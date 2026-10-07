/**
 * An environment without git's per-repository variables. @param {NodeJS.ProcessEnv} env
 * @returns {NodeJS.ProcessEnv}
 */
export function withoutGitRepoVars(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv;
/**
 * Drops git's per-repository variables from this process, so the gate's steps inherit none,
 * when they name the repository git would find from `dir` anyway: then they only repeat what the
 * folder says, and a step that makes a repository of its own gets its own. Variables that name
 * another repository were set on purpose (a bare repository with a separate work tree) and stay.
 * Returns whether it dropped any. @param {string} dir
 */
export function dropHookGitVars(dir: string): boolean;
/** What `git rev-parse --local-env-vars` lists: the variables that name one repository. */
export const GIT_REPO_VARS: string[];
