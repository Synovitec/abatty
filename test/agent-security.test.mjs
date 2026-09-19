/**
 * The family that asks what holds when the person is asleep. Both directions for each rule: a
 * harnessed repository that has the control, one that does not, and a repository nobody points a
 * model at overnight, which is not failing these rules but not running them.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { tempRepo } from "./helpers.mjs";
import { buildContext } from "../src/rules/context.mjs";
import { RULES, runCatalog } from "../src/rules/index.mjs";

const IDS = [
  "SEC-AGENT-SANDBOX",
  "SEC-AGENT-PERMISSIONS",
  "SEC-AGENT-TRUST",
  "SEC-AGENT-MCP",
  "SEC-AGENT-BYPASS",
];

/** @param {import("../src/rules/index.mjs").Finding[]} f @param {string} id */
const of = (f, id) => f.find((x) => x.id === id) || assert.fail(`${id} in the findings`);
/** @param {string} name @param {Record<string,string>} files */
const read = (name, files) => runCatalog(buildContext(tempRepo(name, files)), RULES);

test("a repository nobody runs unattended is n/a, with the reason", () => {
  const f = read("sec-agent-none", {
    "package.json": JSON.stringify({ name: "app", private: true }),
    "src/a.mjs": "export const a = 1;\n",
  });
  for (const id of IDS) {
    assert.equal(of(f, id).status, "n/a", id);
    assert.match(of(f, id).evidence, /no agent harness/, id);
  }
});

test("a harnessed repository with none of it: each rule says what it looked for", () => {
  const f = read("sec-agent-bare", {
    "package.json": JSON.stringify({ name: "app", private: true }),
    ".claude/settings.json": JSON.stringify({ permissions: { allow: [] } }),
    "abatty.config.json": JSON.stringify({ stack: "node" }),
  });
  assert.equal(of(f, "SEC-AGENT-SANDBOX").status, "missing");
  assert.match(of(f, "SEC-AGENT-SANDBOX").evidence, /does not name a sandbox/);
  assert.equal(of(f, "SEC-AGENT-PERMISSIONS").status, "missing");
  assert.match(of(f, "SEC-AGENT-PERMISSIONS").evidence, /nothing dangerous is denied/);
  assert.equal(of(f, "SEC-AGENT-BYPASS").status, "missing");
});

test("a harnessed repository with all of it: each rule holds", () => {
  const f = read("sec-agent-full", {
    "package.json": JSON.stringify({ name: "app", private: true }),
    ".claude/settings.json": JSON.stringify({
      permissions: {
        deny: [
          "Bash(git commit --no-verify *)",
          "Bash(git push --force *)",
          "Bash(git reset --hard *)",
          "Bash(git filter-branch *)",
        ],
      },
    }),
    ".claude/hooks/guard.mjs": "// the guard\n",
    "abatty.config.json": JSON.stringify({
      stack: "node",
      phases: [0],
      sandbox: { mode: "auto" },
      mcp: { servers: ["abatty"] },
    }),
    ".github/workflows/checks.yml":
      "name: checks\njobs:\n  a:\n    steps:\n      - run: git log --format=%H | xargs -I{} echo bypass check {}\n",
  });
  for (const id of IDS) assert.equal(of(f, id).status, "present", `${id}: ${of(f, id).evidence}`);
});

test("the partial cases: the control is named and switched off, which is not the same as absent", () => {
  const f = read("sec-agent-partial", {
    "package.json": JSON.stringify({ name: "app", private: true }),
    ".claude/settings.json": JSON.stringify({
      permissions: { deny: ["Bash(git push --force *)"] },
    }),
    "abatty.config.json": JSON.stringify({
      stack: "node",
      phases: [0],
      sandbox: { mode: "off" },
      preflight: { trust: false },
    }),
  });
  // Stated rather than assumed: a repository that turned the sandbox off said so, and the finding
  // reads differently from one that never considered it.
  assert.equal(of(f, "SEC-AGENT-SANDBOX").status, "partial");
  assert.match(of(f, "SEC-AGENT-SANDBOX").evidence, /stated rather than assumed/);
  assert.equal(of(f, "SEC-AGENT-TRUST").status, "partial");
  assert.equal(of(f, "SEC-AGENT-PERMISSIONS").status, "partial");
  assert.match(of(f, "SEC-AGENT-PERMISSIONS").evidence, /denied: push --force/);
  assert.equal(of(f, "SEC-AGENT-MCP").status, "partial");
});
