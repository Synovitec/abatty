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
 * `reads`: the findings it would count here, or null when it cannot read this way (a rule
 * about a push, read without one) or failed to, with `why` saying which.
 */
export type OffProbe = {
    metric: string;
    title: string;
    reads: number | null;
    why: string;
};
