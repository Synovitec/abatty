/**
 * Measure the repository (its full catalog: built-in rules, its own, its waivers) and assemble
 * the report. Writes it under .abatty/reports/ unless `write` is false.
 * @param {string} repoDir @param {{ write?: boolean, abattyVersion?: string }} [o]
 */
export function buildReport(repoDir: string, o?: {
    write?: boolean;
    abattyVersion?: string;
}): Promise<Report>;
/** The newest report on disk, or null. @param {string} repoDir @returns {Report | null} */
export function latestReport(repoDir: string): Report | null;
/** Every dated report on disk, oldest first. @param {string} repoDir @returns {Report[]} */
export function allReports(repoDir: string): Report[];
/**
 * @typedef {{
 *   version: 1,
 *   abatty: string,
 *   repo: string, name: string, date: string, at: string, branch: string, commit: string,
 *   score: number, applicable: number, waived: number,
 *   enforced: import("./gap-analysis.mjs").Enforced,
 *   families: { name: string, present: number, partial: number, missing: number, na: number, waived: number }[],
 *   findings: import("../rules/index.mjs").Finding[],
 *   problems: string[],
 *   harness: { present: boolean, drift: number, missing: number },
 *   scrub: { enabled: boolean, lines: number },
 *   night: { state: unknown | null, decisions: number, lastReport: string | null, lastRun: unknown | null },
 * }} Report
 */
export const REPORT_DIR: string;
export type Report = {
    version: 1;
    abatty: string;
    repo: string;
    name: string;
    date: string;
    at: string;
    branch: string;
    commit: string;
    score: number;
    applicable: number;
    waived: number;
    enforced: import("./gap-analysis.mjs").Enforced;
    families: {
        name: string;
        present: number;
        partial: number;
        missing: number;
        na: number;
        waived: number;
    }[];
    findings: import("../rules/index.mjs").Finding[];
    problems: string[];
    harness: {
        present: boolean;
        drift: number;
        missing: number;
    };
    scrub: {
        enabled: boolean;
        lines: number;
    };
    night: {
        state: unknown | null;
        decisions: number;
        lastReport: string | null;
        lastRun: unknown | null;
    };
};
