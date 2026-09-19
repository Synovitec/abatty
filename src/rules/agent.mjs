/**
 * A finding as a signal for the model that has to act on it, rather than as a sentence for a
 * person who already knows the codebase. The published definition of a sensor in an agent harness
 * is a signal optimised for consumption by the model and carrying the instruction for its own
 * correction; measured against it, a report that says "Add --max-warnings=0 to the lint script"
 * is prose, and the agent has to guess where, and has no way to know whether it worked.
 *
 * Four fields close that loop. `where` and `why` the catalog already knows. `what` is the rule's
 * own next step, stated as the edit to make. `verify` is the field nothing in the field ships: a
 * command whose exit code proves the edit worked, so the sequence is mechanical - the rule
 * breaks, the gate refuses with an instruction, the agent edits, the agent runs `verify`, and no
 * human is involved until something does not converge.
 */

/**
 * The command that proves one rule holds. It is the rule's own check, run alone: the only thing
 * that can answer "did my edit work" without a human reading a screen, and it cannot drift from
 * the rule because it is the rule.
 * @param {string} id
 */
export const verifyCommand = (id) => `npx abatty check ${id}`;

/**
 * @typedef {{
 *   id: string,
 *   where: { path: string, line?: number } | null,
 *   what: string,
 *   verify: string,
 *   why: string,
 *   status: import("./index.mjs").Status,
 *   evidence: string,
 * }} AgentFinding
 */

/** A path and a line out of a finding's evidence, when it names one. @param {string} evidence */
export function whereOf(evidence) {
  const m =
    /([\w./@-]+\.(?:mjs|cjs|js|ts|tsx|jsx|json|jsonc|md|ya?ml|toml|sh|ps1))(?::(\d+))?/.exec(
      evidence || "",
    );
  if (!m || !m[1]) return null;
  return m[2] ? { path: m[1], line: Number(m[2]) } : { path: m[1] };
}

/**
 * One finding, shaped for the agent that has to fix it.
 * @param {import("./index.mjs").Finding} f @param {{ why?: string }} [rule]
 * @returns {AgentFinding}
 */
export const agentFinding = (f, rule = {}) => ({
  id: f.id,
  // The finding's own `where`, attached once by runCatalog, falling back to the scrape for a
  // finding built by hand. Three surfaces deciding this for themselves is how two of them came
  // to disagree about whether a location was knowable at all.
  where: f.where || whereOf(f.evidence),
  what: f.next,
  verify: verifyCommand(f.id),
  why: rule.why || "",
  status: f.status,
  evidence: f.evidence,
});

/**
 * The findings an agent should act on, in the plan's order: what is missing or partial, never
 * what already holds.
 * @param {import("./index.mjs").Finding[]} findings @param {import("./index.mjs").CatalogRule[]} rules
 */
export const agentFindings = (findings, rules) => {
  const why = new Map(rules.map((r) => [r.id, r.why]));
  return findings
    .filter((f) => f.status === "missing" || f.status === "partial")
    .map((f) => agentFinding(f, { why: why.get(f.id) }));
};
