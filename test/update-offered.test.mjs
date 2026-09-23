import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NEXT_PKG, cli, tempRepo } from "./helpers.mjs";

// A file init kept (the repository's own settings) has no ancestor, so every update asked for a
// merge base that lives in a gitignored folder and so is on no other clone, and wrote a conflict
// beside a file whose template had not changed. The template offered is now kept by hash in the
// committed lock.

const SETTINGS = ".claude/settings.json";
const LOCK = ".claude/harness.lock.json";

function kept(/** @type {string} */ name) {
  const dir = tempRepo(name, {
    "package.json": NEXT_PKG,
    [SETTINGS]: JSON.stringify({ permissions: { allow: ["Bash(ls)"] } }, null, 2) + "\n",
  });
  cli(["init", dir, "--stack", "next"], dir);
  // Another clone: the installed copies under .abatty/ are not there.
  rmSync(join(dir, ".abatty"), { recursive: true, force: true });
  return dir;
}

test("a file the repository kept is left alone when the package offers the same template again", () => {
  const dir = kept("offered-same");
  const lock = JSON.parse(readFileSync(join(dir, LOCK), "utf8"));
  assert.ok(lock.offered?.[SETTINGS], "the template offered is recorded");
  const r = cli(["update", dir], dir);
  assert.equal(r.code, 0, r.out);
  assert.doesNotMatch(r.out, /conflict\s+\.claude\/settings\.json/);
  assert.equal(existsSync(join(dir, `${SETTINGS}.abatty-new`)), false);
});

test("and still says so when the template it was offered is not the one it is offered now", () => {
  const dir = kept("offered-changed");
  const lock = JSON.parse(readFileSync(join(dir, LOCK), "utf8"));
  lock.offered[SETTINGS] = "0".repeat(64);
  writeFileSync(join(dir, LOCK), JSON.stringify(lock, null, 2) + "\n");
  const r = cli(["update", dir], dir);
  assert.match(r.out, /conflict\s+\.claude\/settings\.json/);
});
