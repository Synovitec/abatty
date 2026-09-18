/**
 * Validate a probe's shape. Returns the problems; an empty list is a valid probe.
 * @param {any} p @param {Set<string>} builtin
 */
export function validateProbe(p: any, builtin: Set<string>): string[];
/**
 * The probes of a repository: the built-in set less `exclude` (or only `include`), plus the
 * repository's own from `abatty.probes.mjs`, validated.
 * @param {string} repoDir @param {RatchetConfig} config
 * @returns {Promise<{ probes: Probe[], problems: string[] }>}
 */
export function loadProbes(repoDir: string, config: RatchetConfig): Promise<{
    probes: Probe[];
    problems: string[];
}>;
/** The kind of a metric: the config's override, then the baseline's promotion, then the probe's own. @param {Probe} p @param {RatchetConfig} config @param {Baseline | null} baseline */
export function kindOf(p: Probe, config: RatchetConfig, baseline: Baseline | null): Kind;
/**
 * Run every probe over the context. A probe that throws is a finding of its own, never a crash.
 * @param {Probe[]} probes @param {RepoContext} ctx @param {ProbeOptions} o @param {Baseline | null} baseline
 * @returns {Measurement[]}
 */
export function measureAll(probes: Probe[], ctx: RepoContext, o: ProbeOptions, baseline: Baseline | null): Measurement[];
/**
 * Judge every measurement against the baseline. HARD: zero or fails. RATCHET: the total and
 * every file's debt hold or fall; a file not in the list carries none. Scanned zero fails when
 * the baseline last saw files (or the config insists): a moved path must not go green forever.
 * A metric the baseline does not know fails when it is not zero: run `abatty baseline`.
 * @param {Measurement[]} measurements @param {Baseline | null} baseline @param {RatchetConfig} config
 * @returns {Verdict[]}
 */
export function compare(measurements: Measurement[], baseline: Baseline | null, config: RatchetConfig): Verdict[];
/**
 * True when the run must fail. `improved` is among them: a floor left above the value it now
 * measures is slack the gate keeps accepting, so the run is red until `abatty baseline` records
 * the number that was earned. Every status here is cured by a change, never by editing a floor
 * upward.
 * @param {Verdict[]} verdicts
 */
export function failed(verdicts: Verdict[]): boolean;
/**
 * The readability score (standard AIR.2): each metric earns full marks at zero and nothing at
 * the count where the property is lost (`lossAt`), averaged per axis, the axes averaged. A trend
 * to watch, never a gate: every term is already ratcheted on its own.
 * @param {Measurement[]} measurements
 */
export function scoreOf(measurements: Measurement[]): {
    score: number;
    axes: Record<string, number>;
};
/**
 * The configuration of a repository, for the commands: the one config (abatty.config.json at
 * the root over the older .claude/adoption.json), resolved for the ratchet.
 * @param {string} repoDir
 */
export function ratchetSetup(repoDir: string): {
    adoption: Record<string, any>;
    config: RatchetConfig;
    baselineRel: string;
};
export { DEFAULT_CONFIG } from "./config.mjs";
/**
 * @typedef {import("../rules/context.mjs").RepoContext} RepoContext
 * @typedef {"hard" | "ratchet"} Kind
 * @typedef {{ path: string, line?: number, detail?: string, weight?: number }} Finding
 * @typedef {{ scanned: number, findings: Finding[], skipped?: string }} ProbeResult
 * @typedef {{ files: Record<string, string>, message: string, date?: string }} ControlCommit
 * @typedef {{ name: string, files?: Record<string, string>, commits?: ControlCommit[], range?: string, config?: Partial<RatchetConfig>, expect: number }} Control
 * @typedef {{ config: RatchetConfig, range: string }} ProbeOptions
 * @typedef {{
 *   metric: string,
 *   kind: Kind,
 *   standard: string[],
 *   title: string,
 *   why: string,
 *   axis?: string,
 *   lossAt?: number,
 *   emptyScanOk?: boolean,
 *   scan: (ctx: RepoContext, o: ProbeOptions) => ProbeResult,
 *   controls: Control[],
 *   source?: string,
 * }} Probe
 * @typedef {{ match: string, kind: string, max: number }} KindBudget
 * @typedef {{
 *   local: string,
 *   include: string[],
 *   exclude: string[],
 *   hard: string[],
 *   ratchet: string[],
 *   mustScan: string[],
 *   cap: number,
 *   defaultMax: number,
 *   contextMax: number,
 *   barrelMax: number,
 *   kinds: KindBudget[],
 *   exempt: string[],
 *   envModule: string,
 *   citationsExempt: string[],
 *   changelog: string,
 *   changelogRequiredFor: string[],
 *   coupled: unknown[],
 * }} RatchetConfig
 * @typedef {{ metric: string, kind: Kind, value: number, scanned: number, findings: Finding[], debt: Record<string, number>, skipped?: string, probe: Probe }} Measurement
 * @typedef {"ok" | "improved" | "regressed" | "hard-fail" | "scanned-zero" | "unbaselined" | "skipped"} VerdictStatus
 * @typedef {{ metric: string, kind: Kind, status: VerdictStatus, value: number, floor: number | null, scanned: number, messages: string[], findings: Finding[] }} Verdict
 * @typedef {{ measuredAt: string, note?: string, score?: number, hard?: string[], metrics: Record<string, number>, scanned?: Record<string, number>, debt: Record<string, Record<string, number>>, [k: string]: unknown }} Baseline
 */
/** @type {Probe[]} */
export const BUILTIN_PROBES: Probe[];
export type RepoContext = import("../rules/context.mjs").RepoContext;
export type Kind = "hard" | "ratchet";
export type Finding = {
    path: string;
    line?: number;
    detail?: string;
    weight?: number;
};
export type ProbeResult = {
    scanned: number;
    findings: Finding[];
    skipped?: string;
};
export type ControlCommit = {
    files: Record<string, string>;
    message: string;
    date?: string;
};
export type Control = {
    name: string;
    files?: Record<string, string>;
    commits?: ControlCommit[];
    range?: string;
    config?: Partial<RatchetConfig>;
    expect: number;
};
export type ProbeOptions = {
    config: RatchetConfig;
    range: string;
};
export type Probe = {
    metric: string;
    kind: Kind;
    standard: string[];
    title: string;
    why: string;
    axis?: string;
    lossAt?: number;
    emptyScanOk?: boolean;
    scan: (ctx: RepoContext, o: ProbeOptions) => ProbeResult;
    controls: Control[];
    source?: string;
};
export type KindBudget = {
    match: string;
    kind: string;
    max: number;
};
export type RatchetConfig = {
    local: string;
    include: string[];
    exclude: string[];
    hard: string[];
    ratchet: string[];
    mustScan: string[];
    cap: number;
    defaultMax: number;
    contextMax: number;
    barrelMax: number;
    kinds: KindBudget[];
    exempt: string[];
    envModule: string;
    citationsExempt: string[];
    changelog: string;
    changelogRequiredFor: string[];
    coupled: unknown[];
};
export type Measurement = {
    metric: string;
    kind: Kind;
    value: number;
    scanned: number;
    findings: Finding[];
    debt: Record<string, number>;
    skipped?: string;
    probe: Probe;
};
export type VerdictStatus = "ok" | "improved" | "regressed" | "hard-fail" | "scanned-zero" | "unbaselined" | "skipped";
export type Verdict = {
    metric: string;
    kind: Kind;
    status: VerdictStatus;
    value: number;
    floor: number | null;
    scanned: number;
    messages: string[];
    findings: Finding[];
};
export type Baseline = {
    measuredAt: string;
    note?: string;
    score?: number;
    hard?: string[];
    metrics: Record<string, number>;
    scanned?: Record<string, number>;
    debt: Record<string, Record<string, number>>;
    [k: string]: unknown;
};
export { readBaseline, writeBaseline } from "./baseline.mjs";
