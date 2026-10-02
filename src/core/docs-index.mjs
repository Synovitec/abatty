/**
 * The rows of the documentation index `init` writes, for the documents a repository already had.
 * The index named only the two files `init` wrote, so a repository whose docs/ held documents of
 * its own read them as missing from the index (docs.indexDrift, HARD) and its first `baseline`
 * was refused. Each document already says what it is in its front matter; the row reads it there.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, posix } from "node:path";
import { frontMatter } from "../ratchet/probes/lib.mjs";

/** The Markdown files under a folder, as paths relative to it, deepest last. @param {string} dir @param {string} [rel] */
function markdownUnder(dir, rel = "") {
  /** @type {string[]} */
  const out = [];
  for (const name of readdirSync(join(dir, rel)).sort()) {
    const path = rel ? posix.join(rel, name) : name;
    if (statSync(join(dir, path)).isDirectory()) out.push(...markdownUnder(dir, path));
    else if (name.endsWith(".md")) out.push(path);
  }
  return out;
}

/** A front matter value as one table cell. @param {unknown} v */
const cell = (v) => (v ? String(v).replace(/\|/g, "\\|").replace(/\s+/g, " ").trim() : "-");

/**
 * One index row per document already under docs/, the index itself and `skip` left out: its
 * path, then what it is for, its category and its status as its front matter says them.
 * @param {string} repoDir @param {string[]} skip paths relative to docs/ that init writes itself
 * @returns {string} the rows, each ending in a newline; "" when there is none
 */
export function existingDocRows(repoDir, skip) {
  const docs = join(repoDir, "docs");
  if (!existsSync(docs)) return "";
  return markdownUnder(docs)
    .filter((f) => f !== "README.md" && !skip.includes(f))
    .map((f) => {
      const fm = frontMatter(readFileSync(join(docs, f), "utf8")) || {};
      return `| \`${f}\` | ${cell(fm.description || fm.title)} | ${cell(fm.category)} | ${cell(fm.status)} |\n`;
    })
    .join("");
}
