/**
 * Git's per-repository variables, as a hook hands them to the gate. A hook run from a linked
 * worktree exports an absolute GIT_DIR, and every step inherited it: a test suite that made a
 * fixture repository with `git init` in a temporary folder wrote into the real one instead (its
 * config turned bare, its main branch rewritten, its worktrees switched to fixture branches).
 */
import { spawnSync } from "node:child_process";
import { dropGitRepoVars, envWithoutGitRepoVars, gitRepoVarsSet } from "./env.mjs";

/**
 * The git directory git finds from `dir`, or "": under this process's environment, or `env`.
 * @param {string} dir @param {NodeJS.ProcessEnv} [env]
 */
function gitDirFrom(dir, env) {
  const r = spawnSync("git", ["rev-parse", "--absolute-git-dir"], {
    cwd: dir,
    env,
    encoding: "utf8",
  });
  return r.status === 0 ? String(r.stdout).trim().replace(/\\/g, "/").toLowerCase() : "";
}

/**
 * Drops git's per-repository variables from this process, so the gate's steps inherit none,
 * when they name the repository git would find from `dir` anyway: then they only repeat what the
 * folder says, and a step that makes a repository of its own gets its own. Variables that name
 * another repository were set on purpose (a bare repository with a separate work tree) and stay.
 * Returns whether it dropped any. @param {string} dir
 */
export function dropHookGitVars(dir) {
  if (!gitRepoVarsSet()) return false;
  const given = gitDirFrom(dir);
  if (!given || given !== gitDirFrom(dir, envWithoutGitRepoVars())) return false;
  dropGitRepoVars();
  return true;
}
