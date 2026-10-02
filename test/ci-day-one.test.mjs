import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { NEXT_PKG, cli, git, tempRepo } from "./helpers.mjs";
import { ciGate } from "../src/ci/day-one.mjs";

// An adopter's two critical advisories surfaced only because somebody ran the gate by hand, and
// nothing in init or doctor said that no pipeline ran it.

const WORKFLOW = ".github/workflows/abatty-gate.yml";

/** A repository whose origin is on GitHub. @param {string} name @param {Record<string, string>} [files] */
function onGithub(name, files = {}) {
  const dir = tempRepo(name, { "package.json": NEXT_PKG, ...files });
  git(dir, "remote", "add", "origin", "https://github.com/acme/shop.git");
  return dir;
}

test("on GitHub with no pipeline, init writes the fast gate on every push, in the repo's manager", () => {
  const dir = onGithub("day-one-npm");
  const r = cli(["init", dir, "--stack", "next"], dir);
  const yml = readFileSync(join(dir, WORKFLOW), "utf8");
  assert.match(yml, /^on:\n {2}push:\n {2}pull_request:/m);
  assert.match(yml, /actions\/checkout@[0-9a-f]{40}/, "the actions are pinned");
  assert.match(yml, /- run: npm ci\n {6}- run: npm run -s gate:fast/);
  assert.match(r.out, /\d+\. Commit \.github\/workflows\/abatty-gate\.yml with the rest/);
  assert.equal(ciGate(dir).state, "fast", "what it wrote is read as the fast gate");
  const pnpm = onGithub("day-one-pnpm", { "pnpm-lock.yaml": "lockfileVersion: '9.0'\n" });
  cli(["init", pnpm, "--stack", "next"], pnpm);
  assert.match(
    readFileSync(join(pnpm, WORKFLOW), "utf8"),
    /pnpm\/action-setup@[\s\S]*pnpm run -s gate:fast/,
  );
});

test("a pipeline that already runs the gate is left alone, and no second one is written", () => {
  const dir = onGithub("day-one-kept", {
    ".github/workflows/ci.yml": "on: push\njobs:\n  a:\n    steps:\n      - run: npx abatty gate\n",
  });
  cli(["init", dir, "--stack", "next"], dir);
  assert.equal(existsSync(join(dir, WORKFLOW)), false);
  assert.equal(ciGate(dir).state, "gate");
});

test("off GitHub nothing is written, and init and doctor both name the gap", () => {
  const dir = tempRepo("day-one-elsewhere", { "package.json": NEXT_PKG });
  const r = cli(["init", dir, "--stack", "next"], dir);
  assert.equal(existsSync(join(dir, WORKFLOW)), false);
  assert.match(r.out, /\d+\. no CI pipeline: the gate runs only when somebody runs it/);
  const doc = cli(["doctor", dir, "--skip-self-test"], dir);
  assert.match(doc.out, /no CI pipeline: the gate runs only when somebody runs it/);
});
