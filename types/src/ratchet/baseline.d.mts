/**
 * @typedef {import("./index.mjs").Baseline} Baseline
 * @typedef {import("./index.mjs").Measurement} Measurement
 * @typedef {import("./index.mjs").RatchetConfig} RatchetConfig
 * @typedef {import("./index.mjs").BaselineEntry} BaselineEntry
 */
/**
 * The definition a metric is counted under. A probe that changes WHAT it counts bumps this, and
 * the floor written under the old number is then reported rather than compared. 1 is the
 * definition a probe has until somebody says otherwise.
 * @param {{ probe: { version?: number } }} m
 */
export function probeVersion(m: {
    probe: {
        version?: number;
    };
}): number;
/**
 * The committed baseline, or null. Its per-file floors are read where their files are now: a
 * file renamed since the commit that wrote the baseline carries its floor to the new path.
 * @param {string} repoDir @param {string} rel @returns {Baseline | null}
 */
export function readBaseline(repoDir: string, rel: string): Baseline | null;
/**
 * Write today's numbers as the floor. A metric at zero is promoted to HARD (a floor of zero and
 * a HARD rule enforce the same thing today and differ in what they tell the next person) unless
 * the config holds it as a ratchet; a HARD metric above zero is refused; a number above the
 * committed floor is refused without a reason, and with one the reason belongs in the progress
 * log. Nothing is written when refused.
 * @param {{ repoDir: string, rel: string, measurements: Measurement[], config: RatchetConfig, previous: Baseline | null, today: string, reason?: string, owner?: string, dryRun?: boolean }} o
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
    owner?: string;
    dryRun?: boolean;
}): {
    ok: boolean;
    baseline: Baseline;
    refusals: string[];
    promoted: string[];
    rises: string[];
};
/**
 * The floors a change earned, written for it. When every verdict that fails the run is a floor
 * left above today's count (`improved`), the numbers only fell, so writing today's baseline can
 * only lower a floor: nothing is raised, nothing needs a reason. Lowering by hand made "leave the
 * findings in" simpler than "remove them", which is the friction adopters of every ratchet name.
 * The file is written, not committed: a hook cannot add a commit to the push it judges, so the
 * run still fails, with one thing left to do. Anything else failing, and nothing is written.
 * @param {{ repoDir: string, rel: string, verdicts: import("./index.mjs").Verdict[], measurements: Measurement[], config: RatchetConfig, previous: Baseline | null, today: string }} o
 * @returns {{ locked: string[] }}
 */
export function lockEarned(o: {
    repoDir: string;
    rel: string;
    verdicts: import("./index.mjs").Verdict[];
    measurements: Measurement[];
    config: RatchetConfig;
    previous: Baseline | null;
    today: string;
}): {
    locked: string[];
};
export type Baseline = import("./index.mjs").Baseline;
export type Measurement = import("./index.mjs").Measurement;
export type RatchetConfig = import("./index.mjs").RatchetConfig;
export type BaselineEntry = import("./index.mjs").BaselineEntry;
