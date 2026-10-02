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
/**
 * A job's first steps: the checkout with its history, the runner's toolchain following the
 * lockfile (pnpm before node so the cache can find it, bun with its own action) and the manager's
 * frozen install. Shared with the day-one workflow, so both pin the same actions.
 * @param {ReturnType<typeof tooling>} t @param {string} node
 * @returns {string[]}
 */
export function githubSetup(t: ReturnType<typeof tooling>, node: string): string[];
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
import { tooling } from "./generate.mjs";
