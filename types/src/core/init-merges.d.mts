/**
 * Append the lines a file lacks, keeping every line it has, and record what was added.
 * @param {string} repoDir @param {string} rel @param {string[]} lines
 * @param {import("./init.mjs").InitEvent[]} events @param {boolean} dryRun
 */
export function appendLines(repoDir: string, rel: string, lines: string[], events: import("./init.mjs").InitEvent[], dryRun: boolean): void;
/**
 * What `.gitignore` must hold: the night's folder and abatty's own, and in a JavaScript
 * repository its packages unless the file already names them in any form. An adopter with no
 * `.gitignore` followed init's steps, committed, and committed node_modules with it.
 * @param {string} repoDir @returns {string[]}
 */
export function ignoredHere(repoDir: string): string[];
/**
 * The keys a merge put in or changed, as a merged line says them. A key whose value it replaced
 * (under --force) counts; one the repository already had and kept does not.
 * @param {Record<string, unknown>} after @param {Record<string, unknown>} before @param {string} kind
 * @returns {string} "" when nothing changed
 */
export function added(after: Record<string, unknown>, before: Record<string, unknown>, kind: string): string;
/**
 * A folder's name as npm takes a package name: lower case, no spaces, nothing npm refuses. The
 * folder `My Go_Svc` was written as the name verbatim, and npm refused every command after.
 * @param {string} folder @returns {string}
 */
export function packageName(folder: string): string;
