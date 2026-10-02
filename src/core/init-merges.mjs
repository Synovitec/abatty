/**
 * What `init` does to a file the repository already owns, and what it says it did. A file it
 * writes from a template is its own; a `package.json`, a `.gitignore` or a config it merges into
 * is the repository's, so each merge adds only what is missing and names it on its line:
 * "merged" alone sent a reader to `git diff` to find out what had been done to a file of theirs.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Append the lines a file lacks, keeping every line it has, and record what was added.
 * @param {string} repoDir @param {string} rel @param {string[]} lines
 * @param {import("./init.mjs").InitEvent[]} events @param {boolean} dryRun
 */
export function appendLines(repoDir, rel, lines, events, dryRun) {
  const target = join(repoDir, rel);
  const current = existsSync(target) ? readFileSync(target, "utf8") : "";
  const missing = lines.filter((l) => !current.split(/\r?\n/).includes(l));
  if (!missing.length) {
    events.push({ file: rel, action: "kept" });
    return;
  }
  if (!dryRun)
    writeFileSync(
      target,
      (current ? current.replace(/\s*$/, "\n") : "") + missing.join("\n") + "\n",
    );
  events.push({
    file: rel,
    action: current ? "merged" : "written",
    ...(current && { detail: `added ${missing.join(", ")}` }),
  });
}

/**
 * What `.gitignore` must hold: the night's folder and abatty's own, and in a JavaScript
 * repository its packages unless the file already names them in any form. An adopter with no
 * `.gitignore` followed init's steps, committed, and committed node_modules with it.
 * @param {string} repoDir @returns {string[]}
 */
export function ignoredHere(repoDir) {
  const lines = [".claude/night/", ".abatty/"];
  const current = existsSync(join(repoDir, ".gitignore"))
    ? readFileSync(join(repoDir, ".gitignore"), "utf8")
    : "";
  if (existsSync(join(repoDir, "package.json")) && !/node_modules/.test(current))
    lines.push("node_modules/");
  return lines;
}

/**
 * The keys a merge put in or changed, as a merged line says them. A key whose value it replaced
 * (under --force) counts; one the repository already had and kept does not.
 * @param {Record<string, unknown>} after @param {Record<string, unknown>} before @param {string} kind
 * @returns {string} "" when nothing changed
 */
export function added(after, before, kind) {
  const keys = Object.keys(after).filter(
    (k) => JSON.stringify(after[k]) !== JSON.stringify(before[k]),
  );
  return keys.length ? `${kind} added: ${keys.join(", ")}` : "";
}
