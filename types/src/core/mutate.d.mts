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
 * The lines each shipped source file gained since `base`, working tree included.
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
 * @typedef {{ file: string, line: number, operator: string, outcome: "killed" | "survived" | "no test" | "timeout" }} Mutant
 */
/**
 * Plant each mutant, run the tests that name its module, put the file back, whatever happened.
 * @param {{ repoDir: string, base: string, command: string, max: number, timeoutMs: number, log?: (s: string) => void }} o
 * `command` runs the tests, with `{files}` where the test files go (`node --test {files}`).
 * @returns {Mutant[]}
 */
export function runMutants(o: {
    repoDir: string;
    base: string;
    command: string;
    max: number;
    timeoutMs: number;
    log?: (s: string) => void;
}): Mutant[];
export type Mutant = {
    file: string;
    line: number;
    operator: string;
    outcome: "killed" | "survived" | "no test" | "timeout";
};
