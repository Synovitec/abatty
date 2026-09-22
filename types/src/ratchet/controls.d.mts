/**
 * Remove a fixture, and never let the removal decide anything. The probe has already answered
 * by the time this runs, so a folder that will not go away is a leaked temp directory, not a
 * failed control: throwing from the teardown lost the answer AND masked whatever the block
 * above was reporting, which is how fifteen passing controls became a red suite on the release
 * of 0.3.0. The retries are for a writer that is not us and outlives the command that forked it.
 * @param {string} dir
 */
export function removeFixture(dir: string): void;
/**
 * Run one probe's controls. Each control is a fresh git repository with the files committed,
 * the extra commits applied in order, and the probe measured with the control's config on top
 * of the defaults.
 * @param {import("./index.mjs").Probe} probe
 * @returns {{ name: string, expect: number, got: number, ok: boolean, detail: string }[]}
 */
export function runControls(probe: import("./index.mjs").Probe): {
    name: string;
    expect: number;
    got: number;
    ok: boolean;
    detail: string;
}[];
