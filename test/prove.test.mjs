import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { cli, git, tempRepo } from "./helpers.mjs";

// The first contact six outside reviews asked for: which of a repository's checks can fail,
// with no config, no init and nothing written in it. The controls run on a copy.

const copies = () => readdirSync(tmpdir()).filter((d) => d.startsWith("abatty-prove-")).length;

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
  assert.equal(git(dir, "status", "--porcelain"), "", "the repository is as it was");
  assert.equal(copies(), before, "the copy is removed");
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
