/**
 * Where a planted failing test has to sit for a repository's OWN test script to run it. The
 * script may name its tests directly (a glob, a folder), through the files it hands over (a
 * runner config, or a wrapper that prepares a database and then calls the runner), or through a
 * task runner that runs each workspace's own script (`turbo run test`). A control planted where
 * none of those look stays green, and a working suite reads as absent, which refuses every
 * night: the replays of 0.7.0-rc.1 met a wrapper on one product and a turbo monorepo on another.
 * What this cannot read, `controls` in the config names (step-controls.mjs). Every path it
 * returns is inside the repository.
 */
import { readFileSync, statSync } from "node:fs";
import { join, posix } from "node:path";
import { readPackage } from "./repo.mjs";
import { workspaceFolders, workspaceGlobs } from "../presets/workspaces.mjs";

/** A test file glob as a string literal: `tests/integration/**\/*.test.ts`, braces allowed. */
const GLOB = String.raw`((?:\.{1,2}\/)*[\w@./*-]*\*[\w@./*-]*\.(?:test|spec)\.(?:[cm]?[jt]sx?|\{[^}"'\x60]+\}))`;
const GLOB_IN_TEXT = new RegExp(String.raw`["'\x60]${GLOB}["'\x60]`);
/** The same glob where a runner reads its tests from: `include` (vitest), `testMatch` (jest, Playwright). */
const INCLUDED = new RegExp(String.raw`(?:include|testMatch)\s*:\s*\[?\s*["'\x60]${GLOB}["'\x60]`);
/** A key whose globs are what a runner does NOT read. */
const EXCLUDED = /(?:exclude|testPathIgnorePatterns|coveragePathIgnorePatterns)\s*:\s*\[[^\]]*\]/g;
/** A file a script or a wrapper names, as a token or a string literal. */
const FILE_REF = /^[\w@./-]+\.(?:[cm]?[jt]s|json)$/;
/** How far a wrapper is followed: the script's own files, then the files they name. */
const DEPTH = 2;
/** A script that runs nothing: a workspace whose task says so is not where tests run. */
const NO_OP = /^\s*(?:echo\b|true\b|exit 0\b)/;
/** A task runner's flags whose next word is a value, not the task. */
const VALUED = /^(?:--filter|-F|--scope|-p|--projects|--concurrency)$/;
/** Heads whose next word is a subcommand (`bun test`, `playwright test`), never a folder. */
const SUBCOMMANDED = /^(?:bun|npm|pnpm|yarn|deno|playwright|npx)$/;
/** Flags whose next word is their value (`--test-reporter spec`), never a folder. */
const FLAG_VALUE =
  /^(?:--(?:test-)?reporter|--test-name-pattern|--config|-c|-t|--testNamePattern)$/;

/**
 * @typedef {{ extOf: (dir: string) => string, rootOf: (dir: string) => string, mark: string }} PlantHow
 */

/** A repository-relative path, normalised, or "" when it leaves the repository. @param {string} rel */
function inside(rel) {
  const p = posix.normalize(rel.replace(/\\/g, "/")).replace(/^\.\//, "");
  return p === "." || p.startsWith("../") || p === ".." || /^(?:\/|[A-Za-z]:)/.test(p) ? "" : p;
}

/**
 * The files a text names that exist in the repository, outside node_modules: a `./` or `../`
 * name from the folder of the file that names it, any other from the root, then from there.
 * @param {string} dir @param {string[]} words @param {string} [base] the naming file's folder
 */
function namedFiles(dir, words, base = "") {
  /** @type {string[]} */
  const out = [];
  for (const raw of words) {
    const w = raw.replace(/^['"`]|['"`]$/g, "");
    if (!FILE_REF.test(w)) continue;
    const tries = /^\.{1,2}\//.test(w) ? [posix.join(base, w)] : [w, posix.join(base, w)];
    for (const t of tries.map(inside)) {
      if (!t || t.startsWith("node_modules/")) continue;
      try {
        if (statSync(join(dir, t)).isFile()) {
          out.push(t);
          break;
        }
      } catch {
        /* not a file here */
      }
    }
  }
  return out;
}

/** A folder of the repository, outside node_modules. @param {string} dir @param {string} word */
function isFolder(dir, word) {
  const p = inside(word);
  if (!p || !/^[\w@][\w@./-]*$/.test(p) || p.startsWith("node_modules")) return false;
  try {
    return statSync(join(dir, p)).isDirectory();
  } catch {
    return false;
  }
}

/** The test glob a file's text names, preferring what a runner includes over any literal. @param {string} text */
function globIn(text) {
  const read = text.replace(EXCLUDED, "");
  const m = INCLUDED.exec(read) || GLOB_IN_TEXT.exec(read);
  return m && m[1] ? m[1].replace(/\{([^,}]+)[^}]*\}/, "$1") : "";
}

/**
 * The first test glob a script reaches: in its own words, else in the files it names, followed
 * `DEPTH` levels deep. A runner config's glob is relative to the config's own folder.
 * @param {string} dir @param {string[]} tokens
 */
function reachedGlob(dir, tokens) {
  const direct = tokens.find((t) => t.includes("*") && /\.[cm]?[jt]sx?$/.test(t));
  if (direct) return direct;
  const seen = new Set();
  let frontier = namedFiles(dir, tokens);
  for (let level = 0; level < DEPTH && frontier.length; level++) {
    /** @type {string[]} */
    const next = [];
    for (const f of frontier) {
      if (seen.has(f)) continue;
      seen.add(f);
      const text = readFileSync(join(dir, f), "utf8");
      const base = posix.dirname(f) === "." ? "" : posix.dirname(f);
      const glob = globIn(text);
      if (glob) return /config\./.test(f) ? posix.join(base, glob) : glob;
      const literals = [...text.matchAll(/["'`]([^"'`\s]+)["'`]/g)].map((x) => String(x[1]));
      next.push(...namedFiles(dir, literals, base));
    }
    frontier = next;
  }
  return "";
}

/**
 * The task a script hands to every workspace and the workspace it filters to, or no task:
 * `turbo run test --filter=web`, `nx run-many -t test`, `pnpm -r test`, `npm run test
 * --workspaces`, `bun --filter '*' test`. A plain `npm run test` is not one: it runs this
 * package's own script. @param {string[]} tokens
 */
function delegatedTask(tokens) {
  const [head = ""] = tokens;
  const fansOut =
    /^(?:turbo|nx|lerna)$/.test(head) ||
    (/^(?:npm|pnpm|yarn|bun)$/.test(head) &&
      tokens.some((t) => /^(?:-r|--recursive|--workspaces|-ws|--filter|-F)(?:=|$)/.test(t)));
  if (!fansOut) return { task: "", filter: "" };
  let task = "";
  let filter = "";
  for (let i = 1; i < tokens.length; i++) {
    const t = String(tokens[i]);
    const eq = /^(--[\w-]+)=(.*)$/.exec(t);
    const flag = eq ? String(eq[1]) : t;
    const value = eq ? String(eq[2]) : String(tokens[i + 1] || "");
    if (/^(?:-t|--target|--targets)$/.test(flag)) task = value;
    else if (/^(?:--filter|-F|--scope|-p|--projects)$/.test(flag)) filter ||= value;
    else if (!t.startsWith("-") && !/^(?:run|run-many|exec|workspaces?)$/.test(t)) task ||= t;
    if (!eq && (VALUED.test(flag) || /^(?:-t|--target|--targets)$/.test(flag))) i++;
  }
  return { task, filter: filter.replace(/^\.\//, "").replace(/\.\.\.$|^\{|\}$/g, "") };
}

/**
 * The workspace whose own script for the task runs something, and that script: the one the
 * filter names (by package name or folder) when there is one, else the first in folder order.
 * @param {string} dir @param {string} task @param {string} filter
 */
function workspaceRunning(dir, task, filter) {
  /** @type {{ ws: string, script: string }[]} */
  const running = [];
  for (const ws of workspaceFolders(dir, workspaceGlobs(dir))) {
    const pkg = readPackage(join(dir, ws));
    const script = pkg.scripts?.[task];
    if (typeof script !== "string" || NO_OP.test(script)) continue;
    const names = [
      ws,
      ws.split("/").pop(),
      pkg.name,
      String(pkg.name || "")
        .split("/")
        .pop(),
    ];
    if (filter && names.includes(filter)) return { ws, script };
    running.push({ ws, script });
  }
  return running[0] || null;
}

/**
 * Whether a script's word is a folder its runner is handed: not a subcommand (`bun test`), not a
 * script's or a task's name (`npm run test`), not a flag's value (`--test-reporter spec`).
 * @param {string} dir @param {string[]} tokens @param {number} i
 */
function isFolderArg(dir, tokens, i) {
  const token = String(tokens[i]);
  const head = String(tokens[0]);
  const prev = String(tokens[i - 1] || "");
  if (i === 0 || token.startsWith("-") || FLAG_VALUE.test(prev)) return false;
  if (i === 1 && SUBCOMMANDED.test(head)) return false;
  if (prev === "run" && /^(?:npm|pnpm|yarn|bun)$/.test(head)) return false;
  if (head === "yarn" && tokens[1] === "workspace" && i <= 3) return false;
  return /^\.?\/?(tests?|__tests__|spec)\/?$/.test(token) || isFolder(dir, token);
}

/**
 * The path a failing test has to take for the repository's own test script to run it: the first
 * test glob the script reaches decides the folder and the name; a task runner defers to the
 * workspace that runs the task; a folder handed to a runner decides the folder. With none of
 * these (`vitest run`), the convention-based path, because the runner's own default finds it.
 * @param {string} dir the repository @param {string} script @param {PlantHow} how
 * @returns {string}
 */
export function testPlantPath(dir, script, how) {
  const tokens = String(script || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token.replace(/^['"]|['"]$/g, ""));
  const glob = inside(reachedGlob(dir, tokens));
  if (glob) {
    const parts = glob.split("/");
    const name = String(parts.pop() || "").replace(/\*+/g, how.mark);
    const folder = parts.filter((part) => !part.includes("*")).join("/");
    return folder ? `${folder}/${name}` : name;
  }
  const { task, filter } = delegatedTask(tokens);
  if (task) {
    const w = workspaceRunning(dir, task, filter);
    if (w) return `${w.ws}/${testPlantPath(join(dir, w.ws), w.script, how)}`;
  }
  // A folder handed to the runner (`node --test test/`, the form every Node accepts, where the
  // glob form needs 21; `bun test src/`; `vitest run tests/unit`) is searched by the runner's
  // own patterns, which a `.test` name meets.
  const at = task ? -1 : tokens.findIndex((_, i) => isFolderArg(dir, tokens, i));
  const folder = at >= 0 ? inside(String(tokens[at])) : "";
  const ext = how.extOf(dir);
  if (folder) return `${folder.replace(/\/$/, "")}/${how.mark}.test${ext}`;
  return `${how.rootOf(dir)}/${how.mark}.test${ext}`;
}
