import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { STUB_AGENT, cli, git, tempRepo } from "./helpers.mjs";
import { night, nightRepo, recordControls, setGate } from "./night-helpers.mjs";

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
  // The runner's own detection of a moved harness, the layer above the sandbox: proven alone.
  abortCase(
    "night-tamper",
    { STUB_TAMPER: "1" },
    /harness moved before the wrap-up|harness moved before phase/,
    2,
    { sandbox: "off" },
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

test("a night is refused until the gate steps have been watched failing", () => {
  // A night is hours of unattended work whose only stop is the gate. A step nobody has watched go
  // red may be checking nothing, and running the night on it is trusting a guard that has never
  // been tested.
  const dir = nightRepo("night-controls");
  rmSync(join(dir, ".abatty", "controls.json"), { force: true });
  const never = night(dir);
  assert.equal(never.ok, false);
  assert.match(never.out + never.abort, /never been watched failing|doctor --controls/);

  // A step that stayed green on a planted violation is absent, not passing, and the night says so
  // rather than starting.
  recordControls(dir);
  const file = join(dir, ".abatty", "controls.json");
  const rec = JSON.parse(readFileSync(file, "utf8"));
  rec.absent = ["dead code (CODE.6)"];
  writeFileSync(file, JSON.stringify(rec));
  const absent = night(dir);
  assert.equal(absent.ok, false);
  assert.match(absent.out + absent.abort, /dead code \(CODE\.6\).*absent|absent, not passing/s);

  // And with every step watched red, the same repository is allowed to start.
  recordControls(dir);
  const ok = night(dir, { canaryOnly: true });
  assert.equal(/never been watched failing/.test(ok.out + ok.abort), false);
});
