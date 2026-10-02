/**
 * The result as the gate should read it: unchanged, or "could not run" when a failing step's
 * output is a tool saying it had nothing to judge.
 * @param {import("./spawn.mjs").RunResult} res @param {string} logFile the step's kept output
 * @returns {import("./spawn.mjs").RunResult}
 */
export function couldNotRun(res: import("./spawn.mjs").RunResult, logFile: string): import("./spawn.mjs").RunResult;
