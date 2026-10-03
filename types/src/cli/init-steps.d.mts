/**
 * A step: what it says, and the command that takes it when a machine safely can.
 * @typedef {{ text: string, run?: string[] }} InitStep
 */
/**
 * Say the steps; with `apply`, take each one that has a command, in order, until one fails. The
 * rest are said as before, numbered from one, so the list a reader is left with is only theirs.
 * @param {InitStep[]} steps @param {{ dir: string, apply: boolean, out: (s: string) => void }} o
 * @returns {boolean} false when a step it took failed
 */
export function finishSteps(steps: InitStep[], o: {
    dir: string;
    apply: boolean;
    out: (s: string) => void;
}): boolean;
/**
 * A step: what it says, and the command that takes it when a machine safely can.
 */
export type InitStep = {
    text: string;
    run?: string[];
};
