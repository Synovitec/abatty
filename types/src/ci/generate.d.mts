/** The steps of a preset's CI, in the gate's order, provider-neutral. @param {Preset} preset @param {CiOptions} [o] */
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
/** The pull-request template: the reviewer's checklist in the author's hands. */
export function renderPullRequestTemplate(): string;
/**
 * The organisation ruleset for GitHub (Settings → Rules → Rulesets → Import): a branch name
 * that names a tool is refused, a pull request is required on the default branch, and the
 * generated checks must pass. Carries the vocabulary in the open, so it is printed, never
 * written into a repository.
 * @param {{ checks?: string[] }} [o]
 */
export function renderRuleset(o?: {
    checks?: string[];
}): string;
/**
 * @typedef {import("../presets/index.mjs").Preset} Preset
 * @typedef {{ base?: string, node?: string, publish?: boolean }} CiOptions
 * @typedef {{ name: string, command: string, when?: "always" | "db" | "browser" }} CiStep
 */
export const PROVIDERS: string[];
export type Preset = import("../presets/index.mjs").Preset;
export type CiOptions = {
    base?: string;
    node?: string;
    publish?: boolean;
};
export type CiStep = {
    name: string;
    command: string;
    when?: "always" | "db" | "browser";
};
