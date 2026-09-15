/**
 * @typedef {{ dir: string, opt: (name: string) => string, flag: (name: string) => boolean, out: (s: string) => void, err: (s: string) => void, VERSION: string }} CliContext
 */
/** @param {"ratchet" | "baseline" | string} command @param {CliContext} c */
export function ratchetCommand(command: "ratchet" | "baseline" | string, c: CliContext): Promise<void>;
export type CliContext = {
    dir: string;
    opt: (name: string) => string;
    flag: (name: string) => boolean;
    out: (s: string) => void;
    err: (s: string) => void;
    VERSION: string;
};
