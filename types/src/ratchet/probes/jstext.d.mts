/**
 * The text with the inside of every string and template literal blanked, and every comment too
 * unless `comments` is "keep"; lengths and newlines kept, so a line number still points home. A
 * name inside a message or a test fixture is not code, and a directive is a comment.
 * @param {string} text @param {{ comments?: "keep" | "blank" }} [o]
 */
export function codeOnly(text: string, o?: {
    comments?: "keep" | "blank";
}): string;
/**
 * The index just past the bracket that closes the one at `open`, or -1.
 * @param {string} text @param {number} open @param {string} pair the two brackets, e.g. "()"
 */
export function closeOf(text: string, open: number, pair: string): number;
/** The names a parameter list binds, split on its commas at depth zero. @param {string} params */
export function paramNames(params: string): string[];
/**
 * The parameter names and body of the function whose `(` sits at `paren`, or null.
 * @param {string} text @param {number} paren @returns {{ params: string[], body: string } | null}
 */
export function functionAt(text: string, paren: number): {
    params: string[];
    body: string;
} | null;
/** The argument text of every schema parse call in a body. @param {string} body */
export function parsedArguments(body: string): string[];
/** The parameters no parse call names. @param {string[]} params @param {string} body */
export function unparsedParams(params: string[], body: string): string[];
/** Every exported function of a module: its name and the index of its `(`. @param {string} text */
export function exportedFunctions(text: string): {
    name: string;
    index: number;
    paren: number;
}[];
/**
 * The argument text of the call whose name ends at `m` (the match includes the `(`), or "".
 * @param {string} text @param {RegExpMatchArray} m
 */
export function callArguments(text: string, m: RegExpMatchArray): string;
export function lineAt(text: string, index: number): number;
export function stripComments(text: string): string;
