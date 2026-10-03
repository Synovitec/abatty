/**
 * The summary in markdown: the headline, then one row per step with what it said.
 * @param {string} headline @param {import("../core/gate.mjs").GateEvent[]} events @returns {string}
 */
export function stepSummary(headline: string, events: import("../core/gate.mjs").GateEvent[]): string;
/**
 * Append the summary where the CI provider reads it, when it names a file.
 * @param {string} headline @param {import("../core/gate.mjs").GateEvent[]} events
 * @param {NodeJS.ProcessEnv} [env]
 */
export function writeStepSummary(headline: string, events: import("../core/gate.mjs").GateEvent[], env?: NodeJS.ProcessEnv): void;
