import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { STUB_AGENT, cli, git, tempRepo } from "./helpers.mjs";
import { night, nightRepo, setGate } from "./night-helpers.mjs";
import { deadlineOf } from "../src/night/session.mjs";
import { judgeMcp } from "../src/night/canary.mjs";

test("the deadline: HH:MM is today or tomorrow, +Nmin is relative", () => {
  const now = new Date("2026-09-15T22:00:00");
  assert.equal(deadlineOf("+10min", now), now.getTime() + 10 * 60_000);
  assert.equal(deadlineOf("+2h", now), now.getTime() + 2 * 3_600_000);
  assert.equal(new Date(deadlineOf("23:30", now)).getDate(), 15, "later today");
  assert.equal(new Date(deadlineOf("07:00", now)).getDate(), 16, "already past: tomorrow");
  assert.throws(() => deadlineOf("soon", now));
});

test("the canary's MCP judgement: undeclared servers and declared servers without a tool are findings", () => {
  assert.deepEqual(judgeMcp("abc1234 none", [], "cfg"), []);
  assert.match(judgeMcp("abc1234", [], "cfg")[0] || "", /did not report its MCP tools/);
  assert.match(judgeMcp("abc1234 mcp__mail_example__send", [], "cfg")[0] || "", /does not declare/);
  assert.match(judgeMcp("abc1234 none", ["serena"], "cfg")[0] || "", /gave the session no tool/);
  assert.deepEqual(
    judgeMcp("abc1234 mcp__serena__find_symbol,mcp__serena__read", ["serena"], "cfg"),
    [],
  );
});

test("a stub night: pre-flight green, the canary green, the phase done, the wrap-up, the branch local and clean", () => {
  const dir = nightRepo("night-happy");
  const r = night(dir);
  assert.equal(r.ok, true, r.out);
  assert.equal(r.code, 0);
  assert.match(r.out, /canary ok/);
  assert.match(r.out, /night-run done/);
  assert.equal(r.branch, `adopt/standards-${new Date().toISOString().slice(0, 10)}`);
  assert.equal(git(dir, "rev-parse", "--abbrev-ref", "HEAD"), r.branch);
  const state = JSON.parse(readFileSync(join(dir, "docs/ADOPTION_STATE.json"), "utf8"));
  assert.equal(state.phases[0].status, "done");
  assert.equal(state.phases[0].id, 11, "a numeric phase id stays a number");
  assert.match(readFileSync(join(dir, "CHANGELOG.md"), "utf8"), /Stub run: phase 11/);
  assert.equal(
    git(dir, "status", "--porcelain")
      .split("\n")
      .filter((l) => l && !l.includes(".claude/night/")).length,
    0,
    "clean tree",
  );
  assert.ok(
    existsSync(
      join(dir, ".claude/night", new Date().toISOString().slice(0, 10), "preflight-gate.txt"),
    ),
  );
  assert.ok(r.spent > 0 && r.spent < 10, `spent ${r.spent}`);
  assert.equal(r.pushed, false);
  // the numbers are JSON, never a locale: the run file reads back
  const run = JSON.parse(readFileSync(join(dir, ".claude/night/run.json"), "utf8"));
  assert.equal(run.maxCostUsd, 10);
  assert.equal(
    readFileSync(join(dir, ".claude/night/run.json"), "utf8").charCodeAt(0) !== 0xfeff,
    true,
    "no BOM",
  );
});

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
