/**
 * The files each fixing commit touched, and how many commits touched each file at all.
 * @param {(...args: string[]) => string} git
 * @param {string} range "" for the whole history
 * @returns {{ fixed: Map<string, number>, churn: Map<string, number>, commits: number, fixes: number }}
 */
export function fixHistory(git: (...args: string[]) => string, range: string): {
    fixed: Map<string, number>;
    churn: Map<string, number>;
    commits: number;
    fixes: number;
};
/**
 * One probe against the history: of the files it reports today, how many were ever touched by a
 * fixing commit, against the same rate among the files it does not report.
 * @param {{ metric: string, findings: { path: string }[], scanned: string[] }} probe
 * @param {ReturnType<typeof fixHistory>} history
 */
export function probeAgainstHistory(probe: {
    metric: string;
    findings: {
        path: string;
    }[];
    scanned: string[];
}, history: ReturnType<typeof fixHistory>): {
    metric: string;
    violating: {
        files: number;
        everFixed: number;
        rate: number;
        churn: number;
    };
    clean: {
        files: number;
        everFixed: number;
        rate: number;
        churn: number;
    };
    lift: number | null;
    verdict: string;
};
/** Below this many files on either side, a rate is noise and is reported as noise. */
export const SAMPLE_FLOOR: 8;
/** The caveats, carried with the numbers so they cannot be quoted without them. */
export const CAVEATS: string[];
