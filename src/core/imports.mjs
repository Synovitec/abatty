/**
 * The import graph of a repository's scripts, by relative specifier: who imports whom. Two
 * questions read it. `abatty mutate` asks which tests can notice a change to one module; the gate
 * asks, after a red test step, whether the push changed anything a failing test reaches. Reading
 * only whether the test FILE changed filed the commonest break of all (the push edits a module and
 * its untouched test goes red) as a likely flake.
 */
import { readFileSync } from "node:fs";
import { join, posix } from "node:path";
import { git } from "./repo.mjs";

/** A script file this graph reads. */
export const SCRIPT = /\.[cm]?[jt]sx?$/;

/**
 * Who imports whom over the tracked scripts: the map from a file to the files that import it.
 * @param {string} repoDir @returns {Map<string, string[]>}
 */
export function importersOf(repoDir) {
  /** @type {Map<string, string[]>} */
  const by = new Map();
  const files = git(repoDir, "ls-files")
    .split("\n")
    .filter((f) => SCRIPT.test(f));
  const known = new Set(files);
  for (const f of files) {
    let text = "";
    try {
      text = readFileSync(join(repoDir, f), "utf8");
    } catch {
      continue;
    }
    for (const m of text.matchAll(/(?:from|import\s*\(?)\s*["'](\.{1,2}\/[^"']+)["']/g)) {
      const target = posix.normalize(posix.join(posix.dirname(f), String(m[1])));
      if (!known.has(target)) continue;
      by.set(target, [...(by.get(target) || []), f]);
    }
  }
  return by;
}

/**
 * Every file that reaches one of `changed` through its imports, the changed files included: the
 * set of tests a push can have broken, read upward from what it changed.
 * @param {Map<string, string[]>} graph @param {string[]} changed @returns {Set<string>}
 */
export function reachedBy(graph, changed) {
  const seen = new Set(changed);
  let ring = [...changed];
  while (ring.length) {
    ring = ring.flatMap((f) => graph.get(f) || []).filter((f) => !seen.has(f) && seen.add(f));
  }
  return seen;
}
