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
 * Whether a hook is one an earlier version wrote and nobody edited since: its commands, comments
 * and blank lines aside, are exactly ones `init` has written. Such a hook is refreshed; any other
 * is the repository's own, and gets the new version beside it instead.
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
