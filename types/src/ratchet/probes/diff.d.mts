/**
 * A zero-context diff read line by line with the file each line belongs to: the one reader the
 * probes that judge a change share. A header is only read as one between `diff --git` and the
 * first hunk, so a removed content line that starts with `-- ` (an SQL comment) is never taken
 * for a path, and a quoted path (a name git escapes) is unquoted.
 */
/**
 * The added and removed lines of a diff, each with its file: the new path, or the old one for a
 * file the diff deletes.
 * @param {string} diff @returns {Generator<[string, string]>} [file, the line with its + or -]
 */
export function contentLines(diff: string): Generator<[string, string]>;
