/**
 * The hooks as this version writes them.
 * @param {{ run: (script: string, args?: string[]) => string[], exec: (bin: string) => string[] }} pm
 * @returns {Record<string, string>} path to content
 */
export function gitHooks(pm: {
    run: (script: string, args?: string[]) => string[];
    exec: (bin: string) => string[];
}): Record<string, string>;
/**
 * Whether a hook is one an earlier version wrote and nobody edited since: its commands are exactly
 * ones `init` has written, and every comment is one of `init`'s. Such a hook is refreshed; any
 * other is the repository's own, and gets the new version beside it instead. A comment of the
 * repository's own is read as an edit: this package's hooks, which explain themselves in their
 * own words, were rewritten by an update that ignored comments.
 * @param {string} rel @param {string} text
 */
export function writtenByInit(rel: string, text: string): boolean;
/**
 * The hooks git records as not executable, from the index rather than the disk: a hook committed
 * from Windows arrives 100644 on every other machine, where git skips it silently, and the file
 * on this disk says nothing about that.
 * @param {string} repoDir
 * @returns {string[]}
 */
export function hooksNotExecutable(repoDir: string): string[];
/**
 * Give tracked files the executable mode in the index, and nothing else. `git update-index
 * --chmod=+x` also stages the file's working-tree content, so an unstaged edit to a hook went
 * into the index with the bit, a change nobody asked to commit. The entry is rewritten with its
 * own blob and the new mode. An untracked file is left alone.
 * @param {string} cwd a folder inside the repository @param {string[]} paths relative to `cwd`
 * @returns {string[]} the paths whose mode was set
 */
export function indexExecutable(cwd: string, paths: string[]): string[];
