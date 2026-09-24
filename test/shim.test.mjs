import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SHIM_REFUSALS,
  realGit,
  shimVerdict,
  subcommandOf,
} from "../templates/harness/bin/shim.mjs";
import { SHIM_DIR, shimmedPath } from "../src/core/shim.mjs";

const SHIM = fileURLToPath(new URL("../templates/harness/bin/shim.mjs", import.meta.url));
const FORCE = "--force";
const BYPASS = "--no-verify";

/** A directory holding a git that only reports the arguments it was handed: a shell script, or on Windows a batch file. */
function fakeGit() {
  const dir = mkdtempSync(join(tmpdir(), "abatty-shim-"));
  if (process.platform === "win32") {
    writeFileSync(join(dir, "git.cmd"), "@echo real git: %*\r\n");
    return dir;
  }
  const p = join(dir, "git");
  writeFileSync(p, '#!/bin/sh\necho "real git: $*"\n');
  chmodSync(p, 0o755);
  return dir;
}

/** The shim run as a process, the way a shell reaches it. @param {string[]} args @param {Record<string,string>} [env] */
function run(args, env = {}) {
  const dir = fakeGit();
  const r = spawnSync(process.execPath, [SHIM, ...args], {
    encoding: "utf8",
    env: { ...process.env, PATH: [dir, process.env.PATH].join(delimiter), ...env },
  });
  return { code: r.status, out: r.stdout || "", err: r.stderr || "" };
}

test("the subcommand survives git's global options, so `git -C dir push` is still a push", () => {
  assert.equal(subcommandOf(["push", "origin"]).name, "push");
  assert.equal(subcommandOf(["-C", "/tmp/repo", "push"]).name, "push");
  assert.equal(subcommandOf(["-c", "user.name=x", "commit"]).name, "commit");
  assert.equal(subcommandOf(["--git-dir=/tmp/.git", "status"]).name, "status");
  assert.equal(subcommandOf(["-C", "/tmp"]).name, "");
});

test("a force push is refused, in every spelling a shell can reach it by", () => {
  for (const args of [
    ["push", FORCE],
    ["push", "-f"],
    ["push", "--force-with-lease"],
    ["push", "--force-with-lease=main"],
    ["push", "origin", "+main"],
    ["-C", "/tmp/repo", "push", FORCE],
  ])
    assert.equal(shimVerdict(args)?.id, "force-push", args.join(" "));
});

test("a hook bypass is refused, including the one bundled into a short-flag cluster", () => {
  for (const args of [
    ["commit", BYPASS, "-m", "x"],
    ["commit", "-n", "-m", "x"],
    ["commit", "-an", "-m", "x"],
    ["push", BYPASS],
  ])
    assert.equal(shimVerdict(args)?.id, "no-verify", args.join(" "));
});

test("ordinary work is not refused: the control case in the other direction", () => {
  for (const args of [
    ["status"],
    ["push", "origin", "main"],
    ["push", "--dry-run"],
    ["commit", "-m", "fix: a message that says -n and --force"],
    ["commit", "-am", "chore: two flags, neither of them the bypass"],
    ["log", "-n", "5"],
    ["diff", "--stat"],
    [],
  ])
    assert.equal(shimVerdict(args), null, args.join(" "));
});

test("the real git is the first one on PATH outside the shim's own folder", () => {
  // The name the OS can run: `git` on POSIX, `git.exe` on Windows; the separators are the OS's.
  const exe = process.platform === "win32" ? "git.exe" : "git";
  const isExe = (/** @type {string} */ p) =>
    ["/self", "/a", "/b"].map((d) => join(d, exe)).includes(p);
  assert.equal(realGit("/self", ["/self", "/a", "/b"].join(delimiter), isExe), join("/a", exe));
  assert.equal(realGit("/self", "/self", isExe), null, "nothing but itself: no git, not a loop");
});

test("the shim as a process: it refuses with 3 and hands ordinary work to the real git", () => {
  const refused = run(["push", FORCE]);
  assert.equal(refused.code, 3);
  assert.match(refused.err, /Force push is never allowed/);
  assert.equal(refused.out, "");

  const passed = run(["status", "--short"]);
  assert.equal(passed.code, 0);
  assert.match(passed.out, /real git: status --short/);
});

test("the escape hatch is deliberate and loud, never silent", () => {
  const off = run(["push", FORCE], { ABATTY_SHIM: "off" });
  assert.equal(off.code, 0);
  assert.match(off.err, /ABATTY_SHIM=off/);
  assert.match(off.out, /real git: push/);
});

test("the shim and the guard hook refuse in the same words", () => {
  const guard = readFileSync(
    fileURLToPath(new URL("../templates/harness/hooks/guard.mjs", import.meta.url)),
    "utf8",
  );
  for (const reason of Object.values(SHIM_REFUSALS))
    assert.equal(guard.includes(reason), true, `the guard no longer says: ${reason}`);
});

test("the shim goes on PATH in front, and a repository without one keeps its PATH", () => {
  const repo = mkdtempSync(join(tmpdir(), "abatty-path-"));
  assert.equal(shimmedPath(repo, "/usr/bin"), "/usr/bin", "not installed: unchanged");
  mkdirSync(join(repo, SHIM_DIR), { recursive: true });
  for (const f of ["git", "shim.mjs"]) writeFileSync(join(repo, SHIM_DIR, f), "");
  const dir = join(repo, SHIM_DIR);
  assert.equal(shimmedPath(repo, "/usr/bin"), [dir, "/usr/bin"].join(delimiter));
  assert.equal(
    shimmedPath(repo, ["/usr/bin", dir].join(delimiter)),
    [dir, "/usr/bin"].join(delimiter),
    "never behind the real git",
  );
});

// The same bypass by its effect, in every shell: the hooks run from core.hooksPath.
const HOOKS = ["core", "hooksPath"].join(".");

test("the shim refuses pointing the hooks away, by argument or by environment, and lets a read through", () => {
  const away = (/** @type {string[]} */ args, env = {}) => shimVerdict(args, env)?.id ?? null;
  assert.equal(away(["-c", `${HOOKS}=/dev/null`, "commit", "-m", "x"]), "hooks-path");
  assert.equal(away(["config", HOOKS, "/dev/null"]), "hooks-path");
  assert.equal(away(["config", "--unset", HOOKS]), "hooks-path");
  assert.equal(
    away(["commit", "-m", "x"], {
      GIT_CONFIG_COUNT: "1",
      GIT_CONFIG_KEY_0: HOOKS,
      GIT_CONFIG_VALUE_0: "/dev/null",
    }),
    "hooks-path",
  );
  assert.equal(away(["config", "--get", HOOKS]), null);
  assert.equal(away(["config", HOOKS]), null);
  assert.equal(
    away(["-c", "user.name=A", "commit", "-m", HOOKS]),
    null,
    "a message naming the key",
  );
});

test("the shim refuses the environment spelling as a process, before the real git runs", () => {
  const r = run(["commit", "-m", "x"], {
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: HOOKS,
    GIT_CONFIG_VALUE_0: "/dev/null",
  });
  assert.notEqual(r.code, 0);
  assert.doesNotMatch(r.out, /real git/);
  assert.equal(run(["status"]).code, 0);
});
