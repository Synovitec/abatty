import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { cli, git, tempRepo } from "./helpers.mjs";
import { dropHookGitVars } from "../src/core/git-env.mjs";

// A pre-push hook run from a linked worktree exports an absolute GIT_DIR. The gate's unit tests
// inherited it, and every fixture repository they made with `git init` was the real one: its
// config turned bare, its main branch rewritten, its worktrees switched to fixture branches.

test("a step that makes a repository of its own gets its own, under a hook's GIT_DIR", () => {
  const dir = tempRepo("git-env-hook", {
    "package.json": JSON.stringify({
      name: "g",
      private: true,
      scripts: {
        // what a test suite's fixture does: a repository in a folder of its own, and a commit
        typecheck:
          "git init -q nested && git -C nested -c user.email=f@f -c user.name=f commit -q --allow-empty -m fixture",
        standards: "node -e 0 --",
      },
      dependencies: { next: "15.0.0" },
    }),
    "package-lock.json": "{}\n",
    "src/a.ts": "export const a = 1;\n",
    "abatty.config.json": JSON.stringify({ profiles: ["minimal"] }),
  });
  const before = git(dir, "rev-parse", "HEAD");
  const gitDir = join(dir, ".git");
  const r = cli(["gate", dir, "--fast", "--stack", "next"], dir, { GIT_DIR: gitDir });
  assert.equal(r.code, 0, r.out);
  assert.equal(
    git(dir, "rev-parse", "HEAD"),
    before,
    "the fixture's commit went into the outer repository",
  );
  assert.equal(git(dir, "config", "--get", "core.bare"), "false");
  assert.ok(existsSync(join(dir, "nested", ".git")), "the step's repository is its own");
  assert.equal(git(join(dir, "nested"), "log", "-1", "--format=%s"), "fixture");
});

test("git's variables are dropped only when they name the repository the folder already is", () => {
  const dir = tempRepo("git-env-same", { "a.txt": "a\n" });
  const other = tempRepo("git-env-other", { "b.txt": "b\n" });
  const was = process.env.GIT_DIR;
  try {
    process.env.GIT_DIR = join(dir, ".git");
    assert.equal(dropHookGitVars(dir), true);
    assert.equal(process.env.GIT_DIR, undefined);
    // the other direction: a GIT_DIR naming another repository was set on purpose, and stays
    process.env.GIT_DIR = join(other, ".git");
    assert.equal(dropHookGitVars(dir), false);
    assert.equal(process.env.GIT_DIR, join(other, ".git"));
    delete process.env.GIT_DIR;
    assert.equal(dropHookGitVars(dir), false, "nothing set, nothing dropped");
  } finally {
    if (was === undefined) delete process.env.GIT_DIR;
    else process.env.GIT_DIR = was;
  }
});
