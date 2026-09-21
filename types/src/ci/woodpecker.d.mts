/**
 * @typedef {import("./generate.mjs").CiStep} CiStep
 * @typedef {import("./generate.mjs").CiOptions} CiOptions
 * @typedef {import("../presets/index.mjs").Preset} Preset
 */
/**
 * The Woodpecker pipeline: one `checks` pipeline with the always-on steps, the suites in their
 * own pipelines depending on it, Postgres as a service where the preset has a database suite.
 * @param {Preset} preset @param {CiOptions} [o]
 */
export function renderWoodpecker(preset: Preset, o?: CiOptions): string;
export type CiStep = import("./generate.mjs").CiStep;
export type CiOptions = import("./generate.mjs").CiOptions;
export type Preset = import("../presets/index.mjs").Preset;
