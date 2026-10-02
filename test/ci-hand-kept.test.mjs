import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cli, tempRepo } from "./helpers.mjs";
import { presetById } from "../src/presets/index.mjs";
import { isGenerated, runsGate } from "../src/ci/hand-kept.mjs";
import { renderGithubActions } from "../src/ci/github.mjs";

const PKG = JSON.stringify({
  name: "fixture-kept",
  private: true,
  scripts: {
    test: "node -e process.exit(0)",
    gate: "abatty gate",
    "gate:fast": "abatty gate --fast",
    gateway: "node gateway.mjs",
  },
  dependencies: { next: "15.0.0", react: "19.0.0" },
});

/** A pipeline kept by hand, as an adopter wrote theirs: its own env, pins and one gate step. */
const KEPT = [
  "name: checks",
  "on: [push, pull_request]",
  "concurrency:",
  "  group: checks-${{ github.ref }}",
  "env:",
  "  TEST_DATABASE_URL: postgresql://ci:ci@localhost:5432/ci",
  "jobs:",
  "  checks:",
  "    runs-on: ubuntu-26.04",
  "    steps:",
  "      - uses: actions/checkout@v7",
  "      - run: pnpm install --frozen-lockfile",
  "      - run: pnpm run -s gate -- --range auto",
  "",
].join("\n");

const scripts = JSON.parse(PKG).scripts;

test("a pipeline runs the gate through the gate itself or a script whose body is the gate", () => {
  assert.equal(runsGate("- run: pnpm exec abatty gate --range auto", scripts).runs, true);
  assert.equal(runsGate("- run: pnpm run -s gate", scripts).runs, true);
  assert.equal(runsGate("- run: npm run gate -- --range auto", scripts).runs, true);
  assert.equal(runsGate("- run: bun run --silent gate", scripts).runs, true);
  const legacy = runsGate("- run: npm run check", { check: "node scripts/ci/gate.mjs" });
  assert.equal(legacy.runs, true, "the older gate script is the gate too");
});

test("a pipeline that names the gate without running all of it does not run the gate", () => {
  const fast = runsGate("- run: pnpm run gate:fast", scripts);
  assert.equal(fast.runs, false);
  assert.match(fast.how, /gate:fast.*leaves out the suites/);
  assert.equal(runsGate("- run: pnpm exec abatty gate --fast", scripts).runs, false);
  assert.equal(runsGate("# - run: pnpm run gate\n- run: pnpm test", scripts).runs, false);
  assert.equal(runsGate("- run: pnpm run gateway", scripts).runs, false, "a longer name");
  assert.equal(runsGate("- run: pnpm run gate", { gate: "echo green" }).runs, false);
});

test("the generated pipeline carries the mark that it may be regenerated; a hand-kept one does not", () => {
  const preset = /** @type {import("../src/presets/index.mjs").Preset} */ (presetById("next"));
  assert.equal(isGenerated(renderGithubActions(preset, { scripts })), true);
  assert.equal(isGenerated(KEPT), false);
});

test("abatty ci leaves a hand-kept pipeline that runs the gate as it is, and --check calls it the gate", () => {
  const dir = tempRepo("ci-kept-gate", {
    "package.json": PKG,
    ".github/workflows/checks.yml": KEPT,
  });
  const w = cli(["ci", dir, "--provider", "github"], dir);
  assert.equal(w.code, 0, w.out);
  assert.equal(readFileSync(join(dir, ".github/workflows/checks.yml"), "utf8"), KEPT);
  assert.ok(!existsSync(join(dir, ".github/workflows/checks.yml.abatty-new")));
  const c = cli(["ci", dir, "--provider", "github", "--check"], dir);
  assert.equal(c.code, 0, c.out);
  assert.match(
    c.out,
    /runs gate\s+\.github\/workflows\/checks\.yml · kept by hand; runs the `gate` script/,
  );
  assert.match(c.out, /CI is the gate/);
});

test("abatty ci puts the generated pipeline beside a hand-kept one that does not run the gate, and exits 3", () => {
  const partial = KEPT.replace("pnpm run -s gate -- --range auto", "pnpm test");
  const dir = tempRepo("ci-kept-short", {
    "package.json": PKG,
    ".github/workflows/checks.yml": partial,
    ".github/PULL_REQUEST_TEMPLATE.md": "## Ours\n",
  });
  const c = cli(["ci", dir, "--provider", "github", "--check"], dir);
  assert.equal(c.code, 3, c.out);
  assert.match(c.out, /not gate\s+\.github\/workflows\/checks\.yml/);
  assert.ok(!/run abatty ci/.test(c.out), "a hand-kept file is not told to be regenerated");
  const w = cli(["ci", dir, "--provider", "github"], dir);
  assert.equal(w.code, 3, w.out);
  assert.equal(readFileSync(join(dir, ".github/workflows/checks.yml"), "utf8"), partial);
  const beside = readFileSync(join(dir, ".github/workflows/checks.yml.abatty-new"), "utf8");
  assert.equal(isGenerated(beside), true);
});

test("a pull-request template the repository wrote is kept, and the generated one names its package manager", () => {
  const dir = tempRepo("ci-kept-template", {
    "package.json": PKG,
    "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
    ".github/workflows/checks.yml": KEPT,
    ".github/PULL_REQUEST_TEMPLATE.md": "## Ours\n",
  });
  const c = cli(["ci", dir, "--provider", "github", "--check"], dir);
  assert.equal(c.code, 0, c.out);
  assert.match(c.out, /kept\s+\.github\/PULL_REQUEST_TEMPLATE\.md/);
  cli(["ci", dir, "--provider", "github"], dir);
  assert.equal(readFileSync(join(dir, ".github/PULL_REQUEST_TEMPLATE.md"), "utf8"), "## Ours\n");
  const theirs = readFileSync(join(dir, ".github/PULL_REQUEST_TEMPLATE.md.abatty-new"), "utf8");
  assert.match(theirs, /The gate is green \(`pnpm run gate`\)/);
  assert.ok(!/npm run gate/.test(theirs.replace(/pnpm run gate/g, "")));
});

test("a pipeline only named after the gate does not run it, and a run line under that name does", () => {
  const named =
    "name: abatty gate\njobs:\n  a:\n    name: abatty gate on push\n    steps:\n      - name: abatty gate\n        run: npm test\n";
  assert.equal(runsGate(named, { test: "node --test" }).runs, false);
  const ran =
    "name: ci\njobs:\n  a:\n    steps:\n      - name: the gate\n        run: npx abatty gate\n";
  assert.equal(runsGate(ran, {}).runs, true);
});
