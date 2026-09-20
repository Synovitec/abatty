import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { STUB_AGENT, cli, git, tempRepo } from "./helpers.mjs";
import { night, nightRepo, setGate } from "./night-helpers.mjs";
import { prepareSandbox } from "../src/night/sandbox.mjs";
import { runNight } from "../src/night/runner.mjs";
import { localToday } from "../src/core/today.mjs";

test("under the sandbox the tamper cannot happen: the filesystem refuses the write, the night goes on, the config is what it was", (t) => {
  const dir = nightRepo("night-sandboxed");
  const probe = prepareSandbox(
    {},
    { repoDir: dir, folder: ".claude", nightDir: join(dir, ".claude/night/probe") },
  );
  if (!probe.sandbox) {
    t.skip(`no sandbox on this machine: ${probe.note || probe.refuse}`);
    return;
  }
  const before = readFileSync(join(dir, "abatty.config.json"), "utf8");
  process.env.STUB_TAMPER = "1";
  let r;
  try {
    r = night(dir, { sandbox: "required" });
  } finally {
    delete process.env.STUB_TAMPER;
  }
  assert.equal(r.ok, true, r.out);
  assert.match(r.out, /sandbox bubblewrap|sandbox sandbox-exec/);
  assert.match(r.out, /night-run done: .* sandbox (bwrap|sandbox-exec)/);
  assert.equal(
    readFileSync(join(dir, "abatty.config.json"), "utf8"),
    before,
    "the config unchanged",
  );
  const run = JSON.parse(readFileSync(join(dir, ".claude/night/run.json"), "utf8"));
  assert.notEqual(run.sandbox, "none");
  const nightDir = join(dir, ".claude/night", localToday());
  const stderr = readdirSync(nightDir)
    .filter((f) => /^phase-11-.*stderr\.txt$/.test(f))
    .map((f) => readFileSync(join(nightDir, f), "utf8"))
    .join("\n");
  assert.match(stderr, /tamper refused by the filesystem: EROFS/);
});

test("the allowance: sessions or tokens end the night, said, with no wrap-up; the spend is in run.json", () => {
  const dir = nightRepo("night-allowance");
  const r = night(dir, { maxSessions: 1 });
  assert.equal(r.ok, true, r.out);
  assert.match(r.out, /allowance: 1 session\(s\), 10 USD/);
  assert.match(r.out, /the allowance is spent: 1 of 1 session\(s\); the wrap-up is not run/);
  assert.doesNotMatch(r.out, /adopt-wrap-up/);
  assert.equal(r.sessions, 1);
  assert.equal(r.tokens, 350 + 1300, "the canary's tokens and the phase's");
  const run = JSON.parse(readFileSync(join(dir, ".claude/night/run.json"), "utf8"));
  assert.equal(run.status, "done");
  assert.deepEqual(run.spent, { usd: r.spent, sessions: 1, tokens: 1650 });
  assert.deepEqual(run.allowance, { usd: 10, sessions: 1, tokens: 0 });

  const dir2 = nightRepo("night-tokens");
  const r2 = night(dir2, { maxTokens: 400, skipCanary: true });
  assert.equal(r2.ok, true, r2.out);
  assert.match(r2.out, /the allowance is spent: 1300 of 400 tokens/);
  assert.equal(r2.sessions, 1);
});

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
