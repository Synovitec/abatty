/**
 * What the gate needs before it runs, read without running anything: for each step its script,
 * the program the script starts, the config file it wants, the lockfile the audit reads, the
 * database a suite starts in a container. The confirm-clean run of `doctor --controls` proves a
 * step can run by running it; this is the half that needs no run. It answers in a second what
 * the gate would otherwise answer after the unit tests, which in the outside trial was five
 * minutes into a run that could never have gone green.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { packageManager } from "./package-manager.mjs";
import { readPackage } from "./repo.mjs";
import { dockerRunning } from "./spawn.mjs";
import { scriptProgram, toolFound } from "./which.mjs";

/**
 * @typedef {import("../presets/index.mjs").GateStep} GateStep
 * @typedef {{ label: string, state: "ready" | "missing" | "off", required: boolean, detail: string }} Prerequisite
 *   `missing`: the step is configured (or required) and something it needs is not here.
 *   `off`: an optional step this repository has not configured; the gate skips it.
 */

/**
 * The program a gate command starts: `npx <tool>` runs the tool, anything else runs itself.
 * @param {string[]} argv @returns {string | null}
 */
function commandProgram(argv) {
  const [first, ...rest] = argv;
  if (first === "npx") return scriptProgram(rest.filter((a) => !a.startsWith("-")).join(" "));
  return first ? scriptProgram(first) : null;
}

/**
 * One step's readiness here.
 * @param {string} repoDir @param {GateStep} s @param {Record<string, string>} scripts
 * @returns {Prerequisite}
 */
function stepReadiness(repoDir, s, scripts) {
  const required = s.required === true;
  /** @param {Prerequisite["state"]} state @param {string} detail @returns {Prerequisite} */
  const at = (state, detail) => ({ label: s.label, state, required, detail });
  if (s.builtin === "audit") {
    const pm = packageManager(repoDir);
    return pm ? at("ready", `${pm.id}, ${pm.lockfile}`) : at("missing", "no lockfile to audit");
  }
  if (s.builtin) return at("ready", "built in");
  if (s.requires && !s.requires.some((f) => existsSync(join(repoDir, f))))
    return at(required ? "missing" : "off", `no ${s.requires[0]}`);
  if (s.command) {
    const program = commandProgram(s.command);
    return program && !toolFound(repoDir, program)
      ? at("missing", `${program} is not installed`)
      : at("ready", s.command.join(" "));
  }
  const script = [s.script, ...(s.alternatives || [])].find(
    (x) => typeof x === "string" && typeof scripts[x] === "string",
  );
  if (!script) return at(required ? "missing" : "off", `no "${s.script}" script`);
  const program = scriptProgram(String(scripts[script]));
  return program && !toolFound(repoDir, program)
    ? at("missing", `"${script}" runs ${program}, which is not installed`)
    : at("ready", `npm run ${script}`);
}

/**
 * Every gate step's prerequisites in a repository, the suites' included; a suite that starts a
 * database needs a container runtime that answers.
 * @param {string} repoDir @param {import("../presets/index.mjs").Preset} preset
 * @param {{ dockerUp?: () => boolean }} [o] @returns {Prerequisite[]}
 */
export function prerequisites(repoDir, preset, o = {}) {
  const scripts = /** @type {Record<string, string>} */ (readPackage(repoDir).scripts || {});
  const list = preset.gate.always.map((s) => stepReadiness(repoDir, s, scripts));
  for (const suite of preset.gate.suites) {
    const steps = suite.steps.map((s) => stepReadiness(repoDir, s, scripts));
    list.push(...steps.map((p) => ({ ...p, label: `${suite.name}: ${p.label}` })));
    if (suite.docker && steps.some((p) => p.state === "ready") && !(o.dockerUp || dockerRunning)())
      list.push({
        label: `${suite.name}: the database`,
        state: "missing",
        required: false,
        detail: "docker does not answer; the gate defers this suite to CI",
      });
  }
  return list;
}

/**
 * The gate's first line when steps look unable to run, or "". A line and never a refusal: a
 * lookup that cannot see a layout must never stop a gate that would have run. The container
 * runtime is not asked here; the suites ask it when they are selected.
 * @param {string} repoDir @param {import("../presets/index.mjs").Preset} preset
 */
export function preflightLine(repoDir, preset) {
  const unready = prerequisites(repoDir, preset, { dockerUp: () => true }).filter(
    (p) => p.state === "missing",
  );
  return unready.length
    ? `· preflight: ${unready.length} step(s) look unable to run here: ${unready.map((p) => `${p.label} (${p.detail})`).join("; ")}`
    : "";
}
