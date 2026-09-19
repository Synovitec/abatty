/**
 * Whether this repository has the layer installed. Both halves are required: a wrapper without
 * its logic is a `git` on PATH that fails every command, which is worse than no shim at all.
 * @param {string} repoDir
 */
export function shimInstalled(repoDir: string): boolean;
/**
 * Whether an installed harness file has to be executable. shim.mjs is read by node and never run,
 * so only the wrappers carry the mode; a wrapper without it is a git a shell silently will not
 * execute, which is the same shape of failure as a git hook that was never made executable.
 * @param {string} rel the path relative to the repository root
 */
export function shimExecutable(rel: string): rel is ".claude/bin/git" | ".claude/bin/git.cmd";
/**
 * PATH with the shim in front of it. WHY in front and not appended: an entry after the real git
 * is a file nobody ever executes, which is the failure mode that makes a layer feel installed
 * while refusing nothing. A repository without the shim gets its PATH back unchanged, so a caller
 * never has to ask first.
 * @param {string} repoDir
 * @param {string} [pathEnv]
 * @returns {string}
 */
export function shimmedPath(repoDir: string, pathEnv?: string): string;
/** The installed shim's directory, relative to the repository root. */
export const SHIM_DIR: ".claude/bin";
/** The files a working shim is made of: the wrapper a shell finds, and the refusals it reads. */
export const SHIM_FILES: string[];
