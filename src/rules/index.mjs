/**
 * The rule catalog: every check abatty makes, as data. A rule says what must hold (the
 * standard's statement and the reason), how strongly (must or should), what insures it today
 * (hard, ratchet, review, prose), when the plan adopts it (the phase), and carries the check
 * that reads a repository and returns a finding. `measure` runs the catalog; `rules` lists it;
 * `explain` opens one rule against a repository.
 *
 * The rules come from profiles (src/profiles): the built-in `synovitec` profile is the standard
 * the package was built on; a repository names the profiles it follows in its config. It
 * extends the catalog with its own rules from `abatty.rules.mjs` at its root (the path is
 * configurable through the config → rules.local) and waives a rule with a reason through
 * rules.waived. A waived rule is listed, not scored.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { readAdoption } from "../core/repo.mjs";
import { synovitec } from "../profiles/synovitec.mjs";
import { catalogOf, loadProfiles, phasesOf } from "../profiles/index.mjs";
import { validate } from "./validate.mjs";

export { validate };

/**
 * @typedef {"present" | "partial" | "missing" | "n/a" | "waived"} Status
 * @typedef {"must" | "should"} Level
 * @typedef {"hard" | "ratchet" | "review" | "prose"} Enforcement
 * @typedef {{ status: Status, evidence: string, next?: string }} Verdict
 * @typedef {import("./context.mjs").RepoContext} RepoContext
 *
 * @typedef {object} Rule
 * @property {string} id the check's ID, FAMILY-NAME, unique across the catalog
 * @property {string} family the family the reports group by
 * @property {string} title the rule in one line
 * @property {string[]} [standard] the standard's rule IDs this check holds (CODE.6, DOC.2 ...)
 * @property {Level} level must, or should
 * @property {Enforcement} enforcement what insures it once present: hard (a machine refuses), ratchet (a number that may only fall), review (a checklist item), prose
 * @property {string} phase the adoption plan phase that installs it ("0", "A.1", "-" for none)
 * @property {string} why the reason, one or two sentences
 * @property {string} next what to do when the finding is not present
 * @property {string} [when] where the rule applies, as a sentence for the catalog ("a repository with a database"); absent means always
 * @property {(ctx: RepoContext) => boolean | string} [applies] true where the rule applies; a string is the reason it does not (the finding is n/a with it), false a bare n/a
 * @property {import("./stage.mjs").Stage[]} [stages] the stages the rule belongs to (design, build, run); absent means every stage
 * @property {(ctx: RepoContext) => Verdict} check the finding for a repository
 * @property {string} [source] "abatty" for the built-in rules, the file path for a repository's own
 *
 * @typedef {Rule & { waived?: { reason: string, until?: string } }} CatalogRule
 * @typedef {{ id: string, family: string, rule: string, status: Status, evidence: string, next: string, phase: string, level: Level, enforcement: Enforcement, standard: string[], when?: string, stages?: string[] }} Finding
 */

/** The built-in rules (the `synovitec` profile's), in the order the reports print them. @type {Rule[]} */
export const RULES = synovitec.rules.map((r) => ({ source: "abatty", ...r }));

/** The families, in catalog order. */
export const FAMILIES = [...new Set(RULES.map((r) => r.family))];

/** @param {string} id @param {Rule[]} [catalog] */
export function ruleById(id, catalog = RULES) {
  const key = id.toUpperCase();
  return catalog.find((r) => r.id.toUpperCase() === key) || null;
}

/**
 * The rules file of a repository: `abatty.rules.mjs` at the root, or the path named by
 * adoption.json → rules.local. Exports `rules` (an array) or a default array. Returns the
 * loaded rules and the problems found; a missing file is neither.
 * @param {string} repoDir @param {Record<string, any> | null} adoption @param {Rule[]} [base] the profiles' rules a local one may not redefine
 * @returns {Promise<{ file: string | null, rules: Rule[], problems: string[] }>}
 */
export async function loadLocalRules(repoDir, adoption, base = RULES) {
  const relPath = String(adoption?.rules?.local || "abatty.rules.mjs");
  const file = resolve(repoDir, relPath);
  if (!existsSync(file)) return { file: null, rules: [], problems: [] };
  try {
    const mod = await import(pathToFileURL(file).href + `?t=${Date.now()}`);
    /** @type {Rule[] | null} */
    const list = Array.isArray(mod.rules)
      ? mod.rules
      : Array.isArray(mod.default)
        ? mod.default
        : null;
    if (!list)
      return { file: relPath, rules: [], problems: [`${relPath}: export \`rules\` (an array)`] };
    const problems = validate(list).map((p) => `${relPath}: ${p}`);
    const builtIn = new Set(base.map((r) => r.id));
    for (const r of list)
      if (builtIn.has(r.id))
        problems.push(`${relPath}: ${r.id} is a built-in id; waive it instead of redefining it`);
    return {
      file: relPath,
      rules: problems.length ? [] : list.map((r) => ({ ...r, source: relPath })),
      problems,
    };
  } catch (e) {
    return {
      file: relPath,
      rules: [],
      problems: [`${relPath}: ${e instanceof Error ? e.message : String(e)}`],
    };
  }
}

/**
 * The catalog of a repository: the rules of the profiles it names, its own, and the waivers
 * applied. A waiver names a reason; one with an `until` date in the past no longer waives.
 * @param {string} repoDir @param {{ adoption?: Record<string, any> | null, today?: string }} [o]
 * @returns {Promise<{ rules: CatalogRule[], localFile: string | null, problems: string[], profiles: string[], phases: import("../profiles/index.mjs").Phase[] }>}
 */
export async function loadCatalog(repoDir, o = {}) {
  const adoption = o.adoption === undefined ? readAdoption(repoDir) : o.adoption;
  const loaded = await loadProfiles(repoDir, adoption);
  const base = catalogOf(loaded.profiles);
  const local = await loadLocalRules(repoDir, adoption, base);
  const today = o.today || new Date().toISOString().slice(0, 10);
  /** @type {Record<string, { reason?: string, until?: string } | string>} */
  const waived = adoption?.rules?.waived || {};
  const problems = [...loaded.problems, ...local.problems];
  const known = new Set([...base, ...local.rules].map((r) => r.id));
  for (const id of Object.keys(waived))
    if (!known.has(id)) problems.push(`rules.waived: ${id} is not a rule`);
  const rules = [...base, ...local.rules].map((r) => {
    const w = waived[r.id];
    if (!w) return r;
    const reason = typeof w === "string" ? w : String(w.reason || "");
    const until = typeof w === "string" ? undefined : w.until;
    if (!reason) problems.push(`rules.waived: ${r.id} needs a reason`);
    if (until && until < today) return r;
    return { ...r, waived: until ? { reason, until } : { reason } };
  });
  return {
    rules,
    localFile: local.file,
    problems,
    profiles: loaded.profiles.map((p) => p.id),
    phases: phasesOf(loaded.profiles),
  };
}

/**
 * Run a catalog against a context: one finding per rule, in catalog order. A rule of another
 * stage is n/a with the stage named; a rule that says where it applies is asked next: where it
 * does not, the finding is n/a with the reason and the check does not run. A check that throws is a finding too (status missing, the error as
 * evidence), never a crash of the measurement.
 * @param {RepoContext} ctx @param {CatalogRule[]} [catalog]
 * @returns {Finding[]}
 */
export function runCatalog(ctx, catalog = RULES) {
  return catalog.map((r) => {
    /** @type {Verdict} */
    let v;
    if (r.waived)
      v = {
        status: "waived",
        evidence: `waived: ${r.waived.reason}${r.waived.until ? " (until " + r.waived.until + ")" : ""}`,
      };
    else {
      try {
        const a =
          r.stages && !r.stages.includes(ctx.stage)
            ? `not at this stage: ${ctx.stage} (a rule of the ${r.stages.join(" and ")} stage${r.stages.length > 1 ? "s" : ""})`
            : r.applies
              ? r.applies(ctx)
              : true;
        v =
          a === true
            ? r.check(ctx)
            : {
                status: "n/a",
                evidence: `does not apply: ${typeof a === "string" && a ? a : "not this repository"}`,
              };
      } catch (e) {
        v = {
          status: "missing",
          evidence: `check failed: ${e instanceof Error ? e.message : String(e)}`,
        };
      }
    }
    return {
      id: r.id,
      family: r.family,
      rule: r.title,
      status: v.status,
      evidence: String(v.evidence),
      next: v.next || r.next,
      phase: r.phase,
      level: r.level,
      enforcement: r.enforcement,
      standard: r.standard || [],
      when: r.when || "always",
      stages: r.stages || ["design", "build", "run"],
    };
  });
}

/**
 * The enforced share: of the rules a repository has (present or partial), the part a machine
 * holds (hard, ratchet) against the part only a reviewer or a sentence holds (review, prose).
 * The number that says how much of a written standard is actually enforced; the rules under
 * review or prose are what a night moves up a level next.
 * @param {Finding[]} findings
 * @returns {{ share: number | null, total: number, hard: number, ratchet: number, review: number, prose: number, promotable: string[] }}
 */
export function enforcedOf(findings) {
  const held = findings.filter((f) => f.status === "present" || f.status === "partial");
  /** @param {Enforcement} e */
  const n = (e) => held.filter((f) => f.enforcement === e).length;
  const hard = n("hard");
  const ratchet = n("ratchet");
  const review = n("review");
  const prose = n("prose");
  const total = held.length;
  return {
    share: total ? Math.round((100 * (hard + ratchet)) / total) : null,
    total,
    hard,
    ratchet,
    review,
    prose,
    promotable: held
      .filter((f) => f.enforcement === "review" || f.enforcement === "prose")
      .map((f) => f.id),
  };
}

/** The score of a list of findings: present = 1, partial = 0.5, over the applicable ones. @param {Finding[]} findings */
export function scoreOf(findings) {
  const applicable = findings.filter((f) => f.status !== "n/a" && f.status !== "waived");
  const score = applicable.length
    ? Math.round(
        (100 *
          applicable.reduce(
            (s, f) => s + (f.status === "present" ? 1 : f.status === "partial" ? 0.5 : 0),
            0,
          )) /
          applicable.length,
      )
    : 0;
  return { score, applicable: applicable.length };
}
