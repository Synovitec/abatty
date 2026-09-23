/**
 * Score a scanner against the corpus. Precision is the share of what it reported that is really
 * a secret; recall is the share of the secrets it found. A scanner is judged on both: one that
 * reports everything has perfect recall and is switched off within a week.
 * @param {(text: string, path: string) => unknown[]} scan a scanner over one text and the path it sits in, returning its findings
 * @returns {{ precision: number, recall: number, truePositives: number, falsePositives: Case[], falseNegatives: Case[], total: number }}
 */
export function scoreCorpus(scan: (text: string, path: string) => unknown[]): {
    precision: number;
    recall: number;
    truePositives: number;
    falsePositives: Case[];
    falseNegatives: Case[];
    total: number;
};
/** Shapes the scan must report. @type {Case[]} */
export const POSITIVES: Case[];
/** Shapes that look like a secret and are not: the cases that decide whether people keep the scan on. @type {Case[]} */
export const NEGATIVES: Case[];
/** Every case, positives first. @type {Case[]} */
export const CORPUS: Case[];
/**
 * `path`: the file the text sits in, where the reading depends on it
 */
export type Case = {
    text: string;
    secret: boolean;
    why: string;
    path?: string;
};
