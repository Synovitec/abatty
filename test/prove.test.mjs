import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { cli, git, tempRepo } from "./helpers.mjs";

// The first contact six outside reviews asked for: which of a repository's checks can fail,
// with no config, no init and nothing written in it. The controls run on a copy.

const copies = () =>
  readdirSync(tmpdir()).filter(
    (d) => d.startsWith("abatty-prove-") && !d.startsWith("abatty-prove-logs-"),
  ).length;

test("a test script that runs the tests is proven, and nothing is written in the repository", () => {
  const dir = tempRepo("prove-real", {
    "package.json": JSON.stringify({ name: "p", scripts: { test: "node --test" } }),
    "src/add.js": "module.exports = (a, b) => a + b;\n",
    "test/add.test.js":
      'const { test } = require("node:test");\nconst assert = require("node:assert");\ntest("adds", () => assert.equal(require("../src/add.js")(1, 2), 3));\n',
  });
  const before = copies();
  const r = cli(["prove", dir, "--stack", "node"], dir);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /✓ unit tests \(TEST\.1\)\s+went red on a test that throws/);
  // One check is the repository's; the secret scan is abatty's own and is said apart. "2 of 2"
  // counted it as the repository's.
  assert.match(r.out, /1 of 1 of your check\(s\) went red on a planted violation and green again/);
  assert.match(r.out, /and abatty's own secret scan/);
  assert.equal(git(dir, "status", "--porcelain"), "", "the repository is as it was");
  assert.equal(copies(), before, "the copy is removed");
});

test("the lint plant is said in the repository's language", () => {
  const dir = tempRepo("prove-lint-js", {
    "package.json": JSON.stringify({ name: "p", scripts: { lint: "node -e 0" } }),
    "src/a.js": "export const a = 1;\n",
  });
  const r = cli(["prove", dir, "--stack", "node"], dir);
  assert.match(r.out, /planting a debugger statement/);
  assert.doesNotMatch(r.out, /Python/, "a JavaScript repository reads about JavaScript");
});

test("a test script that can never fail is named as absent, and the run exits 3", () => {
  const dir = tempRepo("prove-hollow", {
    "package.json": JSON.stringify({ name: "p", scripts: { test: "node -e 0" } }),
    "test/add.test.js": 'require("node:test")("x", () => {});\n',
  });
  const r = cli(["prove", dir, "--stack", "node", "--json"], dir);
  assert.equal(r.code, 3, r.out);
  const unit = JSON.parse(r.out).steps.find((/** @type {any} */ s) => /TEST\.1/.test(s.label));
  assert.equal(unit?.outcome, "green");
  assert.equal(git(dir, "status", "--porcelain"), "");
});

test("removing the copy never reaches the repository's own node_modules, which the copy links", () => {
  const dir = tempRepo("prove-modules", {
    "package.json": JSON.stringify({ name: "p", scripts: { test: "node --test" } }),
    "test/a.test.js": 'require("node:test")("x", () => {});\n',
    ".gitignore": "node_modules/\n",
    "node_modules/kept/index.js": "module.exports = 1;\n",
  });
  cli(["prove", dir, "--stack", "node"], dir);
  assert.ok(existsSync(join(dir, "node_modules/kept/index.js")), "the dependencies are untouched");
});

test("a workspace's own dependencies are linked into the copy, so its tests are judged, not red before the plant", () => {
  // A bun monorepo's workspaces keep their own node_modules: linked at the root alone, its
  // typecheck and tests failed in the copy and five working steps read as unproven.
  const dir = tempRepo("prove-workspace-modules", {
    "package.json": JSON.stringify({
      name: "mono",
      private: true,
      workspaces: ["packages/*"],
      // Run in the workspace with no path, which Node 20 and 22 both search by their own default
      // patterns: the quoted glob needs Node 21, and on Node 20 the fixture's own tests were red
      // before the plant.
      scripts: { test: "cd packages/a && node --test" },
    }),
    ".gitignore": "node_modules/\n",
    "packages/a/package.json": JSON.stringify({ name: "a" }),
    "packages/a/node_modules/only-here/index.js": "module.exports = 2;\n",
    "packages/a/test/a.test.js":
      'const { test } = require("node:test");\nconst assert = require("node:assert");\ntest("two", () => assert.equal(require("only-here"), 2));\n',
  });
  const r = cli(["prove", dir, "--stack", "node", "--json"], dir);
  const unit = JSON.parse(r.out).steps.find((/** @type {any} */ s) => /TEST\.1/.test(s.label));
  assert.equal(unit?.outcome, "red", JSON.stringify(unit));
  assert.ok(existsSync(join(dir, "packages/a/node_modules/only-here/index.js")), "left in place");
});

test("a step red before its plant is counted as not judged, and its log is kept outside the repository", () => {
  const dir = tempRepo("prove-unjudged", {
    "package.json": JSON.stringify({ name: "p", scripts: { test: "node -e process.exitCode=1" } }),
  });
  const r = cli(["prove", dir, "--stack", "node"], dir);
  assert.match(r.out, /1 more could not be judged here \(unit tests \(TEST\.1\)\)/);
  const kept = r.out.match(/what each step printed: (\S+)/)?.[1] || "";
  assert.ok(kept && !kept.startsWith(dir) && existsSync(kept), `kept at ${kept}`);
  assert.equal(existsSync(join(dir, ".abatty")), false, "nothing written in the repository");
});
