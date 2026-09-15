/**
 * Delivery (standard CHANGE-1): over the pushed range, every commit that touches source is
 * followed or accompanied by a changelog touch. A rule about commits, so it reads the range
 * alone, never the tree; with no range there is nothing to judge and the probe says so.
 */
/** @type {import("../index.mjs").Probe[]} */
export const probes: import("../index.mjs").Probe[];
