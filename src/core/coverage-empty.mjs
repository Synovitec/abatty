/**
 * A coverage step that measured nothing. The step exits 0 whether it judged a thousand lines or
 * none, and a product's `vitest --coverage` over a push that touched nothing under
 * `coverage.include` printed "Unknown% ( 0/0 )" and read green, which is the same colour as a
 * push whose every changed line was covered. The gate cannot know what the step should have
 * measured; it can read what the tool says it measured, and say so when that was nothing.
 *
 * Only a tool's own words for "no data" count. A table row of zeros is not one: a file that
 * exists and is wholly untested reads 0% too, and that is a measurement.
 */
import { readFileSync } from "node:fs";

/**
 * How the coverage tools a profile may name say they measured nothing, each by the tool that
 * prints it. A tool missing here reads as a step that measured something, which is today's
 * behaviour, never a new red.
 * @type {[tool: string, re: RegExp][]}
 */
export const EMPTY_COVERAGE = [
  // The istanbul text summary, which vitest, jest, nyc and c8 print: `Statements : Unknown% ( 0/0 )`.
  ["istanbul", /^\s*(?:Statements|Lines)\s*:\s*Unknown%\s*\(\s*0\s*\/\s*0\s*\)/m],
  // coverage.py, and pytest-cov through it.
  ["coverage.py", /\bNo data (?:to report|was collected)\b/],
  // go test -cover over a package with no statements.
  ["go", /coverage: \[no statements\]/],
];

/**
 * What a passing coverage step's output says it measured, when that was nothing: the tool and
 * its line, or null when the output shows a measurement (or no tool the list knows).
 * @param {string} output
 * @returns {{ tool: string, line: string } | null}
 */
export function measuredNothing(output) {
  for (const [tool, re] of EMPTY_COVERAGE) {
    const m = re.exec(output);
    if (m) return { tool, line: m[0].trim() };
  }
  return null;
}

/**
 * Mark a green coverage step whose kept output says it measured nothing, so the verdict says so,
 * and say it on the log. The step stands as it ran when there is no log to read.
 * @param {string} file the step's kept output
 * @param {import("./gate.mjs").GateEvent[]} events the gate's, the step's own last
 * @param {(line: string) => void} log
 */
export function markHollow(file, events, log) {
  let text = "";
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return;
  }
  const none = measuredNothing(text);
  const last = events[events.length - 1];
  if (!none || !last) return;
  last.empty = `${none.tool}: ${none.line}`;
  last.detail = `measured nothing (${last.empty})`;
  log(
    `· ${last.label} passed and measured nothing: ${none.line}. The changed lines lie outside what the step's tool includes, or it ran no test; green here proves nothing about them`,
  );
}

/**
 * How the unit runners say they ran no test while exiting 0. `node --test` with no test file
 * prints `# tests 0` (or `ℹ tests 0`) and passes, and the unit step read green having judged
 * nothing. vitest, jest and bun exit non-zero there and are read as they are today.
 * @type {[tool: string, re: RegExp][]}
 */
const NO_TESTS = [["node --test", /^(?:#|ℹ)\s*tests 0\s*$/m]];

/**
 * Mark a green unit step whose output says it ran no test, as markHollow does for coverage.
 * @param {string} file @param {import("./gate.mjs").GateEvent[]} events @param {(line: string) => void} log
 */
export function markNoTests(file, events, log) {
  let text = "";
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return;
  }
  const hit = NO_TESTS.find(([, re]) => re.test(text));
  const last = events[events.length - 1];
  if (!hit || !last) return;
  last.empty = `${hit[0]}: tests 0`;
  last.detail = "ran no test";
  log(
    `· ${last.label} passed and ran no test (${hit[0]} found none): green here proves nothing; add a test file the runner finds`,
  );
}
