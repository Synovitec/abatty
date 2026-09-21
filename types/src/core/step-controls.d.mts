/**
 * Run the controls of a preset's steps in a repository, the always-on ones and the suites':
 * plant, run, remove, confirm clean, judge.
 * @param {{ repoDir: string, preset: import("../presets/index.mjs").Preset, log?: (line: string) => void, run?: (cwd: string, script: string) => number, dockerUp?: () => boolean }} o
 * @returns {{ at: string, steps: StepOutcome[], absent: string[] }}
 */
export function runStepControls(o: {
    repoDir: string;
    preset: import("../presets/index.mjs").Preset;
    log?: (line: string) => void;
    run?: (cwd: string, script: string) => number;
    dockerUp?: () => boolean;
}): {
    at: string;
    steps: StepOutcome[];
    absent: string[];
};
export { STEP_CONTROLS } from "./step-plants.mjs";
export const CONTROLS_FILE: ".abatty/controls.json";
export type StepOutcome = {
    label: string;
    outcome: "red" | "green" | "skipped" | "none";
    detail: string;
    ms?: number;
};
