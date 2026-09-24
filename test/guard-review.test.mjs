import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// The spellings the review of 0.5.2 replayed against the guard, each in the direction it has to
// go. Several were refused by 0.5.1 and allowed by the first cut of the worktree fix (the night's
// adoption-branch rule read one refspec of several); the rest were open in both.

const GUARD = resolve("templates/harness/hooks/guard.mjs");
const slash = (/** @type {string} */ p) => p.replace(/\\/g, "/");

/** A checkout on `rootBranch` and a worktree beside it on `wtBranch`. @param {string} rootBranch @param {string} wtBranch @param {object} [config] */
function checkouts(rootBranch, wtBranch, config = { baseBranch: "main", directPushToBase: false }) {
  const dir = mkdtempSync(join(tmpdir(), "abatty-review-"));
  const root = join(dir, "root");
  const wt = join(dir, "wt");
  const git = (/** @type {string} */ cwd, /** @type {string[]} */ ...a) =>
    spawnSync("git", a, { cwd, stdio: "ignore" });
  spawnSync("git", ["init", "-q", "-b", "main", root], { stdio: "ignore" });
  git(root, "config", "user.email", "r@example.com");
  git(root, "config", "user.name", "Review");
  git(root, "commit", "-q", "--allow-empty", "--no-gpg-sign", "-m", "init");
  for (const b of ["feat", "adopt/x"]) git(root, "branch", b);
  if (rootBranch !== "main") git(root, "checkout", "-q", rootBranch);
  git(root, "worktree", "add", "-q", wt, wtBranch);
  mkdirSync(join(root, "sub"), { recursive: true });
  writeFileSync(join(root, "abatty.config.json"), JSON.stringify(config));
  return { root, wt, wtSlash: slash(wt) };
}

/** @param {string} cwd @param {string} command @param {{ night?: boolean, tool?: string }} [o] */
function decide(cwd, command, o = {}) {
  const r = spawnSync(process.execPath, [GUARD], {
    cwd,
    input: JSON.stringify({ tool_name: o.tool || "Bash", tool_input: { command } }),
    encoding: "utf8",
    env: {
      ...process.env,
      ADOPTION_RUN: o.night ? "1" : "",
      ADOPTION_BRANCH: o.night ? "adopt/x" : "",
    },
  });
  assert.equal(r.status, 0, `the guard must not crash on: ${command}`);
  try {
    return JSON.parse(r.stdout).hookSpecificOutput?.permissionDecision ?? "none";
  } catch {
    return "none";
  }
}

test("at night every refspec of a push is read, and --all or --mirror writes the base", () => {
  const { root } = checkouts("adopt/x", "feat");
  for (const cmd of [
    "git push origin main adopt/x",
    "git push origin refs/heads/main:refs/heads/main adopt/x",
    "git push --all origin",
    "git push --mirror",
  ])
    assert.equal(decide(root, cmd, { night: true }), "deny", cmd);
  for (const cmd of ["git push origin adopt/x", "git push"])
    assert.equal(decide(root, cmd, { night: true }), "none", cmd);
});

test("by day, a second refspec, --mirror, git's own options and a wrapper do not hide a push", () => {
  const { root } = checkouts("feat", "main");
  for (const cmd of [
    "git push origin main feat",
    "git push --mirror",
    "git --attr-source HEAD push --force origin feat",
    "git --attr-source HEAD commit -n -m x",
    'sh -c "git -C . push --force origin feat"',
    'sh -c "git -C . push origin main"',
  ])
    assert.equal(decide(root, cmd), "deny", cmd);
  assert.equal(decide(root, "git push origin feat"), "none");
});

test("a push is judged where it runs, through the options and the shapes that hide a cd", () => {
  const { root, wtSlash: wt } = checkouts("feat", "main");
  for (const cmd of [
    `git --namespace x -C ${wt} push`,
    `git --config-env a.b=HOME -C ${wt} push`,
    `{ cd ${wt}; git push; }`,
    `if cd ${wt}; then git push; fi`,
    `env -C ${wt} git push`,
    `sh -c "cd ${wt} && git push"`,
    `timeout 30 git.exe -C ${wt} push`,
    "git push origin $(git branch --show-current)",
  ])
    assert.equal(decide(root, cmd), "deny", cmd);
});

test("an ordinary command that only quotes the words after a cd is not a push from nowhere", () => {
  const { root } = checkouts("feat", "main");
  assert.equal(decide(root, "cd sub && npm test -- -t 'git push'"), "none");
});

test("PowerShell paths keep their backslashes", () => {
  const { root, wt } = checkouts("main", "feat");
  for (const cmd of [`Set-Location ${wt}; git push`, `git -C ${wt} push`])
    assert.equal(decide(root, cmd, { tool: "PowerShell" }), "none", cmd);
});

test("where the base takes direct pushes, a push to an unknown branch is not refused by day", () => {
  const { root } = checkouts("feat", "main", { baseBranch: "main", directPushToBase: true });
  assert.equal(decide(root, "cd $WT && git push"), "none");
  assert.equal(decide(root, "cd $WT && git push", { night: true }), "deny");
});
