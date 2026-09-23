/**
 * Source text read as code rather than as characters: where a comment or a string literal ends,
 * the text with them blanked, where a bracket closes, the line of an index. One definition of a
 * literal serves them all: there were two once, with different ideas of where a quote ends, and
 * an apostrophe in JSX text unbalanced every function body the second one read. A quoted string
 * ends on its line (a quote that does not is JSX text or a regex character); a template literal
 * or a block comment runs on, to the end of the file when nothing closes it.
 */

/** The 1-based line of an index. @param {string} text @param {number} index */
export const lineAt = (text, index) => text.slice(0, index).split("\n").length;

/**
 * The index of the last character of the comment or string literal that starts at `i`, or null
 * when none does. A line comment with no newline after it ends at -1, as `indexOf` says; an
 * unterminated block comment or template at the end of the text.
 * @param {string} text @param {number} i @returns {number | null}
 */
function literalEnd(text, i) {
  const ch = text[i];
  if (ch === "/" && text[i + 1] === "/") return text.indexOf("\n", i);
  if (ch === "/" && text[i + 1] === "*") {
    // Unterminated, it runs to the end: `indexOf` + 1 was 0 there, and the caller started over.
    const close = text.indexOf("*/", i + 2);
    return close < 0 ? text.length : close + 1;
  }
  if (ch !== "'" && ch !== '"' && ch !== "`") return null;
  let j = i + 1;
  for (; j < text.length && text[j] !== ch; j++) {
    if (text[j] === "\\") j++;
    else if (text[j] === "\n" && ch !== "`") return null;
  }
  return j;
}

/**
 * The text with the inside of every string and template literal blanked unless `strings` is
 * "keep", and every comment too unless `comments` is "keep"; lengths and newlines kept, so a line
 * number still points home. A name inside a message or a test fixture is not code, a directive is
 * a comment, and a clone is judged with its literals.
 * @param {string} text @param {{ comments?: "keep" | "blank", strings?: "keep" | "blank" }} [o]
 */
export function codeOnly(text, o = {}) {
  /** @type {string[]} */
  const out = [];
  const blank = (/** @type {string} */ s) => s.replace(/[^\n]/g, " ");
  let i = 0;
  while (i < text.length) {
    let last = literalEnd(text, i);
    if (last === null) {
      out.push(text[i] || "");
      i++;
      continue;
    }
    // Always forward: an unterminated literal runs to the end of the text, never back.
    if (last < 0 || last >= text.length) last = text.length - 1;
    const piece = text.slice(i, last + 1);
    if (text[i] === "/") out.push(o.comments === "keep" ? piece : blank(piece));
    else if (o.strings === "keep") out.push(piece);
    else out.push(piece[0] + blank(piece.slice(1, -1)) + (piece.length > 1 ? piece.slice(-1) : ""));
    i = last + 1;
  }
  return out.join("");
}

/**
 * The index just past the bracket that closes the one at `open`, or -1.
 * @param {string} text @param {number} open @param {string} pair the two brackets, e.g. "()"
 */
export function closeOf(text, open, pair) {
  const [l, r] = pair;
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const skipTo = literalEnd(text, i);
    if (skipTo !== null) i = skipTo;
    else if (text[i] === l) depth++;
    else if (text[i] === r && --depth === 0) return i + 1;
    if (i < 0) return -1;
  }
  return -1;
}
