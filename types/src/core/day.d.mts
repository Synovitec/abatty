/**
 * The rows, before and now. A higher number is better for the score, the phase, the share held
 * by a machine, the present and proven counts; lower is better for the rest.
 * @param {Report} now @param {Report | null} before @returns {DayRow[]}
 */
export function dayRows(now: Report, before: Report | null): DayRow[];
/**
 * The checks whose status moved between the two readings, worse first.
 * @param {Report} now @param {Report | null} before @returns {Moved[]}
 */
export function movedFindings(now: Report, before: Report | null): Moved[];
/**
 * The reading to compare today's with: the newest dated one before today's date, or null.
 * @param {Report[]} all oldest first @param {string} today
 */
export function previousReading(all: Report[], today: string): import("./report.mjs").Report | null;
export type Report = import("./report.mjs").Report;
export type DayRow = {
    label: string;
    before: string;
    now: string;
    change: "better" | "worse" | "same" | "new";
};
export type Moved = {
    id: string;
    from: string;
    to: string;
    better: boolean;
};
