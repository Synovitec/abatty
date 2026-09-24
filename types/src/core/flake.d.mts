/**
 * The test files a step's output reports as failing, repository-relative with forward slashes.
 * @param {string} text @returns {string[]}
 */
export function failingTestFiles(text: string): string[];
/**
 * What a failed step says about itself: which failing test files this push touched, which it did
 * not, and which of those have failed untouched before (the count is written here).
 * @param {{ repoDir: string, log: string, changed: string[], head: string }} o
 * @returns {string[]} the lines to print, empty when the output names no test file
 */
export function explainFailure(o: {
    repoDir: string;
    log: string;
    changed: string[];
    head: string;
}): string[];
/** Where the untouched failures are counted, per test file, by the commits they failed on. */
export const FLAKES: ".abatty/flakes.json";
