/**
 * Earlier night branches, here or on origin, that the base has not taken yet and that worked a
 * phase this night would run: the same phase twice is two answers to reconcile, or the second
 * undoing the first. Tonight's own branch is a resume, not an overlap; a branch the base already
 * contains is done.
 * @param {{ repoDir: string, prefix: string, base: string, branch: string, stateFile: string, phases: string[] }} o
 * @returns {{ ref: string, phases: string[] }[]}
 */
export function openNightWork(o: {
    repoDir: string;
    prefix: string;
    base: string;
    branch: string;
    stateFile: string;
    phases: string[];
}): {
    ref: string;
    phases: string[];
}[];
/**
 * The lines a branch changes against the base, renames read as moves: what a reviewer reads.
 * @param {string} repoDir @param {string} base @param {string} branch @returns {number}
 */
export function changedLineCount(repoDir: string, base: string, branch: string): number;
/** Past this many changed lines a night branch stays local by default: one reading, not a skim. */
export const DEFAULT_MAX_DIFF_LINES: 2000;
