/**
 * Every gate step proves it can go red. The ratchet's probes carry their control cases; the
 * gate steps of a preset are scripts a repository owns (a linter, a typecheck, a test runner,
 * a dead-code tool, the formatter) and a step that is wired but never went red may be
 * checking nothing. So each step has a planted violation, language-neutral in what it means
 * (a debugger statement, a type error, a failing test, an unused export, an unformatted file,
 * an oversized file, a secret) and `abatty doctor --controls` plants it, runs the step, removes
 * it, and reports a step that stays green as ABSENT. The suites' steps are judged the same way
 * (a step the controls cannot see is a step that can vanish unseen, which is what the trial's
 * empty-range run did to them), and a step that went red is run once more clean: red without a
 * plant proves nothing about the plant, and reading it as proof was the environment's failure
 * passing for the guard's. The outcome is written to `.abatty/controls.json`, which the
 * INST-CONTROLS rule reads.
 *
 * The planted files sit beside the sources under a name no repository uses
 * (`abatty-control.__.*`); a tree that already carries one is refused, and every file is
 * removed again whatever the step did.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { dockerRunning, launch } from "./spawn.mjs";
import { git, readAdoption, readPackage, writeJsonFile } from "./repo.mjs";
import { scanSecrets } from "./secrets.mjs";
import { NO_CONTROL, STEP_CONTROLS } from "./step-plants.mjs";
import { testRunEnv } from "./env.mjs";

export { STEP_CONTROLS } from "./step-plants.mjs";
/** Where the gate steps' control outcomes are recorded: the one file under `.abatty/` a rule may read, since it is proof and not a cache. */
export const CONTROLS_FILE = ".abatty/controls.json";

/**
 * The version of abatty that planted the controls, recorded with them: where a step is planted
 * changes between versions, and a proof taken with an older planting is not evidence about the
 * steps today. A monorepo read three of its steps as absent for a week on controls an older
 * version had planted in a folder none of its workspaces scans.
 */
export const CONTROLS_VERSION = String(
  JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")).version,
);

/** The major and minor of a version, as one comparable number. @param {unknown} v */
const minorOf = (v) => {
  const [major = 0, minor = 0] = String(v || "0.0")
    .split(".")
    .map(Number);
  return major * 1000 + minor;
};

/**
 * The last controls run, when this version of abatty can still read it as evidence, for every
 * reader (the truth of a finding, the night's precondition, the attestation, INST-CONTROLS): one written
 * by an older minor version, or by one that did not record its version, planted where that
 * version planted, and read as today's proof it once dropped three steps a monorepo had watched
 * fail by hand. Such a run is left unread, so the steps read unproven rather than contradicted.
 * @param {any} controls
 */
export function currentControls(controls) {
  return controls && minorOf(controls.abatty) >= minorOf(CONTROLS_VERSION) ? controls : null;
}

/**
 * @typedef {{ label: string, outcome: "red" | "green" | "skipped" | "none", detail: string, ms?: number }} StepOutcome
 */

/**
 * A control's files moved into the folder the repository named for the step, each keeping its
 * name, or left where the script put them. @param {Record<string, string>} files @param {unknown} folder
 */
export function plantedIn(files, folder) {
  // Inside the repository only: an absolute, a drive, a UNC or a climbing path is not a folder
  // of the step's runner, and doctor writes and then deletes there. Backslashes are read as the
  // separator Windows takes them for, so `..\..` climbs as `../..` does.
  const into =
    typeof folder === "string"
      ? folder.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "")
      : "";
  if (!into || /^(?:\/|[A-Za-z]:)/.test(into) || into.split("/").includes("..")) return files;
  return Object.fromEntries(
    Object.entries(files).map(([rel, text]) => [`${into}/${rel.split("/").pop()}`, text]),
  );
}

/**
 * Run the controls of a preset's steps in a repository, the always-on ones and the suites':
 * plant, run, remove, confirm clean, judge.
 * @param {{ repoDir: string, preset: import("../presets/index.mjs").Preset, log?: (line: string) => void, run?: (cwd: string, script: string) => number, dockerUp?: () => boolean }} o
 * @returns {{ at: string, abatty: string, steps: StepOutcome[], absent: string[] }}
 */
export function runStepControls(o) {
  const { repoDir, preset } = o;
  const log = o.log || (() => {});
  const dockerUp = o.dockerUp || dockerRunning;
  const spawn = (/** @type {string} */ cmd, /** @type {string[]} */ args) => {
    const l = launch(cmd, args);
    const r = spawnSync(l.file, l.args, {
      cwd: repoDir,
      encoding: "utf8",
      shell: l.shell,
      // Without what a parent test runner set: a child `node --test` that inherited it reported
      // upward and exited 0 on a failing test, so a control would call the step green.
      env: testRunEnv(),
      maxBuffer: 16 * 1024 * 1024,
    });
    // A tool that could not be spawned answers as a POSIX shell would (127), on every platform:
    // without this, a missing `ruff` on Windows read as a red control, which is the false red the
    // trial hit, inside the mechanism that exists to catch false greens.
    if (r.error && /** @type {NodeJS.ErrnoException} */ (r.error).code === "ENOENT") return 127;
    return r.status ?? 1;
  };
  const run = o.run || ((cwd, script) => spawn("npm", ["run", "-s", script]));
  const pkg = readPackage(repoDir);
  const scripts = pkg.scripts || {};
  const deps = new Set([
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ]);
  /** @type {StepOutcome[]} */
  const steps = [];
  /** Where the repository says a step's plant goes, by its script (`controls` in the config). */
  const folders = /** @type {Record<string, unknown>} */ (readAdoption(repoDir)?.controls || {});

  /** One step: what it runs, or null when it has nothing to run. @param {import("../presets/index.mjs").GateStep} s */
  const runner = (s) => {
    if (s.builtin === "secrets")
      return () => (scanSecrets(repoDir, { mode: "tree" }).findings.length ? 1 : 0);
    if (s.command) return () => spawn(String(s.command?.[0]), (s.command || []).slice(1));
    const script = [s.script, ...(s.alternatives || [])].find(
      (x) => typeof x === "string" && typeof scripts[x] === "string",
    );
    return script ? () => run(repoDir, String(script)) : null;
  };

  /** Plant, run, remove, confirm clean, judge. @param {import("../presets/index.mjs").GateStep} s @param {string} label */
  const judge = (s, label) => {
    // The control is keyed by the script the step runs, the built-in it is, or, for a step
    // that is a command, the first word of its label (the format step).
    const key = s.builtin || s.script || String(s.label.split(/\s/)[0] || "");
    if (s.requires && !s.requires.some((f) => existsSync(join(repoDir, f)))) {
      steps.push({ label, outcome: "skipped", detail: `no ${s.requires[0]}` });
      return;
    }
    // A built-in step is this package's own code, with its control in the suite; the ones with
    // no planted file say why rather than reading as a step with no script.
    if (s.builtin && s.builtin !== "secrets") {
      steps.push({
        label,
        outcome: "none",
        detail: NO_CONTROL[key] || "no control declared for this step",
      });
      return;
    }
    const exec = runner(s);
    if (!exec) {
      steps.push({ label, outcome: "skipped", detail: `no "${s.script}" script` });
      return;
    }
    const control = STEP_CONTROLS[key];
    if (!control) {
      steps.push({
        label,
        outcome: "none",
        detail: NO_CONTROL[key] || "no control declared for this step",
      });
      return;
    }
    const files = plantedIn(
      control.files({ deps, pack: preset.pack || "javascript", dir: repoDir, scripts }),
      folders[key],
    );
    const clash = Object.keys(files).find((f) => existsSync(join(repoDir, f)));
    if (clash) {
      steps.push({ label, outcome: "skipped", detail: `${clash} exists already; remove it` });
      return;
    }
    log(`▶ ${label}: planting ${control.means}`);
    const t0 = Date.now();
    let code = 0;
    /** The folders the plant had to make, deepest last, so the tree is left as it was. @type {string[]} */
    const made = [];
    try {
      for (const [rel, text] of Object.entries(files)) {
        for (let d = dirname(join(repoDir, rel)); !existsSync(d); d = dirname(d)) made.unshift(d);
        mkdirSync(dirname(join(repoDir, rel)), { recursive: true });
        writeFileSync(join(repoDir, rel), text);
      }
      // Marked as about to be committed, which is what a violation that reaches a push is: the
      // ratchet reads the tracked tree, and an untracked plant was invisible to it. The mark
      // (an empty index entry) is taken out again below, with the file.
      git(repoDir, "add", "--intent-to-add", "--", ...Object.keys(files));
      code = exec();
    } finally {
      git(repoDir, "rm", "--cached", "--quiet", "--ignore-unmatch", "--", ...Object.keys(files));
      for (const rel of Object.keys(files)) rmSync(join(repoDir, rel), { force: true });
      for (const d of made.reverse())
        if (existsSync(d) && !readdirSync(d).length) rmSync(d, { recursive: true });
    }
    const ms = Date.now() - t0;
    // 127 is the shell's "command not found": a tool that is not installed proves nothing.
    if (code === 127) {
      steps.push({
        label,
        outcome: "skipped",
        detail: `the tool is not installed (${s.command ? s.command[0] : s.script})`,
        ms,
      });
      log(`  not installed`);
      return;
    }
    if (code === 0) {
      steps.push({
        label,
        outcome: "green",
        detail: `stayed GREEN on ${control.means}: the check is absent`,
        ms,
      });
      log(`  GREEN: absent (${ms} ms)`);
      return;
    }
    // Red with the plant. Red without it too is the environment, not the guard: a suite that
    // cannot start (no browsers, no database) or a tree that is broken reads red on anything,
    // and calling that "proven" is the false red the trial hit on its first day.
    const clean = exec();
    if (clean !== 0) {
      steps.push({
        label,
        outcome: "skipped",
        detail: `red without a plant (exit ${clean}): nothing to prove until the step is green on its own`,
        ms,
      });
      log(`  red without a plant: nothing proven`);
      return;
    }
    steps.push({
      label,
      outcome: "red",
      detail: `went red on ${control.means}, green without it`,
      ms,
    });
    log(`  red, as it must (${ms} ms)`);
  };

  for (const s of preset.gate.always) judge(s, s.label);
  for (const suite of preset.gate.suites) {
    if (suite.docker && !dockerUp()) {
      for (const s of suite.steps)
        steps.push({
          label: `${s.label} · ${suite.name}`,
          outcome: "skipped",
          detail:
            "the Docker daemon is not running: the suite cannot run here, so nothing can be proven",
        });
      continue;
    }
    for (const s of suite.steps) judge(s, `${s.label} · ${suite.name}`);
  }
  const result = {
    at: new Date().toISOString(),
    abatty: CONTROLS_VERSION,
    steps,
    absent: steps.filter((x) => x.outcome === "green").map((x) => x.label),
  };
  writeJsonFile(repoDir, CONTROLS_FILE, result);
  return result;
}
