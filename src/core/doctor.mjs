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
  pairs.push(["harness/settings.project.json", ".claude/settings.json"]);
  pairs.push(["harness/mcp.night.json", ".claude/mcp.night.json"]);
  return pairs;
}

/**
 * @param {string} repoDir
 * @returns {DriftEvent[]}
 */
export function drift(repoDir) {
  return shippedFiles().map(
    ([tpl, rel]) => /** @type {DriftEvent} */ ({ file: rel, state: driftState(repoDir, tpl, rel) }),
  );
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
 * @param {{ repoDir: string, preset: import("../presets/index.mjs").Preset | null, strict?: boolean, skipSelfTest?: boolean }} o
 */
export function doctor(o) {
  const { repoDir, preset } = o;
  const st = o.skipSelfTest ? { code: 0, output: "self-test skipped\n" } : selfTest(repoDir);
  const d = drift(repoDir);
  const missing = d.filter((x) => x.state === "missing");
  const differs = d.filter((x) => x.state === "differs");
  const scripts = preset ? missingGateScripts(repoDir, preset) : [];
  const problems = configProblems(repoDir);
  const ok =
    st.code === 0 &&
    missing.length === 0 &&
    problems.length === 0 &&
    (!o.strict || differs.length === 0);
  const lock = readLock(repoDir);
  return {
    ok,
    selfTest: st,
    drift: d,
    missing,
    differs,
    missingScripts: scripts,
    installed: lock?.abatty || null,
    packageVersion: packageVersion(),
    config: { files: configFiles(repoDir), problems },
  };
}
