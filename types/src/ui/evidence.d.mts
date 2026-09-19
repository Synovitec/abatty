/**
 * @param {{ findings: import("../rules/index.mjs").Finding[], name: string, date: string, commit: string, version: string, score: number }} o
 * @returns {string}
 */
export function renderEvidence(o: {
    findings: import("../rules/index.mjs").Finding[];
    name: string;
    date: string;
    commit: string;
    version: string;
    score: number;
}): string;
