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
import { aliasScopes, unalias } from "./ts-paths.mjs";

/** A script file this graph reads. */
export const SCRIPT = /\.[cm]?[jt]sx?$/;

/** The extensions a specifier written without one may name, in TypeScript's order. */
const EXTS = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"];

/**
 * The tracked file a resolved specifier names, as TypeScript and the bundlers read it: as
 * written, with an extension added, as a folder's index, or with the `.js` an ESM TypeScript
 * import writes for its `.ts` source. Reading only the exact path left every TypeScript import
 * (`./price`, `./price.js` for `price.ts`) without an edge.
 * @param {Set<string>} known @param {string} target @returns {string}
 */
export function resolveIn(known, target) {
  if (known.has(target)) return target;
  const swapped = target.replace(/\.([cm]?)js(x?)$/, ".$1ts$2");
  if (swapped !== target && known.has(swapped)) return swapped;
  for (const stem of [target, `${target}/index`])
    for (const ext of EXTS) if (known.has(stem + ext)) return stem + ext;
  return "";
}

/**
 * Who imports whom over the tracked scripts: the map from a file to the files that import it.
 * A relative specifier and a tsconfig path alias both count; a bare package name does not.
 * @param {string} repoDir @returns {Map<string, string[]>}
 */
export function importersOf(repoDir) {
  /** @type {Map<string, string[]>} */
  const by = new Map();
  const files = git(repoDir, "ls-files")
    .split("\n")
    .filter((f) => SCRIPT.test(f));
  const known = new Set(files);
  const scopes = aliasScopes(
    repoDir,
    files.length ? git(repoDir, "ls-files", "--", ":(glob)**/tsconfig.json").split("\n") : [],
  );
  for (const f of files) {
    let text = "";
    try {
      text = readFileSync(join(repoDir, f), "utf8");
    } catch {
      continue;
    }
    for (const m of text.matchAll(/(?:from|import\s*\(?|require\s*\()\s*["']([^"'\s]+)["']/g)) {
      const spec = String(m[1]);
      const candidates = spec.startsWith(".")
        ? [posix.normalize(posix.join(posix.dirname(f), spec))]
        : unalias(scopes, f, spec);
      const target = candidates.map((c) => resolveIn(known, c)).find(Boolean);
      if (!target || target === f) continue;
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
