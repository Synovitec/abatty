/**
 * The newest commit that changed `path` beyond a document's verification date, as a sha, or ""
 * when git has none within reach (a file never committed). A commit whose only change to a
 * DOCUMENT under the path is a date line is passed over: bumping the date re-read nothing, and a
 * source doc whose date alone moved has not moved. In any other file a date line is content: a
 * config whose `updated:` changed has moved. A re-read with no edit is not read here but from a
 * `docs-verified:` line naming the document (see `readOf`), one rule for both.
 *
 * With `bodyOnly`, for a path judged as a SOURCE: a Markdown document moves only when its body
 * does. Its front matter is where a split rewrites the `source_truth` globs, and read as a move it
 * put every document citing it behind, with nothing to re-read (an adopter raised a floor for it).
 * A document's own re-read is not judged this way. Nor does a source move by what abatty writes as
 * its own record (`abatty update` moving the version pin, `abatty baseline` rewriting the floors):
 * read as moves, an upgrade put the documents citing package.json, the config and the baseline
 * behind, their re-read moved the progress log, and one adopter took four commits to go green.
 * @param {import("../../rules/context.mjs").RepoContext} c @param {string} path
 * @param {{ bodyOnly?: boolean }} [o]
 */
export function lastChange(c: import("../../rules/context.mjs").RepoContext, path: string, o?: {
    bodyOnly?: boolean;
}): string;
/**
 * The re-reads that changed nothing, named in commit messages, newest first: a
 * `docs-verified: <paths>` line records which documents were read, with no edit to invent.
 * @param {import("../../rules/context.mjs").RepoContext} c
 * @returns {{ sha: string, paths: string[] }[]}
 */
export function verifiedIn(c: import("../../rules/context.mjs").RepoContext): {
    sha: string;
    paths: string[];
}[];
