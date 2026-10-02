import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NEXT_PKG, cli, tempRepo } from "./helpers.mjs";

// An adopter who did every step init listed met a first gate with no floor and a coverage step
// skipped for a script nobody had mentioned. The steps by hand now name both, and only when due.

const steps = (/** @type {string} */ out) => out.slice(out.indexOf("By hand"));

test("a repository with no floor is asked to record one, and one with a floor is not", () => {
  const fresh = tempRepo("steps-floor", { "package.json": NEXT_PKG });
  assert.match(
    steps(cli(["init", fresh, "--stack", "next"], fresh).out),
    /\d+\. npm run -s standards:baseline/,
  );
  const held = tempRepo("steps-held", { "package.json": NEXT_PKG });
  mkdirSync(join(held, "scripts/ci"), { recursive: true });
  writeFileSync(join(held, "scripts/ci/standards-baseline.json"), '{ "metrics": {} }\n');
  assert.doesNotMatch(
    steps(cli(["init", held, "--stack", "next"], held).out),
    /standards:baseline/,
  );
});

test("a gate step whose script only the repository can write is named until it exists", () => {
  const none = tempRepo("steps-cov", { "package.json": NEXT_PKG });
  assert.match(
    steps(cli(["init", none, "--stack", "next"], none).out),
    /"coverage:changed" script/,
  );
  const pkg = { ...JSON.parse(NEXT_PKG), scripts: { test: "vitest run", "coverage:changed": "x" } };
  const has = tempRepo("steps-has-cov", { "package.json": JSON.stringify(pkg) });
  assert.doesNotMatch(
    steps(cli(["init", has, "--stack", "next"], has).out),
    /"coverage:changed" script/,
  );
});

test("the graph step is its own, and never points at a section a repository's own file lacks", () => {
  const dir = tempRepo("steps-own", { "package.json": NEXT_PKG, "CLAUDE.md": "# Mine\n" });
  const out = steps(cli(["init", dir, "--stack", "next"], dir).out);
  assert.match(
    out,
    /\d+\. Edit \.dependency-cruiser\.cjs: one rule per boundary this repository forbids/,
  );
  assert.doesNotMatch(out, /§3/);
  assert.doesNotMatch(out, /was kept[^\n]*then/);
});
