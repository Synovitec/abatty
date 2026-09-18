/**
 * @param {import("./ratchet.mjs").CliContext} c
 * @param {import("../presets/index.mjs").Preset | null} preset the repository's root preset, or none
 */
export function statusCommand(c: import("./ratchet.mjs").CliContext, preset: import("../presets/index.mjs").Preset | null): Promise<void>;
/**
 * The enforced share for a screen: how much of what the repository has is held by a machine.
 * @param {import("../core/gap-analysis.mjs").Enforced | undefined} e
 */
export function enforcedLine(e: import("../core/gap-analysis.mjs").Enforced | undefined): string;
/**
 * The headline: the phase the repository is ON and its standing, which is the number a reader
 * can act on this week. The score over the whole catalog follows as a trend, labelled as one.
 *
 * A fresh application is missing the later phases by design - of the rules one was missing on
 * 2026-09-18, six were phase 0 and seventeen were phases the plan puts after it - so a
 * percentage that counts them reads as a verdict on work nobody was asked to do yet, and the
 * first impression a stranger gets is a failure they did not earn.
 * @param {{ phase: { id: string, title: string, held: number, applicable: number } | null, score: number, applicable: number }} r
 */
export function phaseLine(r: {
    phase: {
        id: string;
        title: string;
        held: number;
        applicable: number;
    } | null;
    score: number;
    applicable: number;
}): string;
export function nextSteps(r: import("../core/report.mjs").Report, n: number): import("../rules/index.mjs").Finding[];
