import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { localToday } from "../src/core/today.mjs";
import { GIT_REPO_VARS } from "../src/core/env.mjs";

// The suite is hermetic: the harness a developer installed in THIS repository exports
// ADOPTION_CONFIG for every child process, and inherited into a fixture it points the hooks at a
// file that is not there, so they run on defaults and the checks that read the config find
// nothing. Every test file imports this one, so clearing it here clears it for all of them.
delete process.env.ADOPTION_CONFIG;
// The same for git's own: a pre-push hook run from a linked worktree exports an absolute GIT_DIR,
// and every fixture's `git init` and commit went into this repository instead of its own.
for (const k of GIT_REPO_VARS) delete process.env[k];

// Every fixture is removed when the test process ends: they were left in the temp folder, about
// 750 a run, and a contributor machine held 126,103 of them. Kept with ABATTY_KEEP_FIXTURES=1
// to read one after a failure. rmSync does not follow a link, so a fixture linking elsewhere
// removes only the link.
/** @type {string[]} */
const fixtures = [];
process.on("exit", () => {
  if (process.env.ABATTY_KEEP_FIXTURES === "1") return;
  for (const dir of fixtures) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // A file a child still holds on Windows: left for the system to clear.
    }
  }
});

/** A fresh temp directory that is a git repository with one commit on main. @param {string} name @param {Record<string,string>} [files] */
export function tempRepo(name, files = {}) {
  const dir = mkdtempSync(join(tmpdir(), `abatty-${name}-`));
  fixtures.push(dir);
  for (const [rel, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), content);
  }
  git(dir, "init", "-q", "-b", "main");
  git(dir, "config", "user.email", "test@example.com");
  git(dir, "config", "user.name", "Test");
  git(dir, "config", "core.autocrlf", "false");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "--allow-empty", "-m", "init");
  return dir;
}

/**
 * Run something in a named timezone, and put the old one back whatever happens.
 *
 * Every date this package compares is a local date, so a suite that only ever runs at UTC cannot
 * see a whole class of defect: it is invisible at Greenwich and real for everybody else in the
 * offset window either side of midnight. Cases that care pin a zone with this.
 * @template T @param {string} tz @param {() => T} fn @returns {T}
 */
export function inTimezone(tz, fn) {
  const was = process.env.TZ;
  process.env.TZ = tz;
  try {
    return fn();
  } finally {
    // Deleting TZ does not put the clock back on Windows: Node keeps the last zone it was set
    // to, and every later case ran in whatever the previous one pinned. The system's zone, read
    // once before anything was pinned, is restored by name.
    process.env.TZ = was === undefined ? SYSTEM_ZONE : was;
  }
}

/**
 * Run something that stamps today's local date, and return it with the days it may have stamped:
 * the one it started on and the one it ended on. A case that read the day only afterwards failed
 * when the run crossed local midnight, which the skewed-clock job makes happen at noon UTC.
 * @template T @param {() => T} run @returns {{ result: T, days: string[] }}
 */
export function aroundToday(run) {
  const before = localToday();
  const result = run();
  return { result, days: [...new Set([before, localToday()])] };
}

/** The machine's own zone, read before any case pins another. */
const SYSTEM_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * git in a folder. On Windows git does not get TZ: it reads a zone NAME there as UTC, and a case
 * that pinned the machine's own zone by name then committed on yesterday's date between midnight
 * and two in Paris, which is when a date test first failed. Without TZ it writes the system's
 * zone, the one the context reads too.
 * @param {string} dir @param {string[]} args
 */
export function git(dir, ...args) {
  const env = { ...process.env };
  if (process.platform === "win32") delete env.TZ;
  const r = spawnSync("git", args, { cwd: dir, encoding: "utf8", env });
  return (r.stdout || "").trim();
}

/** Run the CLI; { code, out } with stdout and stderr joined. @param {string[]} args @param {string} cwd @param {Record<string,string>} [env] extra variables for the child */
export function cli(args, cwd, env = {}) {
  const r = spawnSync(
    process.execPath,
    [new URL("../bin/abatty.mjs", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"), ...args],
    {
      cwd,
      encoding: "utf8",
      // The agent's executable is a fact of the machine, never of the repository; the tests hand
      // the stub to the self-test so "agent on PATH" is proven by the stub where none is set.
      env: {
        ...process.env,
        ADOPTION_RUN: "",
        // The harness a developer installed in THIS repository exports it for every child
        // process; inherited into a fixture it points the hooks at a file that is not there and
        // they run on defaults, so the suite must not read the machine's.
        ADOPTION_CONFIG: "",
        // The screens as written, whatever console runs the suite: a classic Windows console
        // would read ASCII and every case that matches a symbol would fail there only.
        ABATTY_ASCII: "0",
        ABATTY_AGENT: process.env.ABATTY_AGENT || STUB_AGENT,
        ...env,
      },
    },
  );
  return { code: r.status ?? 1, out: (r.stdout || "") + (r.stderr || "") };
}

/** The stub agent shipped with the harness templates, as a path the self-test can execute. */
export const STUB_AGENT = new URL(
  `../templates/harness/testing/stub-agent.${process.platform === "win32" ? "cmd" : "sh"}`,
  import.meta.url,
).pathname.replace(/^\/([A-Z]:)/, "$1");

/** A minimal Next-shaped package.json. */
export const NEXT_PKG =
  JSON.stringify(
    {
      name: "fixture-next",
      version: "0.1.0",
      private: true,
      scripts: { test: "node -e process.exit(0)", build: "node -e process.exit(0)" },
      dependencies: { next: "15.0.0", react: "19.0.0" },
    },
    null,
    2,
  ) + "\n";
