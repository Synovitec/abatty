/**
 * Run the controls of a preset's steps in a repository, the always-on ones and the suites':
 * plant, run, remove, confirm clean, judge.
 * @param {{ repoDir: string, preset: import("../presets/index.mjs").Preset, log?: (line: string) => void, run?: (cwd: string, script: string) => number, dockerUp?: () => boolean }} o
 * @returns {{ at: string, abatty: string, steps: StepOutcome[], absent: string[] }}
 */
export function runStepControls(o: {
    repoDir: string;
    preset: import("../presets/index.mjs").Preset;
    log?: (line: string) => void;
    run?: (cwd: string, script: string) => number;
    dockerUp?: () => boolean;
}): {
    at: string;
    abatty: string;
    steps: StepOutcome[];
    absent: string[];
};
export { STEP_CONTROLS } from "./step-plants.mjs";
export const CONTROLS_FILE: ".abatty/controls.json";
/**
 * The version of abatty that planted the controls, recorded with them: where a step is planted
 * changes between versions, and a proof taken with an older planting is not evidence about the
 * steps today. A monorepo read three of its steps as absent for a week on controls an older
 * version had planted in a folder none of its workspaces scans.
 */
export const CONTROLS_VERSION: string;
export type StepOutcome = {
    label: string;
    outcome: "red" | "green" | "skipped" | "none";
    detail: string;
    ms?: number;
};
