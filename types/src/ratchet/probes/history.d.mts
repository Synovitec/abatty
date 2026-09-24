/**
 * The newest commit that changed `path` beyond a document's verification date, as a sha, or ""
 * when git has none within reach (a file never committed). A commit whose only change to a
 * DOCUMENT under the path is a date line is passed over: bumping the date re-read nothing, and a
 * source doc whose date alone moved has not moved. In any other file a date line is content: a
 * config whose `updated:` changed has moved. A re-read with no edit is not read here but from a
 * `docs-verified:` line naming the document (see `readOf`), one rule for both.
 * @param {import("../../rules/context.mjs").RepoContext} c @param {string} path
 */
export function lastChange(c: import("../../rules/context.mjs").RepoContext, path: string): string;
