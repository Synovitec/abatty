/**
 * Run the controls of a preset's always-on steps in a repository: plant, run, remove, judge.
 * @param {{ repoDir: string, preset: import("../presets/index.mjs").Preset, log?: (line: string) => void, run?: (cwd: string, script: string) => number }} o
 * @returns {{ at: string, steps: StepOutcome[], absent: string[] }}
 */
export function runStepControls(o: {
    repoDir: string;
    preset: import("../presets/index.mjs").Preset;
    log?: (line: string) => void;
    run?: (cwd: string, script: string) => number;
}): {
    at: string;
    steps: StepOutcome[];
    absent: string[];
};
export const CONTROLS_FILE: ".abatty/controls.json";
/** The planted violation per step, by the script it runs or the built-in it is. @type {Record<string, StepControl>} */
export const STEP_CONTROLS: Record<string, StepControl>;
export type StepControl = {
    files: (deps: Set<string>, pack: string) => Record<string, string>;
    means: string;
};
export type StepOutcome = {
    label: string;
    outcome: "red" | "green" | "skipped" | "none";
    detail: string;
    ms?: number;
};
