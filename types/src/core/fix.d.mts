/**
 * What `fix` would do for a phase: one step per rule of that phase with a fixer, skipped when the
 * rule already holds. Nothing is written here.
 * @param {{ repoDir: string, findings: import("../rules/index.mjs").Finding[], phase: string, name: string, date: string }} o
 * @returns {FixStep[]}
 */
export function planFix(o: {
    repoDir: string;
    findings: import("../rules/index.mjs").Finding[];
    phase: string;
    name: string;
    date: string;
}): FixStep[];
/**
 * Write the steps, and keep the index equal to the tree in the same pass: a document that lands
 * without its row trades one finding for another, which is the failure a fixer must never have.
 * @param {string} repoDir @param {FixStep[]} steps
 * @returns {string[]} the paths written
 */
export function applyFix(repoDir: string, steps: FixStep[]): string[];
/** @type {Fixer[]} */
export const FIXERS: Fixer[];
export type Fixer = {
    rule: string;
    path: string;
    why: string;
    whenMissing?: boolean;
    text: (o: {
        name: string;
        date: string;
    }) => string;
};
export type FixStep = {
    rule: string;
    path: string;
    why: string;
    action: "write" | "held";
    text: string;
};
