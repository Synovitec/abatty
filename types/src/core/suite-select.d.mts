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
 * The files of a range whose every added and removed line is a comment or blank: they change no
 * behaviour, so they select no suite. Read line by line from a zero-context diff; a file the diff
 * cannot show (binary, deleted, renamed) is never counted as comment-only, because a guess that
 * skips a suite is the expensive direction to be wrong in.
 * @param {string} repoDir @param {string} range @param {string[]} files
 * @returns {Set<string>}
 */
export function commentOnly(repoDir: string, range: string, files: string[]): Set<string>;
