/**
 * @param {import("./ratchet.mjs").CliContext} cx
 */
export function reportCommand(cx: import("./ratchet.mjs").CliContext): Promise<void>;
/**
 * @param {import("./ratchet.mjs").CliContext} cx @param {string[]} [positional] the repositories named on the command line
 */
export function dashboardCommand(cx: import("./ratchet.mjs").CliContext, positional?: string[]): Promise<void>;
