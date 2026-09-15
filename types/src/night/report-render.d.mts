/**
 * The night report as Markdown, in the shape of the other night documents: front matter, the
 * sessions, the Stop gate, the guard, the phases and decisions, the proposed lessons.
 */
/** @typedef {import("./report.mjs").NightReport} NightReport */
/** The report as Markdown, in the shape of the other night documents. @param {NightReport} r */
export function renderNightReport(r: NightReport): string;
export type NightReport = import("./report.mjs").NightReport;
