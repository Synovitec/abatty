/**
 * Where the bypass layer outside the agent is installed, and how a run reaches it.
 *
 * The shim itself is a template (templates/harness/bin/), because it is code the repository owns
 * once it is installed. This module is the package's side of it, and it is small on purpose: the
 * only thing a caller needs to know is that one directory goes on PATH before everything else.
 */
import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";
import { pathFromEnv } from "./env.mjs";

/** The installed shim's directory, relative to the repository root. */
export const SHIM_DIR = ".claude/bin";

/** The files a working shim is made of: the wrapper a shell finds, and the refusals it reads. */
export const SHIM_FILES = ["shim.mjs", "git", "git.cmd"];

/**
 * Whether this repository has the layer installed. Both halves are required: a wrapper without
 * its logic is a `git` on PATH that fails every command, which is worse than no shim at all.
 * @param {string} repoDir
 */
export function shimInstalled(repoDir) {
  return ["git", "shim.mjs"].every((f) => existsSync(join(repoDir, SHIM_DIR, f)));
}

/**
 * Whether an installed harness file has to be executable. shim.mjs is read by node and never run,
 * so only the wrappers carry the mode; a wrapper without it is a git a shell silently will not
 * execute, which is the same shape of failure as a git hook that was never made executable.
 * @param {string} rel the path relative to the repository root
 */
export function shimExecutable(rel) {
  return rel === `${SHIM_DIR}/git` || rel === `${SHIM_DIR}/git.cmd`;
}

/**
 * PATH with the shim in front of it. WHY in front and not appended: an entry after the real git
 * is a file nobody ever executes, which is the failure mode that makes a layer feel installed
 * while refusing nothing. A repository without the shim gets its PATH back unchanged, so a caller
 * never has to ask first.
 * @param {string} repoDir
 * @param {string} [pathEnv]
 * @returns {string}
 */
export function shimmedPath(repoDir, pathEnv = pathFromEnv()) {
  if (!shimInstalled(repoDir)) return pathEnv;
  const dir = join(repoDir, SHIM_DIR);
  const parts = pathEnv.split(delimiter).filter(Boolean);
  if (parts[0] === dir) return pathEnv;
  return [dir, ...parts.filter((p) => p !== dir)].join(delimiter);
}
