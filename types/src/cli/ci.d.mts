/** The files a provider gets. @param {string} provider @param {import("../presets/index.mjs").Preset} preset @param {import("../ci/generate.mjs").CiOptions} o */
export function ciFilesFor(provider: string, preset: import("../presets/index.mjs").Preset, o: import("../ci/generate.mjs").CiOptions): [string, string][];
/**
 * Write (or check) the CI files of the providers. Returns the events.
 * @param {{ repoDir: string, preset: import("../presets/index.mjs").Preset, providers: string[], base: string, check?: boolean }} o
 */
export function writeCi(o: {
    repoDir: string;
    preset: import("../presets/index.mjs").Preset;
    providers: string[];
    base: string;
    check?: boolean;
}): {
    file: string;
    action: "written" | "in step" | "behind" | "missing";
}[];
/** @param {import("./ratchet.mjs").CliContext & { preset: import("../presets/index.mjs").Preset | null, config: Record<string, any> | null }} c */
export function ciCommand(c: import("./ratchet.mjs").CliContext & {
    preset: import("../presets/index.mjs").Preset | null;
    config: Record<string, any> | null;
}): 0 | 2 | 3;
