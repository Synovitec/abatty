/**
 * An import-graph step that read nothing. dependency-cruiser exits 0 when it cruises no module at
 * all, and says "no dependency violations found (0 modules, 0 dependencies cruised)": with
 * TypeScript 7 installed it could not read a single `.ts` file, and the step read green over a
 * repository full of them. A check that reports nothing is indistinguishable from a check that is
 * switched off, so where the repository has scripts the step could have read, it could not run.
 */
import { readFileSync } from "node:fs";
import { git } from "./repo.mjs";
import { SCRIPT } from "./imports.mjs";

/** How the graph tools say they read nothing, by tool. */
const EMPTY_GRAPH = /** @type {[tool: string, re: RegExp][]} */ ([
  ["dependency-cruiser", /\(0 modules, 0 dependencies cruised\)/],
]);

/**
 * Why a passing graph step judged nothing, or "" when it read something (or no known tool spoke,
 * or the repository has no script for it to read).
 * @param {string} repoDir @param {string} logFile the step's kept output
 * @returns {string}
 */
export function graphReadNothing(repoDir, logFile) {
  let text = "";
  try {
    text = readFileSync(logFile, "utf8");
  } catch {
    return "";
  }
  const hit = EMPTY_GRAPH.find(([, re]) => re.test(text));
  if (!hit) return "";
  const scripts = git(repoDir, "ls-files")
    .split("\n")
    .filter((f) => SCRIPT.test(f)).length;
  if (!scripts) return "";
  return `${hit[0]} cruised 0 modules in a repository with ${scripts} tracked script(s): it could not read them (a TypeScript it does not support, or a path it is not given)`;
}

/**
 * Turn the step's green into "could not run", as a step whose tool is not installed reads: the
 * instrument, not the work, and the gate stops here.
 * @param {import("./gate.mjs").GateEvent[]} events @param {(line: string) => void} log
 * @param {string} why @returns {false}
 */
export function couldNotRead(events, log, why) {
  const last = events[events.length - 1];
  if (last) Object.assign(last, { outcome: "errored", detail: why });
  log(
    `\n✗ ${last?.label || "import graph"} could not run: ${why}. The gate stops here, and this is the instrument, not the work.`,
  );
  return false;
}
