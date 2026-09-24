/**
 * The mutant of one line: the first operator whose match lies in the line's code, not in a string
 * or a comment, applied at that place. Null when the line carries none.
 * @param {string} line the line as written @param {string} code the same line, strings and comments blanked
 * @returns {{ text: string, operator: string } | null}
 */
export function mutantOf(line: string, code: string): {
    text: string;
    operator: string;
} | null;
/**
 * The lines each shipped source file gained since `base`, the working tree and new untracked
 * files included. The diff is limited to scripts and read with a large buffer: a diff over the
 * default one was read as empty, and a branch full of changes reported no mutant. A file header
 * is only read as one between `diff --git` and the first hunk, so a removed line that starts
 * with `-- ` is never taken for a path.
 * @param {string} repoDir @param {string} base
 * @returns {Map<string, number[]>}
 */
export function changedLines(repoDir: string, base: string): Map<string, number[]>;
/**
 * The tests that can notice a change to a module: the nearest ring of test files on the import
 * graph, the ones importing it or else the ones importing an importer, and so on. A probe is
 * reached through the registry that lists it, never by name, so a test that runs every probe's
 * controls is the probe's test; the word match that stood alone ran a test naming `refs` against
 * the refs probe and read three killable mutants as survived. The word match is kept for what a
 * relative import cannot reach. A module neither finds has no test to run, and says so.
 * @param {string} repoDir @param {string} file
 */
export function testsFor(repoDir: string, file: string): string[];
/**
 * Put back a file a run was killed before restoring: the recovery file holds its original.
 * @param {string} repoDir @returns {string} the path restored, or ""
 */
export function restoreInterrupted(repoDir: string): string;
/**
 * @typedef {{ file: string, line: number, operator: string, outcome: "killed" | "survived" | "no test" | "timeout" | "tests red" }} Mutant
 * @typedef {{ mutants: Mutant[], interrupted: boolean, restored: string }} MutationRun
 */
/**
 * Plant each mutant, run the nearest tests, put the file back, whatever happened. A file's tests
 * run once unmutated first: a suite already red, or a command that cannot run, would read every
 * mutant as killed, so that file is reported as `tests red` and none of its mutants is judged.
 * A timeout under a shell ends the shell; on Windows the test process it started can outlive it.
 * @param {{ repoDir: string, base: string, command: string, max: number, timeoutMs: number, log?: (s: string) => void }} o
 * `command` runs the tests, with `{files}` where the test files go (`node --test {files}`).
 * @returns {MutationRun}
 */
export function runMutants(o: {
    repoDir: string;
    base: string;
    command: string;
    max: number;
    timeoutMs: number;
    log?: (s: string) => void;
}): MutationRun;
export type Mutant = {
    file: string;
    line: number;
    operator: string;
    outcome: "killed" | "survived" | "no test" | "timeout" | "tests red";
};
export type MutationRun = {
    mutants: Mutant[];
    interrupted: boolean;
    restored: string;
};
