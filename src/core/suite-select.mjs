/**
 * What may select or run a conditional suite, beyond the paths it names: a change that is only
 * comments selects nothing, and a suite that would build over a running dev server waits for CI.
 *
 * Both came from one adopter's week. A push that reworded a comment in a page ran the build and
 * the browser suite for twelve minutes, and a flaky browser test then blocked a push that changed
 * no behaviour. On the same checkout, the production build run while `next dev` was serving
 * emptied node_modules three times in a day on Windows with pnpm. `--fast` already skipped the
 * suites loudly; this does it for the two cases where running them is wrong, and says why.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { git } from "./repo.mjs";

/**
 * A dev server holding this folder, read from the lock files a preset names for its framework
 * (`.next/dev/lock` for Next.js, which writes its pid there). The pid is asked whether it is alive,
 * so a lock left behind by a crash does not defer the suite forever. Null when none is live.
 * @param {string} dir the folder the suite runs in
 * @param {string[]} [locks] the lock files, relative to `dir`
 * @returns {{ lock: string, pid: number, port?: number } | null}
 */
export function liveDevServer(dir, locks = []) {
  for (const lock of locks) {
    const path = join(dir, lock);
    if (!existsSync(path)) continue;
    let held;
    try {
      held = JSON.parse(readFileSync(path, "utf8"));
    } catch {
      continue; // a lock that is not the shape this reads is not evidence of anything
    }
    const pid = Number(held?.pid);
    if (!Number.isInteger(pid) || pid <= 0 || !alive(pid)) continue;
    return { lock, pid, ...(Number.isInteger(held.port) ? { port: held.port } : {}) };
  }
  return null;
}

/** Signal 0 asks the system whether the process exists; EPERM means it does, owned by another. @param {number} pid */
function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return /** @type {any} */ (e)?.code === "EPERM";
  }
}

/** A line that is a comment or nothing, in the languages the suites build. */
const COMMENT = /^\s*(\/\/|\/\*|\*|#|\{\s*\/\*|<!--|-->|$)/;

/**
 * The files of a range whose every added and removed line is a comment or blank: they change no
 * behaviour, so they select no suite. Read line by line from a zero-context diff; a file the diff
 * cannot show (binary, deleted, renamed) is never counted as comment-only, because a guess that
 * skips a suite is the expensive direction to be wrong in.
 * @param {string} repoDir @param {string} range @param {string[]} files
 * @returns {Set<string>}
 */
export function commentOnly(repoDir, range, files) {
  const only = new Set();
  for (const f of files) {
    const diff = git(repoDir, "diff", "-U0", "--no-color", range, "--", f);
    if (!diff || /^(Binary files|deleted file|rename from|new file)/m.test(diff)) continue;
    const lines = diff
      .split("\n")
      .filter((l) => /^[+-]/.test(l) && !/^(\+\+\+|---)\s/.test(l))
      .map((l) => l.slice(1));
    if (lines.length && lines.every((l) => COMMENT.test(l))) only.add(f);
  }
  return only;
}
