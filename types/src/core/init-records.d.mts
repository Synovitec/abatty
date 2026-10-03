/**
 * Write the records where they are absent; an index the repository already kept learns of the
 * two documents written beside it.
 * @param {(rel: string, text: string) => boolean} put init's writer: true when it wrote
 * @param {string} repoDir @param {import("./init.mjs").InitEvent[]} events @param {boolean} dryRun
 */
export function writeRecords(put: (rel: string, text: string) => boolean, repoDir: string, events: import("./init.mjs").InitEvent[], dryRun: boolean): void;
