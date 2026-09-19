/** @typedef {import("./report.mjs").NightReport} NightReport */
/** The report as Markdown, in the shape of the other night documents. @param {NightReport} r */
export function renderNightReport(r: NightReport): string;
export type NightReport = import("./report.mjs").NightReport;
