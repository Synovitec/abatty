/**
 * The steps of a preset's CI, in the gate's order, provider-neutral. Given the repository's
 * scripts, a step whose script the package does not have is kept in the list as ABSENT with the
 * reason and rendered as a comment rather than as a command that cannot run: the gate reports
 * the same step as skipped and the gap analysis names it, and the pipeline says the same thing
 * in the same words rather than going red on a script nobody wrote yet.
 * @param {Preset} preset @param {CiOptions} [o]
 */
export function ciSteps(preset: Preset, o?: CiOptions): CiStep[];
/**
 * The Woodpecker pipeline: one `checks` pipeline with the always-on steps, the suites in their
 * own pipelines depending on it, Postgres as a service where the preset has a database suite.
 * @param {Preset} preset @param {CiOptions} [o]
 */
export function renderWoodpecker(preset: Preset, o?: CiOptions): string;
/**
 * The GitHub Actions workflow: a `checks` job with the always-on steps, a `database` job with a
 * Postgres service, a `browser` job, the publish step guarded by the secret.
 * @param {Preset} preset @param {CiOptions} [o]
 */
export function renderGithubActions(preset: Preset, o?: CiOptions): string;
/**
 * @typedef {import("../presets/index.mjs").Preset} Preset
 * @typedef {import("../presets/index.mjs").GateStep} GateStep
 * @typedef {import("../core/package-manager.mjs").PackageManager} PackageManager
 * @typedef {{ base?: string, node?: string, publish?: boolean, scripts?: Record<string, string>, pm?: PackageManager | null }} CiOptions
 * @typedef {{ name: string, command: string, when?: "always" | "db" | "browser", absent?: string }} CiStep
 */
export const PROVIDERS: string[];
export type Preset = import("../presets/index.mjs").Preset;
export type GateStep = import("../presets/index.mjs").GateStep;
export type PackageManager = import("../core/package-manager.mjs").PackageManager;
export type CiOptions = {
    base?: string;
    node?: string;
    publish?: boolean;
    scripts?: Record<string, string>;
    pm?: PackageManager | null;
};
export type CiStep = {
    name: string;
    command: string;
    when?: "always" | "db" | "browser";
    absent?: string;
};
