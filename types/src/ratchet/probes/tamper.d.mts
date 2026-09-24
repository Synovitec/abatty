/**
 * Every way out the commits of a range took, one finding per file and kind. Exported for the
 * night report, which reads the night branch the same way the ratchet reads a push.
 * @param {(...args: string[]) => string} git @param {string} range
 */
export function tamperIn(git: (...args: string[]) => string, range: string): {
    scanned: number;
    findings: {
        path: string;
        line: number;
        detail: string;
    }[];
};
/** @type {Probe[]} */
export const probes: Probe[];
export type Probe = import("../index.mjs").Probe;
