import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { NEXT_PKG, cli, git, tempRepo } from "./helpers.mjs";
import { ciGate, dayOneWorkflow } from "../src/ci/day-one.mjs";
import { renderGithubActions } from "../src/ci/github.mjs";
import { presetById } from "../src/presets/index.mjs";

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
  const r = cli(["init", "--profile", "synovitec", dir, "--stack", "next"], dir);
  const yml = readFileSync(join(dir, WORKFLOW), "utf8");
  assert.match(yml, /^on:\n {2}push:\n {2}pull_request:/m);
  assert.match(yml, /actions\/checkout@[0-9a-f]{40}/, "the actions are pinned");
  assert.match(yml, /- run: npm ci\n {6}- run: npm run -s gate:fast/);
  assert.match(r.out, /\d+\. Commit \.github\/workflows\/abatty-gate\.yml with the rest/);
  assert.equal(ciGate(dir).state, "fast", "what it wrote is read as the fast gate");
  const pnpm = onGithub("day-one-pnpm", { "pnpm-lock.yaml": "lockfileVersion: '9.0'\n" });
  cli(["init", "--profile", "synovitec", pnpm, "--stack", "next"], pnpm);
  assert.match(
    readFileSync(join(pnpm, WORKFLOW), "utf8"),
    /pnpm\/action-setup@[\s\S]*pnpm run -s gate:fast/,
  );
});

test("a pipeline that already runs the gate is left alone, and no second one is written", () => {
  const dir = onGithub("day-one-kept", {
    ".github/workflows/ci.yml": "on: push\njobs:\n  a:\n    steps:\n      - run: npx abatty gate\n",
  });
  cli(["init", "--profile", "synovitec", dir, "--stack", "next"], dir);
  assert.equal(existsSync(join(dir, WORKFLOW)), false);
  assert.equal(ciGate(dir).state, "gate");
});

test("off GitHub nothing is written, and init and doctor both name the gap", () => {
  const dir = tempRepo("day-one-elsewhere", { "package.json": NEXT_PKG });
  const r = cli(["init", "--profile", "synovitec", dir, "--stack", "next"], dir);
  assert.equal(existsSync(join(dir, WORKFLOW)), false);
  assert.match(r.out, /\d+\. no CI pipeline: the gate runs only when somebody runs it/);
  const doc = cli(["doctor", dir, "--skip-self-test"], dir);
  assert.match(doc.out, /no CI pipeline: the gate runs only when somebody runs it/);
});

test("a pipeline that runs the fast gate holds INST-CI-STEPS, and the fast gate says who runs the suites", async () => {
  const dir = onGithub("day-one-steps");
  cli(["init", "--profile", "synovitec", dir, "--stack", "next"], dir);
  const { runCatalog } = await import("../src/rules/index.mjs");
  const { buildContext } = await import("../src/rules/context.mjs");
  const ci = runCatalog(buildContext(dir)).find((f) => f.id === "INST-CI-STEPS");
  assert.equal(ci?.status, "present", ci?.evidence);
  assert.match(String(ci?.evidence), /six steps run inside the gate/);
  const { fastNote } = await import("../src/ci/day-one.mjs");
  assert.match(fastNote(dir), /no pipeline here runs them/);
  const full = onGithub("day-one-full", {
    ".github/workflows/ci.yml": "on: push\njobs:\n  a:\n    steps:\n      - run: npx abatty gate\n",
  });
  assert.match(fastNote(full), /CI runs them/);
});

test("a Python gate's pipelines set up Python and install the tools its steps run; a Node one does not", () => {
  // The runner had neither Python's tools nor a Python to install them into, so every command
  // step of a Python gate could not run in CI.
  const python = presetById("python");
  const node = presetById("node");
  assert.ok(python && node);
  const full = renderGithubActions(python);
  assert.match(full, /actions\/setup-python@[0-9a-f]{40} # v5\.6\.0/);
  assert.match(full, /pip install ruff mypy vulture pytest/);
  const dir = tempRepo("day-one-python", { "pyproject.toml": "[project]\nname = 'a'\n" });
  assert.match(dayOneWorkflow(dir, ["ruff", "pytest"]), /pip install ruff pytest/);
  assert.doesNotMatch(renderGithubActions(node), /setup-python|pip install/);
  assert.doesNotMatch(dayOneWorkflow(dir), /setup-python/);
});
