/**
 * The text with the inside of every string and template literal blanked unless `strings` is
 * "keep", and every comment too unless `comments` is "keep"; lengths and newlines kept, so a line
 * number still points home. A name inside a message or a test fixture is not code, a directive is
 * a comment, and a clone is judged with its literals.
 * @param {string} text @param {{ comments?: "keep" | "blank", strings?: "keep" | "blank" }} [o]
 */
export function codeOnly(text: string, o?: {
    comments?: "keep" | "blank";
    strings?: "keep" | "blank";
}): string;
/**
 * The index just past the bracket that closes the one at `open`, or -1.
 * @param {string} text @param {number} open @param {string} pair the two brackets, e.g. "()"
 */
export function closeOf(text: string, open: number, pair: string): number;
export function lineAt(text: string, index: number): number;
