/**
 * A dev server holding this folder, read from the lock files a preset names for its framework
 * (`.next/dev/lock` for Next.js, which writes its pid there). The pid is asked whether it is alive,
 * so a lock left behind by a crash does not defer the suite forever. Null when none is live.
 * @param {string} dir the folder the suite runs in
 * @param {string[]} [locks] the lock files, relative to `dir`
 * @returns {{ lock: string, pid: number, port?: number } | null}
 */
export function liveDevServer(dir: string, locks?: string[]): {
    lock: string;
    pid: number;
    port?: number;
} | null;
/**
 * The files of a range whose two versions differ only in comments and blank lines: they change
 * no behaviour, so they select no suite. Both versions are read whole and compared with their
 * comments blanked by the probes' lexer, rather than judged line by line from a diff, where a
 * CSS `#id` selector or a `* 2` continuation reads as a comment. Only the languages the lexer
 * knows are judged, and a file missing at either end is never counted: a guess that skips a
 * suite is the expensive direction to be wrong in.
 * @param {string} repoDir @param {string} range `from..to`; a three-dot range judges nothing
 * @param {string[]} files
 * @returns {Set<string>}
 */
export function commentOnly(repoDir: string, range: string, files: string[]): Set<string>;
