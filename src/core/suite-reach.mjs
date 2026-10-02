/**
 * A suite the gate can never select. The gate runs a suite when the push or the tree touches its
 * paths (`app/`, `e2e/`, ...), read from the root for the root's preset. A monorepo whose Next app
 * lives in a workspace with no preset of its own has none of those paths at the root, so its
 * browser suite was never selected: every push read "no matching path", the rule that the suite
 * catches page errors read present, and the first full run found 25 real ones. A repository that
 * has a suite's script but no file its paths match has a suite that never runs, and says so.
 */
import { git, readJsonFile } from "./repo.mjs";
import { appHomes, suiteReads } from "../presets/app-homes.mjs";

/**
 * The suites of a preset this repository has the script for and the gate can never select.
 * @param {string} repoDir @param {import("../presets/index.mjs").Preset | null} preset
 * @returns {{ name: string, script: string }[]}
 */
export function unreachableSuites(repoDir, preset) {
  if (!preset) return [];
  const scripts = readJsonFile(repoDir, "package.json")?.scripts || {};
  const tracked = git(repoDir, "ls-files").split("\n").filter(Boolean);
  // Read as the gate reads them: from the root and from the app's homes.
  const homes = appHomes(preset, tracked);
  /** @type {{ name: string, script: string }[]} */
  const out = [];
  for (const suite of preset.gate.suites) {
    // The repository has the suite when every step has its script: `build` alone is every
    // repository's, and a suite read from it alone would be claimed of all of them.
    const each = suite.steps.map((s) =>
      [s.script, ...(s.alternatives || [])].find((k) => k && k in scripts),
    );
    if (!each.length || each.some((k) => !k)) continue;
    if (!tracked.some((f) => suiteReads(suite.paths, f, homes)))
      out.push({ name: suite.name, script: String(each[each.length - 1]) });
  }
  return out;
}
