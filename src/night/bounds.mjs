/**
 * What a night may take on, and how much it may hand the morning. Two bounds a runner that works
 * unattended needs and a human at the keyboard supplies without noticing: it does not start work
 * that is already open on another branch, and it does not push more change than one review can
 * read. Two branches for the same task are two answers someone must reconcile, and a diff past
 * what one reading holds is merged on trust rather than read.
 */
import { spawnSync } from "node:child_process";
import { git } from "../core/repo.mjs";

/** Past this many changed lines a night branch stays local by default: one reading, not a skim. */
export const DEFAULT_MAX_DIFF_LINES = 2000;

/**
 * The phases a state file says were worked: anything not pending.
 * @param {string} text @returns {string[]}
 */
function workedPhases(text) {
  try {
    const state = JSON.parse(text);
    return (Array.isArray(state?.phases) ? state.phases : [])
      .filter((/** @type {any} */ p) => p && p.status && p.status !== "pending")
      .map((/** @type {any} */ p) => String(p.id));
  } catch {
    return [];
  }
}

/**
 * Earlier night branches, here or on origin, that the base has not taken yet and that worked a
 * phase this night would run: the same phase twice is two answers to reconcile, or the second
 * undoing the first. Tonight's own branch is a resume, not an overlap; a branch the base already
 * contains is done.
 * @param {{ repoDir: string, prefix: string, base: string, branch: string, stateFile: string, phases: string[] }} o
 * @returns {{ ref: string, phases: string[] }[]}
 */
export function openNightWork(o) {
  const refs = git(
    o.repoDir,
    "for-each-ref",
    "--format=%(refname)",
    `refs/heads/${o.prefix}-*`,
    `refs/remotes/origin/${o.prefix}-*`,
  )
    .split("\n")
    .filter(Boolean);
  const baseRef = resolvedBase(o.repoDir, o.base);
  // No base to compare with: the step that branches from it refuses with the real reason.
  if (!baseRef) return [];
  const already = new Set(workedPhases(git(o.repoDir, "show", `${baseRef}:${o.stateFile}`)));
  /** @type {{ ref: string, phases: string[] }[]} */
  const open = [];
  const seen = new Set();
  for (const ref of refs) {
    const name = ref.replace(/^refs\/(heads|remotes\/origin)\//, "");
    if (name === o.branch || seen.has(name)) continue;
    if (isAncestor(o.repoDir, ref, baseRef)) continue;
    seen.add(name);
    const worked = workedPhases(git(o.repoDir, "show", `${ref}:${o.stateFile}`)).filter(
      (p) => !already.has(p) && (!o.phases.length || o.phases.includes(p)),
    );
    if (worked.length) open.push({ ref: name, phases: worked });
  }
  return open;
}

/** True when `b` already contains `a`. @param {string} repoDir @param {string} a @param {string} b */
function isAncestor(repoDir, a, b) {
  return (
    spawnSync("git", ["merge-base", "--is-ancestor", a, b], { cwd: repoDir, stdio: "ignore" })
      .status === 0
  );
}

/**
 * The base as a ref that resolves here: the local branch, else the remote's. The pre-flight
 * branches from `origin/<base>` when there is no local one, and a diff against a name that does
 * not resolve read as an empty diff.
 * @param {string} repoDir @param {string} base @returns {string}
 */
function resolvedBase(repoDir, base) {
  for (const ref of [base, `origin/${base}`])
    if (git(repoDir, "rev-parse", "--verify", "-q", `${ref}^{commit}`)) return ref;
  return "";
}

/**
 * The lines a branch adds and removes against the base, renames read as moves: what a reviewer
 * reads (an edited line counts twice, once each way). Read from `--numstat`, which no locale
 * translates; -1 when the diff cannot be taken, so a caller holds the branch back rather than
 * reading a failure as an empty diff.
 * @param {string} repoDir @param {string} base @param {string} branch @returns {number}
 */
export function changedLineCount(repoDir, base, branch) {
  const from = resolvedBase(repoDir, base);
  if (!from) return -1;
  const r = spawnSync("git", ["diff", "--numstat", "-M", `${from}...${branch}`], {
    cwd: repoDir,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.status !== 0) return -1;
  let n = 0;
  for (const line of String(r.stdout).split("\n")) {
    const [add = "", del = ""] = line.split("\t");
    // A binary file reads "-" on both sides: a changed file, one line of review.
    n += add === "-" ? 1 : (Number(add) || 0) + (Number(del) || 0);
  }
  return n;
}
