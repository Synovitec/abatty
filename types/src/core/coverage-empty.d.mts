/**
 * What a passing coverage step's output says it measured, when that was nothing: the tool and
 * its line, or null when the output shows a measurement (or no tool the list knows).
 * @param {string} output
 * @returns {{ tool: string, line: string } | null}
 */
export function measuredNothing(output: string): {
    tool: string;
    line: string;
} | null;
/**
 * Mark a green coverage step whose kept output says it measured nothing, so the verdict says so,
 * and say it on the log. The step stands as it ran when there is no log to read.
 * @param {string} file the step's kept output
 * @param {import("./gate.mjs").GateEvent[]} events the gate's, the step's own last
 * @param {(line: string) => void} log
 */
export function markHollow(file: string, events: import("./gate.mjs").GateEvent[], log: (line: string) => void): void;
/**
 * How the coverage tools a profile may name say they measured nothing, each by the tool that
 * prints it. A tool missing here reads as a step that measured something, which is today's
 * behaviour, never a new red.
 * @type {[tool: string, re: RegExp][]}
 */
export const EMPTY_COVERAGE: [tool: string, re: RegExp][];
