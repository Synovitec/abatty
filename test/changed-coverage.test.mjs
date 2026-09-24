import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { git, tempRepo } from "./helpers.mjs";
import { missingGateScripts, runGate } from "../src/core/gate.mjs";
import { runStepControls } from "../src/core/step-controls.mjs";
import { presetById } from "../src/presets/index.mjs";

// A push the local full gate passed went red in CI on the coverage of its changed lines, which
// only a separate CI step checked, after the session had reported the push green. The gate runs
// that step now, over its own range, when the repository has the script.

const node = /** @type {import("../src/presets/index.mjs").Preset} */ (presetById("node"));

/** @param {string} name @param {Record<string, string>} scripts */
function repo(name, scripts) {
  const dir = tempRepo(name, {
    "package.json": JSON.stringify({
      name: "c",
      scripts: { test: "node -e 0", typecheck: "node -e 0", standards: "node -e 0", ...scripts },
    }),
    "package-lock.json": "{}\n",
    "src/a.mjs": "export const a = 1;\n",
  });
  writeFileSync(join(dir, "src/a.mjs"), "export const a = 2;\n");
  git(dir, "commit", "-qam", "change a");
  return dir;
}

/** @param {string} dir */
function gate(dir) {
  /** @type {[string, Record<string, string> | undefined][]} */
  const ran = [];
  const r = runGate({
    repoDir: dir,
    preset: node,
    range: "HEAD~1..HEAD",
    run: (_d, script, _a, env) => {
      ran.push([script, env]);
      return 0;
    },
    audit: () => ({ status: 0, output: "" }),
    log: () => {},
  });
  return { r, ran, step: r.events.find((e) => /changed lines/.test(e.label)) };
}

test("the gate runs the changed-lines coverage over its own range, and says so when there is no script", () => {
  const withScript = gate(repo("changed-on", { "test:changed": "vitest --changed" }));
  const call = withScript.ran.find(([s]) => s === "test:changed");
  assert.ok(call, "the alternative script name runs");
  assert.equal(call[1]?.ABATTY_RANGE, "HEAD~1..HEAD", "told the range it judges");
  const without = gate(repo("changed-off", {}));
  assert.equal(without.step?.outcome, "skipped", "not a silent green");
});

test("the step's control goes red on a check of the changed lines, and green on one that checks nothing", () => {
  // A stand-in for a coverage tool: red when a changed source file is in the index and not in
  // the range's committed files, which is what an untested new file is to a real one.
  const check =
    "node -e \"const o=require('child_process').execSync('git ls-files --cached src').toString();process.exit(/abatty-control/.test(o)?1:0)\"";
  const r = runStepControls({
    repoDir: repo("changed-ctl", { "coverage:changed": check }),
    preset: node,
  });
  const step = r.steps.find((s) => /changed lines/.test(s.label));
  assert.equal(step?.outcome, "red", JSON.stringify(step));
  const blind = runStepControls({
    repoDir: repo("changed-blind", { "coverage:changed": "node -e 0" }),
    preset: node,
  });
  assert.equal(blind.steps.find((s) => /changed lines/.test(s.label))?.outcome, "green");
});

test("a range the gate could not trust is not handed to the changed-lines step", () => {
  /** @type {Record<string, string> | undefined} */
  let env;
  runGate({
    repoDir: repo("changed-blind-range", { "test:changed": "vitest --changed" }),
    preset: node,
    range: "HEAD..HEAD",
    ci: true,
    run: (_d, script, _a, e) => {
      if (script === "test:changed") env = e;
      return 0;
    },
    audit: () => ({ status: 0, output: "" }),
    log: () => {},
  });
  assert.ok(env, "the step ran");
  assert.equal(env?.ABATTY_RANGE, undefined);
});

test("the controls leave the index as they found it, the intent-to-add marks included", () => {
  const dir = repo("changed-clean", { "coverage:changed": "node -e 0" });
  const before = git(dir, "status", "--porcelain");
  runStepControls({ repoDir: dir, preset: node });
  // .abatty/ is where the run records its outcome; nothing else may have moved.
  const after = git(dir, "status", "--porcelain")
    .split("\n")
    .filter((l) => l !== "?? .abatty/")
    .join("\n");
  assert.equal(after, before);
  assert.doesNotMatch(git(dir, "ls-files"), /abatty-control/);
});

test("doctor does not call the changed-lines step absent when the gate runs it by its other name", () => {
  const dir = repo("changed-alt-name", { "test:changed": "vitest --changed" });
  assert.equal(missingGateScripts(dir, node).includes("coverage:changed"), false);
  assert.equal(
    missingGateScripts(repo("changed-none", {}), node).includes("coverage:changed"),
    true,
  );
});
