import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { git, tempRepo } from "./helpers.mjs";
import { explainFailure, failingTestFiles } from "../src/core/flake.mjs";
import { runScript } from "../src/core/spawn.mjs";
import { runGate } from "../src/core/gate.mjs";
import { presetById } from "../src/presets/index.mjs";

// An adopter's pushes were refused four times in a day with none caused by the pushed change: a
// test failing on timing read exactly like one this push broke. The step's output is kept, the
// failing test files read out of it, and set against what the push changed.

test("the failing test files are read from each runner's output, colours and all", () => {
  const out = [
    "  1) [chromium] › e2e/menu.spec.ts:26:5 › the menu shows the dishes",
    "  ✘  3 [webkit] › e2e/order.spec.ts:10:3 › an order is placed (5.1s)",
    "\x1b[31m FAIL \x1b[39m src/lib/price.test.ts > rounds half up",
    "FAIL src/legacy/old.test.js",
    "test at test\\gate.test.mjs:18:1",
    "  ✓ e2e/home.spec.ts:3:1 › home (passed)",
  ].join("\n");
  assert.deepEqual(failingTestFiles(out), [
    "e2e/menu.spec.ts",
    "e2e/order.spec.ts",
    "src/legacy/old.test.js",
    "src/lib/price.test.ts",
    "test/gate.test.mjs",
  ]);
});

test("a failure the push touched is its own; one it did not is named, and counted across commits", () => {
  const dir = tempRepo("flake", { "package.json": "{}" });
  const log = join(dir, ".abatty/steps/unit.log");
  mkdirSync(join(dir, ".abatty/steps"), { recursive: true });
  writeFileSync(log, "FAIL src/a.test.ts\nFAIL src/b.test.ts\n");
  const first = explainFailure({ repoDir: dir, log, changed: ["src/a.test.ts"], head: "c1" });
  assert.match(first.join("\n"), /this push changed them: src\/a\.test\.ts/);
  assert.match(first.join("\n"), /did not touch them: src\/b\.test\.ts · likely a flake/);
  assert.doesNotMatch(first.join("\n"), /more than one commit/, "once is not yet a pattern");
  const again = explainFailure({ repoDir: dir, log, changed: [], head: "c2" });
  assert.match(
    again.join("\n"),
    /failed untouched on more than one commit: .*src\/b\.test\.ts \(2\)/,
  );
  assert.deepEqual(
    explainFailure({ repoDir: dir, log: join(dir, "none.log"), changed: [], head: "c3" }),
    [],
  );
});

test("a step run through the wrapper keeps its output and its exit code", () => {
  const dir = tempRepo("tee", {
    "package.json": JSON.stringify({
      scripts: { red: "node -e \"console.log('FAIL src/x.test.ts'); process.exit(3)\"" },
    }),
  });
  const log = join(dir, ".abatty/steps/red.log");
  const r = runScript(dir, "red", [], {}, { log });
  assert.equal(r.code, 3);
  assert.equal(r.errored, undefined, "a step that ran and failed is not one that could not run");
  assert.match(readFileSync(log, "utf8"), /FAIL src\/x\.test\.ts/);
});

test("the gate says a red step's failure is not the push's when the push did not touch it", () => {
  const dir = tempRepo("flake-gate", {
    "package.json": JSON.stringify({ scripts: { test: "x", typecheck: "x", standards: "x" } }),
    "package-lock.json": "{}\n",
    "src/a.ts": "export const a = 1;\n",
  });
  writeFileSync(join(dir, "src/a.ts"), "export const a = 2;\n");
  git(dir, "commit", "-qam", "feat: a is two");
  /** @type {string[]} */
  const lines = [];
  const node = /** @type {import("../src/presets/index.mjs").Preset} */ (presetById("node"));
  const r = runGate({
    repoDir: dir,
    preset: node,
    range: "HEAD~1..HEAD",
    run: (_d, script, _a, _e, o) => {
      if (script !== "test") return 0;
      mkdirSync(join(String(o?.log), ".."), { recursive: true });
      writeFileSync(String(o?.log), "FAIL src/flaky.test.ts\n");
      return 1;
    },
    audit: () => ({ status: 0, output: "" }),
    log: (l) => lines.push(l),
  });
  assert.equal(r.ok, false);
  assert.match(lines.join("\n"), /did not touch them: src\/flaky\.test\.ts/);
});
