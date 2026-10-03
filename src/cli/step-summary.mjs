/**
 * The gate's verdict on the page of the CI run: GitHub renders whatever a job appends to the file
 * `GITHUB_STEP_SUMMARY` names. An outside review found abatty invisible where a pull request is
 * decided: SARIF puts findings on the changed lines, and nothing said whether the gate held or
 * which steps did not run. A provider without that file gets nothing, and a write that fails
 * never turns the gate's own verdict.
 */
import { appendFileSync } from "node:fs";
import { stepSummaryFromEnv } from "../core/env.mjs";

/** @type {Record<string, string>} */
const MARK = { ok: "✅", failed: "❌", errored: "⚠️", deferred: "⏭️", skipped: "➖" };

/**
 * The summary in markdown: the headline, then one row per step with what it said.
 * @param {string} headline @param {import("../core/gate.mjs").GateEvent[]} events @returns {string}
 */
export function stepSummary(headline, events) {
  const cell = (/** @type {string} */ s) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");
  const rows = events.map(
    (e) =>
      `| ${MARK[e.outcome] || ""} | ${cell(e.label)} | ${e.outcome}${e.empty ? " (nothing to judge)" : ""} | ${cell(e.detail || "")} |`,
  );
  return [
    `### abatty gate: ${headline}`,
    "",
    "| | Step | Outcome | Detail |",
    "| --- | --- | --- | --- |",
    ...rows,
    "",
  ].join("\n");
}

/**
 * Append the summary where the CI provider reads it, when it names a file.
 * @param {string} headline @param {import("../core/gate.mjs").GateEvent[]} events
 * @param {string} [file] where the provider reads it; the environment says, else nothing is written
 */
export function writeStepSummary(headline, events, file = stepSummaryFromEnv()) {
  if (!file) return;
  try {
    appendFileSync(file, stepSummary(headline, events) + "\n");
  } catch {
    /* the run page is a courtesy; the gate's exit code is the verdict */
  }
}
