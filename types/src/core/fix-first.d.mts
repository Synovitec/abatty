/**
 * The lines of the "fix these first" block, most urgent first; empty when nothing is urgent.
 * @param {string} repoDir @param {import("../rules/index.mjs").Finding[]} findings the reading's
 * @returns {string[]}
 */
export function fixFirst(repoDir: string, findings: import("../rules/index.mjs").Finding[]): string[];
