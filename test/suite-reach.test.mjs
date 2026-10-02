import { test } from "node:test";
import assert from "node:assert/strict";
import { NEXT_PKG, cli, tempRepo } from "./helpers.mjs";
import { unreachableSuites } from "../src/core/suite-reach.mjs";
import { presetById } from "../src/presets/index.mjs";

// A monorepo whose Next app lives in a workspace with no preset of its own: the browser suite's
// paths (app/, e2e/) are read from the root, matched nothing, and the suite never ran while the
// rule it backs read present. The first full run found 25 real page errors.

const next = presetById("next");
const scripts = { build: "turbo run build", "test:e2e": "turbo run e2e" };
const mono = (/** @type {Record<string, string>} */ files) =>
  tempRepo("reach", {
    "package.json": JSON.stringify({ ...JSON.parse(NEXT_PKG), scripts }),
    ...files,
  });

test("a suite whose scripts exist and whose paths match nothing here is named, doctor says so", () => {
  const dir = mono({
    "apps/web/app/page.tsx": "export default function P() { return null; }\n",
    "apps/web/tests/e2e/home.spec.ts": "test('x', () => {});\n",
  });
  const names = unreachableSuites(dir, next).map((u) => u.name);
  assert.ok(
    names.some((n) => /browser/i.test(n)),
    names.join(", "),
  );
  const doc = cli(["doctor", dir, "--skip-self-test", "--stack", "next"], dir);
  assert.match(doc.out, /the gate can never select [^\n]*browser[^\n]*"test:e2e" script/i);
});

test("an app at the root, or a repository without the suite's scripts, is not named", () => {
  const root = mono({ "app/page.tsx": "export default function P() { return null; }\n" });
  assert.deepEqual(unreachableSuites(root, next), []);
  const none = tempRepo("reach-none", { "package.json": NEXT_PKG });
  assert.deepEqual(unreachableSuites(none, next), [], "no e2e script: no suite to reach");
});
