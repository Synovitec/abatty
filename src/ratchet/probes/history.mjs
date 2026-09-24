/**
 * What a commit changed, read for freshness (standard DOC.5): the newest commit that moved a path
 * in a way a document could be behind, passing over the changes that move nothing a document
 * describes (a verification date, whitespace, a comment). Apart from freshness.mjs, which judges
 * documents against it, because reading git history is one job and judging a document another.
 */
import { contentLines } from "./diff.mjs";

/** A diff line of a document that only moves a verification date. */
const DATE_LINE = /^[+-]\s*(last_verified|last_reviewed|updated)\s*:/;
/**
 * A diff line of code that is a comment and nothing else, or blank, in the file's own spelling:
 * `#` is a comment in Python, YAML or a shell script and a private field in JavaScript.
 * @param {string} file @param {string} line
 */
function commentLine(file, line) {
  if (/^[+-]\s*$/.test(line)) return true;
  if (/\.(py|ya?ml|sh|toml|rb|cfg|ini)$/.test(file)) return /^[+-]\s*#(?!!)/.test(line);
  return /^[+-]\s*(\/\/|\/\*|\*\/?(\s|$))/.test(line);
}

/**
 * The newest commit that changed `path` beyond a document's verification date, as a sha, or ""
 * when git has none within reach (a file never committed). A commit whose only change to a
 * DOCUMENT under the path is a date line is passed over: bumping the date re-read nothing, and a
 * source doc whose date alone moved has not moved. In any other file a date line is content: a
 * config whose `updated:` changed has moved. A re-read with no edit is not read here but from a
 * `docs-verified:` line naming the document (see `readOf`), one rule for both.
 * @param {import("../../rules/context.mjs").RepoContext} c @param {string} path
 */
export function lastChange(c, path) {
  const log = c.git("log", "-50", "--format=%H", "--", path);
  const indented = INDENTED.map((ext) => `:(exclude,glob)**/*.${ext}`);
  for (const sha of log.split("\n").filter(Boolean)) {
    // `-w`: a commit that only reindented or reformatted moved nothing a document describes,
    // except where indentation is the meaning (Python, YAML), which is read with it.
    const loose = c.git("show", "--format=", "-U0", "-w", sha, "--", path, ...indented);
    const strict = c.git("show", "--format=", "-U0", sha, "--", path);
    if (moved(loose, () => true) || moved(strict, (f) => INDENTED_FILE.test(f))) return sha;
  }
  return "";
}

/**
 * The re-reads that changed nothing, named in commit messages, newest first: a
 * `docs-verified: <paths>` line records which documents were read, with no edit to invent.
 * @param {import("../../rules/context.mjs").RepoContext} c
 * @returns {{ sha: string, paths: string[] }[]}
 */
export function verifiedIn(c) {
  return c
    .git("log", "-500", "-i", "--grep=docs-verified:", "--format=%H%x1f%B%x1e")
    .split("\x1e")
    .map((record) => record.trim().split("\x1f"))
    .filter(([sha]) => sha)
    .map(([sha = "", body = ""]) => ({
      sha,
      paths: (body.match(/^\s*docs-verified:(.*)$/gim) || []).flatMap((line) =>
        line
          .replace(/^\s*docs-verified:/i, "")
          .split(/[\s,;]+/)
          .map((w) => w.replace(/^[`'"(]+|[`'".):]+$/g, ""))
          .filter((w) => w.endsWith(".md")),
      ),
    }));
}

/** The languages where indentation is syntax, read without `-w`. */
const INDENTED = ["py", "yml", "yaml"];
const INDENTED_FILE = new RegExp(`\\.(${INDENTED.join("|")})$`);

/**
 * Whether a zero-context diff moves anything a document could describe, in the files `keep`
 * accepts.
 * @param {string} diff @param {(file: string) => boolean} keep
 */
function moved(diff, keep) {
  for (const [file, l] of contentLines(diff)) {
    if (!keep(file)) continue;
    if (file.endsWith(".md") && DATE_LINE.test(l)) continue;
    // Nor did one that only rewrote a comment in code: the behaviour a document cites is the
    // code's. A comment line is `//`, `#`, or a block comment's own lines.
    if (!file.endsWith(".md") && commentLine(file, l)) continue;
    return true;
  }
  return false;
}
