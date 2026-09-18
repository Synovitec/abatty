/**
 * @param {object} o
 * @param {string} o.repoDir
 * @param {import("../presets/index.mjs").Preset} o.preset
 * @param {boolean} [o.force]
 * @param {boolean} [o.dryRun]
 * @param {string[]} [o.agents] the adapters to write for (the config's `agents` when absent)
 * @param {string[]} [o.ci] the CI providers to generate for (the config's `ci.providers` when absent)
 * @param {string} [o.stage] the stage to record in the config (design, build, run)
 * @param {{ path: string, preset: import("../presets/index.mjs").Preset | null }[]} [o.workspaces] the workspaces with a preset: each gets its preset's scripts in its own package.json
 */
export function initRepo(o: {
    repoDir: string;
    preset: import("../presets/index.mjs").Preset;
    force?: boolean | undefined;
    dryRun?: boolean | undefined;
    agents?: string[] | undefined;
    ci?: string[] | undefined;
    stage?: string | undefined;
    workspaces?: {
        path: string;
        preset: import("../presets/index.mjs").Preset | null;
    }[] | undefined;
}): {
    events: InitEvent[];
    missingDeps: string[];
    preset: import("../presets/index.mjs").Preset;
};
export const TEMPLATES: string;
export type InitEvent = {
    file: string;
    action: "written" | "kept" | "overwritten" | "merged" | "n/a";
    detail?: string;
};
