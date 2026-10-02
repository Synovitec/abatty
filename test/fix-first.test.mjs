import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NEXT_PKG, cli, tempRepo } from "./helpers.mjs";
import { fixFirst } from "../src/core/fix-first.mjs";

// An adopter's first report led with documents and decision records while two critical
// advisories and an unvalidated server action waited. A reading now opens with what to fix first.

const KEY_ID = "AKIA" + "IOSFODNN7EXAMPLE".replace("EXAMPLE", "QWERTYU");

test("measure opens with a secret in the tree, before the families", () => {
  const dir = tempRepo("ff-secret", {
    "package.json": NEXT_PKG,
    "src/leak.ts": `export const k = "${KEY_ID}";\n`,
  });
  const out = cli(["measure", dir], dir).out;
  const block = out.indexOf("Fix these first");
  assert.ok(block >= 0 && block < out.indexOf("family"), out);
  assert.match(out, /1 secret\(s\) in the tree, now: src\/leak\.ts:1 \(cloud access key id\)/);
  assert.match(cli(["status", dir, "--fresh"], dir).out, /Fix these first/);
});

test("the last gate's failed audit is named with its day and its advisories", () => {
  const dir = tempRepo("ff-audit", { "package.json": NEXT_PKG });
  mkdirSync(join(dir, ".abatty/steps"), { recursive: true });
  writeFileSync(
    join(dir, ".abatty/steps/audit_SEC.1_.log"),
    "▶ audit (SEC.1)\nnext (critical) Remote code execution\n    affected: <15.5.20\nfailed\n",
  );
  const lines = fixFirst(dir, []);
  assert.match(
    lines.join("\n"),
    /the audit failed at the last gate \(\d{4}-\d{2}-\d{2}\): next \(critical\) Remote code execution/,
  );
});

test("a passed audit, or one CI runs, adds nothing", () => {
  const dir = tempRepo("ff-clean", {
    "package.json": NEXT_PKG,
    ".github/workflows/ci.yml": "on: push\njobs:\n  a:\n    steps:\n      - run: npx abatty gate\n",
  });
  assert.deepEqual(fixFirst(dir, []), [], "CI runs the gate, so no local log is no gap");
  mkdirSync(join(dir, ".abatty/steps"), { recursive: true });
  writeFileSync(join(dir, ".abatty/steps/audit_SEC.1_.log"), "▶ audit (SEC.1)\nok\n");
  assert.deepEqual(fixFirst(dir, []), []);
});
