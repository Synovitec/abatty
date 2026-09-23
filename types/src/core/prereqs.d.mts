/**
 * Every gate step's prerequisites in a repository, the suites' included; a suite that starts a
 * database needs a container runtime that answers.
 * @param {string} repoDir @param {import("../presets/index.mjs").Preset} preset
 * @param {{ dockerUp?: () => boolean }} [o] @returns {Prerequisite[]}
 */
export function prerequisites(repoDir: string, preset: import("../presets/index.mjs").Preset, o?: {
    dockerUp?: () => boolean;
}): Prerequisite[];
/**
 * The gate's first line when steps look unable to run, or "". A line and never a refusal: a
 * lookup that cannot see a layout must never stop a gate that would have run. The container
 * runtime is not asked here; the suites ask it when they are selected.
 * @param {string} repoDir @param {import("../presets/index.mjs").Preset} preset
 */
export function preflightLine(repoDir: string, preset: import("../presets/index.mjs").Preset): string;
export type GateStep = import("../presets/index.mjs").GateStep;
/**
 * `missing`: the step is configured (or required) and something it needs is not here.
 * `off`: an optional step this repository has not configured; the gate skips it.
 */
export type Prerequisite = {
    label: string;
    state: "ready" | "missing" | "off";
    required: boolean;
    detail: string;
};
