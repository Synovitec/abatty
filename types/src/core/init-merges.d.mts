/**
 * Append the lines a file lacks, keeping every line it has, and record what was added.
 * @param {string} repoDir @param {string} rel @param {string[]} lines
 * @param {import("./init.mjs").InitEvent[]} events @param {boolean} dryRun
 */
export function appendLines(repoDir: string, rel: string, lines: string[], events: import("./init.mjs").InitEvent[], dryRun: boolean): void;
/**
 * The keys a merge put in or changed, as a merged line says them. A key whose value it replaced
 * (under --force) counts; one the repository already had and kept does not.
 * @param {Record<string, unknown>} after @param {Record<string, unknown>} before @param {string} kind
 * @returns {string} "" when nothing changed
 */
export function added(after: Record<string, unknown>, before: Record<string, unknown>, kind: string): string;
