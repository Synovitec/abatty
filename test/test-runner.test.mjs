import { test } from "node:test";
import assert from "node:assert/strict";
import { tempRepo } from "./helpers.mjs";
import { testFilesCommand } from "../src/core/test-runner.mjs";

// `abatty mutate` ran `node --test` on every stack, so a vitest product read every mutant as
// `tests red`. Each case below is a stack it missed.

const pkg = (/** @type {object} */ o) => JSON.stringify({ name: "p", ...o });

test("the runner a test script names is the one the files run on, through the package manager", () => {
  const vitest = tempRepo("runner-vitest", {
    "package.json": pkg({ scripts: { test: "vitest run" } }),
    "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
  });
  assert.equal(testFilesCommand(vitest), "pnpm exec vitest run {files}");
  const jest = tempRepo("runner-jest", { "package.json": pkg({ scripts: { test: "jest --ci" } }) });
  assert.equal(testFilesCommand(jest), "npx jest {files}");
  const bun = tempRepo("runner-bun", { "package.json": pkg({ scripts: { test: "bun test" } }) });
  assert.equal(testFilesCommand(bun), "bun test {files}");
});

test("a wrapper script defers to a workspace's runner, then an installed one, then node:test", () => {
  const ws = tempRepo("runner-ws", {
    "package.json": pkg({ scripts: { test: "turbo run test" } }),
    "apps/web/package.json": pkg({ scripts: { test: "vitest" } }),
  });
  assert.equal(testFilesCommand(ws), "npx vitest run {files}");
  const installed = tempRepo("runner-dep", {
    "package.json": pkg({
      scripts: { test: "node scripts/ci.mjs" },
      devDependencies: { jest: "1" },
    }),
  });
  assert.equal(testFilesCommand(installed), "npx jest {files}");
  const platform = tempRepo("runner-node", {
    "package.json": pkg({ scripts: { test: "node scripts/test.mjs" } }),
    "test/a.test.mjs": 'import { test } from "node:test";\n',
  });
  assert.equal(testFilesCommand(platform), "node --test {files}");
  const none = tempRepo("runner-none", { "package.json": pkg({}) });
  assert.equal(testFilesCommand(none), "", "nothing names one: reported, never guessed");
});
