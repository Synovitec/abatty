/**
 * @typedef {import("./index.mjs").Baseline} Baseline
 * @typedef {import("./index.mjs").Measurement} Measurement
 * @typedef {import("./index.mjs").RatchetConfig} RatchetConfig
 */
/** The committed baseline, or null. @param {string} repoDir @param {string} rel @returns {Baseline | null} */
export function readBaseline(repoDir: string, rel: string): Baseline | null;
/**
 * Write today's numbers as the floor. A metric at zero is promoted to HARD (a floor of zero and
 * a HARD rule enforce the same thing today and differ in what they tell the next person) unless
 * the config holds it as a ratchet; a HARD metric above zero is refused; a number above the
 * committed floor is refused without a reason, and with one the reason belongs in the progress
 * log. Nothing is written when refused.
 * @param {{ repoDir: string, rel: string, measurements: Measurement[], config: RatchetConfig, previous: Baseline | null, today: string, reason?: string, dryRun?: boolean }} o
 * @returns {{ ok: boolean, baseline: Baseline, refusals: string[], promoted: string[], rises: string[] }}
 */
export function writeBaseline(o: {
    repoDir: string;
    rel: string;
    measurements: Measurement[];
    config: RatchetConfig;
    previous: Baseline | null;
    today: string;
    reason?: string;
    dryRun?: boolean;
}): {
    ok: boolean;
    baseline: Baseline;
    refusals: string[];
    promoted: string[];
    rises: string[];
};
export type Baseline = import("./index.mjs").Baseline;
export type Measurement = import("./index.mjs").Measurement;
export type RatchetConfig = import("./index.mjs").RatchetConfig;
