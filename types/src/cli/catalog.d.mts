/** @param {import("./ratchet.mjs").CliContext} c */
export function profilesCommand(c: import("./ratchet.mjs").CliContext): Promise<void>;
/**
 * `abatty rules`: the catalog on screen, filtered, as JSON for a script or as the markdown the
 * repository commits.
 * @param {import("./ratchet.mjs").CliContext} cx
 */
export function rulesCommand(cx: import("./ratchet.mjs").CliContext): Promise<void>;
/**
 * `abatty explain <ID>`: one rule, its reason, what insures it, and its finding in this
 * repository, which is the screen a reader meets after the gate refuses their push.
 * @param {import("./ratchet.mjs").CliContext} cx @param {string} id
 */
export function explainCommand(cx: import("./ratchet.mjs").CliContext, id: string): Promise<void>;
