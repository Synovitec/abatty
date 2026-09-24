import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NEXT_PKG, STUB_AGENT, cli, git, tempRepo } from "./helpers.mjs";
import { runNight } from "../src/night/runner.mjs";
import { CONTROLS_VERSION } from "../src/core/step-controls.mjs";

/**
 * The night's fixture, shared by the three files that exercise it. The tests were one file of
 * 151 s, and the runner parallelises files rather than the tests inside one, so the suite waited
 * on this file alone. Split by what each group proves, the three run at once.
 */

/**
 * A repository with the harness installed and committed on main, a gate that is a no-op, and
 * the phases the night walks. The stub agent stands in for the model: it marks a phase done,
 * adds a changelog line, leaves the tree dirty, and plays the Stop loop against the real hooks.
 * @param {string} name @param {string[]} phases
 */
function nightRepo(name, phases = ["11"]) {
  const dir = tempRepo(name, { "package.json": NEXT_PKG });
  cli(["init", dir, "--stack", "next"], dir);
  // The gate the Stop hook runs is the repository's npm script (the self-test requires a script
  // or a file, never a bare command); here a no-op that any shell runs.
  setGate(dir, 'node -e "process.exit(0)"');
  const cfgPath = join(dir, "abatty.config.json");
  const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
  cfg.commands.gate = "npm run gate:fast";
  cfg.phases = phases.map(Number);
  cfg.maxSessionsPerPhase = 2;
  writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + "\n");
  // The controls are a precondition of a night, so a fixture that means to run one records that
  // every gate step was watched going red. A fixture without this is the refusal case, and it has
  // a test of its own.
  recordControls(dir);
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "chore: the instrument");
  return dir;
}

/** Every gate step watched failing on a planted violation, as `doctor --controls` records it. @param {string} dir */
export function recordControls(dir, steps = ["format", "typecheck", "unit tests (TEST.1)"]) {
  mkdirSync(join(dir, ".abatty"), { recursive: true });
  writeFileSync(
    join(dir, ".abatty", "controls.json"),
    JSON.stringify({
      at: new Date().toISOString(),
      abatty: CONTROLS_VERSION,
      steps: steps.map((label) => ({ label, outcome: "red", detail: "went red, as it must" })),
      absent: [],
    }),
  );
}

/** @param {string} dir @param {string} command */
function setGate(dir, command) {
  const pkgPath = join(dir, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  pkg.scripts["gate:fast"] = command;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
}

/** @param {string} dir @param {Partial<import("../src/night/runner.mjs").NightOptions>} [extra] */
function night(dir, extra = {}) {
  /** @type {string[]} */
  const lines = [];
  const r = runNight({
    repoDir: dir,
    until: "+10min",
    maxCostUsd: 10,
    noPush: true,
    agent: STUB_AGENT,
    log: (l) => lines.push(l),
    ...extra,
  });
  return { ...r, out: lines.join("\n") };
}

export { nightRepo, setGate, night };
