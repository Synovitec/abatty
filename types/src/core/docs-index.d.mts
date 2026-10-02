/**
 * One index row per document already under docs/, the index itself and `skip` left out: its
 * path, then what it is for, its category and its status as its front matter says them.
 * @param {string} repoDir @param {string[]} skip paths relative to docs/ that init writes itself
 * @returns {string} the rows, each ending in a newline; "" when there is none
 */
export function existingDocRows(repoDir: string, skip: string[]): string;
