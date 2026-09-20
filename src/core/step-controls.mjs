/**
 * Every gate step proves it can go red. The ratchet's probes carry their control cases; the
 * gate steps of a preset are scripts a repository owns (a linter, a typecheck, a test runner,
 * a dead-code tool, the formatter) and a step that is wired but never went red may be
 * checking nothing. So each step has a planted violation, language-neutral in what it means
 * (a debugger statement, a type error, a failing test, an unused export, an unformatted file,
 * an oversized file, a secret) and `abatty doctor --controls` plants it, runs the step, removes
 * it, and reports a step that stays green as ABSENT. The outcome is written to
 * `.abatty/controls.json`, which the INST-CONTROLS rule reads.
 *
 * The planted files sit beside the sources under a name no repository uses
 * (`abatty-control.__.*`); a tree that already carries one is refused, and every file is
 * removed again whatever the step did.
 */
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { bin } from "./spawn.mjs";
import { readJsonFile, readPackage, writeJsonFile } from "./repo.mjs";
import { scanSecrets } from "./secrets.mjs";

export const CONTROLS_FILE = ".abatty/controls.json";
const MARK = "abatty-control.__";

/**
 * @typedef {{ deps: Set<string>, pack: string, dir: string, scripts: Record<string, string> }} PlantContext
 * @typedef {{ files: (c: PlantContext) => Record<string, string>, means: string }} StepControl
 * @typedef {{ label: string, outcome: "red" | "green" | "skipped" | "none", detail: string, ms?: number }} StepOutcome
 */

/** One planted file, typed as the record a control returns. @param {string} path @param {string} text @returns {Record<string, string>} */
const file = (path, text) => ({ [path]: text });

/** @param {number} n */
const longFile = (n) =>
  Array.from({ length: n }, (_, i) => `export const line${i} = ${i};`).join("\n") + "\n";

/**
 * The environment a planted step runs in: this process's, minus the variables that tell a test
 * runner it is a CHILD of another one.
 *
 * WHY: `node --test` sets NODE_TEST_CONTEXT for the processes it spawns, and a `node --test` that
 * sees it reports its results upward and exits 0 even when a test threw. A control that inherits
 * it therefore watches a failing test and calls the step green, which is the one thing a control
 * must never do. It costs nothing when nobody is above us, and it is exactly the case a control
 * exists to survive.
 */
function childEnv() {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  delete env.NODE_V8_COVERAGE;
  return env;
}

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
  const glob = String(script || "")
    .split(/\s+/)
    .map((token) => token.replace(/^['"]|['"]$/g, ""))
    .find((token) => token.includes("*") && /\.[cm]?[jt]sx?$/.test(token));
  if (!glob) return `src/${MARK}.test${fallbackExt}`;
  const parts = glob.split("/");
  const name = String(parts.pop() || "").replace(/\*+/g, MARK);
  const dir = parts.filter((part) => !part.includes("*")).join("/");
  return dir ? `${dir}/${name}` : name;
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
};

/**
 * Run the controls of a preset's always-on steps in a repository: plant, run, remove, judge.
 * @param {{ repoDir: string, preset: import("../presets/index.mjs").Preset, log?: (line: string) => void, run?: (cwd: string, script: string) => number }} o
 * @returns {{ at: string, steps: StepOutcome[], absent: string[] }}
 */
export function runStepControls(o) {
  const { repoDir, preset } = o;
  const log = o.log || (() => {});
  const run =
    o.run ||
    ((cwd, script) => {
      const r = spawnSync(bin("npm"), ["run", "-s", script], {
        cwd,
        encoding: "utf8",
        env: childEnv(),
        maxBuffer: 16 * 1024 * 1024,
      });
      return r.status ?? 1;
    });
  const pkg = readPackage(repoDir);
  const scripts = pkg.scripts || {};
  const deps = new Set([
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ]);
  /** @type {StepOutcome[]} */
  const steps = [];
  for (const s of preset.gate.always) {
    // The control is keyed by the script the step runs, the built-in it is, or, for a step
    // that is a command, the first word of its label (the format step).
    const key = s.builtin || s.script || String(s.label.split(/\s/)[0] || "");
    const control = STEP_CONTROLS[key];
    if (s.requires && !s.requires.some((f) => existsSync(join(repoDir, f)))) {
      steps.push({ label: s.label, outcome: "skipped", detail: `no ${s.requires[0]}` });
      continue;
    }
    const script = s.builtin
      ? ""
      : [s.script, ...(s.alternatives || [])].find(
          (x) => typeof x === "string" && typeof scripts[x] === "string",
        );
    if (!s.builtin && !s.command && !script) {
      steps.push({ label: s.label, outcome: "skipped", detail: `no "${s.script}" script` });
      continue;
    }
    if (!control) {
      steps.push({
        label: s.label,
        outcome: "none",
        detail:
          s.builtin === "audit"
            ? "no control: an audit is the registry's verdict"
            : "no control declared for this step",
      });
      continue;
    }
    const files = control.files({
      deps,
      pack: preset.pack || "javascript",
      dir: repoDir,
      scripts,
    });
    const clash = Object.keys(files).find((f) => existsSync(join(repoDir, f)));
    if (clash) {
      steps.push({
        label: s.label,
        outcome: "skipped",
        detail: `${clash} exists already; remove it`,
      });
      continue;
    }
    log(`▶ ${s.label}: planting ${control.means}`);
    const t0 = Date.now();
    let code = 0;
    try {
      for (const [rel, text] of Object.entries(files)) {
        mkdirSync(dirname(join(repoDir, rel)), { recursive: true });
        writeFileSync(join(repoDir, rel), text);
      }
      if (s.builtin === "secrets")
        code = scanSecrets(repoDir, { mode: "tree" }).findings.length ? 1 : 0;
      else if (s.command) {
        const [cmd, ...args] = s.command;
        const r = spawnSync(bin(String(cmd)), args, {
          cwd: repoDir,
          encoding: "utf8",
          env: childEnv(),
          maxBuffer: 16 * 1024 * 1024,
        });
        code = r.status ?? 1;
      } else code = run(repoDir, String(script));
    } finally {
      for (const rel of Object.keys(files)) rmSync(join(repoDir, rel), { force: true });
    }
    const ms = Date.now() - t0;
    // 127 is the shell's "command not found": a tool that is not installed proves nothing.
    if (code === 127) {
      steps.push({
        label: s.label,
        outcome: "skipped",
        detail: `the tool is not installed (${s.command ? s.command[0] : script})`,
        ms,
      });
      log(`  not installed`);
      continue;
    }
    if (code !== 0)
      steps.push({ label: s.label, outcome: "red", detail: `went red on ${control.means}`, ms });
    else
      steps.push({
        label: s.label,
        outcome: "green",
        detail: `stayed GREEN on ${control.means}: the check is absent`,
        ms,
      });
    log(`  ${code !== 0 ? "red, as it must" : "GREEN: absent"} (${ms} ms)`);
  }
  const result = {
    at: new Date().toISOString(),
    steps,
    absent: steps.filter((x) => x.outcome === "green").map((x) => x.label),
  };
  writeJsonFile(repoDir, CONTROLS_FILE, result);
  return result;
}
