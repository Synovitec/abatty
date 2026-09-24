/**
 * `abatty doctor`: is the instrument in this repository whole, proven, and in step with
 * the package? Runs the harness self-test (the 128 checks the runner refuses a night without),
 * then compares every file the package ships with the repository's copy - after formatting is
 * normalised, because a repository's Prettier reformats the hooks and that is not drift.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";
import { TEMPLATES } from "./init.mjs";
import { missingGateScripts } from "./gate.mjs";
import { packageVersion, readLock } from "./update.mjs";
import { configFiles, configProblems } from "./config.mjs";
import { runStepControls } from "./step-controls.mjs";
import { readAdoption } from "./repo.mjs";
import { SHIM_DIR, SHIM_FILES } from "./shim.mjs";
import { hookModes } from "./hook-modes.mjs";
import { gitHooks, hooksNotExecutable } from "./git-hooks.mjs";
import { managerFor } from "./package-manager.mjs";
import { loosenedRules, unrefusedSecrets } from "./secret-reads.mjs";
import { offProbes } from "./opt-in.mjs";

/** @typedef {{ file: string, state: "in step" | "differs" | "missing" }} DriftEvent */

/**
 * Formatting-blind comparison: whitespace, trailing commas (before `}`, `]` and `)`, since
 * Prettier's trailingComma "all" puts one after the last call argument too), quote style and
 * the escapes a quote swap changes ('a "b"' becomes "a \"b\"") and the parentheses Prettier
 * removes around a nested ternary do not count. A change to a quote or a parenthesis alone is
 * therefore invisible here; a change to any other character is not - drift means an edit to
 * the hook's logic, and an edit to logic changes identifiers, keywords or operators.
 * @param {string} text
 */
export function normalise(text) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/,(\s*[}\])])/g, "$1")
    .replace(/["'\\()]/g, "")
    .replace(/\s+/g, "");
}

/** @param {string} dir @param {string} [base] @param {string[]} [acc] */
function walk(dir, base = dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, base, acc);
    else acc.push(relative(base, p).split("\\").join("/"));
  }
  return acc;
}

/** The template → repository path map the package keeps in step. */
/** @returns {[string, string][]} */
export function shippedFiles() {
  /** @type {[string, string][]} */
  const pairs = walk(join(TEMPLATES, "harness", "hooks")).map((f) => [
    `harness/hooks/${f}`,
    `.claude/hooks/${f}`,
  ]);
  pairs.push(["skills/adopt-standards/SKILL.md", ".claude/skills/adopt-standards/SKILL.md"]);
  pairs.push(["harness/agents/standards-reviewer.md", ".claude/agents/standards-reviewer.md"]);
  pairs.push(["harness/agents/standards-adopter.md", ".claude/agents/standards-adopter.md"]);
  for (const f of SHIM_FILES) pairs.push([`harness/bin/${f}`, `${SHIM_DIR}/${f}`]);
  pairs.push(["harness/settings.project.json", ".claude/settings.json"]);
  pairs.push(["harness/mcp.night.json", ".claude/mcp.night.json"]);
  return pairs;
}

/**
 * @param {string} repoDir
 * @returns {DriftEvent[]}
 */
export function drift(repoDir) {
  const templates = shippedFiles().map(
    ([tpl, rel]) => /** @type {DriftEvent} */ ({ file: rel, state: driftState(repoDir, tpl, rel) }),
  );
  // The git hooks, against what this version would write in this repository's manager: they are
  // generated, not copied, and a pre-push from before --refs read as no drift at all.
  if (!existsSync(join(repoDir, ".githooks"))) return templates;
  const hooks = Object.entries(gitHooks(managerFor(repoDir))).map(([rel, text]) => {
    const target = join(repoDir, rel);
    const state = !existsSync(target)
      ? "missing"
      : normalise(readFileSync(target, "utf8")) === normalise(text)
        ? "in step"
        : "differs";
    return /** @type {DriftEvent} */ ({ file: rel, state });
  });
  return [...templates, ...hooks];
}

/**
 * What the settings file changed in the permission surface against the template, named: a
 * settings file that differs was reported as drift, and a secret-read deny narrowed to a list of
 * files read the same as a reformatted one. An env file the settings no longer refuse fails doctor.
 * @param {string} repoDir
 * @returns {{ removedDenies: string[], addedAllows: string[], readable: string[] }}
 */
function permissionChanges(repoDir) {
  const read = (/** @type {string} */ p) => {
    try {
      return JSON.parse(readFileSync(p, "utf8"));
    } catch {
      return null;
    }
  };
  const installed = read(join(repoDir, ".claude/settings.json"));
  if (!installed) return { removedDenies: [], addedAllows: [], readable: [] };
  const shipped = read(join(TEMPLATES, "harness/settings.project.json"));
  return { ...loosenedRules(shipped, installed), readable: unrefusedSecrets(installed) };
}

/** @param {string} repoDir @param {string} tpl @param {string} rel @returns {DriftEvent["state"]} */
function driftState(repoDir, tpl, rel) {
  {
    const target = join(repoDir, rel);
    if (!existsSync(target)) return "missing";
    const same =
      normalise(readFileSync(join(TEMPLATES, tpl), "utf8")) ===
      normalise(readFileSync(target, "utf8"));
    return same ? "in step" : "differs";
  }
}

/** Run the repository's own harness self-test; { code, output }. @param {string} repoDir */
export function selfTest(repoDir) {
  const hook = join(repoDir, ".claude", "hooks", "self-test.mjs");
  if (!existsSync(hook))
    return { code: 2, output: "no .claude/hooks/self-test.mjs - run `abatty init` first\n" };
  const r = spawnSync(process.execPath, [hook], { cwd: repoDir, encoding: "utf8" });
  return { code: r.status ?? 1, output: (r.stdout || "") + (r.stderr || "") };
}

/**
 * @param {{ repoDir: string, preset: import("../presets/index.mjs").Preset | null, strict?: boolean, skipSelfTest?: boolean, controls?: boolean, log?: (line: string) => void }} o
 */
export function doctor(o) {
  const { repoDir, preset } = o;
  // Every gate step proves it can go red: planted, run, removed; a step that stays green is absent.
  const controls = o.controls && preset ? runStepControls({ repoDir, preset, log: o.log }) : null;
  const st = o.skipSelfTest ? { code: 0, output: "self-test skipped\n" } : selfTest(repoDir);
  const d = drift(repoDir);
  const missing = d.filter((x) => x.state === "missing");
  const differs = d.filter((x) => x.state === "differs");
  const scripts = preset ? missingGateScripts(repoDir, preset) : [];
  const permissions = permissionChanges(repoDir);
  const optIn = offProbes(repoDir);
  const problems = configProblems(repoDir);
  // What each hook does here, day and night; one that does nothing it seems to fails --strict.
  const hooks = hookModes(repoDir);
  // A hook git records as 100644 is skipped by git on every machine but the one it was written on.
  const notExecutable = hooksNotExecutable(repoDir);
  const ok =
    st.code === 0 &&
    missing.length === 0 &&
    notExecutable.length === 0 &&
    problems.length === 0 &&
    permissions.readable.length === 0 &&
    (!controls || controls.absent.length === 0) &&
    (!o.strict || (differs.length === 0 && hooks.every((h) => !h.warn)));
  const lock = readLock(repoDir);
  return {
    ok,
    selfTest: st,
    drift: d,
    missing,
    differs,
    missingScripts: scripts,
    permissions,
    optIn,
    installed: lock?.abatty || null,
    pinned:
      typeof readAdoption(repoDir)?.abatty === "string"
        ? String(readAdoption(repoDir)?.abatty)
        : null,
    packageVersion: packageVersion(),
    config: { files: configFiles(repoDir), problems },
    controls,
    hooks,
    notExecutable,
  };
}
