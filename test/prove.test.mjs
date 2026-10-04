import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
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
  // It says what it is before it runs anything: the repository's own scripts, not a sandbox.
  assert.match(r.out, /runs this repository's own scripts with your environment.*not a sandbox/);
  // The demo a stranger reads: no live log path into the removed copy, the plant said once, and
  // the opt-in scrub said off rather than missing a control.
  assert.doesNotMatch(r.out, /\.abatty\/steps\/controls/);
  assert.match(r.out, /planting a cloud access key/);
  assert.match(r.out, /no trace of the tools \(scrub\)\s+scrub\.enabled is off/);
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
  // Where to look: the copy is faithful, so the cause is most often the repository or the machine.
  assert.match(r.out, /most often the repository's own failure or the machine's/);
  const kept = r.out.match(/what each step printed: (\S+)/)?.[1] || "";
  assert.ok(kept && !kept.startsWith(dir) && existsSync(kept), `kept at ${kept}`);
  assert.equal(existsSync(join(dir, ".abatty")), false, "nothing written in the repository");
});

test("a scrub the repository turned on is named as proven by its own suite, not as switched off", () => {
  const dir = tempRepo("prove-scrub-on", {
    "package.json": JSON.stringify({ name: "p", private: true }),
    "abatty.config.json": JSON.stringify({ scrub: { enabled: true } }),
  });
  const r = cli(["prove", dir, "--stack", "node"], dir);
  assert.match(r.out, /no trace of the tools \(scrub\)\s+no control here: the scrub's vocabulary/);
  assert.doesNotMatch(r.out, /scrub\.enabled is off/);
});

test("the copy has the repository's history and its ignored env files, so steps reading them are judged", () => {
  // A monorepo's coverage of the changed lines read `git diff HEAD` and a test read DATABASE_URL
  // from a gitignored .env.local: on a copy with one commit and no env file both were red before
  // the plant, and three working steps read as not judged.
  const dir = tempRepo("prove-faithful", {
    "package.json": JSON.stringify({ name: "p", scripts: { test: "node --test" } }),
    ".gitignore": ".env.local\n",
    "test/env.test.js": [
      'const { test } = require("node:test");',
      'const { execSync } = require("node:child_process");',
      'const { readFileSync } = require("node:fs");',
      'test("reads history and env", () => {',
      '  execSync("git rev-parse --verify -q HEAD~1");',
      '  if (!readFileSync(".env.local", "utf8").includes("DATABASE_URL")) throw new Error("no env");',
      "});",
      "",
    ].join("\n"),
  });
  writeFileSync(join(dir, "README.md"), "# a second commit\n");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "docs: a second commit");
  writeFileSync(join(dir, ".env.local"), "DATABASE_URL=postgres://local/test\n");
  const r = cli(["prove", dir, "--stack", "node", "--json"], dir);
  const unit = JSON.parse(r.out).steps.find((/** @type {any} */ s) => /TEST\.1/.test(s.label));
  assert.equal(unit?.outcome, "red", JSON.stringify(unit));
  assert.equal(
    readFileSync(join(dir, ".env.local"), "utf8"),
    "DATABASE_URL=postgres://local/test\n",
  );
  assert.equal(git(dir, "status", "--porcelain"), "", "nothing written in the repository");
});

test("a summary with steps not judged is a warning, and says its count is of the judged ones", () => {
  // "✓ 4 of 4 of your checks" read as everything proven while three steps were not judged.
  const dir = tempRepo("prove-partly-judged", {
    "package.json": JSON.stringify({
      name: "p",
      scripts: { test: "node --test", typecheck: "node -e process.exitCode=1" },
    }),
    "test/a.test.js": 'const { test } = require("node:test");\ntest("a", () => {});\n',
  });
  const r = cli(["prove", dir, "--stack", "node", "--plain"], dir);
  assert.match(r.out, /\[!\] 1 of 1 of your check\(s\) judged here went red/);
  assert.match(r.out, /1 more could not be judged here \(typecheck \(CODE\.3\)\)/);
});

test("what the repository generated into an ignored folder is in the copy, so its tests are judged", () => {
  // A Next and Prisma product generates its client into a gitignored generated/: the copy had
  // none, and its typecheck and tests read red before any plant. Builds and caches stay out.
  const dir = tempRepo("prove-generated", {
    "package.json": JSON.stringify({ name: "p", scripts: { test: "node --test" } }),
    ".gitignore": "generated/\ndist/\n",
    "test/client.test.js":
      'const { test } = require("node:test");\ntest("client", () => require("../generated/prisma/client.js"));\n',
  });
  mkdirSync(join(dir, "generated/prisma"), { recursive: true });
  writeFileSync(join(dir, "generated/prisma/client.js"), "module.exports = {};\n");
  const r = cli(["prove", dir, "--stack", "node", "--json"], dir);
  const unit = JSON.parse(r.out).steps.find((/** @type {any} */ s) => /TEST\.1/.test(s.label));
  assert.equal(unit?.outcome, "red", JSON.stringify(unit));
  assert.equal(git(dir, "status", "--porcelain"), "", "nothing written in the repository");
});

test("a suite the repository has is named as not run by default; none is named where it has none", () => {
  const dir = tempRepo("prove-suites", {
    "package.json": JSON.stringify({
      name: "p",
      scripts: { test: "node --test", "test:integration": "node --test tests/integration" },
    }),
  });
  const r = cli(["prove", dir, "--stack", "node", "--plain"], dir);
  assert.match(r.out, /not run by default: database suite[^·]*· --suites runs them too/);
  const bare = tempRepo("prove-no-suites", {
    "package.json": JSON.stringify({ name: "p", scripts: { test: "node --test" } }),
  });
  assert.doesNotMatch(
    cli(["prove", bare, "--stack", "node", "--plain"], bare).out,
    /not run by default/,
  );
});

test("a step whose only failures are timeouts says so, rather than reading as broken", () => {
  const dir = tempRepo("prove-timeouts", {
    "package.json": JSON.stringify({ name: "p", scripts: { test: "node --test" } }),
    "test/slow.test.js":
      'const { test } = require("node:test");\ntest("slow", { timeout: 20 }, () => new Promise((r) => setTimeout(r, 400)));\n',
  });
  const r = cli(["prove", dir, "--stack", "node", "--json"], dir);
  const unit = JSON.parse(r.out).steps.find((/** @type {any} */ s) => /TEST\.1/.test(s.label));
  assert.match(String(unit?.detail), /1 test\(s\) timed out on the copy and none failed otherwise/);
});

test("abatty's own scan, red on what the tree holds, is said apart from the repository's checks", () => {
  // An adopter's own scan step was green; abatty's built-in one found fixtures and was counted
  // among "your checks" that could not be judged.
  const key = ["AKIA", "QWERTYUIOPASDFGH"].join("");
  const dir = tempRepo("prove-builtin-red", {
    "package.json": JSON.stringify({ name: "p", scripts: { test: "node --test" } }),
    "test/a.test.js": 'const { test } = require("node:test");\ntest("a", () => {});\n',
    "fixtures/creds.txt": `aws_access_key_id = ${key}\n`,
  });
  const r = cli(["prove", dir, "--stack", "node", "--plain"], dir);
  assert.match(r.out, /abatty's own secret scan \(SEC\.1\) already finds something in the tree/);
  assert.doesNotMatch(r.out, /could not be judged here \([^)]*secret scan/);
});
