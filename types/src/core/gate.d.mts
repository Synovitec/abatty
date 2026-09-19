/**
 * @typedef {"ok" | "failed" | "errored" | "skipped" | "deferred"} GateOutcome
 * @typedef {{ label: string, outcome: GateOutcome, detail?: string, ms?: number }} GateEvent
 * @typedef {{ label: string, outcome: GateOutcome, detail?: string, ms?: number, workspace?: string }} GateEventW
 * @typedef {import("./spawn.mjs").RunResult} RunResult
 * @typedef {{ repoDir: string, preset: import("../presets/index.mjs").Preset, fast?: boolean, range?: string, base?: string, run?: (repoDir: string, script: string, extraArgs?: string[]) => RunResult | number, dockerUp?: () => boolean, log?: (line: string) => void, workspaces?: { path: string, preset: import("../presets/index.mjs").Preset | null }[] }} GateOptions
 */
/**
 * What the push contains. `@{u}..HEAD` while the upstream is still an ancestor of HEAD; after
 * a rebase or an amend it is not, and the diff would show the amend delta rather than the
 * push (which is how a push carrying twenty UI files once skipped the browser suite), so the
 * whole branch is judged instead; with no upstream, the fork point from the base; failing
 * that, the last commit.
 */
/** @param {string} repoDir @param {string} [base] @param {string} [explicit] */
export function pushRange(repoDir: string, base?: string, explicit?: string): string;
/** Files whose content on disk differs from HEAD: staged, unstaged, untracked. @param {string} repoDir */
export function pendingPaths(repoDir: string): string[];
/**
 * Run the gate. Returns the events and whether it passed; the first failing step ends it.
 * @param {GateOptions} o
 */
export function runGate(o: GateOptions): {
    ok: boolean;
    events: GateEvent[];
    range: string;
    errored: boolean;
};
/**
 * The always-on scripts the preset expects that package.json does not have (for doctor).
 * @param {string} repoDir @param {import("../presets/index.mjs").Preset} preset
 */
export function missingGateScripts(repoDir: string, preset: import("../presets/index.mjs").Preset): (string | undefined)[];
export type GateOutcome = "ok" | "failed" | "errored" | "skipped" | "deferred";
export type GateEvent = {
    label: string;
    outcome: GateOutcome;
    detail?: string;
    ms?: number;
};
export type GateEventW = {
    label: string;
    outcome: GateOutcome;
    detail?: string;
    ms?: number;
    workspace?: string;
};
export type RunResult = import("./spawn.mjs").RunResult;
export type GateOptions = {
    repoDir: string;
    preset: import("../presets/index.mjs").Preset;
    fast?: boolean;
    range?: string;
    base?: string;
    run?: (repoDir: string, script: string, extraArgs?: string[]) => RunResult | number;
    dockerUp?: () => boolean;
    log?: (line: string) => void;
    workspaces?: {
        path: string;
        preset: import("../presets/index.mjs").Preset | null;
    }[];
};
