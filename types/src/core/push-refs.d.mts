/**
 * @typedef {{ local: string, localSha: string, remote: string, remoteSha: string }} PushLine
 * @typedef {{ judge: PushLine[], skipped: string[], refused: string[] }} PushPlan
 */
/** The lines a pre-push hook receives, parsed; malformed lines are dropped. @param {string} text @returns {PushLine[]} */
export function pushLines(text: string): PushLine[];
/**
 * What to do with each ref of a push, against the commit checked out here.
 * @param {PushLine[]} lines @param {string} head the checked-out commit's sha
 * @returns {PushPlan}
 */
export function pushPlan(lines: PushLine[], head: string): PushPlan;
/**
 * The range a judged ref adds: from what the remote had, or from where the branch left `base`
 * for a new branch (the remote sha all zeros).
 * @param {PushLine} l @param {string} mergeBase the merge base with the base branch, "" when none
 */
export function refRange(l: PushLine, mergeBase: string): string;
export type PushLine = {
    local: string;
    localSha: string;
    remote: string;
    remoteSha: string;
};
export type PushPlan = {
    judge: PushLine[];
    skipped: string[];
    refused: string[];
};
