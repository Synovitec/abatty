// Resuming a night that was interrupted: the spend and the canary carry over, and there is
// nothing to resume without a run of today. Split from night-spend.test.mjs, whose two long tests
// ran one after the other, so the two now run at once.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { night, nightRepo } from "./night-helpers.mjs";

test("resume: an interrupted night continues counting what it spent, the canary of that night standing; nothing to resume is refused", () => {
  const dir = nightRepo("night-resume");
  const first = night(dir, { maxSessions: 1 });
  assert.equal(first.ok, true, first.out);
  // The interruption: the run file still says running, as a killed process leaves it.
  const runFile = join(dir, ".claude/night/run.json");
  const run = JSON.parse(readFileSync(runFile, "utf8"));
  writeFileSync(runFile, JSON.stringify({ ...run, status: "running" }, null, 2) + "\n");
  const r = night(dir, { resume: true, maxSessions: 2 });
  assert.equal(r.ok, true, r.out);
  assert.match(r.out, /resumed: the run of .* stopped after 1 session\(s\)/);
  assert.doesNotMatch(r.out, /adopt-canary/, "the canary of that night stands");
  assert.match(r.out, /no phase left to run/);
  assert.match(r.out, /adopt-wrap-up/, "the allowance had one session left: the wrap-up");
  assert.equal(r.sessions, 2, "one counted from the interrupted run, the wrap-up");
  const after = JSON.parse(readFileSync(runFile, "utf8"));
  assert.equal(after.status, "done");
  assert.equal(after.resumed, true);
  assert.equal(after.startedAt, run.startedAt, "the night keeps its start");

  const fresh = nightRepo("night-resume-none");
  const none = night(fresh, { resume: true });
  assert.equal(none.ok, false);
  assert.match(none.out, /nothing to resume: no run of today/);
  // A finished run is not resumable either.
  const again = night(dir, { resume: true });
  assert.match(again.out, /nothing to resume/);
});
