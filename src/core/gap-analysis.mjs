/**
 * Gap analysis of any repository against the engineering standard: the rule catalog run over
 * the repository's context. Reads files and git history, runs nothing of the repository, and
 * returns { repo, name, date, score, applicable, findings, families, waived }. renderMarkdown
 * is the dated report with the standard's front matter; renderSummary the console lines.
 *
 * Status values: present · partial · missing · n/a · waived. The score is present = 1,
 * partial = 0.5 over the applicable checks (not n/a, not waived) - a trend, not a verdict.
 */
import { buildContext } from "../rules/context.mjs";
import { RULES, enforcedOf, loadCatalog, runCatalog, scoreOf, waiverOf } from "../rules/index.mjs";
import { phaseOf, standing } from "../rules/phases.mjs";
import { synovitec } from "../profiles/synovitec.mjs";

/**
 * @typedef {import("../rules/index.mjs").Finding} Finding
 * @typedef {ReturnType<typeof enforcedOf>} Enforced
 * @typedef {ReturnType<typeof waiverOf>} Waivers
 * @typedef {{ repo: string, name: string, date: string, score: number, applicable: number, enforced: Enforced, findings: Finding[], families: string[], waived: number, waivers?: Waivers, problems: string[], profiles: string[], stage: string, stageFrom: string, plan: import("../rules/phases.mjs").PhaseCount[], phase: import("../rules/phases.mjs").PhaseCount | null }} GapResult
 */

/** @param {import("../rules/phases.mjs").PhaseStanding} p the counts a reader sees, without the list behind them */
const counts = (p) => ({
  id: p.id,
  title: p.title,
  held: p.held,
  applicable: p.applicable,
});

/**
 * Run a catalog (the built-in rules by default) over a repository, synchronously.
 * @param {string} repoDir @param {{ today?: string, catalog?: import("../rules/index.mjs").CatalogRule[], problems?: string[], profiles?: string[], phases?: import("../profiles/index.mjs").Phase[] }} [o]
 * @returns {GapResult}
 */
export function analyze(repoDir, o = {}) {
  const ctx = buildContext(repoDir, { today: o.today });
  const findings = runCatalog(ctx, o.catalog || RULES);
  const { score, applicable } = scoreOf(findings);
  // The plan of the profiles this repository follows, narrowed to its stage: a phase that
  // belongs to another stage is not work this repository owes, so it is not in its denominator.
  const plan = (o.phases || synovitec.phases).filter(
    (p) => !p.stages || p.stages.includes(/** @type {any} */ (ctx.stage)),
  );
  const where = standing(findings, plan);
  return {
    repo: ctx.repo,
    name: ctx.name,
    date: ctx.today,
    score,
    applicable,
    enforced: enforcedOf(findings),
    findings,
    families: [...new Set(findings.map((f) => f.family))],
    waived: findings.filter((f) => f.status === "waived").length,
    waivers: waiverOf(findings),
    problems: o.problems || [],
    profiles: o.profiles || ["synovitec"],
    stage: ctx.stage,
    stageFrom: ctx.stageFrom,
    // The counts only: what is left is already in `findings`, and the report and this result
    // then carry the same shape, so a renderer reads either.
    plan: where.phases.map(counts),
    phase: where.current ? counts(where.current) : null,
  };
}

/**
 * Measure a repository with its full catalog: the built-in rules, its own rules file, its
 * waivers. The form every command uses. @param {string} repoDir @param {{ today?: string }} [o]
 */
export async function measure(repoDir, o = {}) {
  const catalog = await loadCatalog(repoDir, { today: o.today });
  return analyze(repoDir, {
    today: o.today,
    catalog: catalog.rules,
    problems: catalog.problems,
    profiles: catalog.profiles,
    phases: catalog.phases,
  });
}

/**
 * The standard's rule IDs in their namespaced form, `FAMILY.N` (a dot): a repository's own
 * rules are `FAMILY-NAME` or `FAMILY-NN`, and a repository's citation check that claims every
 * `FAMILY-NN` token under docs/ must never claim the standard's. The night of 2026-09-14
 * found the collision; the standard retired the hyphen form on 2026-09-15. This rewrites any
 * hyphen form left in a text. @param {string} text
 */
export function stdIds(text) {
  return text.replace(
    /\b(P|AIR|CODE|VALID|DATA|SEC|FLOW|DOC|CHANGE|TEST|API|I18N|CACHE|UI|PWA|OBS|FLAG|CONFIG|AUTH|A11Y)-(\d{1,2})\b/g,
    "$1.$2",
  );
}

/** @param {string} p */
/**
 * The findings still to do, in the plan's own order. Reading the first number out of the phase
 * was the bug: "A.1" is day 0 and read as 1, so the whole of phase 0 was listed ahead of the
 * day-0 work that blocks it. The plan declares its order, and a phase it does not carry sorts
 * last rather than in the middle.
 * @param {Finding[]} findings @param {string[]} [order] the phase ids in plan order
 */
export function todoOf(findings, order = synovitec.phases.map((p) => String(p.id))) {
  const rank = (/** @type {string} */ p) => {
    const id = phaseOf(p, order);
    return id === null ? order.length : order.indexOf(id);
  };
  return findings
    .filter((f) => f.status === "missing" || f.status === "partial")
    .sort((a, b) => rank(a.phase) - rank(b.phase));
}

/**
 * The dated Markdown report for a result of analyze(), with the standard's front matter.
 * @param {GapResult} result
 */
export function renderMarkdown(result) {
  const { findings, families, score, date, name } = result;
  const applicable = findings.filter((f) => f.status !== "n/a" && f.status !== "waived");
  /** @param {string} fam @param {string} st */
  const count = (fam, st) => findings.filter((f) => f.family === fam && f.status === st).length;
  const n = (/** @type {string} */ st) => applicable.filter((f) => f.status === st).length;
  const waived = findings.filter((f) => f.status === "waived");
  const md = [];
  md.push("---");
  md.push(`title: "Gap analysis - ${name} - ${date}"`);
  md.push(
    `description: "Static reading of ${name} against the engineering standard on ${date}: ${score}/100 over ${applicable.length} applicable checks (${n("present")} present, ${n("partial")} partial, ${n("missing")} missing${waived.length ? ", " + waived.length + " waived" : ""}). Generated by abatty measure; a dated record, not a verdict, and the next steps map to the adoption plan's phases."`,
  );
  md.push("category: reference");
  md.push("status: stable");
  md.push('audience: ["architect", "developer"]');
  md.push('tags: ["gap-analysis", "standards", "generated"]');
  md.push('related: ["../CLAUDE.md"]');
  md.push("scope: synovitec");
  md.push(`last_verified: "${date}"`);
  md.push("---");
  md.push("");
  md.push(`# Gap analysis - ${name} - ${date}`);
  md.push("");
  md.push(
    `${result.phase ? `**Phase ${result.phase.id}: ${result.phase.held} of ${result.phase.applicable} held.** ${result.phase.title}. That is the phase this repository is on: the earliest one in the plan with unfinished work, and the number to act on. ` : "**Every phase of the plan is held.** "}The score below is a trend over the whole catalog, including the phases the plan schedules for later, so a young repository is missing most of it by design.`,
  );
  md.push("");
  md.push(
    `**Score ${score}/100** over ${applicable.length} applicable checks of the ${result.profiles.join(", ")} profile${result.profiles.length > 1 ? "s" : ""}, the repository at the ${result.stage} stage${result.stageFrom === "tree" ? " (read from the tree)" : ""}. Present = the mechanism exists; partial = it exists but not to the standard; missing = nothing found; n/a = the rule does not apply to this stack; waived = set aside with a reason in the adoption config. The score is a trend to compare readings, not a grade: a repository with the gate and the ratchet but a long context file scores below one with neither and a short file.`,
    "",
    enforcedLine(result),
  );
  md.push("");
  md.push("| Family | Present | Partial | Missing | n/a | Waived |");
  md.push("|---|---|---|---|---|---|");
  for (const fam of families)
    md.push(
      `| ${fam} | ${count(fam, "present")} | ${count(fam, "partial")} | ${count(fam, "missing")} | ${count(fam, "n/a")} | ${count(fam, "waived")} |`,
    );
  md.push("");
  md.push("## Next steps, in plan order");
  md.push("");
  const todo = todoOf(
    findings,
    result.plan.map((p) => p.id),
  );
  if (todo.length === 0)
    md.push("Nothing missing or partial. Re-run after the next research pass.");
  for (const f of todo)
    md.push(`- **${f.id}** (phase ${f.phase}, ${f.status}, ${f.level}): ${stdIds(f.next)}`);
  md.push("");
  const waivers = result.waivers || waiverOf(findings);
  if (waived.length || waivers.expired.length) {
    md.push("## Waived");
    md.push("");
    md.push(
      `**Waiver rate ${waivers.rate}%**: ${waived.length} of the ${waivers.considered} rules that could apply here are set aside. The rate is worth watching rather than the list: a rule that repository after repository waives is, in all likelihood, a rule that is wrong, and this count is the first input to a false-positive rate the catalog can be judged by. A rule that does not apply to this stack is not counted, because it was never a candidate.`,
    );
    md.push("");
    for (const f of waived) md.push(`- **${f.id}**: ${f.evidence.replace(/^waived: /, "")}`);
    for (const f of waivers.expired)
      md.push(
        `- **${f.id}**: EXPIRED ${f.waiver?.until} and measured again since. It reads **${f.status}**. The reason given was: ${f.waiver?.reason}`,
      );
    md.push("");
  }
  if (result.problems.length) {
    md.push("## Catalog problems");
    md.push("");
    for (const p of result.problems) md.push(`- ${p}`);
    md.push("");
  }
  md.push("## Every check");
  md.push("");
  md.push("| ID | Family | Rule | Level | Insured by | Status | Evidence | Next step | Phase |");
  md.push("|---|---|---|---|---|---|---|---|---|");
  for (const f of findings)
    md.push(
      `| ${f.id} | ${f.family} | ${stdIds(f.rule)} | ${f.level} | ${f.enforcement} | **${f.status}** | ${stdIds(f.evidence).replace(/\|/g, "\\|")} | ${f.status === "present" || f.status === "n/a" || f.status === "waived" ? "-" : stdIds(f.next)} | ${f.phase} |`,
    );
  md.push("");
  md.push("## How to read this");
  md.push("");
  md.push(
    "Static and dependency-free: nothing of the repository was executed, so a present check means the mechanism is there, not that it is green today; run the repository's own gate for that. Rule IDs refer to the engineering standard in their namespaced form (`CODE.12` for the rule the standard numbers 12 in its CODE family), a namespace a repository's own citation check never claims; phases to the adoption plan; the level of insurance each mechanism gives (hard, ratchet, review, prose) is the enforcement map's. `abatty explain <ID>` opens one rule with its reason. Re-run after each phase and keep the dated reports side by side.",
  );
  md.push("");
  return md.join("\n");
}

/** The enforced share as a sentence for the report. @param {GapResult} r */
function enforcedLine(r) {
  const e = r.enforced;
  if (!e || e.share === null) return "**Enforced share**: nothing present yet.";
  // A report saved before the field existed carries none; an old reading is read, never crashed on.
  const atCeiling = e.atCeiling || [];
  const ceiling = atCeiling.length
    ? ` ${atCeiling.length} of them (${atCeiling.slice(0, 6).join(", ")}${atCeiling.length > 6 ? ", ..." : ""}) are at their machine ceiling: no check can hold them harder, and they are out of that queue rather than permanently behind in it.`
    : "";
  return `**Enforced share ${e.share}%**: of the ${e.total} rules this repository has, ${e.hard + e.ratchet} are held by a machine (${e.hard} hard, ${e.ratchet} ratchet) and ${e.review + e.prose} by a reviewer or a sentence (${e.review} review, ${e.prose} prose). The second group is what a night moves up a level next${e.promotable.length ? ": " + e.promotable.slice(0, 8).join(", ") + (e.promotable.length > 8 ? ", ..." : "") : ""}.${ceiling}`;
}

/** The console summary the CLI prints under the report. @param {GapResult} result @param {string} [reportPath] */
export function renderSummary(result, reportPath) {
  const { findings, families, score, date, name } = result;
  /** @param {string} fam @param {string} st */
  const count = (fam, st) => findings.filter((f) => f.family === fam && f.status === st).length;
  const todo = todoOf(
    findings,
    result.plan.map((p) => p.id),
  );
  const e = result.enforced;
  const lines = [
    `Gap analysis · ${name} · ${date} · score ${score}/100 · ${e.share === null ? "nothing present yet" : `${e.share}% of ${e.total} present rules held by a machine (${e.hard} hard, ${e.ratchet} ratchet, ${e.review} review, ${e.prose} prose)`}`,
    "",
  ];
  for (const fam of families)
    lines.push(
      `  ${fam.padEnd(12)} present ${String(count(fam, "present")).padStart(2)}  partial ${String(count(fam, "partial")).padStart(2)}  missing ${String(count(fam, "missing")).padStart(2)}  n/a ${count(fam, "n/a")}`,
    );
  lines.push("", `  ${todo.length} next step(s)${reportPath ? " · report: " + reportPath : ""}`);
  return lines.join("\n") + "\n";
}
