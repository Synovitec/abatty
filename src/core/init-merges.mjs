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
