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
import { readPackage, writeJsonFile } from "./repo.mjs";
import { scanSecrets } from "./secrets.mjs";

export const CONTROLS_FILE = ".abatty/controls.json";
const MARK = "abatty-control.__";

/**
 * @typedef {{ files: (deps: Set<string>, pack: string) => Record<string, string>, means: string }} StepControl
 * @typedef {{ label: string, outcome: "red" | "green" | "skipped" | "none", detail: string, ms?: number }} StepOutcome
 */

/** One planted file, typed as the record a control returns. @param {string} path @param {string} text @returns {Record<string, string>} */
const file = (path, text) => ({ [path]: text });

/** @param {number} n */
const longFile = (n) =>
  Array.from({ length: n }, (_, i) => `export const line${i} = ${i};`).join("\n") + "\n";

/** The planted violation per step, by the script it runs or the built-in it is. @type {Record<string, StepControl>} */
export const STEP_CONTROLS = {
  format: {
    means: "an unformatted file",
    files: (_d, pack) =>
      pack === "python"
        ? file(`src/${MARK}.py`, "x    =   {  'a':1 }\n")
        : file(`src/${MARK}.ts`, "const   x={a:1,b:2}\nexport   const y=x\n"),
  },
  lint: {
    means: "a debugger statement (an unused import for Python)",
    files: (_d, pack) =>
      pack === "python"
        ? file(`src/${MARK}.py`, "import os\n")
        : file(`src/${MARK}.ts`, "debugger;\nexport const abattyControl = 1;\n"),
  },
  typecheck: {
    means: "a type error",
    files: (_d, pack) =>
      pack === "python"
        ? file(`src/${MARK}.py`, 'abatty_control: int = "not a number"\n')
        : file(`src/${MARK}.ts`, 'export const abattyControl: number = "not a number";\n'),
  },
  test: {
    means: "a test that throws",
    files: (deps, pack) =>
      pack === "python"
        ? {
            [`tests/test_abatty_control__.py`]:
              'def test_abatty_control():\n    raise Exception("planted")\n',
          }
        : file(
            `src/${MARK}.test.ts`,
            (deps.has("vitest") ? 'import { test } from "vitest";\n' : "") +
              'test("abatty control: planted to fail", () => {\n  throw new Error("planted");\n});\n',
          ),
  },
  dead: {
    means: "an unused export in an unreferenced file",
    files: (_d, pack) =>
      pack === "python"
        ? file(`src/${MARK}.py`, "def abatty_unused():\n    return 1\n")
        : file(`src/${MARK}.ts`, "export const abattyUnused = 1;\n"),
  },
  standards: {
    means: "a file over the 800-line cap",
    files: (_d, pack) => file(`src/${MARK}.${pack === "python" ? "py" : "ts"}`, longFile(801)),
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
      const r = spawnSync("npm", ["run", "-s", script], {
        cwd,
        encoding: "utf8",
        shell: true,
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
    const files = control.files(deps, preset.pack || "javascript");
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
        const r = spawnSync(String(cmd), args, {
          cwd: repoDir,
          encoding: "utf8",
          shell: true,
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
