/**
 * The planted violation per gate step: what it means and the file it is, language-neutral in
 * meaning (a debugger statement, a type error, a failing test, an unused export, an unformatted
 * file, an oversized file, a secret, a failing browser or integration test) and placed where the
 * REPOSITORY'S OWN script will read it. `step-controls.mjs` plants, runs and judges; this
 * module only knows what to plant and where.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readJsonFile } from "./repo.mjs";

export const MARK = "abatty-control.__";

/**
 * @typedef {{ deps: Set<string>, pack: string, dir: string, scripts: Record<string, string> }} PlantContext
 * @typedef {{ files: (c: PlantContext) => Record<string, string>, means: string }} StepControl
 */

/** One planted file, typed as the record a control returns. @param {string} path @param {string} text @returns {Record<string, string>} */
const file = (path, text) => ({ [path]: text });

/** @param {number} n */
const longFile = (n) =>
  Array.from({ length: n }, (_, i) => `export const line${i} = ${i};`).join("\n") + "\n";

/**
 * Where a planted file has to sit for the REPOSITORY'S OWN script to read it, and in what
 * language.
 *
 * WHY this is derived rather than assumed. A control planted where the step does not look stays
 * green, and the runner then reports the step as absent - which is the finding, not the fix. It
 * was wrong here, in the package that sells the idea: abatty's typecheck reads `src/**\/*.mjs`
 * and its test script reads `test/*.test.mjs`, so a `.ts` file under `src/` was invisible to
 * both, and two of its own gate steps had never once been watched going red. `doctor --controls`
 * said so on every run; nothing downstream acted on it, because CI runs the self-test skipped.
 */

/**
 * The extension a repository's typecheck actually covers, from its tsconfig include patterns.
 * `.ts` when there is no tsconfig to read, which is the shape a repository adopting one gets.
 * @param {string} dir
 */
function checkedExt(dir) {
  /** @type {string[]} */
  let include = [];
  try {
    const cfg = readJsonFile(dir, "tsconfig.json");
    include = Array.isArray(cfg?.include) ? cfg.include.map(String) : [];
  } catch {
    /* a tsconfig with comments in it is not a reason to plant nothing */
  }
  for (const ext of [".ts", ".mts", ".mjs", ".js"])
    if (include.some((pattern) => pattern.endsWith(ext))) return ext;
  return ".ts";
}

/**
 * The path a failing test has to take for the repository's own test script to run it: the first
 * globbed argument of that script decides both the folder and the name. A script with no glob
 * (`vitest run`) keeps the convention-based path, because the runner's own default finds it.
 * @param {string} script @param {string} fallbackExt
 */
function testPlantPath(script, fallbackExt) {
  const tokens = String(script || "")
    .split(/\s+/)
    .map((token) => token.replace(/^['"]|['"]$/g, ""));
  const glob = tokens.find((token) => token.includes("*") && /\.[cm]?[jt]sx?$/.test(token));
  if (glob) {
    const parts = glob.split("/");
    const name = String(parts.pop() || "").replace(/\*+/g, MARK);
    const dir = parts.filter((part) => !part.includes("*")).join("/");
    return dir ? `${dir}/${name}` : name;
  }
  // A folder handed to the runner (`node --test test/`, the form every Node accepts, where the
  // glob form needs 21) is searched by the runner's own patterns, which a `.test` name meets.
  const folder = tokens.find((token) => /^\.?\/?(tests?|__tests__|spec)\/?$/.test(token));
  if (folder)
    return `${folder.replace(/^\.?\//, "").replace(/\/$/, "")}/${MARK}.test${fallbackExt}`;
  return `src/${MARK}.test${fallbackExt}`;
}

/** The planted violation per step, by the script it runs or the built-in it is. @type {Record<string, StepControl>} */
export const STEP_CONTROLS = {
  format: {
    means: "an unformatted file",
    files: ({ pack }) =>
      pack === "python"
        ? file(`src/${MARK}.py`, "x    =   {  'a':1 }\n")
        : file(`src/${MARK}.ts`, "const   x={a:1,b:2}\nexport   const y=x\n"),
  },
  lint: {
    means: "a debugger statement (an unused import for Python)",
    files: ({ pack }) =>
      pack === "python"
        ? file(`src/${MARK}.py`, "import os\n")
        : file(`src/${MARK}.ts`, "debugger;\nexport const abattyControl = 1;\n"),
  },
  typecheck: {
    means: "a type error",
    files: ({ pack, dir }) => {
      if (pack === "python")
        return file(`src/${MARK}.py`, 'abatty_control: int = "not a number"\n');
      const ext = checkedExt(dir);
      // A tsconfig that only includes JavaScript is checking JavaScript (`checkJs`), where the
      // annotation is a JSDoc type rather than a colon. Planting the colon form there is a
      // SYNTAX error the compiler never reaches, or a file it never reads: either way the step
      // stays green and the control lies about the step rather than about the file.
      const annotated = /[jm]js?$/.test(ext)
        ? '/** @type {number} */\nexport const abattyControl = "not a number";\n'
        : 'export const abattyControl: number = "not a number";\n';
      return file(`src/${MARK}${ext}`, annotated);
    },
  },
  test: {
    means: "a test that throws",
    files: ({ deps, pack, dir, scripts }) =>
      pack === "python"
        ? {
            [`tests/test_abatty_control__.py`]:
              'def test_abatty_control():\n    raise Exception("planted")\n',
          }
        : file(
            testPlantPath(scripts.test || "", checkedExt(dir)),
            (deps.has("vitest") ? 'import { test } from "vitest";\n' : "") +
              (deps.has("vitest") ? "" : 'import { test } from "node:test";\n') +
              'test("abatty control: planted to fail", () => {\n  throw new Error("planted");\n});\n',
          ),
  },
  dead: {
    means: "an unused export in an unreferenced file",
    files: ({ pack }) =>
      pack === "python"
        ? file(`src/${MARK}.py`, "def abatty_unused():\n    return 1\n")
        : file(`src/${MARK}.ts`, "export const abattyUnused = 1;\n"),
  },
  standards: {
    means: "a file over the 800-line cap",
    files: ({ pack }) => file(`src/${MARK}.${pack === "python" ? "py" : "ts"}`, longFile(801)),
  },
  secrets: {
    means: "a planted cloud access key",
    files: () => ({ [`${MARK}.txt`]: "aws_access_key_id = AKIAQWERTYUIOPASDFGH\n" }), // abatty:allow-secret - a planted control, the shape of a key with nothing behind it
  },
  // The suites. These are the steps that vanished from the trial's empty-range run, and the
  // controls pass could not see them because it read the always-on steps alone.
  "test:integration": {
    means: "an integration test that throws",
    files: ({ deps, dir, scripts }) =>
      file(
        testPlantPath(scripts["test:integration"] || "", checkedExt(dir)),
        (deps.has("vitest")
          ? 'import { test } from "vitest";\n'
          : 'import { test } from "node:test";\n') +
          'test("abatty control: planted to fail", () => {\n  throw new Error("planted");\n});\n',
      ),
  },
  e2e: {
    means: "a browser test that throws",
    files: ({ deps, dir }) =>
      file(
        `${e2eDir(dir)}/${MARK}.spec.ts`,
        (deps.has("@playwright/test")
          ? 'import { test } from "@playwright/test";\n'
          : 'import { test } from "vitest";\n') +
          'test("abatty control: planted to fail", () => {\n  throw new Error("planted");\n});\n',
      ),
  },
};

/** What no planted file proves, said rather than left out: a step in this list is reported as `none` with the reason. @type {Record<string, string>} */
export const NO_CONTROL = {
  audit: "no control: an audit is the registry's verdict",
  build:
    "no control: a build is proven by its output; a broken route is the repository's control to write",
  coverage:
    "no control: a coverage floor is proven by a drop that no single planted file causes deterministically",
};

/**
 * Where the browser tests live: the Playwright config's `testDir` when it says, else `e2e`,
 * the folder every preset's browser suite names. Read as text, because the config is code.
 * @param {string} dir
 */
function e2eDir(dir) {
  for (const name of [
    "playwright.config.ts",
    "playwright.config.js",
    "playwright.config.mjs",
    "playwright.config.cjs",
  ]) {
    if (!existsSync(join(dir, name))) continue;
    const m = readFileSync(join(dir, name), "utf8").match(
      /testDir:\s*["'`]\.?\/?([^"'`]+?)\/?["'`]/,
    );
    if (m && m[1]) return m[1];
  }
  return "e2e";
}
