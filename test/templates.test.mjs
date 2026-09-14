import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { TEMPLATES } from "../src/core/init.mjs";

/** @param {string} dir @param {string} [base] @param {string[]} [acc] */
function listFiles(dir, base = dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) listFiles(p, base, acc);
    else acc.push(relative(base, p).split("\\").join("/"));
  }
  return acc.sort();
}

test("the package ships the harness and tooling templates", () => {
  assert.ok(existsSync(TEMPLATES));
  const files = listFiles(TEMPLATES);
  for (const f of [
    "harness/hooks/self-test.mjs",
    "harness/hooks/protect.mjs",
    "harness/hooks/guard.mjs",
    "harness/hooks/vocabulary.mjs",
    "harness/settings.project.json",
    "harness/adoption.json",
    "harness/mcp.night.json",
    "harness/agent-context.md.template",
    "harness/skills/adopt-standards/SKILL.md",
    "tooling/.dependency-cruiser.cjs",
    "tooling/knip.jsonc",
    "tooling/codemods/rename-import.cjs",
  ]) {
    assert.ok(files.includes(f), `template missing: ${f}`);
  }
});
