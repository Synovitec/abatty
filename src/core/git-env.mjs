/**
 * Git's per-repository variables, as a hook hands them to the gate. A hook run from a linked
 * worktree exports an absolute GIT_DIR, and every step inherited it: a test suite that made a
 * fixture repository with `git init` in a temporary folder wrote into the real one instead (its
 * config turned bare, its main branch rewritten, its worktrees switched to fixture branches).
 */
import { spawnSync } from "node:child_process";

/** What `git rev-parse --local-env-vars` lists: the variables that name one repository. */
export const GIT_REPO_VARS = [
  "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  "GIT_CONFIG",
  "GIT_CONFIG_PARAMETERS",
  "GIT_CONFIG_COUNT",
  "GIT_OBJECT_DIRECTORY",
  "GIT_DIR",
  "GIT_WORK_TREE",
  "GIT_IMPLICIT_WORK_TREE",
  "GIT_GRAFT_FILE",
  "GIT_INDEX_FILE",
  "GIT_NO_REPLACE_OBJECTS",
  "GIT_REPLACE_REF_BASE",
  "GIT_PREFIX",
  "GIT_SHALLOW_FILE",
  "GIT_COMMON_DIR",
];

/**
 * An environment without git's per-repository variables. @param {NodeJS.ProcessEnv} env
 * @returns {NodeJS.ProcessEnv}
 */
export function withoutGitRepoVars(env) {
  const out = { ...env };
  for (const k of GIT_REPO_VARS) delete out[k];
  return out;
}

/** The git directory git finds from `dir` under `env`, or "". @param {string} dir @param {NodeJS.ProcessEnv} env */
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
  if (!GIT_REPO_VARS.some((k) => process.env[k] !== undefined)) return false;
  const given = gitDirFrom(dir, process.env);
  if (!given || given !== gitDirFrom(dir, withoutGitRepoVars(process.env))) return false;
  for (const k of GIT_REPO_VARS) delete process.env[k];
  return true;
}
