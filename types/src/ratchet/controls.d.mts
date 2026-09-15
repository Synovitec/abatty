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
