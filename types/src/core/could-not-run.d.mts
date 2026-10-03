/**
 * The result as the gate should read it: unchanged, or "could not run" when a failing step's
 * output is a tool saying it had nothing to judge.
 * @param {import("./spawn.mjs").RunResult} res @param {string} logFile the step's kept output
 * @returns {import("./spawn.mjs").RunResult}
 */
export function couldNotRun(res: import("./spawn.mjs").RunResult, logFile: string): import("./spawn.mjs").RunResult;
/**
 * A step the preset requires, with no script or config to run: the instrument itself is missing,
 * so the gate cannot run, and says what to write. A repository whose every step was skipped for
 * want of a script read "gate green" and exited 0; the reviewer who found it called it the other
 * half of the false green. Recorded as errored, and said once.
 * @param {{ label: string, what: string, presetId: string, workspace: boolean }} step
 * @param {import("./gate.mjs").GateEvent[]} events @param {(line: string) => void} log
 */
export function requiredAbsent(step: {
    label: string;
    what: string;
    presetId: string;
    workspace: boolean;
}, events: import("./gate.mjs").GateEvent[], log: (line: string) => void): void;
