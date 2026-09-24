/**
 * The ratchet config of a repository: the defaults, then `ratchet` in the adoption config, and
 * the changelog names the adoption config already carries.
 * @param {Record<string, any> | null | undefined} adoption
 * @returns {RatchetConfig}
 */
export function resolveConfig(adoption: Record<string, any> | null | undefined): RatchetConfig;
/** The baseline path a repository names, or the standard's default. @param {Record<string, any> | null | undefined} adoption */
export function baselinePath(adoption: Record<string, any> | null | undefined): string;
/**
 * The ratchet's configuration: the budgets by kind (standard CODE.1), the exempt paths, the
 * caps, and how a repository overrides them through `ratchet` in its adoption config or in
 * `abatty.config.json` at its root.
 */
/**
 * @typedef {import("./index.mjs").RatchetConfig} RatchetConfig
 * @typedef {import("./index.mjs").KindBudget} KindBudget
 */
/** Where the committed floor lives when the config names no other path. */
export const BASELINE_DEFAULT: "scripts/ci/standards-baseline.json";
/** The sentence written into every baseline, so whoever opens the file by hand reads how a number may move before editing one. */
export const BASELINE_NOTE: "Written by `abatty baseline`. A number here may only fall; raising one needs a reason in docs/STANDARDS_PROGRESS.md and `--reason` on the command.";
/**
 * The code-line budgets by kind (standard CODE.1), matched in order on the repository-relative
 * path; the first match wins and the last row is the module budget. A repository replaces the
 * whole list through `ratchet.kinds`.
 * @type {KindBudget[]}
 */
export const DEFAULT_KINDS: KindBudget[];
/**
 * A test folder at any depth, as a regex source. One definition: the exempt list below and the
 * probes of what ships (probes/lib.mjs) both read it, and two copies were one edit from drifting.
 */
export const TEST_FOLDERS: "(^|/)(tests?|__tests__|e2e)/";
/**
 * Paths exempt from the per-kind budget and the shape rules (still under the 800 cap): generated
 * code, migrations, seeders, vendored UI, config files, constant tables, and the CLI scripts,
 * hooks and tests where a sequential procedure is the point. Regex sources on the relative path.
 */
export const DEFAULT_EXEMPT: string[];
/** @type {RatchetConfig} */
export const DEFAULT_CONFIG: RatchetConfig;
export type RatchetConfig = import("./index.mjs").RatchetConfig;
export type KindBudget = import("./index.mjs").KindBudget;
