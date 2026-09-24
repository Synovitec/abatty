import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { git, tempRepo } from "./helpers.mjs";
import { testRunEnv } from "../src/core/env.mjs";

// The changed-line check failed open twice: a runtime with no per-line coverage read as all
// covered, and a new untested module was set aside as "reached through a spawned process"
// because another file imported something with the same file name.

const SCRIPT = fileURLToPath(new URL("../scripts/coverage-changed.mjs", import.meta.url));

/** @param {Record<string, { covered: number[], uncovered: number[], noLines?: boolean }>} files */
function repo(files) {
  const dir = tempRepo("coverage-changed", {
    "src/y/index.mjs": "export const y = 1;\n",
    "src/main.mjs": 'import { y } from "./y/index.mjs";\nexport const m = y;\n',
  });
  mkdirSync(join(dir, "src/x"), { recursive: true });
  writeFileSync(join(dir, "src/x/index.mjs"), "export const x = 1;\nexport const z = 2;\n");
  git(dir, "add", "-A");
  mkdirSync(join(dir, ".abatty/coverage"), { recursive: true });
  writeFileSync(join(dir, ".abatty/coverage/lines.json"), JSON.stringify({ files }));
  return dir;
}

const run = (/** @type {string} */ dir) =>
  spawnSync(process.execPath, [SCRIPT, "HEAD"], { cwd: dir, encoding: "utf8", env: testRunEnv() });

test("a new module nothing imports is untested, whatever other file shares its name", () => {
  const r = run(repo({}));
  assert.equal(r.status, 3, r.stdout + r.stderr);
  assert.match(r.stdout, /not run: src\/x\/index\.mjs: every changed line/);
});

test("coverage with no per-line data judges nothing and fails, rather than reading as covered", () => {
  const r = run(repo({ "src/x/index.mjs": { covered: [], uncovered: [], noLines: true } }));
  assert.equal(r.status, 4, r.stdout + r.stderr);
  assert.match(r.stderr, /no per-line data/);
  const held = run(repo({ "src/x/index.mjs": { covered: [1, 2], uncovered: [] } }));
  assert.equal(held.status, 0, held.stdout + held.stderr);
});
