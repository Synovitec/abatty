import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tempRepo } from "./helpers.mjs";
import { runGate } from "../src/core/gate.mjs";

// Every gate step keeps its output under .abatty/steps, so a red one can be read after the run.
// The format command and the built-in steps (secrets, audit, scrub) kept nothing.

const KEY_ID = "AKIA" + "IOSFODNN7EXAMPLE".replace("EXAMPLE", "QWERTYU");

/** @param {import("../src/presets/index.mjs").GateStep[]} always */
const preset = (always) =>
  /** @type {import("../src/presets/index.mjs").Preset} */ (
    /** @type {unknown} */ ({ id: "logs", gate: { always, suites: [] } })
  );

const read = (/** @type {string} */ dir, /** @type {string} */ name) =>
  readFileSync(join(dir, ".abatty/steps", `${name}.log`), "utf8");

test("a command step's output is kept in its step log", () => {
  const dir = tempRepo("steplog-command", { "package.json": "{}" });
  const command = [
    process.execPath,
    "-e",
    "console.log('src/a.ts is not formatted');process.exit(1)",
  ];
  const r = runGate({
    repoDir: dir,
    preset: preset([{ label: "format", command }]),
    log: () => {},
  });
  assert.equal(r.ok, false);
  assert.match(read(dir, "format"), /src\/a\.ts is not formatted/);
});

test("a built-in step keeps what it said and its verdict, red or green", () => {
  const dir = tempRepo("steplog-builtin", {
    "package.json": "{}",
    "src/leak.ts": `export const k = "${KEY_ID}";\n`,
  });
  const steps = preset([{ label: "secret scan (SEC.1)", builtin: "secrets" }]);
  const red = runGate({ repoDir: dir, preset: steps, log: () => {}, run: () => 0 });
  assert.equal(red.ok, false);
  const log = read(dir, "secret_scan_SEC.1_");
  assert.match(log, /src\/leak\.ts:1 {2}cloud access key id/);
  assert.match(log, /failed: 1 finding\(s\)\n$/);
  writeFileSync(join(dir, "src/leak.ts"), "export const k = 1;\n");
  runGate({ repoDir: dir, preset: steps, log: () => {}, run: () => 0 });
  assert.match(read(dir, "secret_scan_SEC.1_"), /^ok: \d+ file\(s\)\n$/m);
  assert.doesNotMatch(read(dir, "secret_scan_SEC.1_"), /leak/, "the last run's log, not the first");
});

test("an audit that cannot run says why in its log", () => {
  const dir = tempRepo("steplog-audit", { "package.json": "{}" });
  runGate({
    repoDir: dir,
    preset: preset([{ label: "audit (SEC.1)", builtin: "audit" }]),
    log: () => {},
  });
  assert.ok(existsSync(join(dir, ".abatty/steps/audit_SEC.1_.log")));
  assert.match(read(dir, "audit_SEC.1_"), /^errored: /m);
});
