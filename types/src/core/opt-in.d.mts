/**
 * @typedef {{ metric: string, title: string, reads: number | null, why: string }} OffProbe
 *   `reads`: the findings it would count here, or null when it cannot read this way (a rule
 *   about a push, read without one) or failed to, with `why` saying which.
 */
/**
 * Every opt-in probe of this version the config neither enables nor excludes, with its reading.
 * @param {string} repoDir @returns {OffProbe[]}
 */
export function offProbes(repoDir: string): OffProbe[];
/**
 * What one probe reads in a repository, the way the ratchet would record it: the sum of the
 * weights (a finding weighs one unless it says otherwise; counting findings read an exclude list
 * of nine as one), or null with the reason when the probe cannot read this way or failed to.
 * @param {import("../ratchet/index.mjs").Probe} p @param {import("../rules/context.mjs").RepoContext} ctx
 * @param {import("../ratchet/index.mjs").RatchetConfig} config @returns {OffProbe}
 */
export function readingOf(p: import("../ratchet/index.mjs").Probe, ctx: import("../rules/context.mjs").RepoContext, config: import("../ratchet/index.mjs").RatchetConfig): OffProbe;
/**
 * `reads`: the findings it would count here, or null when it cannot read this way (a rule
 * about a push, read without one) or failed to, with `why` saying which.
 */
export type OffProbe = {
    metric: string;
    title: string;
    reads: number | null;
    why: string;
};
