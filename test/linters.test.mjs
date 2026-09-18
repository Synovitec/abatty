/**
 * The linter is the repository's choice, not the rule's. A check that reads one vendor's config
 * file fails a repository that holds the same practice with another linter, which is the
 * enforcement map lying in the direction that costs trust: the repository did the work and the
 * instrument says it did not.
 *
 * Every case here is the same repository three times over, once per linter, with the control in
 * the other direction beside it: a configuration that holds none of them is still missing.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { tempRepo } from "./helpers.mjs";
import { buildContext } from "../src/rules/context.mjs";
import { RULES, runCatalog } from "../src/rules/index.mjs";

/** @param {import("../src/rules/index.mjs").Finding[]} f @param {string} id */
const of = (f, id) => f.find((x) => x.id === id) || assert.fail(`${id} in the findings`);
/** @param {string} name @param {Record<string,string>} files */
const read = (name, files) => runCatalog(buildContext(tempRepo(name, files)), RULES);

const SERVICE = {
  "package.json": JSON.stringify({ name: "svc", private: true, dependencies: { express: "4" } }),
  "server/app.js": "const app = require('express')();\napp.get('/', (_q, r) => r.end());\n",
};

test("no bare console from the server: ESLint, oxlint and Biome all say so, under three names", () => {
  // ESLint and oxlint share the rule's name; Biome renamed it noConsole under its suspicious
  // group. All three forbid the same thing, so all three are the rule held.
  /** @type {[string, string, string][]} */
  const cases = [
    ["eslint", "eslint.config.mjs", 'export default [{ rules: { "no-console": "error" } }];\n'],
    ["oxlint", ".oxlintrc.json", JSON.stringify({ rules: { "no-console": "error" } })],
    [
      "biome",
      "biome.json",
      JSON.stringify({ linter: { rules: { suspicious: { noConsole: "error" } } } }),
    ],
  ];
  for (const [name, file, text] of cases) {
    const f = read(`lint-console-${name}`, { ...SERVICE, [file]: text });
    assert.equal(
      of(f, "OBS-CONSOLE").status,
      "present",
      `${name}: ${of(f, "OBS-CONSOLE").evidence}`,
    );
  }
  // The control: a linter configured and this rule not among its rules.
  const none = read("lint-console-none", {
    ...SERVICE,
    "biome.json": JSON.stringify({ linter: { rules: { suspicious: { noDebugger: "error" } } } }),
  });
  assert.equal(of(none, "OBS-CONSOLE").status, "missing");
});

test("the four shape limits are found under ESLint's names and under Biome's", () => {
  const src = {
    "package.json": JSON.stringify({ name: "app", private: true }),
    "src/a.js": "export const a = 1;\n",
  };
  const eslint = read("lint-shape-eslint", {
    ...src,
    "eslint.config.mjs":
      'export default [{ rules: { "max-lines": 1, "max-lines-per-function": 1, complexity: 1, "max-params": 1 } }];\n',
  });
  assert.equal(of(eslint, "CODE-SHAPE").status, "present", of(eslint, "CODE-SHAPE").evidence);
  const biome = read("lint-shape-biome", {
    ...src,
    "biome.json": JSON.stringify({
      linter: {
        rules: {
          complexity: {
            noExcessiveLinesPerFile: "error",
            noExcessiveLinesPerFunction: "error",
            noExcessiveCognitiveComplexity: "error",
            useMaxParams: "error",
          },
        },
      },
    }),
  });
  assert.equal(of(biome, "CODE-SHAPE").status, "present", of(biome, "CODE-SHAPE").evidence);
  // The control: two of the four, which is the partial the rule is there to report.
  const half = read("lint-shape-half", {
    ...src,
    "biome.json": JSON.stringify({
      linter: {
        rules: { complexity: { noExcessiveLinesPerFile: "error", useMaxParams: "error" } },
      },
    }),
  });
  assert.equal(of(half, "CODE-SHAPE").status, "partial", of(half, "CODE-SHAPE").evidence);
});

test("the import boundary is found under both names, and a legacy .eslintrc is a config too", () => {
  const src = {
    "package.json": JSON.stringify({ name: "app", private: true }),
    "src/a.js": "export const a = 1;\n",
  };
  const flat = read("lint-imports-flat", {
    ...src,
    "eslint.config.mjs": 'export default [{ rules: { "no-restricted-imports": "error" } }];\n',
  });
  assert.equal(of(flat, "CODE-ARCH-IMPORTS").status, "present");
  const biome = read("lint-imports-biome", {
    ...src,
    "biome.json": JSON.stringify({
      linter: { rules: { style: { noRestrictedImports: "error" } } },
    }),
  });
  assert.equal(of(biome, "CODE-ARCH-IMPORTS").status, "present");
  // The legacy ESLint config is a configuration the repository still lints with; reading only the
  // flat file called it absent.
  const legacy = read("lint-imports-legacy", {
    ...src,
    ".eslintrc.json": JSON.stringify({ rules: { "no-restricted-imports": "error" } }),
  });
  assert.equal(of(legacy, "CODE-ARCH-IMPORTS").status, "present");
  const none = read("lint-imports-none", { ...src, "biome.json": JSON.stringify({ linter: {} }) });
  assert.equal(of(none, "CODE-ARCH-IMPORTS").status, "missing");
});

test("a warning fails the lint script whichever flag the linter spells it with", () => {
  const withScript = (/** @type {string} */ name, /** @type {string} */ lint) =>
    read(`lint-maxwarn-${name}`, {
      "package.json": JSON.stringify({ name: "app", private: true, scripts: { lint } }),
      "src/a.js": "export const a = 1;\n",
      "eslint.config.mjs": "export default [];\n",
    });
  assert.equal(
    of(withScript("eslint", "eslint . --max-warnings=0"), "CODE-MAXWARN").status,
    "present",
  );
  assert.equal(
    of(withScript("oxlint", "oxlint --max-warnings 0"), "CODE-MAXWARN").status,
    "present",
  );
  assert.equal(
    of(withScript("biome", "biome lint --error-on-warnings ."), "CODE-MAXWARN").status,
    "present",
  );
  // The control: the linter runs and a warning costs nothing.
  assert.equal(of(withScript("loose", "biome lint ."), "CODE-MAXWARN").status, "partial");
});
