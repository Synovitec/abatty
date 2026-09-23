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
/** A route handler's file, under the app router's `app/api`. */
export const ROUTE_FILE: RegExp;
/** A module of server actions: the directive on its first statement. */
export const USE_SERVER: RegExp;
