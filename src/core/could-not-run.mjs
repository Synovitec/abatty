/**
 * A failing step whose tool said it had nothing to judge. A tool exits non-zero for two different
 * reasons, and the gate read both as the work going red: `tsc --noEmit` with no tsconfig.json
 * prints its help screen and exits 1, and dependency-cruiser with no known-violations file says it
 * cannot open it. Neither judged a line. Each is read here by the tool's own words and turned into
 * "could not run" with what to do, as a step whose tool is not installed reads.
 */
import { readFileSync } from "node:fs";

/** The tools' own words for "I had nothing to judge", each with what to do about it. */
const NOTHING = /** @type {[RegExp, string][]} */ ([
  [
    /^tsc: The TypeScript Compiler - Version \S+\s*$[\s\S]*^COMMON COMMANDS\s*$/m,
    "tsc printed its help: it found no tsconfig.json to check. Add the project's tsconfig.json, or point the typecheck script at one (tsc -p <file>)",
  ],
  [
    /Can't open '\.dependency-cruiser-known-violations\.json' for reading/,
    "dependency-cruiser has no known-violations baseline to compare with. Record today's once: the graph script's depcruise command with --baseline in place of its output flags (init's steps print it), and commit the file",
  ],
]);

/**
 * The result as the gate should read it: unchanged, or "could not run" when a failing step's
 * output is a tool saying it had nothing to judge.
 * @param {import("./spawn.mjs").RunResult} res @param {string} logFile the step's kept output
 * @returns {import("./spawn.mjs").RunResult}
 */
export function couldNotRun(res, logFile) {
  if (!res.code || res.errored) return res;
  let text = "";
  try {
    text = readFileSync(logFile, "utf8");
  } catch {
    return res;
  }
  const hit = NOTHING.find(([re]) => re.test(text));
  return hit ? { ...res, errored: true, detail: hit[1] } : res;
}

/**
 * A step the preset requires, with no script or config to run: the instrument itself is missing,
 * so the gate cannot run, and says what to write. A repository whose every step was skipped for
 * want of a script read "gate green" and exited 0; the reviewer who found it called it the other
 * half of the false green. Recorded as errored, and said once.
 * @param {{ label: string, what: string, presetId: string, workspace: boolean }} step
 * @param {import("./gate.mjs").GateEvent[]} events @param {(line: string) => void} log
 */
export function requiredAbsent(step, events, log) {
  const { label, what, presetId, workspace } = step;
  events.push({
    label,
    outcome: "errored",
    detail: `${what}: a step the ${presetId} preset requires`,
  });
  log(
    `\n✗ ${label} could not run: ${what}, and the ${presetId} preset requires this step. Write it in ${workspace ? "the workspace's" : "the"} package.json (init writes the scripts the preset defines; a test script runs the ${workspace ? "workspace's" : "repository's"} own runner, which only it knows), or the gate cannot run. This is the instrument, not the work.`,
  );
}
