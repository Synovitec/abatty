/** The files a provider gets. @param {string} provider @param {import("../presets/index.mjs").Preset} preset @param {import("../ci/generate.mjs").CiOptions} o */
export function ciFilesFor(provider: string, preset: import("../presets/index.mjs").Preset, o: import("../ci/generate.mjs").CiOptions): [string, string][];
/**
 * Write (or check) the CI files of the providers. Returns the events. A file this package did
 * not write is never overwritten: a hand-kept pipeline carries the repository's env, pins and
 * services, and one that runs the gate is the gate in CI whatever else it says.
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
    action: CiAction;
    detail?: string;
}[];
/** @param {import("./ratchet.mjs").CliContext & { preset: import("../presets/index.mjs").Preset | null, config: Record<string, any> | null }} c */
export function ciCommand(c: import("./ratchet.mjs").CliContext & {
    preset: import("../presets/index.mjs").Preset | null;
    config: Record<string, any> | null;
}): 0 | 2 | 3;
/**
 * `kept`: a file this package did not write, left as it is, with the generated one beside it as
 * `.abatty-new` where it adds something; `runs gate` and `not gate` judge a hand-kept pipeline
 * by what it runs rather than by its text.
 */
export type CiAction = "written" | "in step" | "behind" | "missing" | "kept" | "runs gate" | "not gate";
