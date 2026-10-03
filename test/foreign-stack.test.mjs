import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cli, tempRepo } from "./helpers.mjs";
import { packageName } from "../src/core/init-merges.mjs";
import { STEP_CONTROLS } from "../src/core/step-plants.mjs";

// A Go service was taken for documents and handed the docs preset without a word, with a
// package.json named after its folder verbatim, which npm refused.

test("a language no preset covers is said and refused, unless the docs preset is asked for", () => {
  const dir = tempRepo("foreign-go", { "go.mod": "module x\n", "main.go": "package main\n" });
  const refused = cli(["init", dir, "--yes"], dir);
  assert.equal(refused.code, 2, refused.out);
  assert.match(refused.out, /no preset for Go/);
  const asked = cli(["init", dir, "--yes", "--stack", "docs"], dir);
  assert.equal(asked.code, 0, asked.out);
  assert.equal(asked.out.match(/ package\.json/g)?.length, 1, "one line for one file");
});

test("a repository of documents alone still gets the docs preset unasked", () => {
  const dir = tempRepo("foreign-docs", { "docs/a.md": "# a\n" });
  const r = cli(["init", dir, "--yes"], dir);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /init · Documents/);
  assert.equal(JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).name.length > 0, true);
});

test("a folder's name becomes a name npm takes", () => {
  assert.equal(packageName("My Go_Svc"), "my-go_svc");
  assert.equal(packageName("..Été 2026!"), "t-2026");
  assert.equal(packageName("***"), "repository");
});

test("a plain JavaScript package gets no typecheck it cannot run, and a lint plant eslint reads", () => {
  // An outside review's fresh Node package got `tsc --noEmit` with no tsconfig, and its lint
  // control planted a .ts file plain eslint never reads.
  const js = tempRepo("plain-js", {
    "package.json": JSON.stringify({ name: "fresh", scripts: { test: "node --test" } }),
    "index.js": "module.exports = 1;\n",
  });
  assert.equal(cli(["init", js, "--yes"], js).code, 0);
  const scripts = JSON.parse(readFileSync(join(js, "package.json"), "utf8")).scripts;
  assert.equal(scripts.typecheck, undefined);
  const plant = STEP_CONTROLS.lint?.files({ deps: new Set(), pack: "javascript", dir: js, scripts });
  assert.match(Object.keys(plant || {})[0] || "", /\.js$/);
  assert.doesNotMatch(Object.values(plant || {})[0] || "", /: (any|boolean)/);
  // the other direction: a TypeScript package keeps both
  const ts = tempRepo("plain-ts", {
    "package.json": JSON.stringify({ name: "fresh", devDependencies: { typescript: "6" } }),
    "tsconfig.json": "{}\n",
  });
  assert.equal(cli(["init", ts, "--yes"], ts).code, 0);
  assert.match(JSON.parse(readFileSync(join(ts, "package.json"), "utf8")).scripts.typecheck, /tsc/);
  const tsPlant = STEP_CONTROLS.lint?.files({
    deps: new Set(),
    pack: "javascript",
    dir: ts,
    scripts: {},
  });
  assert.match(Object.keys(tsPlant || {})[0] || "", /\.ts$/);
});
