/**
 * The rule catalog: every check abatty makes, as data. A rule says what must hold (the
 * standard's statement and the reason), how strongly (must or should), what insures it today
 * (hard, ratchet, review, prose), when the plan adopts it (the phase), and carries the check
 * that reads a repository and returns a finding. `measure` runs the catalog; `rules` lists it;
 * `explain` opens one rule against a repository.
 *
 * A repository extends the catalog with its own rules from `abatty.rules.mjs` at its root (the
 * path is configurable through adoption.json → rules.local) and waives a rule with a reason
 * through adoption.json → rules.waived. A waived rule is listed, not scored.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { readAdoption } from "../core/repo.mjs";
import { rules as documents } from "./families/documents.mjs";
import { rules as instrument } from "./families/instrument.mjs";
import { rules as harness } from "./families/harness.mjs";
import { rules as code } from "./families/code.mjs";
import { rules as types } from "./families/types.mjs";
import { rules as boundaries } from "./families/boundaries.mjs";
import { rules as data } from "./families/data.mjs";
import { rules as tests } from "./families/tests.mjs";
import { rules as security } from "./families/security.mjs";
import { rules as delivery } from "./families/delivery.mjs";
import { rules as platform } from "./families/platform.mjs";

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
 * @property {string[]} [standard] the standard's rule IDs this check holds (CODE-6, DOC-2 ...)
 * @property {Level} level must, or should
 * @property {Enforcement} enforcement what insures it once present: hard (a machine refuses), ratchet (a number that may only fall), review (a checklist item), prose
 * @property {string} phase the adoption plan phase that installs it ("0", "A.1", "-" for none)
 * @property {string} why the reason, one or two sentences
 * @property {string} next what to do when the finding is not present
 * @property {(ctx: RepoContext) => Verdict} check the finding for a repository
 * @property {string} [source] "abatty" for the built-in rules, the file path for a repository's own
 *
 * @typedef {Rule & { waived?: { reason: string, until?: string } }} CatalogRule
 * @typedef {{ id: string, family: string, rule: string, status: Status, evidence: string, next: string, phase: string, level: Level, enforcement: Enforcement, standard: string[] }} Finding
 */

/** The built-in rules, in the order the reports print them. @type {Rule[]} */
export const RULES = [
  ...documents,
  ...instrument,
  ...harness,
  ...code,
  ...types,
  ...boundaries,
  ...data,
  ...tests,
  ...security,
  ...delivery,
  ...platform,
].map((r) => ({ source: "abatty", ...r }));

/** The families, in catalog order. */
export const FAMILIES = [...new Set(RULES.map((r) => r.family))];

/** @param {string} id @param {Rule[]} [catalog] */
export function ruleById(id, catalog = RULES) {
  const key = id.toUpperCase();
  return catalog.find((r) => r.id.toUpperCase() === key) || null;
}

/** The problems a rule list has, as messages; none for a well-formed catalog. @param {Rule[]} list */
export function validate(list) {
  /** @type {string[]} */
  const problems = [];
  const seen = new Set();
  for (const r of list) {
    const where = r?.id || "(no id)";
    if (!r || typeof r !== "object") problems.push("a rule is not an object");
    else {
      if (!/^[A-Z0-9]+-[A-Z0-9-]+$/.test(String(r.id || "")))
        problems.push(`${where}: id must be FAMILY-NAME in capitals`);
      if (seen.has(r.id)) problems.push(`${where}: duplicate id`);
      seen.add(r.id);
      for (const k of ["family", "title", "phase", "why", "next"])
        if (typeof (/** @type {any} */ (r)[k]) !== "string" || !(/** @type {any} */ (r)[k]))
          problems.push(`${where}: ${k} must be a non-empty string`);
      if (!["must", "should"].includes(r.level))
        problems.push(`${where}: level must be must|should`);
      if (!["hard", "ratchet", "review", "prose"].includes(r.enforcement))
        problems.push(`${where}: enforcement must be hard|ratchet|review|prose`);
      if (typeof r.check !== "function") problems.push(`${where}: check must be a function`);
      if (r.standard && !Array.isArray(r.standard))
        problems.push(`${where}: standard must be an array`);
    }
  }
  return problems;
}

/**
 * The rules file of a repository: `abatty.rules.mjs` at the root, or the path named by
 * adoption.json → rules.local. Exports `rules` (an array) or a default array. Returns the
 * loaded rules and the problems found; a missing file is neither.
 * @param {string} repoDir @param {Record<string, any> | null} adoption
 * @returns {Promise<{ file: string | null, rules: Rule[], problems: string[] }>}
 */
export async function loadLocalRules(repoDir, adoption) {
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
    const builtIn = new Set(RULES.map((r) => r.id));
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
 * The catalog of a repository: the built-in rules, its own, and the waivers applied. A waiver
 * names a reason; one with an `until` date in the past no longer waives.
 * @param {string} repoDir @param {{ adoption?: Record<string, any> | null, today?: string }} [o]
 * @returns {Promise<{ rules: CatalogRule[], localFile: string | null, problems: string[] }>}
 */
export async function loadCatalog(repoDir, o = {}) {
  const adoption = o.adoption === undefined ? readAdoption(repoDir) : o.adoption;
  const local = await loadLocalRules(repoDir, adoption);
  const today = o.today || new Date().toISOString().slice(0, 10);
  /** @type {Record<string, { reason?: string, until?: string } | string>} */
  const waived = adoption?.rules?.waived || {};
  const problems = [...local.problems];
  const known = new Set([...RULES, ...local.rules].map((r) => r.id));
  for (const id of Object.keys(waived))
    if (!known.has(id)) problems.push(`rules.waived: ${id} is not a rule`);
  const rules = [...RULES, ...local.rules].map((r) => {
    const w = waived[r.id];
    if (!w) return r;
    const reason = typeof w === "string" ? w : String(w.reason || "");
    const until = typeof w === "string" ? undefined : w.until;
    if (!reason) problems.push(`rules.waived: ${r.id} needs a reason`);
    if (until && until < today) return r;
    return { ...r, waived: until ? { reason, until } : { reason } };
  });
  return { rules, localFile: local.file, problems };
}

/**
 * Run a catalog against a context: one finding per rule, in catalog order. A check that throws
 * is a finding too (status missing, the error as evidence), never a crash of the measurement.
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
        v = r.check(ctx);
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
    };
  });
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
