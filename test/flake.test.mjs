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
// failing test files read out of it, and set against what the push reaches through its imports:
// a push that edits a module and breaks the untouched test of it broke that test.

test("the failing test files are read from each runner's output, colours, TAP and all", () => {
  const out = [
    "  1) [chromium] › e2e/menu.spec.ts:26:5 › the menu shows the dishes",
    "  ✘  3 [webkit] › e2e/order.spec.ts:10:3 › an order is placed (5.1s)",
    "\x1b[31m FAIL \x1b[39m src/lib/price.test.ts > rounds half up",
    "FAIL src/legacy/old.test.js",
    "test at test\\gate.test.mjs:18:1",
    "  location: '/repo/test/tap.test.mjs:1:65'",
    "  ✓ e2e/home.spec.ts:3:1 › home (passed)",
  ].join("\n");
  assert.deepEqual(failingTestFiles(out, { repoDir: "/repo" }), [
    "e2e/menu.spec.ts",
    "e2e/order.spec.ts",
    "src/legacy/old.test.js",
    "src/lib/price.test.ts",
    "test/gate.test.mjs",
    "test/tap.test.mjs",
  ]);
  // A workspace's step prints paths from its own folder.
  assert.deepEqual(
    failingTestFiles("FAIL src/x.test.ts", { repoDir: "/repo", cwd: "/repo/apps/web" }),
    ["apps/web/src/x.test.ts"],
  );
});

/** A repository where test/price.test.mjs imports src/price.mjs and test/other.test.mjs imports nothing. */
function withGraph() {
  const dir = tempRepo("flake", {
    "package.json": "{}",
    "src/price.mjs": "export const price = 1;\n",
    "test/price.test.mjs": 'import { price } from "../src/price.mjs";\n',
    "test/other.test.mjs": "export {};\n",
  });
  mkdirSync(join(dir, ".abatty/steps"), { recursive: true });
  const log = join(dir, ".abatty/steps/unit.log");
  writeFileSync(log, "FAIL test/price.test.mjs\nFAIL test/other.test.mjs\n");
  return { dir, log };
}

test("a failing test that imports what the push changed is the push's; one nothing reaches is named, and counted", () => {
  const { dir, log } = withGraph();
  const first = explainFailure({ repoDir: dir, log, changed: ["src/price.mjs"], head: "c1" }).join(
    "\n",
  );
  assert.match(first, /this push changed them or what they import: test\/price\.test\.mjs/);
  assert.match(
    first,
    /nothing this push changed reaches them through their imports: test\/other\.test\.mjs/,
  );
  assert.doesNotMatch(
    first,
    /price\.test\.mjs.*nothing this push/,
    "the module's own test is never a flake",
  );
  assert.doesNotMatch(first, /more than one commit/, "once is not yet a pattern");
  const again = explainFailure({ repoDir: dir, log, changed: ["src/price.mjs"], head: "c2" }).join(
    "\n",
  );
  assert.match(again, /failed unreached on more than one commit: test\/other\.test\.mjs \(2\)/);
  assert.deepEqual(
    explainFailure({ repoDir: dir, log: join(dir, "none.log"), changed: [], head: "c3" }),
    [],
  );
});

test("with the push's range unknown nothing is attributed, and a damaged record never breaks it", () => {
  const { dir, log } = withGraph();
  const blind = explainFailure({
    repoDir: dir,
    log,
    changed: ["src/price.mjs"],
    head: "c1",
    blind: true,
  });
  assert.match(blind.join("\n"), /range is unknown here, so whether it caused them is not said/);
  writeFileSync(join(dir, ".abatty/flakes.json"), "{ not json");
  assert.doesNotThrow(() => explainFailure({ repoDir: dir, log, changed: [], head: "c4" }));
});

test("the wrapper keeps the output and the exit code, reads a killed step as one that could not run, and runs without a log it cannot write", () => {
  const dir = tempRepo("tee", {
    "package.json": JSON.stringify({
      scripts: {
        red: "node -e \"console.log('FAIL src/x.test.ts'); process.exit(3)\"",
        killed: "node -e \"process.kill(process.pid, 'SIGTERM')\"",
      },
    }),
    "not-a-folder": "a file where the log folder would go\n",
  });
  const log = join(dir, ".abatty/steps/red.log");
  const r = runScript(dir, "red", [], {}, { log });
  assert.equal(r.code, 3);
  assert.equal(r.errored, undefined, "a step that ran and failed is not one that could not run");
  assert.match(readFileSync(log, "utf8"), /FAIL src\/x\.test\.ts/);
  // A killed step reads exactly as it did without the wrapper: the signal is passed on (on POSIX
  // the gate then says "could not run"), and where there are no signals the code is the same.
  const killed = runScript(dir, "killed", [], {}, { log: join(dir, ".abatty/steps/killed.log") });
  assert.deepEqual(killed, runScript(dir, "killed", [], {}));
  assert.notEqual(killed.code, 0);
  const unwritable = runScript(dir, "red", [], {}, { log: join(dir, "not-a-folder/red.log") });
  assert.equal(unwritable.code, 3, "the step ran, and ended as it ended");
});

test("the gate says a red test that imports the changed module is the push's, and one that does not is not", () => {
  const dir = tempRepo("flake-gate", {
    "package.json": JSON.stringify({ scripts: { test: "x", typecheck: "x", standards: "x" } }),
    "package-lock.json": "{}\n",
    "src/a.mjs": "export const a = 1;\n",
    "test/a.test.mjs": 'import { a } from "../src/a.mjs";\n',
    "test/flaky.test.mjs": "export {};\n",
  });
  writeFileSync(join(dir, "src/a.mjs"), "export const a = 2;\n");
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
      writeFileSync(String(o?.log), "FAIL test/a.test.mjs\nFAIL test/flaky.test.mjs\n");
      return 1;
    },
    audit: () => ({ status: 0, output: "" }),
    log: (l) => lines.push(l),
  });
  assert.equal(r.ok, false);
  assert.match(lines.join("\n"), /changed them or what they import: test\/a\.test\.mjs/);
  assert.match(
    lines.join("\n"),
    /nothing this push changed reaches them through their imports: test\/flaky\.test\.mjs/,
  );
});
