/**
 * @param {import("./ratchet.mjs").CliContext} cx @param {import("../presets/index.mjs").Preset} preset
 */
export function initCommand(cx: import("./ratchet.mjs").CliContext, preset: import("../presets/index.mjs").Preset): Promise<void>;
/**
 * @param {import("./ratchet.mjs").CliContext} cx @param {import("../presets/index.mjs").Preset | null} preset
 */
export function updateCommand(cx: import("./ratchet.mjs").CliContext, preset: import("../presets/index.mjs").Preset | null): Promise<void>;
