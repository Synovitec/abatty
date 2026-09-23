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
import { codeOnly } from "../ratchet/probes/lex.mjs";

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
    return /** @type {NodeJS.ErrnoException} */ (e)?.code === "EPERM";
  }
}

/** The sources whose comments the lexer reads; any other file is never judged comment-only. */
const LEXED = /\.(ts|tsx|js|jsx|mjs|cjs|mts|cts)$/;

/**
 * A comment that changes what a tool does: a coverage ignore, a type or lint switch, a bundler
 * or JSX pragma. Adding one is a change of behaviour, so it is never read as prose.
 */
const DIRECTIVE =
  /@ts-|eslint-|oxlint-|biome-ignore|prettier-ignore|(istanbul|c8|v8)\s+ignore|webpack\w*:|@vite-ignore|@jsx|@refresh|["']use (client|server|strict)["']/;

/**
 * A source as behaviour sees it, or null when this cannot tell. Every line the lexer changed
 * must be a comment and nothing else once blanked: a comment after code, or text the lexer
 * mistook for one (a `//` inside a regular expression literal, a URL in JSX text), makes the file
 * unjudgeable rather than quiet. Comment lines are dropped, and the directives among them kept
 * apart so adding one still counts; every other line, blank ones and template literals included,
 * is compared exactly.
 * @param {string} text
 * @returns {string | null}
 */
function reading(text) {
  const src = text.split("\n");
  const out = codeOnly(text, { strings: "keep" }).split("\n");
  const code = [];
  const directives = [];
  for (const [i, line] of src.entries()) {
    const blanked = out[i] ?? "";
    if (line === blanked) code.push(blanked);
    else if (blanked.trim()) return null;
    else if (DIRECTIVE.test(line)) directives.push(line.trim());
  }
  return `${code.join("\n")}\0${directives.sort().join("\n")}`;
}

/**
 * The files of a range whose two versions differ only in whole-line comments: they change
 * no behaviour, so they select no suite. Both versions are read whole and compared with their
 * comments blanked by the probes' lexer, rather than judged line by line from a diff, where a
 * CSS `#id` selector or a `* 2` continuation reads as a comment. Only the languages the lexer
 * knows are judged, and a file missing at either end is never counted: a guess that skips a
 * suite is the expensive direction to be wrong in.
 * @param {string} repoDir @param {string} range `from..to`; a three-dot range judges nothing
 * @param {string[]} files
 * @returns {Set<string>}
 */
export function commentOnly(repoDir, range, files) {
  const only = new Set();
  const ends = range.includes("...") ? [] : range.split("..");
  if (ends.length !== 2) return only;
  for (const f of files.filter((p) => LEXED.test(p))) {
    const [before, after] = ends.map((ref) => git(repoDir, "show", `${ref}:${f}`));
    if (!before || !after || before === after) continue;
    const was = reading(before);
    if (was !== null && was === reading(after)) only.add(f);
  }
  return only;
}
