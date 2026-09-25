/**
 * The last controls run, when this version of abatty can still read it as evidence, for every
 * reader (the truth of a finding, the night's precondition, the attestation, INST-CONTROLS): one written
 * by an older minor version, or by one that did not record its version, planted where that
 * version planted, and read as today's proof it once dropped three steps a monorepo had watched
 * fail by hand. Such a run is left unread, so the steps read unproven rather than contradicted.
 * @param {any} controls
 */
export function currentControls(controls: any): any;
/**
 * @typedef {{ label: string, outcome: "red" | "green" | "skipped" | "none", detail: string, ms?: number }} StepOutcome
 */
/**
 * A control's files moved into the folder the repository named for the step, each keeping its
 * name, or left where the script put them. @param {Record<string, string>} files @param {unknown} folder
 */
export function plantedIn(files: Record<string, string>, folder: unknown): Record<string, string>;
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
/** Where the gate steps' control outcomes are recorded: the one file under `.abatty/` a rule may read, since it is proof and not a cache. */
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
