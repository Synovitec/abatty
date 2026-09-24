/**
 * Whose failure a red test step is (standard TEST.6). An adopter's pushes were refused four times
 * in a day with no refusal caused by the pushed change: a browser test that failed on timing read
 * exactly like one this push broke, and the only way to tell was to read the whole log. With the
 * step's output kept (src/core/tee-step.mjs), the failing test files are read out of it, set
 * against the files the push changed, and said: this push's, or not touched by it and likely a
 * flake or the environment, with the file to rerun alone. A file that fails untouched on more
 * than one commit is recorded and named as a quarantine candidate. Never retried away: TEST.6
 * says a flaky test is quarantined with an owner and a date, and this says which one to start with.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readJsonFile, writeJsonFile } from "./repo.mjs";

/** Where the untouched failures are counted, per test file, by the commits they failed on. */
export const FLAKES = ".abatty/flakes.json";

/**
 * A failing test file as the runners print one: Playwright's `✘`/numbered `[project] › file`,
 * vitest's and jest's `FAIL file`, Node's `test at file:line`.
 */
const FAILED =
  /(?:^|\s)(?:FAIL|✘|×|\d+\)|test at)\s+(?:\d+\s+)?(?:\[[^\]\n]+\]\s+›\s+)?([\w./\\@-]+\.(?:spec|test|e2e)\.[cm]?[jt]sx?)/gm;

/**
 * The test files a step's output reports as failing, repository-relative with forward slashes.
 * @param {string} text @returns {string[]}
 */
export function failingTestFiles(text) {
  // Colours are codes around the words, and a coloured `FAIL` is still one.
  const plain = text.replace(/\x1b\[[0-9;]*m/g, "");
  return [
    ...new Set(
      [...plain.matchAll(FAILED)].map((m) => String(m[1]).replace(/\\/g, "/").replace(/^\.\//, "")),
    ),
  ].sort();
}

/**
 * What a failed step says about itself: which failing test files this push touched, which it did
 * not, and which of those have failed untouched before (the count is written here).
 * @param {{ repoDir: string, log: string, changed: string[], head: string }} o
 * @returns {string[]} the lines to print, empty when the output names no test file
 */
export function explainFailure(o) {
  if (!existsSync(o.log)) return [];
  const failing = failingTestFiles(readFileSync(o.log, "utf8"));
  if (!failing.length) return [];
  const touched = failing.filter((f) => o.changed.includes(f));
  const untouched = failing.filter((f) => !o.changed.includes(f));
  /** @type {Record<string, string[]>} */
  const seen = readJsonFile(o.repoDir, FLAKES) || {};
  for (const f of untouched) seen[f] = [...new Set([...(seen[f] || []), o.head])].slice(-20);
  if (untouched.length) writeJsonFile(o.repoDir, FLAKES, seen);
  const repeat = untouched.filter((f) => (seen[f] || []).length > 1);
  const lines = [];
  if (touched.length) lines.push(`  failing, and this push changed them: ${touched.join(", ")}`);
  if (untouched.length)
    lines.push(
      `  failing, and this push did not touch them: ${untouched.join(", ")} · likely a flake or the environment rather than this change; rerun one alone to tell`,
    );
  if (repeat.length)
    lines.push(
      `  failed untouched on more than one commit: ${repeat.map((f) => `${f} (${(seen[f] || []).length})`).join(", ")} · quarantine it with an owner and a date (TEST.6), never retry it away (${join(".abatty", "flakes.json")})`,
    );
  return lines;
}
