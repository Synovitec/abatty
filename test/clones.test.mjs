import { test } from "node:test";
import assert from "node:assert/strict";
import { rmSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { git, tempRepo } from "./helpers.mjs";
import { buildContext } from "../src/rules/context.mjs";
import { probes } from "../src/ratchet/probes/clones.mjs";
import { resolveConfig } from "../src/ratchet/config.mjs";

// A monorepo split a file by responsibility and the clone total fell, while six files nobody
// had touched read as rises: each clone was charged to the copy whose path sorted first, so a
// block moved out of one file put its charge on an untouched copy elsewhere.

const BLOCK = Array.from(
  { length: 8 },
  (_, i) => `  if (input.f${i} === undefined) throw new Error("f${i} is required");`,
).join("\n");
const fn = (/** @type {string} */ name) =>
  `export function ${name}(input) {\n${BLOCK}\n  return input;\n}\n`;

/** Each file's clone count in the tree as it is now. @param {string} dir */
const perFile = (dir) => {
  const r = probes[0]?.scan(buildContext(dir), { config: resolveConfig({}), range: "" });
  /** @type {Record<string, number>} */
  const out = {};
  for (const f of r?.findings || []) out[f.path] = (out[f.path] || 0) + 1;
  return out;
};

test("a block moved between files changes the files the move touched and no other", () => {
  const dir = tempRepo("clones-move", {
    "src/z-untouched.js": fn("checkZ"),
    "src/m-before.js": fn("checkM"),
  });
  const before = perFile(dir);
  assert.equal(before["src/z-untouched.js"], 1, JSON.stringify(before));
  // The copy moves to a file whose path sorts first: the charge used to land on the untouched one.
  rmSync(join(dir, "src/m-before.js"));
  mkdirSync(dirname(join(dir, "src/a-after.js")), { recursive: true });
  writeFileSync(join(dir, "src/a-after.js"), fn("checkM"));
  git(dir, "add", "-A");
  const after = perFile(dir);
  assert.equal(after["src/z-untouched.js"], 1, JSON.stringify(after));
  assert.equal(after["src/a-after.js"], 1);
  assert.equal(after["src/m-before.js"], undefined);
});
