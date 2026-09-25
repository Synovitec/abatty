import { test } from "node:test";
import assert from "node:assert/strict";
import { tempRepo } from "./helpers.mjs";
import { testPlantPath } from "../src/core/test-plant-path.mjs";
import { plantedIn } from "../src/core/step-controls.mjs";

// A planted failing test has to sit where the repository's own script looks, or a working suite
// reads as absent. The script names its tests itself, through a runner config, through a
// wrapper that calls the runner with one, or through a task runner over the workspaces.

const M = "abatty-control.__";
const HOW = { extOf: () => ".ts", rootOf: () => "src", mark: M };
const at = (/** @type {string} */ dir, /** @type {string} */ script) =>
  testPlantPath(dir, script, HOW);

test("a glob in the script decides the folder and the name; a folder, the folder", () => {
  const dir = tempRepo("tpp-glob", {});
  assert.equal(at(dir, 'node --test "test/**/*.test.mjs"'), `test/${M}.test.mjs`);
  assert.equal(at(dir, "node --test test/"), `test/${M}.test.ts`);
  assert.equal(at(dir, "vitest run"), `src/${M}.test.ts`, "the runner's default finds it");
  assert.equal(at(dir, "npm run test"), `src/${M}.test.ts`, "a script's name is not a folder");
});

test("a runner's own `run` still hands over a folder; a subcommand or a flag's value does not", () => {
  const dir = tempRepo("tpp-folders", { "tests/unit/a.test.ts": "", "test/b.test.ts": "" });
  assert.equal(at(dir, "vitest run test/"), `test/${M}.test.ts`);
  assert.equal(at(dir, "vitest run tests/unit"), `tests/unit/${M}.test.ts`);
  assert.equal(at(dir, "node --test --test-reporter spec test/"), `test/${M}.test.ts`);
  assert.equal(at(dir, "playwright test"), `src/${M}.test.ts`);
  assert.equal(at(dir, "yarn workspace web test"), `src/${M}.test.ts`);
  assert.equal(
    at(dir, "vitest run ../outside"),
    `src/${M}.test.ts`,
    "never outside the repository",
  );
});

test("a config's excluded globs are not where tests run; its include is", () => {
  const dir = tempRepo("tpp-exclude", {
    "vitest.config.ts":
      "export default { test: { coverage: { exclude: ['**/*.test.ts'] }, include: ['tests/unit/**/*.test.ts'] } };\n",
    "climb.config.ts": "export default { test: { include: ['../elsewhere/**/*.test.ts'] } };\n",
    "jest.config.js": "module.exports = { testPathIgnorePatterns: ['e2e/**/*.test.ts'] };\n",
  });
  assert.equal(at(dir, "jest -c jest.config.js"), `src/${M}.test.ts`, "an ignored glob alone");
  assert.equal(at(dir, "vitest run -c vitest.config.ts"), `tests/unit/${M}.test.ts`);
  assert.equal(
    at(dir, "vitest run -c climb.config.ts"),
    `src/${M}.test.ts`,
    "a glob that climbs out",
  );
});

test("a runner config the script names is read, and a brace glob takes its first form", () => {
  const dir = tempRepo("tpp-config", {
    "vitest.int.config.ts": "export default { test: { include: ['it/**/*.spec.{ts,tsx}'] } };\n",
  });
  assert.equal(at(dir, "vitest run -c vitest.int.config.ts"), `it/${M}.spec.ts`);
});

test("a wrapper is followed to the config it hands the runner, and no further than two files", () => {
  const dir = tempRepo("tpp-wrapper", {
    "scripts/int.mjs": "run('vitest', ['run', '--config', 'vitest.int.config.ts']);\n",
    "vitest.int.config.ts": "export default { test: { include: ['tests/int/**/*.test.ts'] } };\n",
    "scripts/deep.mjs": "import './mid.mjs';\nrun('scripts/mid.mjs');\n",
    "scripts/mid.mjs": "run('vitest.int.config.ts');\n",
  });
  assert.equal(at(dir, "node scripts/int.mjs"), `tests/int/${M}.test.ts`);
  assert.equal(at(dir, "node scripts/deep.mjs"), `src/${M}.test.ts`, "three files away");
  assert.equal(at(dir, "node scripts/missing.mjs"), `src/${M}.test.ts`);
});

test("a wrapper's relative names are read from its own folder, and a config's glob from the config's", () => {
  const dir = tempRepo("tpp-relative", {
    "scripts/ci/int.mjs": "import { run } from './db.mjs';\nrun();\n",
    "scripts/ci/db.mjs":
      "export const run = () => spawn('vitest', ['-c', '../../web/vitest.it.config.ts']);\n",
    "web/vitest.it.config.ts": "export default { test: { include: ['it/**/*.test.ts'] } };\n",
  });
  assert.equal(at(dir, "node scripts/ci/int.mjs"), `src/${M}.test.ts`, "three files away");
  assert.equal(at(dir, "node scripts/ci/db.mjs"), `web/it/${M}.test.ts`);
});

test("`controls` moves a plant into the named folder, and never outside the repository", () => {
  const files = { [`src/${M}.test.ts`]: "x" };
  assert.deepEqual(Object.keys(plantedIn(files, "apps/web/tests/")), [
    `apps/web/tests/${M}.test.ts`,
  ]);
  assert.deepEqual(Object.keys(plantedIn(files, ".\\apps\\web")), [`apps/web/${M}.test.ts`]);
  for (const out of [
    "/etc",
    "C:/evil",
    "c:\\evil",
    "..\\..\\evil",
    "a/../../evil",
    "\\\\srv\\share",
    "",
    3,
  ])
    assert.deepEqual(plantedIn(files, out), files, String(out));
});

test("a task runner defers to the first workspace whose own script runs the task", () => {
  const pkg = (/** @type {Record<string, string>} */ scripts) => JSON.stringify({ scripts });
  const dir = tempRepo("tpp-turbo", {
    "package.json": JSON.stringify({ workspaces: ["apps/*", "packages/*"] }),
    "apps/api/package.json": JSON.stringify({
      name: "@acme/api",
      scripts: { test: "echo 'no tests yet' && exit 0" },
    }),
    "apps/web/package.json": pkg({ test: "bun test --isolate lib/ src/", lint: "x" }),
    "apps/web/lib/a.ts": "export const a = 1;\n",
    "packages/db/package.json": pkg({ test: "vitest run" }),
  });
  const web = `apps/web/lib/${M}.test.ts`;
  assert.equal(at(dir, "turbo run test"), web, "the task's name is not a root folder");
  assert.equal(at(dir, "turbo test --filter web"), web);
  assert.equal(at(dir, "pnpm -r test"), web);
  assert.equal(at(dir, "nx run-many -t test"), web);
  assert.equal(at(dir, "turbo run lint"), `apps/web/src/${M}.test.ts`, "`x` names no folder");
  assert.equal(at(dir, "bun test"), `src/${M}.test.ts`, "a subcommand is not a folder");
  assert.equal(at(dir, "turbo run e2e"), `src/${M}.test.ts`, "no workspace runs it");
  const db = `packages/db/src/${M}.test.ts`;
  assert.equal(at(dir, "turbo run test --filter=db"), db, "the filter names the workspace");
  assert.equal(at(dir, "pnpm --filter ./packages/db test"), db);
  assert.equal(at(dir, "nx run-many --targets=test --projects db"), db);
  assert.equal(at(dir, "lerna run test"), web);
  assert.equal(at(dir, "npm run test --workspaces"), web);
  assert.equal(at(dir, "turbo run test --filter=@acme/api"), web, "a no-op task is not a runner");
});
