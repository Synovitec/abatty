/**
 * @param {import("./ratchet.mjs").CliContext} cx
 */
export function reportCommand(cx: import("./ratchet.mjs").CliContext): Promise<void>;
/**
 * `abatty attest`: the conformance statement, ready to sign.
 *
 * It prints the statement and nothing else when `--json`, so a pipeline can pipe it straight
 * into whatever signs and stores it: this package does not sign, because the signing ecosystem
 * and the identity that backs a signature belong to the pipeline, not to a measurement tool that
 * would have to be trusted with a key.
 * @param {import("./ratchet.mjs").CliContext} cx
 */
export function attestCommand(cx: import("./ratchet.mjs").CliContext): Promise<0 | 3>;
/**
 * @param {import("./ratchet.mjs").CliContext} cx @param {string[]} [positional] the repositories named on the command line
 */
export function dashboardCommand(cx: import("./ratchet.mjs").CliContext, positional?: string[]): Promise<void>;
