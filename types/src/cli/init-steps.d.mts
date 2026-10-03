/**
 * A step: what it says, and the command that takes it when a machine safely can.
 * @typedef {{ text: string, run?: string[], note?: boolean }} InitStep a `note` is what the gate
 * skips until the repository adds it: said apart, never numbered as something to do
 */
/**
 * Say the steps; with `apply`, take each one that has a command, in order, until one fails. The
 * rest are said as before, numbered from one, so the list a reader is left with is only theirs.
 * @param {InitStep[]} steps @param {{ dir: string, apply: boolean, out: (s: string) => void }} o
 * @returns {number} 0 when every step it took passed, else the failing step's exit code (4 when it
 * could not start), so a first gate that found something reads as found (3), not as broken
 */
export function finishSteps(steps: InitStep[], o: {
    dir: string;
    apply: boolean;
    out: (s: string) => void;
}): number;
/**
 * a `note` is what the gate
 * skips until the repository adds it: said apart, never numbered as something to do
 */
export type InitStep = {
    text: string;
    run?: string[];
    note?: boolean;
};
