import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { NEXT_PKG, cli, git, tempRepo } from "./helpers.mjs";
import { presetById } from "../src/presets/index.mjs";
import { CONTROLS_FILE, STEP_CONTROLS, runStepControls } from "../src/core/step-controls.mjs";
import { analyze } from "../src/core/gap-analysis.mjs";

const BIN = fileURLToPath(new URL("../bin/abatty.mjs", import.meta.url));

/** A repository whose scripts stand in for the tools: a linter that refuses a debugger statement, a typecheck that checks nothing, no test runner, the real ratchet. @param {string} name */
function fixture(name) {
  const dir = tempRepo(name, {
    // Formatted as prettier writes them: the format control is judged against a clean run now,
    // and a fixture that was red without a plant was the false red hiding under a "proven" one.
    "package.json":
      JSON.stringify(
        {
          name: "controls",
          private: true,
          scripts: {
            lint: "node lint.mjs",
            typecheck: 'node -e "process.exit(0)"',
            standards: `node ${JSON.stringify(BIN)} ratchet`,
          },
          dependencies: { express: "4.0.0" },
        },
        null,
        2,
      ) + "\n",
    "lint.mjs":
      'import { readFileSync, readdirSync } from "node:fs";\nfor (const f of readdirSync("src"))\n  if (/debugger/.test(readFileSync("src/" + f, "utf8"))) process.exit(1);\n',
    "src/server.js": "module.exports = 1;\n",
    ".prettierrc": "{}\n",
  });
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "chore: the tree");
  return dir;
}

test("every step has a control that means something; planted, run, removed: a step that goes red is proven, one that stays green is absent, one without a script is skipped", () => {
  for (const [key, c] of Object.entries(STEP_CONTROLS)) {
    assert.ok(c.means, `${key} says what it plants`);
    const files = c.files({
      deps: new Set(["vitest"]),
      pack: "javascript",
      dir: process.cwd(),
      scripts: {},
    });
    assert.ok(
      Object.keys(files).every((f) => f.includes("abatty-control.__")),
      `${key} plants under the control name`,
    );
  }
  const dir = fixture("controls-run");
  const preset = presetById("node");
  assert.ok(preset);
  /** @type {string[]} */
  const lines = [];
  const r = runStepControls({ repoDir: dir, preset, log: (l) => lines.push(l) });
  const by = Object.fromEntries(r.steps.map((s) => [s.label.replace(/ \(.*/, ""), s]));
  assert.equal(by["lint"]?.outcome, "red", JSON.stringify(by["lint"]));
  assert.equal(by["typecheck"]?.outcome, "green", "a typecheck that checks nothing is absent");
  assert.match(by["typecheck"]?.detail || "", /stayed GREEN on a type error: the check is absent/);
  assert.equal(by["unit tests"]?.outcome, "skipped");
  assert.equal(by["import graph"]?.outcome, "skipped", "no config");
  assert.equal(by["format"]?.outcome, "red", "prettier --check on an unformatted file");
  assert.equal(
    by["abatty ratchet + changelog range"]?.outcome,
    "red",
    "the ratchet on an 801-line file",
  );
  assert.equal(by["secret scan"]?.outcome, "red");
  assert.equal(by["audit"]?.outcome, "none");
  assert.deepEqual(r.absent, ["typecheck (CODE.3)"]);
  assert.ok(
    !readdirSync(join(dir, "src")).some((f) => f.includes("abatty-control")),
    "every planted file removed",
  );
  assert.ok(!existsSync(join(dir, "abatty-control.__.txt")));
  assert.equal(
    git(dir, "status", "--porcelain")
      .split("\n")
      .filter((l) => l && !l.includes(".abatty/")).length,
    0,
    "the tree as it was",
  );
  const saved = JSON.parse(readFileSync(join(dir, CONTROLS_FILE), "utf8"));
  assert.deepEqual(saved.absent, ["typecheck (CODE.3)"]);
  assert.ok(lines.some((l) => /planting a debugger statement/.test(l)));

  // The rule reads the last run: an absent step is partial with its name.
  const before = analyze(dir).findings.find((f) => f.id === "INST-CONTROLS");
  assert.equal(before?.status, "partial");
  assert.match(
    before?.evidence || "",
    /typecheck \(CODE\.3\) stayed green on a planted violation \(absent\)/,
  );
});

test("doctor --controls prints the verdict per step and is not ok while a step is absent; the rule is present once every step went red", () => {
  const dir = fixture("controls-doctor");
  cli(["init", dir, "--stack", "node"], dir);
  const r = cli(["doctor", dir, "--skip-self-test", "--controls"], dir);
  assert.equal(r.code, 3, r.out);
  assert.match(r.out, /Controls/);
  assert.match(r.out, /typecheck \(CODE\.3\).*stayed GREEN/);
  assert.match(r.out, /lint \(CODE\.4\).*went red on a debugger statement/);
  assert.match(r.out, /doctor: NOT ok/);

  const fresh = tempRepo("controls-present", { "package.json": NEXT_PKG });
  const preset = presetById("next");
  assert.ok(preset);
  const none = analyze(fresh).findings.find((f) => f.id === "INST-CONTROLS");
  assert.equal(none?.status, "missing", "no ratchet script at all");
  cli(["init", fresh, "--stack", "next"], fresh);
  const unrun = analyze(fresh).findings.find((f) => f.id === "INST-CONTROLS");
  assert.equal(unrun?.status, "partial");
  assert.match(unrun?.evidence || "", /controls not run yet \(abatty doctor --controls\)/);
  // Every step skipped or red counts as proven: here nothing runs but the built-in scan and the ratchet.
  runStepControls({ repoDir: fresh, preset, run: () => 1 });
  const proven = analyze(fresh).findings.find((f) => f.id === "INST-CONTROLS");
  assert.equal(proven?.status, "present", proven?.evidence);
  assert.match(proven?.evidence || "", /\d+ step\(s\) went red on a planted violation/);
});

/**
 * A repository whose typecheck reads JavaScript and whose test runner reads one folder: the shape
 * abatty itself has, and the shape a planted `src/*.test.ts` is invisible to. Both scripts stand
 * in for the real tools the way the fixture above does, and both are DELIBERATELY narrow, so a
 * control planted anywhere other than where the script looks leaves the step green.
 * @param {string} name
 */
function narrowFixture(name) {
  const dir = tempRepo(name, {
    "package.json":
      JSON.stringify({
        name: "narrow",
        private: true,
        scripts: {
          typecheck: "node typecheck.mjs",
          // A runner that expands the glob itself, as this package's own does: `node --test` with
          // a glob needs Node 21, and with a folder fails on Windows, so neither form runs on every
          // machine the suite does. The glob stays in the text because the plant reads it. Found
          // by the Node 20 leg of the matrix, through the confirm-clean run of this control.
          test: 'node run-tests.mjs "test/*.test.mjs"',
        },
      }) + "\n",
    "run-tests.mjs":
      'import { readdirSync } from "node:fs";\nimport { spawnSync } from "node:child_process";\n' +
      'const files = readdirSync("test").filter((f) => f.endsWith(".test.mjs")).map((f) => "test/" + f);\n' +
      'process.exit(spawnSync(process.execPath, ["--test", ...files], { stdio: "inherit" }).status ?? 1);\n',
    "tsconfig.json": JSON.stringify({ include: ["src/**/*.mjs"] }) + "\n",
    // Reads src/*.mjs alone, and refuses a JSDoc type that the value contradicts.
    "typecheck.mjs":
      'import { readFileSync, readdirSync } from "node:fs";\n' +
      'for (const f of readdirSync("src").filter((n) => n.endsWith(".mjs")))\n' +
      '  if (/@type \\{number\\}[\\s\\S]*?= "/.test(readFileSync("src/" + f, "utf8"))) process.exit(1);\n',
    "src/a.mjs": "export const a = 1;\n",
    "test/a.test.mjs": 'import { test } from "node:test";\ntest("holds", () => {});\n',
    ".prettierrc": "{}\n",
  });
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "chore: the tree");
  return dir;
}

test("the plant follows the repository: the typecheck's own extension and the test script's own folder, not a convention the repository does not keep", () => {
  const ctx = {
    deps: new Set(),
    pack: "javascript",
    dir: narrowFixture("controls-paths"),
    scripts: { test: 'node --test "test/*.test.mjs"' },
  };
  assert.deepEqual(Object.keys(STEP_CONTROLS.typecheck?.files(ctx) || {}), [
    "src/abatty-control.__.mjs",
  ]);
  assert.deepEqual(Object.keys(STEP_CONTROLS.test?.files(ctx) || {}), [
    "test/abatty-control.__.test.mjs",
  ]);
  // A tsconfig that covers TypeScript, and a runner with no glob of its own, keep the convention.
  // A folder handed to the runner is a folder the plant goes in; a runner with no argument at
  // all keeps the convention-based path its own default finds.
  const folderCtx = { ...ctx, scripts: { test: "node --test ./tests/" } };
  assert.deepEqual(Object.keys(STEP_CONTROLS.test?.files(folderCtx) || {}), [
    "tests/abatty-control.__.test.mjs",
  ]);
  const tsCtx = { ...ctx, dir: process.cwd() + "/no-such-dir", scripts: { test: "vitest run" } };
  assert.deepEqual(Object.keys(STEP_CONTROLS.typecheck?.files(tsCtx) || {}), [
    "src/abatty-control.__.ts",
  ]);
  assert.deepEqual(Object.keys(STEP_CONTROLS.test?.files(tsCtx) || {}), [
    "src/abatty-control.__.test.ts",
  ]);
});

test("against a narrow typecheck and a one-folder test runner, both steps go red: the control the old plant could not reach", () => {
  const dir = narrowFixture("controls-narrow");
  const preset = presetById("node");
  assert.ok(preset);
  const r = runStepControls({ repoDir: dir, preset });
  const by = Object.fromEntries(r.steps.map((s) => [s.label.replace(/ \(.*/, ""), s]));
  assert.equal(by["typecheck"]?.outcome, "red", JSON.stringify(by["typecheck"]));
  assert.equal(by["unit tests"]?.outcome, "red", JSON.stringify(by["unit tests"]));
  assert.deepEqual(r.absent, [], "nothing stayed green");
  // Planted, run, removed: a control that leaves its file behind is a control that breaks the tree.
  assert.deepEqual(
    readdirSync(join(dir, "src")).filter((f) => f.includes("abatty-control")),
    [],
  );
  assert.deepEqual(
    readdirSync(join(dir, "test")).filter((f) => f.includes("abatty-control")),
    [],
  );
});

test("the suites are judged too, a step red without a plant proves nothing, and what no plant can prove is said", () => {
  // The browser and database steps are what vanished from the trial's empty-range run, and the
  // controls pass could not see them: it read the always-on steps alone. And a step that is red
  // with the plant AND without it is the environment failing, not the guard holding; reading it
  // as proven was the trial's first-day false red, inside the mechanism that exists to catch
  // false greens.
  const dir = tempRepo("controls-suites", {
    "package.json":
      JSON.stringify(
        {
          name: "s",
          private: true,
          scripts: {
            typecheck: "x",
            test: "x",
            standards: "x",
            build: "x",
            e2e: "x",
            "test:integration": "x",
            coverage: "x",
          },
          dependencies: { next: "15", "@playwright/test": "1.0.0", vitest: "3.0.0" },
        },
        null,
        2,
      ) + "\n",
    "playwright.config.ts": 'export default { testDir: "./browser-tests" };\n',
    "src/a.ts": "export const a = 1;\n",
  });
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "chore: the tree");
  const preset = presetById("next");
  assert.ok(preset);
  /** @type {string[]} */
  const seen = [];
  // A runner that answers as the real tools would: red when the plant is in the tree, green clean;
  // except `test:integration`, which is red either way (a database nobody started).
  const run = (/** @type {string} */ cwd, /** @type {string} */ script) => {
    seen.push(script);
    if (script === "test:integration") return 1;
    const planted = readdirSync(cwd, { recursive: true }).some((f) =>
      String(f).includes("abatty-control.__"),
    );
    return planted ? 1 : 0;
  };
  const down = runStepControls({ repoDir: dir, preset, run, dockerUp: () => false, log: () => {} });
  const by = (/** @type {{ steps: { label: string, outcome: string, detail: string }[] }} */ r) =>
    Object.fromEntries(r.steps.map((s) => [s.label.replace(/ \(.*/, "").replace(/ · .*/, ""), s]));
  const d = by(down);
  assert.equal(d["E2E + axe"]?.outcome, "skipped");
  assert.match(d["E2E + axe"]?.detail || "", /Docker daemon is not running/);
  assert.equal(d["coverage gate"]?.outcome, "skipped", "the database suite too");
  assert.ok(!seen.includes("e2e"), "nothing of a suite runs without its environment");

  const up = runStepControls({ repoDir: dir, preset, run, dockerUp: () => true, log: () => {} });
  const u = by(up);
  assert.equal(u["E2E + axe"]?.outcome, "red", JSON.stringify(u["E2E + axe"]));
  assert.match(
    u["E2E + axe"]?.detail || "",
    /went red on a browser test that throws, green without it/,
  );
  assert.equal(u["build"]?.outcome, "none");
  assert.match(u["build"]?.detail || "", /a build is proven by its output/);
  assert.equal(u["coverage gate"]?.outcome, "none");
  assert.equal(u["integration suite against a real Postgres"]?.outcome, "skipped");
  assert.match(
    u["integration suite against a real Postgres"]?.detail || "",
    /red without a plant \(exit 1\): nothing to prove/,
  );
  assert.equal(u["unit tests"]?.outcome, "red", "an always-on step, judged the same way");
  assert.equal(u["audit"]?.outcome, "none");
  assert.deepEqual(up.absent, [], "nothing stayed green on its plant");
  assert.ok(
    !existsSync(join(dir, "browser-tests")) &&
      !readdirSync(dir).some((f) => f.includes("abatty-control")),
    "every planted file removed, the folder it was planted in included",
  );

  // The browser plant follows the Playwright config's testDir.
  assert.deepEqual(
    Object.keys(
      STEP_CONTROLS.e2e?.files({
        deps: new Set(["@playwright/test"]),
        pack: "javascript",
        dir,
        scripts: {},
      }) || {},
    ),
    ["browser-tests/abatty-control.__.spec.ts"],
  );
});
