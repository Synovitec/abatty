import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { NEXT_PKG, cli, git, tempRepo } from "./helpers.mjs";
import { presetById } from "../src/presets/index.mjs";
import { CONTROLS_FILE, STEP_CONTROLS, runStepControls } from "../src/core/step-controls.mjs";
import { analyze } from "../src/core/gap-analysis.mjs";

const BIN = new URL("../bin/abatty.mjs", import.meta.url).pathname;

/** A repository whose scripts stand in for the tools: a linter that refuses a debugger statement, a typecheck that checks nothing, no test runner, the real ratchet. @param {string} name */
function fixture(name) {
  const dir = tempRepo(name, {
    "package.json":
      JSON.stringify({
        name: "controls",
        private: true,
        scripts: {
          lint: "node lint.mjs",
          typecheck: 'node -e "process.exit(0)"',
          standards: `node ${JSON.stringify(BIN)} ratchet`,
        },
        dependencies: { express: "4.0.0" },
      }) + "\n",
    "lint.mjs":
      'import { readFileSync, readdirSync } from "node:fs";\nfor (const f of readdirSync("src")) if (/debugger/.test(readFileSync("src/" + f, "utf8"))) process.exit(1);\n',
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
    const files = c.files(new Set(["vitest"]));
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
  assert.equal(r.code, 1, r.out);
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
