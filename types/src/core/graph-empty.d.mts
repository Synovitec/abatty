/**
 * Why a passing graph step judged nothing, or "" when it read something (or no known tool spoke,
 * or the repository has no script for it to read).
 * @param {string} repoDir @param {string} logFile the step's kept output
 * @returns {string}
 */
export function graphReadNothing(repoDir: string, logFile: string): string;
/**
 * Turn the step's green into "could not run", as a step whose tool is not installed reads: the
 * instrument, not the work, and the gate stops here.
 * @param {import("./gate.mjs").GateEvent[]} events @param {(line: string) => void} log
 * @param {string} why @returns {false}
 */
export function couldNotRead(events: import("./gate.mjs").GateEvent[], log: (line: string) => void, why: string): false;
