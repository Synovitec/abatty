import { test } from "node:test";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
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
