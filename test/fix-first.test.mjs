import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NEXT_PKG, cli, tempRepo } from "./helpers.mjs";
import { fixFirst } from "../src/core/fix-first.mjs";
import { fixFirstBlock } from "../src/cli/status.mjs";

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

test("an audit that could not run is named, never read as nothing to fix", () => {
  const dir = tempRepo("ff-audit-errored", { "package.json": NEXT_PKG });
  mkdirSync(join(dir, ".abatty/steps"), { recursive: true });
  writeFileSync(
    join(dir, ".abatty/steps/audit_SEC.1_.log"),
    "▶ audit (SEC.1)\n\n✗ audit (SEC.1) could not run: no lockfile. The gate stops here.\nerrored: no lockfile\n",
  );
  assert.match(
    fixFirst(dir, []).join("\n"),
    /the audit could not run at the last gate .*: no lockfile/,
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

test("nothing to fix first is said in one line, never left as silence", () => {
  const dir = tempRepo("ff-said", {
    "package.json": NEXT_PKG,
    ".github/workflows/ci.yml": "on: push\njobs:\n  a:\n    steps:\n      - run: npx abatty gate\n",
  });
  const out = cli(["measure", dir], dir).out;
  // The Security musts this bare fixture misses keep the block; the line appears once they hold.
  assert.match(out, /Fix these first|Security: nothing to fix first/);
  assert.match(
    fixFirstBlock(dir, []),
    /Security: nothing to fix first/,
    "no finding passed: the line",
  );
});
