/** @param {"serve" | "publish" | string} command @param {import("./ratchet.mjs").CliContext} c */
export function hostedCommand(command: "serve" | "publish" | string, c: import("./ratchet.mjs").CliContext): Promise<void>;
