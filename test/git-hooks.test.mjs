import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NEXT_PKG, cli, git, tempRepo } from "./helpers.mjs";
import { writtenByInit } from "../src/core/git-hooks.mjs";

// Only init wrote the git hooks, so an adopter who upgraded with `update` kept a pre-push hook
// from before --refs, and `npm run` on a pnpm repository, while doctor reported no drift.

/** A repository init has installed, on pnpm, committed. */
function installed(/** @type {string} */ name) {
  const dir = tempRepo(name, {
    "package.json": NEXT_PKG,
    "pnpm-lock.yaml": "lockfileVersion: 9\n",
  });
  cli(["init", dir, "--stack", "next"], dir);
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "chore: init");
  return dir;
}

const read = (/** @type {string} */ dir, /** @type {string} */ rel) =>
  readFileSync(join(dir, rel), "utf8");

test("update refreshes a hook an earlier init wrote, and doctor reads the git hooks' drift", () => {
  const dir = installed("hooks-refresh");
  const current = read(dir, ".githooks/pre-push");
  assert.match(current, /pnpm run -s gate --refs/);
  writeFileSync(join(dir, ".githooks/pre-push"), "#!/bin/sh\nnpm run -s gate\n");
  const before = cli(["doctor", dir, "--skip-self-test"], dir);
  assert.match(before.out, /differs\s+\.githooks\/pre-push/);
  const r = cli(["update", dir], dir);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /updated\s+\.githooks\/pre-push/);
  assert.equal(read(dir, ".githooks/pre-push"), current);
  assert.doesNotMatch(cli(["doctor", dir, "--skip-self-test"], dir).out, /differs\s+\.githooks/);
});

test("a hook the repository edited is kept, with the new version beside it; no .githooks is left alone", () => {
  const dir = installed("hooks-edited");
  const ours = "#!/bin/sh\npnpm run -s gate --refs\npnpm run -s e2e:smoke\n";
  writeFileSync(join(dir, ".githooks/pre-push"), ours);
  const r = cli(["update", dir], dir);
  assert.match(r.out, /conflict\s+\.githooks\/pre-push/);
  assert.equal(read(dir, ".githooks/pre-push"), ours, "the repository's hook is not replaced");
  assert.match(read(dir, ".githooks/pre-push.abatty-new"), /pnpm run -s gate --refs/);
  // Offered once: the next update that brings the same hook keeps yours and says so, where a
  // replay of 0.7.0-rc.1 met the same conflict on every update.
  rmSync(join(dir, ".githooks/pre-push.abatty-new"));
  const again = cli(["update", dir], dir);
  assert.equal(again.code, 0, again.out);
  assert.match(again.out, /kept\s+\.githooks\/pre-push\s+· yours; the hook this version writes/);
  assert.equal(existsSync(join(dir, ".githooks/pre-push.abatty-new")), false);
  // A pre-push of the repository's own that init kept is offered the package's on the first
  // update, not silently kept: the lock init wrote had offered it nothing.
  const own = tempRepo("hooks-own", {
    "package.json": NEXT_PKG,
    "pnpm-lock.yaml": "lockfileVersion: 9\n",
    ".githooks/pre-push": "#!/bin/sh\necho no gate here\n",
  });
  cli(["init", own, "--stack", "next"], own);
  assert.match(cli(["update", own], own).out, /conflict\s+\.githooks\/pre-push/);
  assert.match(read(own, ".githooks/pre-push.abatty-new"), /gate --refs/);
  const husky = installed("hooks-elsewhere");
  rmSync(join(husky, ".githooks"), { recursive: true });
  cli(["update", husky], husky);
  assert.equal(existsSync(join(husky, ".githooks")), false, "hooks that live elsewhere");
});

test("the forms earlier versions wrote are recognised, and a hook with a command of its own is not", () => {
  assert.equal(
    writtenByInit(
      ".githooks/pre-push",
      "#!/bin/sh\n# One implementation, two callers: this hook and `npm run gate`.\nnpm run -s gate\n",
    ),
    true,
  );
  assert.equal(
    writtenByInit(
      ".githooks/pre-push",
      "#!/bin/sh\n# ours: the gate before a push\nnpm run -s gate\n",
    ),
    false,
    "a comment of the repository's own is an edit",
  );
  assert.equal(writtenByInit(".githooks/pre-push", "bun run --silent gate --refs\n"), true);
  assert.equal(writtenByInit(".githooks/pre-push", "npm run -s gate\nnpm run lint\n"), false);
  assert.equal(writtenByInit(".githooks/pre-push", "#!/bin/sh\n"), false, "an empty hook");
});

test("doctor fails a hook git records as not executable, whatever the disk says", () => {
  const dir = installed("hooks-mode");
  git(
    dir,
    "update-index",
    "--chmod=+x",
    "--",
    ".githooks/pre-commit",
    ".githooks/pre-push",
    ".githooks/commit-msg",
  );
  git(dir, "commit", "-q", "-m", "chore: executable");
  const ok = cli(["doctor", dir, "--skip-self-test"], dir);
  assert.doesNotMatch(ok.out, /as not executable/);
  git(dir, "update-index", "--chmod=-x", "--", ".githooks/pre-push");
  git(dir, "commit", "-q", "-m", "chore: committed from a machine without modes");
  const bad = cli(["doctor", dir, "--skip-self-test"], dir);
  assert.match(bad.out, /git records \.githooks\/pre-push as not executable/);
  assert.notEqual(bad.code, 0);
});

test("abatty hooks stages the executable bit for a hook git tracks without it", () => {
  const dir = installed("hooks-stage-mode");
  git(dir, "update-index", "--chmod=-x", "--", ".githooks/pre-push");
  writeFileSync(join(dir, ".githooks/README.md"), "How the hooks work.\n");
  git(dir, "add", "--", ".githooks/README.md");
  git(dir, "commit", "-q", "-m", "chore: committed without modes");
  // An edit in progress must stay the author's: only the mode goes into the index.
  writeFileSync(join(dir, ".githooks/pre-push"), `${read(dir, ".githooks/pre-push")}# wip\n`);
  const r = cli(["hooks", dir], dir);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /committed as not executable; the mode alone is staged now/);
  assert.match(git(dir, "ls-files", "-s", "--", ".githooks/pre-push"), /^100755 /);
  assert.doesNotMatch(git(dir, "diff", "--cached", "--", ".githooks/pre-push"), /# wip/);
  assert.match(git(dir, "ls-files", "-s", "--", ".githooks/README.md"), /^100644 /, "not a hook");
});
