/**
 * Mark each present finding a gate step backs: proven, contradicted (and dropped to partial) or
 * left unproven. Returns new findings; the input is not changed.
 * @param {Finding[]} findings @param {string} repoDir
 * @param {import("../presets/index.mjs").Preset | null} preset
 * @returns {{ findings: Finding[], truth: Truth }}
 */
export function applyTruth(findings: Finding[], repoDir: string, preset: import("../presets/index.mjs").Preset | null): {
    findings: Finding[];
    truth: Truth;
};
export type Finding = import("../rules/index.mjs").Finding;
export type Truth = {
    proven: number;
    contradicted: number;
    unproven: number;
};
