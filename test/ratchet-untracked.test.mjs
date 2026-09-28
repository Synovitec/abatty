import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cli, git, tempRepo } from "./helpers.mjs";
import { buildContext } from "../src/rules/context.mjs";
import { untrackedInScope, untrackedLine } from "../src/ratchet/untracked.mjs";

// An adopter wrote a baseline over new sources it had not added yet; the ratchet reads the
// tracked tree, so the floor left them out and the push that committed them was refused, with
// nothing having said the files were unseen.

/** @param {string} name */
function repo(name) {
  const dir = tempRepo(name, {
    "package.json": JSON.stringify({ name: "u", private: true }) + "\n",
    ".gitignore": "scratch/\n",
    "src/a.mjs": "export const a = 1;\n",
    "docs/README.md": "# docs\n",
  });
  writeFileSync(join(dir, "src/b.mjs"), "export const b = 2;\n");
  writeFileSync(join(dir, "src/b.test.mjs"), "import './b.mjs';\n");
  writeFileSync(join(dir, "docs/new.md"), "# new\n");
  writeFileSync(join(dir, "notes.txt"), "not a source\n");
  mkdirSync(join(dir, "scratch"));
  writeFileSync(join(dir, "scratch/c.mjs"), "export const c = 3;\n");
  return dir;
}

test("the untracked sources, tests and docs are listed; ignored files, other files and tracked ones are not", () => {
  const dir = repo("untracked-list");
  const found = untrackedInScope(dir, buildContext(dir, { tracked: true })).sort();
  assert.deepEqual(found, ["docs/new.md", "src/b.mjs", "src/b.test.mjs"]);
  git(dir, "add", "-A");
  assert.deepEqual(untrackedInScope(dir, buildContext(dir, { tracked: true })), []);
  assert.equal(untrackedLine([], "ratchet"), null, "nothing left out says nothing");
});

test("ratchet and baseline say which untracked files they left out, and stop saying it once they are added", () => {
  const dir = repo("untracked-cli");
  const ratchet = cli(["ratchet", dir], dir);
  assert.match(ratchet.out, /3 untracked file\(s\) the probes would read are not measured/);
  assert.match(ratchet.out, /src\/b\.mjs/);
  const baseline = cli(["baseline", dir, "--dry-run"], dir);
  assert.match(baseline.out, /are not in this floor/);
  git(dir, "add", "-A");
  assert.doesNotMatch(cli(["ratchet", dir], dir).out, /untracked file/);
  assert.doesNotMatch(cli(["baseline", dir, "--dry-run"], dir).out, /untracked file/);
});
