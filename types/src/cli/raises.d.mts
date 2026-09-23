/**
 * The floors loosened against the base, judged. Exit 3 when one is loosened and no approval was
 * read, which is always the case without `--require-review`: this machine has no approval to read.
 * @param {import("./ratchet.mjs").CliContext} cx @returns {number}
 */
export function raisesCommand(cx: import("./ratchet.mjs").CliContext): number;
