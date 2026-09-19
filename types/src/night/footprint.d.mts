/**
 * The harness's footprint in a repository: the bytes per part, the total, and an estimated token
 * count. `estimated: true` is on the object rather than in a comment, so a caller that prints it
 * cannot print it as a measurement.
 * @param {string} repoDir
 * @returns {{ estimated: true, bytesPerToken: number, bytes: number, tokens: number, parts: { part: string, bytes: number, tokens: number }[] }}
 */
export function harnessFootprint(repoDir: string): {
    estimated: true;
    bytesPerToken: number;
    bytes: number;
    tokens: number;
    parts: {
        part: string;
        bytes: number;
        tokens: number;
    }[];
};
/**
 * The footprint against what a night actually spent: the share of the run's tokens that went on
 * carrying the harness rather than on doing the work. A night of many short sessions pays it
 * many times, which is the thing worth seeing.
 * @param {ReturnType<typeof harnessFootprint>} f
 * @param {{ sessions: number, tokens: number }} spent
 */
export function footprintShare(f: ReturnType<typeof harnessFootprint>, spent: {
    sessions: number;
    tokens: number;
}): {
    perSession: number;
    sessions: number;
    carried: number;
    share: number | null;
};
/** One line for a reader. @param {ReturnType<typeof harnessFootprint>} f @param {ReturnType<typeof footprintShare>} [s] */
export function describeFootprint(f: ReturnType<typeof harnessFootprint>, s?: ReturnType<typeof footprintShare>): string;
/**
 * Bytes per token, across the current generation of models on English prose with code in it.
 * Deliberately a single round number rather than a per-model table: a table would imply a
 * precision this estimate does not have, and would go stale on its own.
 */
export const BYTES_PER_TOKEN: 4;
