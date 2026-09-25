/**
 * The test files a step's output reports as failing, repository-relative with forward slashes: an
 * absolute path is made relative to the repository, a relative one is read from the workspace a
 * task runner's prefix names, else from the folder the step ran in (a workspace's step prints
 * paths from its own folder). A replay of 0.7.0-rc.1 on a bun and turbo monorepo went red with no
 * attribution at all: bun's reporter and turbo's prefix were both unread.
 * @param {string} text @param {{ repoDir?: string, cwd?: string }} [o]
 * @returns {string[]}
 */
export function failingTestFiles(text: string, o?: {
    repoDir?: string;
    cwd?: string;
}): string[];
/**
 * What a failed step says about itself: which failing tests this push reaches, which it does not,
 * and which of those have failed unreached before (the count is written here). Nothing is
 * attributed when the push's range is unknown: every file then reads as changed, and an
 * attribution the gate cannot make is not stated as a fact.
 * A test step whose output names no test file says that it could not read one, rather than
 * nothing: silence read as "attribution found nothing to blame".
 * @param {{ repoDir: string, log: string, changed: string[], head: string, cwd?: string, blind?: boolean, tests?: boolean }} o
 * @returns {string[]} the lines to print, empty for a step that is not a test step and names none
 */
export function explainFailure(o: {
    repoDir: string;
    log: string;
    changed: string[];
    head: string;
    cwd?: string;
    blind?: boolean;
    tests?: boolean;
}): string[];
/** Where the unreached failures are counted, per test file, by the commits they failed on. */
export const FLAKES: ".abatty/flakes.json";
