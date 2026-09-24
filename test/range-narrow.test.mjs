import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { git, tempRepo } from "./helpers.mjs";
import { runGate } from "../src/core/gate.mjs";
import { presetById } from "../src/presets/index.mjs";

// A CI run on a new branch has no `before` to diff from; a hand-written fallback of HEAD~1 judged
// one commit of four and printed green. The gate says how much of the branch a given range holds.

const node = /** @type {import("../src/presets/index.mjs").Preset} */ (presetById("node"));

/** A branch three commits past main. */
function branch() {
  const dir = tempRepo("range-narrow", {
    "package.json": JSON.stringify({ name: "r", scripts: { test: "node -e 0" } }),
    "src/a.mjs": "export const a = 0;\n",
  });
  git(dir, "branch", "-M", "main");
  git(dir, "checkout", "-q", "-b", "feat/three");
  for (const n of [1, 2, 3]) {
    writeFileSync(join(dir, "src/a.mjs"), `export const a = ${n};\n`);
    git(dir, "commit", "-qam", `feat: ${n}`);
  }
  return dir;
}

/** @param {string} dir @param {string} range */
function lines(dir, range) {
  /** @type {string[]} */
  const out = [];
  runGate({
    repoDir: dir,
    preset: node,
    range,
    base: "main",
    run: () => 0,
    audit: () => ({ status: 0, output: "" }),
    log: (l) => out.push(l),
  });
  return out.join("\n");
}

test("a range narrower than the branch is said, with the range that holds the branch", () => {
  const dir = branch();
  const fork = git(dir, "merge-base", "main", "HEAD");
  const said = lines(dir, "HEAD~1..HEAD");
  assert.match(said, /judges 1 of the 3 commit\(s\) this branch carries since it left main/);
  assert.ok(said.includes(`--range ${fork.slice(0, 12)}..HEAD judges the branch`), said);
  assert.doesNotMatch(lines(dir, `${fork}..HEAD`), /judges \d+ of the/);
});

test("on the base branch a narrow range is the push, and nothing is said", () => {
  const dir = branch();
  // main three commits ahead of its remote: the fork from origin/main is three back.
  git(dir, "update-ref", "refs/remotes/origin/main", "main");
  git(dir, "checkout", "-q", "main");
  git(dir, "merge", "-q", "--ff-only", "feat/three");
  assert.doesNotMatch(lines(dir, "HEAD~1..HEAD"), /judges \d+ of the/);
});

test("a range from the push's own before is the push; a HEAD~1 fallback on a detached checkout is named", () => {
  const dir = branch();
  const before = git(dir, "rev-parse", "HEAD~1");
  assert.doesNotMatch(lines(dir, `${before}..HEAD`), /judges \d+ of the/, "an incremental push");
  git(dir, "checkout", "-q", "--detach");
  assert.match(lines(dir, "HEAD~1..HEAD"), /judges 1 of the 3 commit\(s\)/);
});
