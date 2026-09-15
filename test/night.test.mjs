import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NEXT_PKG, STUB_AGENT, cli, git, tempRepo } from "./helpers.mjs";
import { runNight } from "../src/night/runner.mjs";
import { deadlineOf } from "../src/night/session.mjs";
import { judgeMcp } from "../src/night/canary.mjs";

/**
 * A repository with the harness installed and committed on main, a gate that is a no-op, and
 * the phases the night walks. The stub agent stands in for the model: it marks a phase done,
 * adds a changelog line, leaves the tree dirty, and plays the Stop loop against the real hooks.
 * @param {string} name @param {string[]} phases
 */
function nightRepo(name, phases = ["11"]) {
  const dir = tempRepo(name, { "package.json": NEXT_PKG });
  cli(["init", dir, "--stack", "next"], dir);
  // The gate the Stop hook runs is the repository's npm script (the self-test requires a script
  // or a file, never a bare command); here a no-op that any shell runs.
  setGate(dir, 'node -e "process.exit(0)"');
  const cfgPath = join(dir, "abatty.config.json");
  const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
  cfg.commands.gate = "npm run gate:fast";
  cfg.phases = phases.map(Number);
  cfg.maxSessionsPerPhase = 2;
  writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + "\n");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "chore: the instrument");
  return dir;
}

/** @param {string} dir @param {string} command */
function setGate(dir, command) {
  const pkgPath = join(dir, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  pkg.scripts["gate:fast"] = command;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
}

/** @param {string} dir @param {Partial<import("../src/night/runner.mjs").NightOptions>} [extra] */
function night(dir, extra = {}) {
  /** @type {string[]} */
  const lines = [];
  const r = runNight({
    repoDir: dir,
    until: "+10min",
    maxCostUsd: 10,
    noPush: true,
    agent: STUB_AGENT,
    log: (l) => lines.push(l),
    ...extra,
  });
  return { ...r, out: lines.join("\n") };
}

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

test("the abort paths end with the named reason and the branch local", () => {
  /** @param {string} name @param {Record<string, string>} env @param {RegExp} reason @param {number} code @param {Partial<import("../src/night/runner.mjs").NightOptions>} [extra] */
  const abortCase = (name, env, reason, code, extra = {}) => {
    const dir = nightRepo(name);
    const before = { ...process.env };
    Object.assign(process.env, env);
    try {
      const r = night(dir, extra);
      assert.equal(r.ok, false, `${name}: ${r.out}`);
      assert.equal(r.code, code, `${name}: code`);
      assert.match(r.out, reason, `${name}: ${r.out}`);
    } finally {
      for (const k of Object.keys(env)) delete process.env[k];
      Object.assign(process.env, before);
    }
  };
  abortCase(
    "night-tamper",
    { STUB_TAMPER: "1" },
    /harness moved before the wrap-up|harness moved before phase/,
    2,
  );
  abortCase(
    "night-skip-guard",
    { STUB_CANARY_SKIP_GUARD: "1" },
    /the PreToolUse guard did NOT run/,
    1,
  );
  abortCase("night-skip-stop", { STUB_CANARY_SKIP_STOP: "1" }, /the Stop hook left no receipt/, 1);
  abortCase("night-mcp", { STUB_CANARY_MCP: "1" }, /--strict-mcp-config did not take/, 1);
  abortCase("night-crash", { STUB_CRASH: "1" }, /failed to run twice in a row/, 2, {
    skipCanary: true,
  });
  abortCase("night-denials", { STUB_DENIALS: "20" }, /20 permission denials/, 3, {
    skipCanary: true,
  });
});

test("a night is refused on a dirty tree, on a red gate, and on an MCP server the config does not name", () => {
  const dirty = nightRepo("night-dirty");
  writeFileSync(join(dirty, "src-note.txt"), "x");
  assert.match(night(dirty).out, /dirty tree/);
  const red = nightRepo("night-red");
  setGate(red, 'node -e "process.exit(1)"');
  git(red, "add", "-A");
  git(red, "commit", "-q", "-m", "chore: a red gate");
  const r = night(red);
  assert.equal(r.ok, false);
  assert.match(r.out, /the gate is red on .* before the night started/);
  const mcp = nightRepo("night-mcp-unnamed");
  writeFileSync(
    join(mcp, ".claude/mcp.night.json"),
    JSON.stringify({ mcpServers: { serena: { command: "x" } } }) + "\n",
  );
  git(mcp, "add", "-A");
  git(mcp, "commit", "-q", "-m", "chore: a server");
  const m = night(mcp);
  assert.equal(m.ok, false, m.out);
  assert.match(
    m.out,
    /loads the MCP server 'serena' but adoption.json -> mcpServers does not name it|self-test failed/,
  );
});

test("the CLI: abatty night --canary-only with the stub", () => {
  const dir = nightRepo("night-cli");
  const r = cli(["night", dir, "--canary-only", "--agent", STUB_AGENT, "--no-push"], dir);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /pre-flight done/);
});
