/**
 * Per-file floors follow a renamed file. A floor is keyed by path, so a `git mv` of a file that
 * carries debt read as a new file rising from zero: the ratchet failed a change that moved no
 * debt, and `abatty baseline` refused it without a reason and an owner. Path-keyed baselines
 * breaking on moves is the friction adopters of every ratchet name first. Git already knows the
 * move: its rename detection, run from the commit that wrote the floor, says where each file went.
 */
import { git } from "../core/repo.mjs";

/**
 * The files renamed between `rev` and the working tree, as new path → old path. Empty when git
 * has no such revision or the directory is not a repository. A rename git does not see (an
 * untracked copy, an edit past its similarity threshold) is not carried: the file counts as new.
 * @param {string} repoDir @param {string} rev
 * @returns {Map<string, string>}
 */
export function renamesSince(repoDir, rev) {
  /** @type {Map<string, string>} */
  const moved = new Map();
  if (!rev) return moved;
  const out = git(repoDir, "diff", "-M", "--name-status", "-z", rev);
  const parts = out.split("\0");
  for (let i = 0; i < parts.length; i++) {
    const status = parts[i] || "";
    if (status.startsWith("R")) {
      const from = parts[i + 1] || "";
      const to = parts[i + 2] || "";
      if (from && to) moved.set(to, from);
      i += 2;
    } else if (/^[ACDMTU]/.test(status)) i += 1;
  }
  return moved;
}

/**
 * The commit that last wrote the baseline file, or "" when it was never committed.
 * @param {string} repoDir @param {string} rel
 */
export function baselineCommit(repoDir, rel) {
  return git(repoDir, "log", "-1", "--format=%H", "--", rel);
}

/**
 * The baseline with every per-file floor and per-file entry of a renamed file moved to the new
 * path. A key the new path already holds is left alone: a baseline written after the move has
 * the floor where it belongs.
 * @template {{ debt?: Record<string, Record<string, number>>, entries?: Record<string, any> }} B
 * @param {B} baseline @param {Map<string, string>} moved
 * @returns {B}
 */
export function carryRenames(baseline, moved) {
  if (!moved.size) return baseline;
  /** @type {Record<string, Record<string, number>>} */
  const debt = {};
  for (const [metric, files] of Object.entries(baseline.debt || {})) {
    const next = { ...files };
    for (const [to, from] of moved)
      if (from in next && !(to in next)) {
        next[to] = /** @type {number} */ (next[from]);
        delete next[from];
      }
    debt[metric] = next;
  }
  /** @type {Record<string, any>} */
  const entries = { ...(baseline.entries || {}) };
  for (const key of Object.keys(entries)) {
    const cut = key.indexOf(" ");
    if (cut < 0) continue;
    const file = key.slice(cut + 1);
    const to = [...moved].find(([, from]) => from === file)?.[0];
    if (to && !(`${key.slice(0, cut)} ${to}` in entries)) {
      entries[`${key.slice(0, cut)} ${to}`] = entries[key];
      delete entries[key];
    }
  }
  return { ...baseline, debt, entries };
}
