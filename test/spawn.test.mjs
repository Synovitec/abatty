import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { launch, notInstalled, quoteForCmd, runCommand } from "../src/core/spawn.mjs";
import { scriptProgram } from "../src/core/which.mjs";

// The launcher fix is proved on the platform it is for and on the platforms it must leave alone:
// a launch decision is a pure function of the name and the platform, so both sides are asserted
// wherever the suite runs, and one real spawn proves the launcher actually starts here.

test("a tool launcher on Windows gets cmd.exe with its arguments quoted; nothing else gets a shell", () => {
  const was = Object.getOwnPropertyDescriptor(process, "platform");
  try {
    Object.defineProperty(process, "platform", { value: "win32" });
    const l = launch("npm", ["run", "-s", "gate", "--", "--range", "a b..HEAD"]);
    assert.equal(l.file, "npm.cmd");
    assert.equal(l.shell, true, "a batch file is a script for cmd.exe: EINVAL without one");
    assert.deepEqual(l.args, ["run", "-s", "gate", "--", "--range", '"a b..HEAD"']);
    const exe = launch("git", ["status"]);
    assert.deepEqual(exe, { file: "git", args: ["status"], shell: false });

    Object.defineProperty(process, "platform", { value: "linux" });
    const posix = launch("npm", ["run", "-s", "gate", "--", "--range", "a b..HEAD"]);
    assert.deepEqual(posix, {
      file: "npm",
      args: ["run", "-s", "gate", "--", "--range", "a b..HEAD"],
      shell: false,
    });
  } finally {
    if (was) Object.defineProperty(process, "platform", was);
  }
});

test("quoting for cmd.exe: what the shell would read is fenced, what it would not is untouched", () => {
  assert.equal(quoteForCmd("--max-warnings=0"), "--max-warnings=0");
  assert.equal(quoteForCmd("src/**/*.ts"), "src/**/*.ts");
  assert.equal(quoteForCmd("a b"), '"a b"');
  assert.equal(quoteForCmd("x&y"), '"x&y"');
  assert.equal(quoteForCmd('say "hi"'), '"say \\"hi\\""');
  assert.equal(quoteForCmd(""), '""', "an empty argument must survive the join");
});

test("every launcher on this machine's PATH starts through launch(): npm always, pnpm, yarn and bun where they are installed", () => {
  // Before this fix the same call answered `EINVAL: spawnSync npm.cmd EINVAL` on Windows, and the
  // gate stopped at its first step with "the instrument, not the work" for two days. npm is on
  // every machine the suite runs on; the others are proved wherever they are found (the Windows
  // job in CI installs pnpm for exactly this case), and named as absent otherwise rather than
  // silently passed over.
  const onPath = (/** @type {string} */ name) =>
    spawnSync(process.platform === "win32" ? "where" : "which", [name], { stdio: "ignore" })
      .status === 0;
  const found = ["npm", "pnpm", "yarn", "bun"].filter(onPath);
  assert.ok(found.includes("npm"), "npm is the floor");
  for (const name of found) {
    const r = runCommand(tmpdir(), [name, "--version"]);
    assert.equal(r.errored, undefined, `${name}: ${r.detail}`);
    assert.equal(r.code, 0, `${name} --version`);
  }
  console.log(`launchers proved: ${found.join(", ")}`);
});

test("cmd.exe's exit 1 is read again: a script whose program is found nowhere could not run", () => {
  const dir = mkdtempSync(join(tmpdir(), "abatty-which-"));
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({
      scripts: {
        lint: "abatty-no-such-tool-xyz . --max-warnings=0",
        local: "CI=1 localtool --check",
        builtin: "echo hi",
        path: "./bin/run",
      },
    }),
  );
  mkdirSync(join(dir, "node_modules", ".bin"), { recursive: true });
  writeFileSync(join(dir, "node_modules", ".bin", "localtool.cmd"), "");
  const env = { PATH: "", PATHEXT: ".CMD" };
  const failed = { code: 1 };
  const missing = notInstalled(failed, dir, "lint", "win32", env);
  assert.equal(missing.errored, true);
  assert.equal(missing.code, 127);
  assert.match(missing.detail || "", /abatty-no-such-tool-xyz: not installed/);
  // the tool's own verdict stands wherever the program is found or cannot be read
  assert.deepEqual(notInstalled(failed, dir, "local", "win32", env), failed, "node_modules/.bin");
  assert.deepEqual(notInstalled(failed, dir, "builtin", "win32", env), failed, "a builtin");
  assert.deepEqual(
    notInstalled(failed, dir, "path", "win32", env),
    failed,
    "a path is the shell's",
  );
  // and nothing changes where the shell already says 127, or for another exit code
  assert.deepEqual(notInstalled(failed, dir, "lint", "linux", env), failed);
  assert.deepEqual(notInstalled({ code: 2 }, dir, "lint", "win32", env), { code: 2 });
  assert.equal(scriptProgram("NODE_ENV=test FOO=1 vitest run"), "vitest");
  assert.equal(scriptProgram('"C:/x y/tool" a'), null);
});
