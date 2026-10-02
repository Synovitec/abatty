/**
 * The tracked file a resolved specifier names, as TypeScript and the bundlers read it: as
 * written, with an extension added, as a folder's index, or with the `.js` an ESM TypeScript
 * import writes for its `.ts` source. Reading only the exact path left every TypeScript import
 * (`./price`, `./price.js` for `price.ts`) without an edge.
 * @param {Set<string>} known @param {string} target @returns {string}
 */
export function resolveIn(known: Set<string>, target: string): string;
/**
 * Who imports whom over the tracked scripts: the map from a file to the files that import it.
 * A relative specifier and a tsconfig path alias both count; a bare package name does not.
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
