/**
 * The suites of a preset this repository has the script for and the gate can never select.
 * @param {string} repoDir @param {import("../presets/index.mjs").Preset | null} preset
 * @returns {{ name: string, script: string }[]}
 */
export function unreachableSuites(repoDir: string, preset: import("../presets/index.mjs").Preset | null): {
    name: string;
    script: string;
}[];
