/**
 * The untracked, not-ignored files a probe would read once committed: sources and tests of
 * every detected language, and the documents under docs/. Ignored files are not listed; they
 * never reach a push.
 * @param {string} repoDir @param {import("../rules/context.mjs").RepoContext} tracked the ratchet's context, built with `tracked`
 * @returns {string[]}
 */
export function untrackedInScope(repoDir: string, tracked: import("../rules/context.mjs").RepoContext): string[];
/**
 * The sentence both commands print, or null when nothing is left out. @param {string[]} files
 * @param {"ratchet" | "baseline"} command
 */
export function untrackedLine(files: string[], command: "ratchet" | "baseline"): string | null;
