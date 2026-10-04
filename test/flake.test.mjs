import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { git, tempRepo } from "./helpers.mjs";
import { explainFailure, failingTestFiles, onlyTimedOut } from "../src/core/flake.mjs";
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

test("bun's `(fail)` lines under a file header, and a task runner's prefix naming the workspace, are read", () => {
  const dir = tempRepo("flake-turbo", {
    "package.json": JSON.stringify({ workspaces: ["apps/*"] }),
    "apps/web/package.json": JSON.stringify({ name: "@izishift/web" }),
    "apps/mobile/package.json": JSON.stringify({ name: "@izishift/mobile" }),
  });
  const out = [
    "@izishift/web:test: lib\\proxy\\route-classes.test.ts:",
    "@izishift/web:test: (pass) routes > classify",
    "@izishift/web:test: (fail) abatty rc replay plant > fails on purpose",
    "@izishift/web:test: lib\\ok.test.ts:",
    "@izishift/web:test: (pass) fine",
    // bun's closing summary re-lists the failure with no header: not lib/ok.test.ts's
    "@izishift/web:test: 1 tests failed:",
    "@izishift/web:test: (fail) abatty rc replay plant > fails on purpose",
    "@izishift/web:test:  1 fail",
    "@izishift/mobile:test: FAIL lib/cart.test.ts",
    "@unknown/pkg:test: FAIL lib/elsewhere.test.ts",
    "Error: something: happened at lib/x.test.ts",
  ].join("\n");
  assert.deepEqual(failingTestFiles(out, { repoDir: dir }), [
    "apps/mobile/lib/cart.test.ts",
    "apps/web/lib/proxy/route-classes.test.ts",
    "lib/elsewhere.test.ts",
  ]);
  // Bun without a task runner: the header's path is the step's own.
  assert.deepEqual(failingTestFiles("src/a.test.ts:\n(fail) a > b\n", { repoDir: dir }), [
    "src/a.test.ts",
  ]);
});

test("a red test step whose output names no test file says so; another step says nothing", () => {
  const dir = tempRepo("flake-unread", { "package.json": "{}" });
  mkdirSync(join(dir, ".abatty/steps"), { recursive: true });
  const log = join(dir, ".abatty/steps/unit.log");
  writeFileSync(log, "something went wrong\n");
  const o = { repoDir: dir, log, changed: [], head: "c1" };
  assert.match(
    explainFailure({ ...o, tests: true }).join("\n"),
    /no failing test file could be read from the output \(\.abatty\/steps\/unit\.log\)/,
  );
  assert.deepEqual(explainFailure(o), []);
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
  assert.match(
    first,
    /this change \(the push, or the working tree\) touched them or what they import: test\/price\.test\.mjs/,
  );
  assert.match(
    first,
    /nothing this change touched reaches them through their imports: test\/other\.test\.mjs/,
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

// Three of an adopter's five red pushes were 5 s timeouts that passed alone, and read exactly
// like a test the push broke.
test("a test that timed out is named apart from one that failed, in each runner's words", () => {
  const dir = tempRepo("flake-timeout", { "package.json": "{}" });
  mkdirSync(join(dir, ".abatty/steps"), { recursive: true });
  const log = join(dir, ".abatty/steps/unit.log");
  writeFileSync(
    log,
    [
      " FAIL  src/vitest.test.ts > slow",
      "Error: Test timed out in 5000ms.",
      "FAIL src/jest.test.ts",
      '  thrown: "Exceeded timeout of 5000 ms for a test.',
      "  location: 'test/node.test.mjs:3:1'",
      "  failureType: 'testTimeoutFailure'",
      "src/bun.test.ts:",
      "(fail) slow [5001.20ms]",
      "  ^ this test timed out after 5000ms.",
      "  1) [chromium] › e2e/pw.spec.ts:3:5 › slow",
      "    Test timeout of 30000ms exceeded.",
      "FAIL src/assert.test.ts",
      "AssertionError: expected 1 to be 2",
      // a timeout printed under a file that passed is no failure's
      "src/passing.test.ts:",
      "(pass) fine",
      "  ^ this test timed out after 5000ms.",
    ].join("\n"),
  );
  const said = explainFailure({ repoDir: dir, log, changed: [], head: "c1" }).join("\n");
  const [line] = said.split("\n").filter((l) => l.includes("timed out rather than failed"));
  assert.equal(
    line?.split(": ")[1]?.split(" · ")[0],
    "e2e/pw.spec.ts, src/bun.test.ts, src/jest.test.ts, src/vitest.test.ts, test/node.test.mjs",
  );
  assert.match(said, /src\/assert\.test\.ts(?! \(timed out\))/, "an assertion is not a timeout");
  assert.doesNotMatch(said, /passing\.test\.ts/);
  assert.match(said, /src\/vitest\.test\.ts \(timed out\)/);
});

// The replay of rc.4: one vitest file with a test that timed out and one that failed an
// assertion was tagged timed out whole, steering a real failure toward a rerun.
test("a file where one test timed out and another failed says both, and is not called a timeout", () => {
  const dir = tempRepo("flake-mixed", { "package.json": "{}" });
  mkdirSync(join(dir, ".abatty/steps"), { recursive: true });
  const log = join(dir, ".abatty/steps/unit.log");
  const said = (/** @type {string[]} */ lines) => {
    writeFileSync(log, lines.join("\n"));
    return explainFailure({ repoDir: dir, log, changed: [], head: "c1" }).join("\n");
  };
  const vitest = said([
    " FAIL  lib/mixed.test.ts > waits",
    "Error: Test timed out in 5000ms.",
    " FAIL  lib/mixed.test.ts > fails",
    "AssertionError: expected 1 to be 2",
  ]);
  assert.match(vitest, /lib\/mixed\.test\.ts \(1 timed out, 1 failed\)/);
  assert.doesNotMatch(vitest, /timed out rather than failed/);
  // Jest names the file once and each test under it with `●`.
  const jest = said([
    "FAIL src/mixed.test.ts (6.1 s)",
    "  ● slow",
    '    thrown: "Exceeded timeout of 5000 ms for a test.',
    "  ● wrong",
    "    expect(received).toBe(expected)",
    "FAIL src/slow.test.ts",
    "  ● only slow",
    '    thrown: "Exceeded timeout of 5000 ms for a test.',
  ]);
  assert.match(jest, /src\/mixed\.test\.ts \(1 timed out, 1 failed\)/);
  assert.match(jest, /timed out rather than failed: src\/slow\.test\.ts ·/);
});

test("a red step with no timeout in it says nothing about timeouts", () => {
  const { dir, log } = withGraph();
  const said = explainFailure({ repoDir: dir, log, changed: [], head: "c1" }).join("\n");
  assert.doesNotMatch(said, /timed out/);
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
        // The wrapper also shows the output live, into this suite's own run: a line shaped like a
        // runner's failure was read by the gate as a failing src/x.test.ts whenever the suite
        // went red for another reason, and recorded as a flake.
        red: "node -e \"console.log('kept by the tee'); process.exit(3)\"",
        killed: "node -e \"process.kill(process.pid, 'SIGTERM')\"",
      },
    }),
    "not-a-folder": "a file where the log folder would go\n",
  });
  const log = join(dir, ".abatty/steps/red.log");
  const r = runScript(dir, "red", [], {}, { log });
  assert.equal(r.code, 3);
  assert.equal(r.errored, undefined, "a step that ran and failed is not one that could not run");
  assert.match(readFileSync(log, "utf8"), /kept by the tee/);
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
  assert.match(lines.join("\n"), /touched them or what they import: test\/a\.test\.mjs/);
  assert.match(
    lines.join("\n"),
    /nothing this change touched reaches them through their imports: test\/flaky\.test\.mjs/,
  );
});

test("an output whose only failures are timeouts is counted; one with any other failure is not", () => {
  // A fresh copy on a scanned disk timed out four tests that pass in the repository; prove now
  // says so rather than reading the suite as broken.
  const timeouts = [" FAIL  src/a.test.ts > slow", "Error: Test timed out in 5000ms."].join("\n");
  assert.equal(onlyTimedOut(timeouts), 1);
  const mixed = [timeouts, "FAIL src/b.test.ts", "AssertionError: expected 1 to be 2"].join("\n");
  assert.equal(onlyTimedOut(mixed), 0);
  assert.equal(onlyTimedOut("all green\n"), 0, "nothing failed, nothing timed out");
});
