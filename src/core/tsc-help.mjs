/**
 * A typecheck that found no project. `tsc --noEmit` in a folder with no tsconfig.json prints its
 * whole help screen and exits 1, and the gate read that as a typecheck that failed: the work
 * judged red, by a compiler that judged nothing. The help screen is the compiler saying it had
 * nothing to check, so the step could not run, as a step whose tool is not installed reads.
 */
import { readFileSync } from "node:fs";

/** The help screen's own header: `tsc: The TypeScript Compiler - Version 5.6.3`. */
const HELP = /^tsc: The TypeScript Compiler - Version \S+\s*$[\s\S]*^COMMON COMMANDS\s*$/m;

/**
 * The result as the gate should read it: unchanged, or "could not run" when a failing step's
 * output is tsc's help screen.
 * @param {import("./spawn.mjs").RunResult} res @param {string} logFile the step's kept output
 * @returns {import("./spawn.mjs").RunResult}
 */
export function tscFoundNoProject(res, logFile) {
  if (!res.code || res.errored) return res;
  let text = "";
  try {
    text = readFileSync(logFile, "utf8");
  } catch {
    return res;
  }
  if (!HELP.test(text)) return res;
  return {
    ...res,
    errored: true,
    detail:
      "tsc printed its help: it found no tsconfig.json to check. Add the project's tsconfig.json, or point the typecheck script at one (tsc -p <file>)",
  };
}
