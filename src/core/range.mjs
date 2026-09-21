/**
 * What a push contains: the range git will send, how that range was found, and the files the
 * range and the working tree change. Split from the gate because three other commands (the
 * ratchet, the report, the MCP server) ask the same questions and none of them runs a gate.
 */
import { spawnSync } from "node:child_process";
import { git } from "./repo.mjs";

/**
 * What the push contains. `@{u}..HEAD` while the upstream is still an ancestor of HEAD; after
 * a rebase or an amend it is not, and the diff would show the amend delta rather than the
 * push (which is how a push carrying twenty UI files once skipped the browser suite), so the
 * whole branch is judged instead; with no upstream, the fork point from the base; failing
 * that, the last commit.
 */
/**
 * @typedef {"explicit" | "upstream" | "fork" | "unknown"} RangeHow
 * @typedef {{ range: string, how: RangeHow, commits: number }} RangeInfo
 */

/**
 * The push range and how it was found, because "could not be found" is a different answer from
 * "found and empty" and the gate must not read the two alike. `commits` is what the range holds,
 * -1 when git cannot list it (a shallow clone whose `HEAD~1` does not exist).
 * @param {string} repoDir @param {string} [base] @param {string} [explicit] @returns {RangeInfo}
 */
export function pushRangeInfo(repoDir, base = "main", explicit = "") {
  const count = (/** @type {string} */ range) => {
    const r = spawnSync("git", ["rev-list", "--count", range], { cwd: repoDir, encoding: "utf8" });
    return r.status === 0 ? Number(String(r.stdout).trim()) || 0 : -1;
  };
  if (explicit) return { range: explicit, how: "explicit", commits: count(explicit) };
  const upstream = git(repoDir, "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}");
  const linear =
    upstream &&
    spawnSync("git", ["merge-base", "--is-ancestor", "@{u}", "HEAD"], {
      cwd: repoDir,
      stdio: "ignore",
    }).status === 0;
  if (linear) return { range: "@{u}..HEAD", how: "upstream", commits: count("@{u}..HEAD") };
  const fork =
    git(repoDir, "merge-base", `origin/${base}`, "HEAD") ||
    git(repoDir, "merge-base", base, "HEAD");
  if (fork) return { range: `${fork}..HEAD`, how: "fork", commits: count(`${fork}..HEAD`) };
  // Nothing to compare with: no upstream, no base to fork from. The last commit is a guess, and
  // the caller is told it is one.
  return { range: "HEAD~1..HEAD", how: "unknown", commits: count("HEAD~1..HEAD") };
}

/** The push range alone (see pushRangeInfo). @param {string} repoDir @param {string} [base] @param {string} [explicit] */
export function pushRange(repoDir, base = "main", explicit = "") {
  return pushRangeInfo(repoDir, base, explicit).range;
}

/** Files whose content on disk differs from HEAD: staged, unstaged, untracked. @param {string} repoDir */
export function pendingPaths(repoDir) {
  const tracked = git(repoDir, "diff", "--name-only", "HEAD");
  const untracked = git(repoDir, "ls-files", "--others", "--exclude-standard");
  return `${tracked}\n${untracked}`.split("\n").filter(Boolean);
}

/**
 * The files a range changed, repository-relative. A finding in a file this change never touched
 * is not this change's finding, however true it is, and telling the two apart is the difference
 * between a gate a team acts on and a list they learn to scroll past.
 * @param {string} repoDir @param {string} range
 */
export function changedPaths(repoDir, range) {
  if (!range) return [];
  return git(repoDir, "diff", "--name-only", range).split("\n").filter(Boolean);
}
