import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cli, git, tempRepo } from "./helpers.mjs";
import { mutantOf, runMutants } from "../src/core/mutate.mjs";

// A green suite says the tests passed, not that they would notice the lines this change wrote.
// One mutant per changed line, the tests that name the module run against it, the file restored.

const ADULT = "export const adult = (age) => age >= 18;\n";
const BIG = "export const big = (n) => n > 100;\n";
const LONELY = "export const one = (a) => a === 1;\n";

/** A repository whose last commit wrote three modules: one tested at its edge, one not, one untested. */
function changed() {
  const dir = tempRepo("mutate", {
    "package.json": JSON.stringify({ name: "m", type: "module" }),
    "src/adult.mjs": "export const adult = () => true;\n",
    "src/big.mjs": "export const big = () => true;\n",
    "src/lonely.mjs": "export const one = () => true;\n",
  });
  const base = git(dir, "rev-parse", "HEAD");
  mkdirSync(join(dir, "test"));
  writeFileSync(join(dir, "src/adult.mjs"), ADULT);
  writeFileSync(join(dir, "src/big.mjs"), BIG);
  writeFileSync(join(dir, "src/lonely.mjs"), LONELY);
  const t = (/** @type {string} */ m, /** @type {string} */ body) =>
    `import { test } from "node:test";\nimport assert from "node:assert/strict";\nimport { ${m} } from "../src/${m === "big" ? "big" : "adult"}.mjs";\ntest("${m}", () => { ${body} });\n`;
  writeFileSync(
    join(dir, "test/adult.test.mjs"),
    t("adult", "assert.equal(adult(18), true); assert.equal(adult(17), false);"),
  );
  writeFileSync(join(dir, "test/big.test.mjs"), t("big", "assert.equal(big(500), true);"));
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "feat: three rules");
  return { dir, base };
}

test("a mutant the tests notice is killed, one they miss survives, and a module no test names says so", () => {
  const { dir, base } = changed();
  const { mutants } = runMutants({
    repoDir: dir,
    base,
    command: "node --test {files}",
    max: 10,
    timeoutMs: 60000,
  });
  const by = Object.fromEntries(mutants.map((m) => [m.file, m.outcome]));
  assert.deepEqual(by, {
    "src/adult.mjs": "killed",
    "src/big.mjs": "survived",
    "src/lonely.mjs": "no test",
  });
  assert.equal(readFileSync(join(dir, "src/adult.mjs"), "utf8"), ADULT, "every file put back");
  assert.equal(readFileSync(join(dir, "src/big.mjs"), "utf8"), BIG);
});

test("the mutant is taken from code, never from a string or a comment", () => {
  assert.equal(mutantOf('const s = "a === b";', 'const s = "       ";'), null);
  assert.deepEqual(mutantOf("if (a === b) go();", "if (a === b) go();"), {
    text: "if (a !== b) go();",
    operator: "equality inverted",
  });
});

test("the command reports survivors, and --strict makes one fail the run", () => {
  const { dir, base } = changed();
  const report = cli(["mutate", dir, "--range", `${base}..HEAD`], dir);
  assert.equal(report.code, 0, report.out);
  assert.match(report.out, /src\/big\.mjs:1 boundary moved/);
  assert.match(report.out, /1 killed, 1 survived, 1 with no test/);
  assert.equal(cli(["mutate", dir, "--range", `${base}..HEAD`, "--strict"], dir).code, 3);
});

test("a module reached only through a registry is tested by the tests that import the registry", () => {
  const dir = tempRepo("mutate-registry", {
    "package.json": JSON.stringify({ name: "m", type: "module" }),
    "src/probes/refs.mjs": "export const refs = () => true;\n",
    "src/index.mjs": 'import { refs } from "./probes/refs.mjs";\nexport const all = [refs];\n',
    "test/all.test.mjs": `import { test } from "node:test";\nimport assert from "node:assert/strict";\nimport { all } from "../src/index.mjs";\ntest("all", () => { assert.equal(all[0](5), false); assert.equal(all[0](9), true); });\n`,
    "test/push-refs.test.mjs": `import { test } from "node:test";\ntest("refs", () => {});\n`,
  });
  const base = git(dir, "rev-parse", "HEAD");
  writeFileSync(join(dir, "src/probes/refs.mjs"), "export const refs = (n) => n > 5;\n");
  git(dir, "commit", "-qam", "feat: a bound");
  const [m] = runMutants({
    repoDir: dir,
    base,
    command: "node --test {files}",
    max: 5,
    timeoutMs: 60000,
  }).mutants;
  assert.equal(m?.outcome, "killed", "the registry's test ran, not the one that only says refs");
});

test("a file whose tests are red with no mutant in it is reported, never read as killed", () => {
  const { dir, base } = changed();
  writeFileSync(
    join(dir, "test/adult.test.mjs"),
    'import { test } from "node:test";\nimport { adult } from "../src/adult.mjs";\ntest("red", () => { throw new Error(String(adult)); });\n',
  );
  git(dir, "commit", "-qam", "test: a red suite");
  const { mutants } = runMutants({
    repoDir: dir,
    base,
    command: "node --test {files}",
    max: 10,
    timeoutMs: 60000,
  });
  assert.equal(mutants.find((m) => m.file === "src/adult.mjs")?.outcome, "tests red");
  assert.equal(mutants.filter((m) => m.outcome === "killed").length, 0);
});

test("a file a killed run left mutated is put back by the next run", () => {
  const { dir } = changed();
  writeFileSync(join(dir, "src/adult.mjs"), "export const adult = (age) => age > 18;\n");
  mkdirSync(join(dir, ".abatty"), { recursive: true });
  writeFileSync(
    join(dir, ".abatty/mutate-restore.json"),
    JSON.stringify({ file: "src/adult.mjs", original: ADULT }),
  );
  const run = runMutants({
    repoDir: dir,
    base: "HEAD",
    command: "node --test {files}",
    max: 0,
    timeoutMs: 60000,
  });
  assert.equal(run.restored, "src/adult.mjs");
  assert.equal(readFileSync(join(dir, "src/adult.mjs"), "utf8"), ADULT);
});
