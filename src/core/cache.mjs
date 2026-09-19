/**
 * The measurement cache. Every `measure` reads the whole tree and runs the whole catalog, so the
 * second run over an unchanged repository costs exactly what the first did - which is what makes
 * the inner-loop tier aspirational rather than real.
 *
 * One constraint governs the design: **a cache must never be able to turn a finding into a pass.**
 * So the key is the content of everything a rule could read, not a timestamp and not a guess. The
 * committed tree is identified by git's own tree object, and every file that differs from it -
 * modified, staged or untracked - is hashed. A file edited twice in the same second changes the
 * key; a file touched and restored does not. On anything the key cannot account for, the cache
 * misses and the catalog runs.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { git } from "./repo.mjs";

export const CACHE_ROOT = ".abatty";
export const CACHE_DIR = join(CACHE_ROOT, "cache");

/**
 * The identity of a reading: the package's version, the committed tree, and the content of every
 * file that differs from it. Null when this is not a git repository, because then there is no
 * cheap way to know what changed and the honest answer is to measure.
 * @param {string} repoDir @param {{ version?: string, catalog?: string[] }} [o]
 */
export function cacheKey(repoDir, o = {}) {
  const tree = git(repoDir, "rev-parse", "HEAD^{tree}");
  if (!tree) return null;
  const h = createHash("sha256");
  h.update(`abatty:${o.version || ""}\n`);
  h.update(`tree:${tree}\n`);
  for (const id of (o.catalog || []).slice().sort()) h.update(`rule:${id}\n`);
  const dirty = [
    ...git(repoDir, "diff", "--name-only", "HEAD").split("\n"),
    ...git(repoDir, "diff", "--name-only", "--cached").split("\n"),
    ...git(repoDir, "ls-files", "--others", "--exclude-standard").split("\n"),
  ]
    .filter(Boolean)
    // The tool's own scratch folder is not an input: writing the cache would otherwise change the
    // key that named it, and the cache would never hit in a repository that does not ignore it.
    .filter((f) => !f.startsWith(`${CACHE_ROOT}/`))
    .sort();
  for (const rel of [...new Set(dirty)]) {
    const abs = join(repoDir, rel);
    // A file that differs is hashed by content: a timestamp cannot tell two edits in one second
    // apart, and the one it misses is the one that would have been a finding.
    h.update(
      `file:${rel}:${existsSync(abs) ? createHash("sha256").update(readFileSync(abs)).digest("hex") : "gone"}\n`,
    );
  }
  return h.digest("hex").slice(0, 32);
}

/** The reading kept under this key, or null. @param {string} repoDir @param {string | null} key */
export function readCache(repoDir, key) {
  if (!key) return null;
  const file = join(repoDir, CACHE_DIR, `${key}.json`);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    // A cache that cannot be read is a cache that missed. It is never a reason to fail.
    return null;
  }
}

/**
 * Keep a reading under its key, and keep the folder small: the readings are worth nothing once
 * their key is stale, and an unbounded cache folder is a bug report waiting to happen.
 * @param {string} repoDir @param {string | null} key @param {unknown} value @param {number} [keep]
 */
export function writeCache(repoDir, key, value, keep = 8) {
  if (!key) return;
  const dir = join(repoDir, CACHE_DIR);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${key}.json`), JSON.stringify(value));
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => ({ f, at: statSync(join(dir, f)).mtimeMs }))
    .sort((a, b) => b.at - a.at);
  for (const { f } of files.slice(keep)) {
    try {
      writeFileSync(join(dir, f), "");
    } catch {
      /* a cache entry that will not go is not an error */
    }
  }
}
