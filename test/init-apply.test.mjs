import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tempRepo } from "./helpers.mjs";
import { finishSteps } from "../src/cli/init-steps.mjs";

// `init --apply` takes the steps a machine safely can, in order, and leaves the rest numbered
// for the reader; a step that fails stops the ones after it. Commands here are node itself, so
// no test reaches a registry.

/** A command that writes `name` in the folder it runs in, then exits with `code`. */
const touch = (/** @type {string} */ name, code = 0) => [
  process.execPath,
  "-e",
  `require("fs").writeFileSync(${JSON.stringify(name)}, ""); process.exit(${code})`,
];

const run = (
  /** @type {string} */ dir,
  /** @type {boolean} */ apply,
  /** @type {any[]} */ steps,
) => {
  /** @type {string[]} */
  const said = [];
  const ok = finishSteps(steps, { dir, apply, out: (s) => said.push(s) });
  return { ok, out: said.join("") };
};

test("without --apply every step is said and none is taken", () => {
  const dir = tempRepo("apply-off", {});
  const r = run(dir, false, [{ text: "install", run: touch("a") }, { text: "fill the file" }]);
  assert.equal(r.ok, true);
  assert.equal(existsSync(join(dir, "a")), false);
  assert.match(r.out, /1\. install\n\s+2\. fill the file/);
});

test("--apply takes the runnable steps and numbers what is left from one", () => {
  const dir = tempRepo("apply-on", {});
  const r = run(dir, true, [
    { text: "install", run: touch("a") },
    { text: "fill the file" },
    { text: "baseline", run: touch("b") },
  ]);
  assert.equal(r.ok, true, r.out);
  assert.ok(existsSync(join(dir, "a")) && existsSync(join(dir, "b")));
  assert.match(r.out, /Left to do by hand\n\s+1\. fill the file\n/);
  assert.doesNotMatch(r.out, /\d\. install|\d\. baseline/);
});

test("a step that fails stops the ones after it, which are left by hand, and the run says so", () => {
  const dir = tempRepo("apply-fail", {});
  const r = run(dir, true, [
    { text: "install", run: touch("a", 1) },
    { text: "baseline", run: touch("b") },
  ]);
  assert.equal(r.ok, false);
  assert.equal(existsSync(join(dir, "b")), false, "nothing after a failure is taken");
  assert.match(r.out, /exited 1: this step and the ones after it are left to do by hand/);
  assert.match(r.out, /1\. install\n\s+2\. baseline/);
});
