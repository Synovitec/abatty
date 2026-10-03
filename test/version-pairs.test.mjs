import { test } from "node:test";
import assert from "node:assert/strict";
import { cli, tempRepo } from "./helpers.mjs";
import { splitPairs } from "../src/core/version-pairs.mjs";

// A lockfile refresh moved @playwright/test to 1.63 while an override held playwright-core at
// 1.60, and every browser worker died before a test ran. Nothing read version skew.

const pkg = (/** @type {string} */ v) => JSON.stringify({ version: v });

test("a family installed at two versions is named, with what is installed", () => {
  const dir = tempRepo("pairs-split", {
    "package.json": "{}",
    "node_modules/@playwright/test/package.json": pkg("1.63.0"),
    "node_modules/playwright-core/package.json": pkg("1.60.0"),
    "node_modules/react/package.json": pkg("19.0.0"),
    "node_modules/react-dom/package.json": pkg("19.0.0"),
  });
  assert.deepEqual(splitPairs(dir), [
    { family: "playwright", versions: "playwright-core 1.60.0, @playwright/test 1.63.0" },
  ]);
  const doc = cli(["doctor", dir, "--skip-self-test"], dir);
  assert.match(doc.out, /playwright's packages are installed at different versions/);
});

test("a family at one version, or a member alone, is not named", () => {
  const dir = tempRepo("pairs-ok", {
    "package.json": "{}",
    "node_modules/prisma/package.json": pkg("6.1.0"),
    "node_modules/@prisma/client/package.json": pkg("6.1.0"),
    "node_modules/vitest/package.json": pkg("3.0.0"),
  });
  assert.deepEqual(splitPairs(dir), []);
});
