/**
 * Whose failure a red test step is (standard TEST.6). An adopter's pushes were refused four times
 * in a day with no refusal caused by the pushed change: a browser test that failed on timing read
 * exactly like one this push broke, and the only way to tell was to read the whole log. With the
 * step's output kept (src/core/tee-step.mjs), the failing test files are read out of it and set
 * against what the push can reach: a test is this push's when the push changed it or anything it
 * imports. One that nothing changed reaches is said to be likely a flake or the environment, with
 * the file to rerun alone; failing so on more than one commit, it is named as a quarantine
 * candidate. Never retried away: TEST.6 says a flaky test is quarantined with an owner and a date.
 */
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, posix, relative } from "node:path";
import { readJsonFile, readPackage, writeJsonFile } from "./repo.mjs";
import { workspaceFolders, workspaceGlobs } from "../presets/workspaces.mjs";
import { importersOf, reachedBy } from "./imports.mjs";

/** Where the unreached failures are counted, per test file, by the commits they failed on. */
export const FLAKES = ".abatty/flakes.json";

const TEST_FILE = String.raw`[\w./\\:@-]+\.(?:spec|test|e2e)\.[cm]?[jt]sx?`;
/**
 * A failing test file as the runners print one: Playwright's `✘`/numbered `[project] › file`,
 * vitest's and jest's `FAIL file`, Node's `test at file:line` (spec) and `location: 'file:l:c'`
 * (TAP, what it prints when its output is a pipe).
 */
const FAILED = new RegExp(
  String.raw`(?:^|\s)(?:FAIL|✘|×|\d+\)|test at)\s+(?:\d+\s+)?(?:\[[^\]\n]+\]\s+›\s+)?(${TEST_FILE})|location:\s*'(${TEST_FILE}):\d+`,
  "gm",
);

/** Bun's file header (`lib\proxy\a.test.ts:`), under which its `(fail)` lines name the tests. */
const BUN_HEADER = new RegExp(String.raw`^(${TEST_FILE}):\s*$`);
/** A task runner's prefix on every line of a workspace's output: turbo's `@acme/web:test: `. */
const TASK_PREFIX = /^((?:@[\w.-]+\/)?[\w.-]+):[\w.:-]+: ?(.*)$/;

/**
 * A runner saying a test ran out of time, not that it failed an assertion: vitest's `Test timed
 * out in`, jest's `Exceeded timeout of`, Node's `test timed out after` (and its TAP
 * `testTimeoutFailure`), bun's `this test timed out after`, Playwright's `Test timeout of ... exceeded`.
 */
const TIMED_OUT =
  /\b(?:test timed out|this test timed out)\b|Exceeded timeout of \d|Test timeout of \d+\s*ms exceeded|testTimeoutFailure/i;

/** The workspace folder of each package name, for a task runner's prefixed output. @param {string} [repoDir] */
function workspacesByName(repoDir) {
  /** @type {Map<string, string>} */
  const byName = new Map();
  if (!repoDir) return byName;
  for (const ws of workspaceFolders(repoDir, workspaceGlobs(repoDir))) {
    const name = readPackage(join(repoDir, ws)).name;
    if (typeof name === "string" && name) byName.set(name, ws);
  }
  return byName;
}

/**
 * The failing test files a step's output names, each with the folder its path is relative to:
 * the workspace a task runner's prefix names, or the step's own. Reads the runners' `FAIL` and
 * `test at` forms line by line, and bun's, whose `(fail)` lines sit under a file header. Every
 * runner prints a timeout's message after the line naming the failure, so a timeout marks the
 * failure last read in its workspace. A failure is one test where the runner names one: jest's
 * `FAIL file` stands for the whole file until its `●` lines name the tests in it, and a file with
 * one test timed out and another failed on an assertion was read as timed out whole.
 * @param {string} plain @param {Map<string, string>} byName
 * @returns {{ file: string, ws: string, test: boolean, timedOut?: boolean }[]}
 */
function failuresIn(plain, byName) {
  /** @type {{ file: string, ws: string, test: boolean, timedOut?: boolean }[]} */
  const out = [];
  /** @type {Map<string, string>} the bun header last seen, per workspace */
  const header = new Map();
  /** @type {Map<string, { file: string, ws: string, test: boolean, timedOut?: boolean }>} the failure last read, per workspace */
  const last = new Map();
  const found = (
    /** @type {{ file: string, ws: string, test: boolean, timedOut?: boolean }} */ f,
  ) => (out.push(f), last.set(f.ws, f));
  for (const raw of plain.split(/\r?\n/)) {
    const pre = TASK_PREFIX.exec(raw);
    const ws = pre && byName.has(String(pre[1])) ? String(byName.get(String(pre[1]))) : "";
    const line = ws && pre ? String(pre[2]) : raw;
    const head = BUN_HEADER.exec(line.trim());
    if (head) header.set(ws, String(head[1]));
    // Bun's closing summary lists every failure again with no file header above it: read under
    // the last file printed, it named a test that had passed as a flake.
    else if (/^\s*\d+ tests? failed:\s*$/.test(line)) header.delete(ws);
    else if (/^\s*\(fail\)\s/.test(line) && header.has(ws))
      found({ file: String(header.get(ws)), ws, test: true });
    if (head) last.delete(ws);
    for (const m of line.matchAll(FAILED)) {
      // `FAIL file` alone is jest's line for the file; vitest's `FAIL file > name` is a test.
      const whole = /^\s*FAIL\b/.test(m[0]) && !/\s>\s/.test(line.slice(m.index + m[0].length));
      found({ file: String(m[1] || m[2]), ws, test: !whole });
    }
    const failure = last.get(ws);
    if (failure && /^\s*● /.test(line)) {
      if (failure.test) found({ file: failure.file, ws, test: true });
      else failure.test = true;
    } else if (failure && TIMED_OUT.test(line)) failure.timedOut = true;
  }
  return out;
}

/**
 * The test files a step's output reports as failing, repository-relative with forward slashes: an
 * absolute path is made relative to the repository, a relative one is read from the workspace a
 * task runner's prefix names, else from the folder the step ran in (a workspace's step prints
 * paths from its own folder). A replay of 0.7.0-rc.1 on a bun and turbo monorepo went red with no
 * attribution at all: bun's reporter and turbo's prefix were both unread.
 * @param {string} text @param {{ repoDir?: string, cwd?: string }} [o]
 * @returns {string[]}
 */
export function failingTestFiles(text, o = {}) {
  return [...readFailures(text, o).keys()].sort();
}

/**
 * Each failing test file, repository-relative, with how many of its failures timed out and how
 * many failed otherwise.
 * @param {string} text @param {{ repoDir?: string, cwd?: string }} o
 * @returns {Map<string, { timedOut: number, failed: number }>}
 */
function readFailures(text, o) {
  // Colours are codes around the words, and a coloured `FAIL` is still one.
  const plain = text.replace(/\x1b\[[0-9;]*m/g, "");
  const under = o.repoDir && o.cwd ? relative(o.repoDir, o.cwd).replace(/\\/g, "/") : "";
  const fromRepo = (/** @type {{ file: string, ws: string }} */ f) => {
    const file = f.file.replace(/\\\\/g, "\\").replace(/:\d+(:\d+)?$/, "");
    if (isAbsolute(file) && o.repoDir) return relative(o.repoDir, file).replace(/\\/g, "/");
    const slashed = file.replace(/\\/g, "/").replace(/^\.\//, "");
    const base = f.ws || under;
    return base ? posix.join(base, slashed) : slashed;
  };
  /** @type {Map<string, { timedOut: number, failed: number }>} */
  const files = new Map();
  for (const f of failuresIn(plain, workspacesByName(o.repoDir))) {
    const n = files.get(fromRepo(f)) || { timedOut: 0, failed: 0 };
    n[f.timedOut ? "timedOut" : "failed"]++;
    files.set(fromRepo(f), n);
  }
  return files;
}

/** The unreached-failure record, or an empty one when it is missing or damaged: a diagnostic never breaks the gate. @param {string} repoDir */
function readFlakes(repoDir) {
  try {
    const raw = readJsonFile(repoDir, FLAKES);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    return Object.fromEntries(
      Object.entries(raw)
        .filter(([, v]) => Array.isArray(v))
        .map(([k, v]) => [k, v.map(String)]),
    );
  } catch {
    return {};
  }
}

/**
 * What a failed step says about itself: which failing tests this push reaches, which it does not,
 * and which of those have failed unreached before (the count is written here). Nothing is
 * attributed when the push's range is unknown: every file then reads as changed, and an
 * attribution the gate cannot make is not stated as a fact.
 * A test step whose output names no test file says that it could not read one, rather than
 * nothing: silence read as "attribution found nothing to blame".
 * @param {{ repoDir: string, log: string, changed: string[], head: string, cwd?: string, blind?: boolean, tests?: boolean }} o
 * @returns {string[]} the lines to print, empty for a step that is not a test step and names none
 */
export function explainFailure(o) {
  if (!existsSync(o.log)) return [];
  const read = readFailures(readFileSync(o.log, "utf8"), { repoDir: o.repoDir, cwd: o.cwd });
  const failing = [...read.keys()].sort();
  // A test that ran out of time is named apart from one that failed: on an adopter's machine
  // three of five red pushes were 5 s timeouts that passed alone, and read as broken tests. A
  // file where only some timed out says both counts; its assertion failure is no flake.
  const count = (/** @type {string} */ f) => read.get(f) || { timedOut: 0, failed: 0 };
  const timedOut = failing.filter((f) => count(f).timedOut && !count(f).failed);
  const note = (/** @type {string} */ f) => {
    const { timedOut: t, failed } = count(f);
    return !t ? "" : failed ? ` (${t} timed out, ${failed} failed)` : " (timed out)";
  };
  const named = (/** @type {string[]} */ fs) => fs.map((f) => f + note(f)).join(", ");
  if (!failing.length)
    return o.tests
      ? [
          `  no failing test file could be read from the output (${relative(o.repoDir, o.log).replace(/\\/g, "/")}), so whose failure it is is not said`,
        ]
      : [];
  if (o.blind)
    return [
      `  failing: ${named(failing)} · the push's range is unknown here, so whether it caused them is not said`,
    ];
  const reached = reachedBy(importersOf(o.repoDir), o.changed);
  const ours = failing.filter((f) => reached.has(f));
  const others = failing.filter((f) => !reached.has(f));
  /** @type {Record<string, string[]>} */
  const seen = readFlakes(o.repoDir);
  for (const f of others) seen[f] = [...new Set([...(seen[f] || []), o.head])].slice(-20);
  if (others.length)
    try {
      writeJsonFile(o.repoDir, FLAKES, seen);
    } catch {
      // A record that cannot be written is a record lost, not a gate broken.
    }
  const repeat = others.filter((f) => (seen[f] || []).length > 1);
  const lines = [];
  if (ours.length)
    lines.push(
      `  failing, and this change (the push, or the working tree) touched them or what they import: ${named(ours)}`,
    );
  if (others.length)
    lines.push(
      `  failing, and nothing this change touched reaches them through their imports: ${named(others)} · a flake, the environment, or a change outside the code (a config, a lockfile); rerun one alone to tell`,
    );
  if (repeat.length)
    lines.push(
      `  failed unreached on more than one commit: ${repeat.map((f) => `${f} (${(seen[f] || []).length})`).join(", ")} · if it is a flake, quarantine it with an owner and a date (TEST.6), never retry it away (${FLAKES})`,
    );
  if (timedOut.length)
    lines.push(
      `  timed out rather than failed: ${timedOut.join(", ")} · a test that runs out of time and passes alone is slow or waiting on the machine or a service; rerun it alone, then give it the time it needs or quarantine it (TEST.6)`,
    );
  return lines;
}
