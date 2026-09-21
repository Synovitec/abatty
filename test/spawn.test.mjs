import { test } from "node:test";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { launch, quoteForCmd, runCommand } from "../src/core/spawn.mjs";

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

test("the launcher starts here: npm --version is a tool that ran, on every platform the suite runs on", () => {
  // Before this fix the same call answered `EINVAL: spawnSync npm.cmd EINVAL` on Windows, and the
  // gate stopped at its first step with "the instrument, not the work" for two days.
  const r = runCommand(tmpdir(), ["npm", "--version"]);
  assert.equal(r.errored, undefined, r.detail);
  assert.equal(r.code, 0);
});
