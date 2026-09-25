/**
 * @typedef {{ metric: string, runs: boolean, reads: number | null, scanned: number, why: string, disputes: number, clean: boolean }} ProbationReading
 *   `runs`: the repository runs it (not opt-in, or enabled). `clean`: it runs, scanned something,
 *   reads 0 and was never disputed here, which is one repository's vote for promotion; a check
 *   with nothing of its kind to read (no documents for a documents check) casts none.
 */
/**
 * Every probe on probation, with its reading here and the disputes recorded against it.
 * @param {string} repoDir @param {Record<string, number>} disputes by metric, from the report
 * @returns {ProbationReading[]}
 */
export function probationReadings(repoDir: string, disputes: Record<string, number>): ProbationReading[];
/**
 * `runs`: the repository runs it (not opt-in, or enabled). `clean`: it runs, scanned something,
 * reads 0 and was never disputed here, which is one repository's vote for promotion; a check
 * with nothing of its kind to read (no documents for a documents check) casts none.
 */
export type ProbationReading = {
    metric: string;
    runs: boolean;
    reads: number | null;
    scanned: number;
    why: string;
    disputes: number;
    clean: boolean;
};
