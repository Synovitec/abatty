/**
 * The executable bit on a file git must be able to run. git skips a hook that is not executable
 * and says so only as a hint, so a pre-push hook written 644 means the gate never runs and a red
 * push looks like a green one. Windows carries the bit in the index rather than the filesystem;
 * `git update-index --chmod=+x` is what records it there, and a failure is not fatal here because
 * the file may not be tracked yet.
 *
 * Returns true when git will commit the bit on its own, false when the file is untracked on a
 * filesystem without modes (Windows, core.filemode false): there `git add` does not read the bit
 * from disk and the hook would be committed 644 and skipped on every other machine. The file is
 * NOT staged here to fix that, as it once was: in a repository several sessions share, the next
 * commit of any of them swept the staged hooks in. The caller says how to commit it instead.
 * @param {string} target @returns {boolean}
 */
export function makeExecutable(target: string): boolean;
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
