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
 * `test at` forms line by line, and bun's, whose `(fail)` lines sit under a file header.
 * @param {string} plain @param {Map<string, string>} byName
 * @returns {{ file: string, ws: string }[]}
 */
function failuresIn(plain, byName) {
  /** @type {{ file: string, ws: string }[]} */
  const out = [];
  /** @type {Map<string, string>} the bun header last seen, per workspace */
  const header = new Map();
  for (const raw of plain.split(/\r?\n/)) {
    const pre = TASK_PREFIX.exec(raw);
    const ws = pre && byName.has(String(pre[1])) ? String(byName.get(String(pre[1]))) : "";
    const line = ws && pre ? String(pre[2]) : raw;
    const head = BUN_HEADER.exec(line.trim());
    if (head) header.set(ws, String(head[1]));
    else if (/^\s*\(fail\)\s/.test(line) && header.has(ws))
      out.push({ file: String(header.get(ws)), ws });
    for (const m of line.matchAll(FAILED)) out.push({ file: String(m[1] || m[2]), ws });
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
  return [...new Set(failuresIn(plain, workspacesByName(o.repoDir)).map(fromRepo))].sort();
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
  const failing = failingTestFiles(readFileSync(o.log, "utf8"), { repoDir: o.repoDir, cwd: o.cwd });
  if (!failing.length)
    return o.tests
      ? [
          `  no failing test file could be read from the output (${relative(o.repoDir, o.log).replace(/\\/g, "/")}), so whose failure it is is not said`,
        ]
      : [];
  if (o.blind)
    return [
      `  failing: ${failing.join(", ")} · the push's range is unknown here, so whether it caused them is not said`,
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
    lines.push(`  failing, and this push changed them or what they import: ${ours.join(", ")}`);
  if (others.length)
    lines.push(
      `  failing, and nothing this push changed reaches them through their imports: ${others.join(", ")} · a flake, the environment, or a change outside the code (a config, a lockfile); rerun one alone to tell`,
    );
  if (repeat.length)
    lines.push(
      `  failed unreached on more than one commit: ${repeat.map((f) => `${f} (${(seen[f] || []).length})`).join(", ")} · if it is a flake, quarantine it with an owner and a date (TEST.6), never retry it away (${FLAKES})`,
    );
  return lines;
}
