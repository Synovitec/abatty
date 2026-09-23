import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { gitLocation, segmentDirs, shellSegments } from "../templates/harness/hooks/shell.mjs";

// A push is judged by the branch checked out where it RUNS. The guard asked once, in its own
// folder, so `cd <worktree> && git push` was judged by another checkout's branch: an adopter whose
// sessions push from worktrees was refused a push to a feature branch because the main checkout
// stood on main, and the mirror case (a worktree on main, the checkout on a feature branch) was
// allowed by construction.

const GUARD = resolve("templates/harness/hooks/guard.mjs");
const slash = (/** @type {string} */ p) => p.replace(/\\/g, "/");

/** @param {string} cmd @param {string} start */
const dirsOf = (cmd, start) => segmentDirs(shellSegments(cmd), start, "/home/u");

test("each segment runs where the cd before it left the shell, and a subshell's cd is undone", () => {
  const root = resolve("/repo");
  assert.deepEqual(dirsOf("cd wt && git push", root), [root, resolve(root, "wt")]);
  assert.deepEqual(dirsOf("git status; cd ../other; git push", root), [
    root,
    root,
    resolve(root, "../other"),
  ]);
  assert.deepEqual(dirsOf("(cd wt && git push) && git push", root), [
    root,
    resolve(root, "wt"),
    root,
  ]);
  assert.deepEqual(dirsOf("cd ~/wt && git push", root), [root, resolve("/home/u/wt")]);
  for (const unknown of ["cd $WT && git push", "cd - && git push", "pushd a; popd; git push"])
    assert.equal(dirsOf(unknown, root).at(-1), null, unknown);
});

test("git's own location options are read, and one this cannot know is null", () => {
  assert.deepEqual(gitLocation(["-C", "wt", "push"]), ["-C", "wt"]);
  assert.deepEqual(gitLocation(["--git-dir=wt/.git", "--work-tree", "wt", "push"]), [
    "--git-dir=wt/.git",
    "--work-tree",
    "wt",
  ]);
  assert.deepEqual(gitLocation(["-c", "core.x=1", "push"]), [], "a config pair is not a location");
  assert.equal(gitLocation(["-C", "$WT", "push"]), null);
});

test("a subshell's parentheses are the shell's: the push inside is read as a push", () => {
  const segs = shellSegments("(cd wt && git push origin main)");
  assert.deepEqual(
    segs.map((s) => [s.program, s.args]),
    [
      ["cd", ["wt"]],
      ["git", ["push", "origin", "main"]],
    ],
  );
  assert.deepEqual(
    shellSegments("echo $(pwd)").at(0)?.args,
    ["$(pwd)"],
    "a substitution keeps its own",
  );
});

/** A checkout on `rootBranch` with a worktree beside it on `wtBranch`. */
function checkouts(/** @type {string} */ rootBranch, /** @type {string} */ wtBranch) {
  const dir = mkdtempSync(join(tmpdir(), "abatty-wt-"));
  const root = join(dir, "root");
  const wt = join(dir, "wt");
  const git = (/** @type {string} */ cwd, /** @type {string[]} */ ...a) =>
    spawnSync("git", a, { cwd, stdio: "ignore" });
  spawnSync("git", ["init", "-q", "-b", "main", root], { stdio: "ignore" });
  git(root, "config", "user.email", "wt@example.com");
  git(root, "config", "user.name", "Worktree");
  git(root, "commit", "-q", "--allow-empty", "--no-gpg-sign", "-m", "init");
  git(root, "branch", "feat");
  if (rootBranch !== "main") git(root, "checkout", "-q", rootBranch);
  git(root, "worktree", "add", "-q", wt, wtBranch);
  writeFileSync(
    join(root, "abatty.config.json"),
    JSON.stringify({ baseBranch: "main", directPushToBase: false }),
  );
  return { root, wt: slash(wt) };
}

/** @param {string} cwd @param {string} command @param {Record<string, string>} [env] */
function decide(cwd, command, env = {}) {
  const r = spawnSync(process.execPath, [GUARD], {
    cwd,
    input: JSON.stringify({ tool_name: "Bash", tool_input: { command } }),
    encoding: "utf8",
    env: { ...process.env, ADOPTION_RUN: "", ADOPTION_BRANCH: "", ...env },
  });
  assert.equal(r.status, 0, `the guard must not crash on: ${command}`);
  try {
    return JSON.parse(r.stdout).hookSpecificOutput?.permissionDecision ?? "none";
  } catch {
    return "none";
  }
}

test("a push from a worktree on a feature branch is allowed while the checkout stands on main", () => {
  const { root, wt } = checkouts("main", "feat");
  for (const cmd of [
    `cd ${wt} && git push`,
    `cd "${wt}" && git push origin HEAD`,
    `git -C ${wt} push`,
    `git -C ${wt} push origin @`,
    `(cd ${wt} && git push)`,
  ])
    assert.equal(decide(root, cmd), "none", cmd);
  assert.equal(decide(root, "git push"), "deny", "and the checkout's own bare push is still main");
});

test("a push from a worktree on main is refused while the checkout stands on a feature branch", () => {
  const { root, wt } = checkouts("feat", "main");
  for (const cmd of [
    `cd ${wt} && git push`,
    `cd ${wt}; git push origin HEAD`,
    `git -C ${wt} push`,
    `git -C ${wt} push origin`,
    `(cd ${wt} && git push)`,
    `(cd . && git push origin main)`,
  ])
    assert.equal(decide(root, cmd), "deny", cmd);
  assert.equal(decide(root, "git push"), "none", "the checkout's own branch is feat");
  assert.equal(decide(root, `(cd ${wt} && git status) && git push`), "none", "the subshell ended");
});

test("a push whose folder cannot be followed is refused rather than guessed", () => {
  const { root } = checkouts("feat", "main");
  for (const cmd of ["cd $WT && git push", "cd - && git push origin HEAD", "git -C $WT push"])
    assert.equal(decide(root, cmd), "deny", cmd);
  assert.equal(
    decide(root, "cd $WT && git push origin feat"),
    "none",
    "a named branch needs no folder",
  );
});

test("git's -C no longer hides a force push or a night's stray push", () => {
  const { root, wt } = checkouts("main", "feat");
  assert.equal(decide(root, `git -C ${wt} push --force origin feat`), "deny");
  const night = { ADOPTION_RUN: "1", ADOPTION_BRANCH: "adopt/standards-x" };
  assert.equal(decide(root, `git -C ${wt} push origin feat`, night), "deny");
});
