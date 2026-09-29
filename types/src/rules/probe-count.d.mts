/**
 * The findings of one of the code probes over the repository, with the ratchet's configuration
 * (its exempt list, its env module) resolved from the repository's own.
 * @param {import("./context.mjs").RepoContext} c @param {string} metric
 * @returns {{ findings: { path: string, line?: number, detail?: string }[], config: import("../ratchet/index.mjs").RatchetConfig }}
 */
export function probeFindings(c: import("./context.mjs").RepoContext, metric: string): {
    findings: {
        path: string;
        line?: number;
        detail?: string;
    }[];
    config: import("../ratchet/index.mjs").RatchetConfig;
};
