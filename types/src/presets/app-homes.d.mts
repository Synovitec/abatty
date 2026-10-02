/**
 * The folders below the root holding the preset's app marker, less the workspaces that have a
 * preset of their own (their suites already run under them).
 * @param {import("./index.mjs").Preset | null} preset @param {string[]} files tracked paths
 * @param {string[]} [gated] the paths of workspaces with a preset
 * @returns {string[]} each with a trailing slash
 */
export function appHomes(preset: import("./index.mjs").Preset | null, files: string[], gated?: string[]): string[];
/**
 * Whether a suite's paths match a file, read from the root or from any of the app's homes.
 * @param {RegExp} paths @param {string} file @param {string[]} homes
 */
export function suiteReads(paths: RegExp, file: string, homes: string[]): boolean;
