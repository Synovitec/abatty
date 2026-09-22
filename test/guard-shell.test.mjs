import { test } from "node:test";
import assert from "node:assert/strict";
import { programName, shellSegments } from "../templates/harness/hooks/shell.mjs";

// The tokenizer exists because five families of hole came from matching a regex against a whole
// command line. Its own correctness therefore cannot be asserted by a regex either: these read
// the structure it produces, and the attack shapes below were supplied by the reviewing session
// that found two of those five families.

/** The single segment a command parses to, for the many cases that have exactly one.
 *  @param {string} cmd */
function one(cmd) {
  const segs = shellSegments(cmd);
  assert.equal(segs.length, 1, `expected one segment from ${cmd}, got ${segs.length}`);
  const [first] = segs;
  if (!first) throw new Error(`no segment from ${cmd}`);
  return first;
}

test("a program is known by its basename, whatever path or extension reached it", () => {
  for (const spelling of ["git", "/usr/bin/git", "C:\\Program Files\\Git\\git.exe", "git.cmd"])
    assert.equal(programName(spelling), "git", spelling);
  // A leading backslash defeats a shell alias; it does not change the program.
  assert.equal(programName("\\git"), "git");
  assert.equal(programName(""), "");
});

test("quotes are consumed, so a quoted flag is the flag", () => {
  assert.deepEqual(one(`git push "--force" origin dev`).args, ["push", "--force", "origin", "dev"]);
  assert.deepEqual(one("git push '-f' origin dev").args, ["push", "-f", "origin", "dev"]);
  assert.deepEqual(one(`git push origin "main"`).args, ["push", "origin", "main"]);
  // An escaped quote inside a double-quoted string stays in the token.
  assert.deepEqual(one(`echo "he said \\"push\\""`).args, [`he said "push"`]);
});

test("a separator inside quotes is not a separator", () => {
  assert.equal(shellSegments("echo 'a;b'").length, 1);
  assert.equal(shellSegments(`echo "a && b"`).length, 1);
  assert.equal(shellSegments(`grep "a|b" file`).length, 1);
  // And outside them it is.
  assert.equal(shellSegments("git add . && git commit -m x").length, 2);
  assert.equal(shellSegments("a; b | c").length, 3);
});

test("a redirection is the shell's, not an argument of the command", () => {
  assert.deepEqual(one("git push origin main 2>&1").args, ["push", "origin", "main"]);
  assert.deepEqual(one("git push origin main > out.log").args, ["push", "origin", "main"]);
  assert.deepEqual(one("git push origin main >out.log").args, ["push", "origin", "main"]);
  // `2>&1` must not split the segment on its ampersand.
  assert.equal(shellSegments("git push origin main 2>&1 | tee out.log").length, 2);
});

test("leading environment assignments belong to the environment", () => {
  const s = one("GIT_TRACE=1 FOO=bar git push origin dev");
  assert.equal(s.program, "git");
  assert.deepEqual(s.args, ["push", "origin", "dev"]);
});

test("a reader's arguments are text, and git's are not", () => {
  const reader = one(`rg "git push --force" docs/`);
  assert.equal(reader.program, "rg");
  assert.equal(reader.opaque, false, "a reader is understood, so its arguments are not git's");
  const real = one("git push --force origin dev");
  assert.equal(real.program, "git");
  assert.equal(real.opaque, false);
});

// The rule that makes this shippable: anything not recognised is opaque, and an opaque segment
// sends its caller back to the blunt instrument. A wrapper list can never be complete, so the
// list is of readers instead and everything else is conservative by default.
test("every unrecognised program is opaque, which is the conservative direction", () => {
  const wrappers = [
    `sh -c "git push --force origin dev"`,
    `bash -c "git push --force origin dev"`,
    `eval "git push --force origin dev"`,
    "timeout 5 git push --force origin dev",
    "nice git push --force origin dev",
    "stdbuf -o0 git push --force origin dev",
    "sudo git push --force origin dev",
    "setsid git push --force origin dev",
    `script -c "git push --force origin dev"`,
    "find . -exec git push --force origin dev ;",
    "xargs git push --force origin",
  ];
  for (const cmd of wrappers) {
    const segs = shellSegments(cmd);
    assert.ok(
      segs.some((s) => s.opaque),
      `${cmd} must be opaque so the caller falls back`,
    );
  }
});

test("a substitution or a variable in command position is opaque", () => {
  for (const cmd of [
    "$(echo git) push --force origin dev",
    "`echo git` push --force origin dev",
    "$GIT push --force origin dev",
    "${GIT} push --force origin dev",
  ])
    assert.ok(one(cmd).opaque, cmd);
});

test("quoting that does not close is opaque rather than guessed at", () => {
  assert.ok(one(`git push origin "main`).opaque, "an unterminated quote is not a parse");
  assert.ok(one("git commit -m 'x").opaque);
});

test("git reached by a path or with an extension is still git, and still precise", () => {
  for (const cmd of [
    "/usr/bin/git push --force origin dev",
    "git.exe push --force origin dev",
    "\\git push --force origin dev",
  ]) {
    const s = one(cmd);
    assert.equal(s.program, "git", cmd);
    assert.equal(s.opaque, false, cmd);
    assert.equal(s.args[0], "push");
  }
});

test("a backslash continuation joins the line it continues", () => {
  const s = one("git push \\\n --force origin dev");
  assert.equal(s.program, "git");
  assert.ok(s.args.includes("--force"), JSON.stringify(s.args));
});
