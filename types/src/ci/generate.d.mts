/**
 * The commands of the package manager a pipeline is written for: the repository's, read from
 * its lockfile, or npm where nothing says otherwise. A pipeline that said `npm ci` to a pnpm
 * repository was red from its first run (the trial's seventh defect).
 * @param {CiOptions} o
 */
export function tooling(o: CiOptions): {
    id: import("../core/package-manager.mjs").PackageManagerId;
    install: string;
    run: (script: string, args?: string[]) => string;
    exec: (tool: string) => string;
    audit: string;
};
/**
 * The steps of a preset's CI, in the gate's order, provider-neutral. Given the repository's
 * scripts, a step whose script the package does not have is kept in the list as ABSENT with the
 * reason and rendered as a comment rather than as a command that cannot run: the gate reports
 * the same step as skipped and the gap analysis names it, and the pipeline says the same thing
 * in the same words rather than going red on a script nobody wrote yet.
 * @param {Preset} preset @param {CiOptions} [o]
 */
export function ciSteps(preset: Preset, o?: CiOptions): CiStep[];
/** A YAML scalar, quoted when it must be. @param {string} s */
export function y(s: string): string;
/** A step's name as an identifier. @param {string} name */
export function ident(name: string): string;
/**
 * The steps of a pipeline by the job they run in: always-on, the database suite's, the browser
 * suite's. One reading for every renderer.
 * @param {CiStep[]} steps
 */
export function byJob(steps: CiStep[]): {
    always: CiStep[];
    db: CiStep[];
    browser: CiStep[];
};
/**
 * @typedef {import("../presets/index.mjs").Preset} Preset
 * @typedef {import("../presets/index.mjs").GateStep} GateStep
 * @typedef {import("../core/package-manager.mjs").PackageManager} PackageManager
 * @typedef {{ base?: string, node?: string, publish?: boolean, scripts?: Record<string, string>, pm?: PackageManager | null, present?: (rel: string) => boolean }} CiOptions
 *   `present`: whether a file is in the repository, for a step that `requires` one; without it every step is emitted.
 * @typedef {{ name: string, command: string, when?: "always" | "db" | "browser", absent?: string }} CiStep
 */
/** The pipelines `abatty ci` can write, each from the same list of steps. */
export const PROVIDERS: string[];
export type Preset = import("../presets/index.mjs").Preset;
export type GateStep = import("../presets/index.mjs").GateStep;
export type PackageManager = import("../core/package-manager.mjs").PackageManager;
/**
 * `present`: whether a file is in the repository, for a step that `requires` one; without it every step is emitted.
 */
export type CiOptions = {
    base?: string;
    node?: string;
    publish?: boolean;
    scripts?: Record<string, string>;
    pm?: PackageManager | null;
    present?: (rel: string) => boolean;
};
export type CiStep = {
    name: string;
    command: string;
    when?: "always" | "db" | "browser";
    absent?: string;
};
