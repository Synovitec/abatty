// The canary alone, in-process and through the CLI: the pre-flight on the current branch and
// nothing else. Split from night.test.mjs so it runs beside the stub night rather than after it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { STUB_AGENT, cli, git } from "./helpers.mjs";
import { night, nightRepo } from "./night-helpers.mjs";

test("canary only: the four checks on the current branch, nothing else", () => {
  const dir = nightRepo("night-canary");
  const r = night(dir, { canaryOnly: true });
  assert.equal(r.ok, true, r.out);
  assert.match(r.out, /pre-flight done on main/);
  assert.equal(existsSync(join(dir, "docs/ADOPTION_STATE.json")), false);
  assert.equal(git(dir, "rev-parse", "--abbrev-ref", "HEAD"), "main");
});

test("the CLI: abatty night --canary-only with the stub", () => {
  const dir = nightRepo("night-cli");
  const r = cli(["night", dir, "--canary-only", "--agent", STUB_AGENT, "--no-push"], dir);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /pre-flight done/);
});
