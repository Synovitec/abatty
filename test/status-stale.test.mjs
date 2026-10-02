import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { NEXT_PKG, cli, git, tempRepo } from "./helpers.mjs";

// status printed the stored reading's branch and commit as the checkout's: an adopter on main
// read an adoption branch and a commit from three days before. Then it marked the reading stale
// and still had to be asked for --fresh. A reading of another commit is now measured again, and
// the line says which reading it replaced.

test("status shows a reading of this checkout, measuring again when the commit has moved", () => {
  const dir = tempRepo("status-stale", { "package.json": NEXT_PKG });
  git(dir, "checkout", "-q", "-b", "adopt/standards-old");
  cli(["measure", dir, "--quiet"], dir);
  const same = cli(["status", dir, "--plain"], dir);
  assert.match(
    same.out,
    /adopt\/standards-old @ \w+ +reading of/,
    "same commit: the reading stands",
  );
  git(dir, "checkout", "-q", "-b", "main-ish");
  writeFileSync(join(dir, "a.md"), "# a\n");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "docs: a");
  const moved = cli(["status", dir, "--plain"], dir);
  assert.match(
    moved.out,
    /main-ish @ \w+ +measured now · the last reading was of adopt\/standards-old @ \w+/,
  );
  assert.doesNotMatch(moved.out, /--fresh to measure/);
});
