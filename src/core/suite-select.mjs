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
import { appHomes, suiteReads } from "../presets/app-homes.mjs";

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

/**
 * Whether a suite's paths match a file the push or the tree touches: under a workspace's folder
 * for a workspace's preset, and from the root or the app's homes for the root's
 * (src/presets/app-homes.mjs).
 * @param {RegExp} paths @param {string[]} files @param {string} under "" for the root
 * @param {string[]} homes the root app's homes
 */
export function selectedByPath(paths, files, under, homes) {
  return under
    ? files.some((f) => f.startsWith(under) && paths.test(f.slice(under.length)))
    : files.some((f) => suiteReads(paths, f, homes));
}

/**
 * A selected suite whose testing steps have no script: no step but `build` has one, so nothing
 * would be judged and nothing runs. It built the app on every push, only to skip the tests after
 * it. Returned with what the gate records and says; null when a testing step has its script
 * (integration without coverage runs).
 * @param {import("../presets/index.mjs").GateSuite} suite @param {string} name as the gate labels it
 * @param {(s: import("../presets/index.mjs").GateStep) => boolean} has
 * @returns {{ event: import("./gate.mjs").GateEvent, says: string } | null}
 */
export function untestedSuite(suite, name, has) {
  const judging = suite.steps.filter((s) => s.script !== "build");
  const own = judging[judging.length - 1];
  if (!own?.script || judging.some((s) => s.required || has(s))) return null;
  const names = [own.script, ...(own.alternatives || [])].join(", ");
  return {
    event: { label: name, outcome: "skipped", detail: `no ${names} script` },
    says: `\n! ${name}: selected by this push, and package.json has no ${names} script, so nothing ran. Add one to run the suite on every push that touches it.`,
  };
}

/**
 * The root app's homes in this repository: the folders holding its marker that no workspace with
 * a preset of its own covers (src/presets/app-homes.mjs).
 * @param {string} repoDir @param {import("../presets/index.mjs").Preset} preset
 * @param {{ path: string }[]} gated the workspaces with a preset
 */
export function suiteHomes(repoDir, preset, gated) {
  return appHomes(
    preset,
    git(repoDir, "ls-files").split("\n"),
    gated.map((w) => w.path),
  );
}

/**
 * Every suite recorded as skipped by `--fast`, the root's and each gated workspace's, so the
 * report counts them rather than leaving them out.
 * @param {import("../presets/index.mjs").Preset} preset
 * @param {{ path: string, preset: import("../presets/index.mjs").Preset | null }[]} gated
 * @param {import("./gate.mjs").GateEvent[]} events
 */
export function skipSuitesFast(preset, gated, events) {
  for (const suite of preset.gate.suites)
    events.push({ label: suite.name, outcome: "skipped", detail: "--fast" });
  for (const w of gated)
    for (const suite of w.preset?.gate.suites || [])
      events.push({ label: `${w.path} · ${suite.name}`, outcome: "skipped", detail: "--fast" });
}
