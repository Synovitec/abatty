/**
 * @typedef {import("./generate.mjs").CiStep} CiStep
 * @typedef {import("./generate.mjs").CiOptions} CiOptions
 * @typedef {import("../presets/index.mjs").Preset} Preset
 */
/**
 * The GitHub Actions workflow: a `checks` job with the always-on steps, a `database` job with a
 * Postgres service, a `browser` job, the publish step guarded by the secret.
 * @param {Preset} preset @param {CiOptions} [o]
 */
export function renderGithubActions(preset: Preset, o?: CiOptions): string;
export namespace ACTIONS {
    let checkout: string;
    let setupNode: string;
    let setupPnpm: string;
    let setupBun: string;
    let uploadSarif: string;
    let attest: string;
}
export type CiStep = import("./generate.mjs").CiStep;
export type CiOptions = import("./generate.mjs").CiOptions;
export type Preset = import("../presets/index.mjs").Preset;
