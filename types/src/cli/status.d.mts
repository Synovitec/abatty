/**
 * @param {import("./ratchet.mjs").CliContext} c
 * @param {import("../presets/index.mjs").Preset | null} preset the repository's root preset, or none
 */
export function statusCommand(c: import("./ratchet.mjs").CliContext, preset: import("../presets/index.mjs").Preset | null): Promise<void>;
/**
 * The enforced share for a screen: how much of what the repository has is held by a machine.
 * @param {import("../core/gap-analysis.mjs").Enforced | undefined} e
 */
export function enforcedLine(e: import("../core/gap-analysis.mjs").Enforced | undefined): string;
export function nextSteps(r: import("../core/report.mjs").Report, n: number): import("../rules/index.mjs").Finding[];
