/**
 * What a file pulls in before it runs: a static import, a bare import for its side effects, and a
 * re-export, which loads the module just as eagerly. `await import()` is the whole point of the
 * split and must never count.
 * @param {string} text
 */
export function staticImports(text: string): string[];
/**
 * The modules a file pulls in before it runs, transitively, relative to the repository.
 * @param {string} repoDir @param {string} entry
 */
export function reachable(repoDir: string, entry: string): any[];
/** @type {import("../index.mjs").Probe[]} */
export const probes: import("../index.mjs").Probe[];
