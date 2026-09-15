/**
 * The lessons a night's facts propose. Each heuristic fires on a recurrence (twice or more) or
 * on a fact that is a lesson by itself (a crash, twenty denials, a loosening refused).
 * @param {NightReport} f
 * @returns {Lesson[]}
 */
export function distil(f: NightReport): Lesson[];
export type NightReport = import("./report.mjs").NightReport;
export type Lesson = import("./report.mjs").Lesson;
export type BlockFact = import("./report.mjs").BlockFact;
export type DenialFact = import("./report.mjs").DenialFact;
