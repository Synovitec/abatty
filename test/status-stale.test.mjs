import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { NEXT_PKG, cli, git, tempRepo } from "./helpers.mjs";

// status printed the stored reading's branch and commit as the checkout's: an adopter on main
// read an adoption branch and a commit from three days before.

test("status names the checkout as it is, and calls a reading from elsewhere stale", () => {
  const dir = tempRepo("status-stale", { "package.json": NEXT_PKG });
  git(dir, "checkout", "-q", "-b", "adopt/standards-old");
  cli(["measure", dir, "--quiet"], dir);
  const same = cli(["status", dir, "--plain"], dir);
  assert.match(same.out, /adopt\/standards-old @ \w+ +reading of/);
  assert.doesNotMatch(same.out, /stale/);
  git(dir, "checkout", "-q", "-b", "main-ish");
  writeFileSync(join(dir, "a.md"), "# a\n");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "docs: a");
  const moved = cli(["status", dir, "--plain"], dir);
  assert.match(moved.out, /main-ish @ \w+ +stale: reading of [\d-]+ on adopt\/standards-old @ \w+/);
});
