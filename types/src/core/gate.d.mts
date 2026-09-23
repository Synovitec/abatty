/**
 * Run the gate. Returns the events and whether it passed; the first failing step ends it.
 * @param {GateOptions} o
 */
export function runGate(o: GateOptions): {
    ok: boolean;
    events: GateEvent[];
    range: string;
    blind: boolean;
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
export type AuditRunner = (cmd: string, args: string[]) => {
    status: number | null;
    output: string;
};
export type GateOptions = {
    repoDir: string;
    preset: import("../presets/index.mjs").Preset;
    fast?: boolean;
    range?: string;
    base?: string;
    ci?: boolean;
    run?: (repoDir: string, script: string, extraArgs?: string[], env?: Record<string, string>) => RunResult | number;
    audit?: AuditRunner;
    dockerUp?: () => boolean;
    db?: {
        url: string;
        test: string;
    };
    log?: (line: string) => void;
    workspaces?: {
        path: string;
        preset: import("../presets/index.mjs").Preset | null;
    }[];
};
