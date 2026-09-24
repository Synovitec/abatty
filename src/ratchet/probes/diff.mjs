/**
 * A zero-context diff read line by line with the file each line belongs to: the one reader the
 * probes that judge a change share. A header is only read as one between `diff --git` and the
 * first hunk, so a removed content line that starts with `-- ` (an SQL comment) is never taken
 * for a path, and a quoted path (a name git escapes) is unquoted.
 */

/**
 * The added and removed lines of a diff, each with its file (the new path, or the old one for a
 * file the diff deletes) and its line number on its own side: the old file's for a removed line,
 * the new file's for an added one.
 * @param {string} diff @returns {Generator<[string, string, number]>} [file, the line with its + or -, its number]
 */
export function* contentLines(diff) {
  let file = "";
  let header = false;
  let oldAt = 0;
  let newAt = 0;
  for (const l of diff.split("\n")) {
    if (l.startsWith("diff --git ")) header = true;
    const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(l);
    if (hunk) {
      header = false;
      oldAt = Number(hunk[1]);
      newAt = Number(hunk[2]);
      continue;
    }
    if (header) {
      if (l.startsWith("+++ ") || l.startsWith("--- ")) {
        const p = l
          .slice(4)
          .replace(/^"(.*)"$/, "$1")
          .replace(/^[ab]\//, "");
        if (p !== "/dev/null") file = p;
      }
      continue;
    }
    if (!file) continue;
    if (l.startsWith("+")) yield [file, l, newAt++];
    else if (l.startsWith("-")) yield [file, l, oldAt++];
  }
}
