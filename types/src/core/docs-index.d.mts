/**
 * One index row per document already under docs/, the index itself and `skip` left out: its
 * path, then what it is for, its category and its status as its front matter says them.
 * @param {string} repoDir @param {string[]} skip paths relative to docs/ that init writes itself
 * @returns {string} the rows, each ending in a newline; "" when there is none
 */
export function existingDocRows(repoDir: string, skip: string[]): string;
/**
 * Add init's two documents to an index the repository already had, each only where the index
 * does not name it yet, and record what was added.
 * @param {string} repoDir @param {import("./init.mjs").InitEvent[]} events @param {boolean} dryRun
 */
export function indexOwnDocs(repoDir: string, events: import("./init.mjs").InitEvent[], dryRun: boolean): void;
