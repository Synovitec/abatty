/**
 * Who imports whom over the tracked scripts: the map from a file to the files that import it.
 * @param {string} repoDir @returns {Map<string, string[]>}
 */
export function importersOf(repoDir: string): Map<string, string[]>;
/**
 * Every file that reaches one of `changed` through its imports, the changed files included: the
 * set of tests a push can have broken, read upward from what it changed.
 * @param {Map<string, string[]>} graph @param {string[]} changed @returns {Set<string>}
 */
export function reachedBy(graph: Map<string, string[]>, changed: string[]): Set<string>;
/** A script file this graph reads. */
export const SCRIPT: RegExp;
