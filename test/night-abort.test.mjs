import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { STUB_AGENT, cli, git, tempRepo } from "./helpers.mjs";
import { night, nightRepo, setGate } from "./night-helpers.mjs";

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
