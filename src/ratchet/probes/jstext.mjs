/**
 * The JavaScript source readings the boundary probes share: where a bracket closes, a
 * function's parameters and body, the arguments of every schema parse, a module's exported
 * functions. Text, not a parser: a parser is a dependency, and every probe that reads through
 * these says so in its `approximates`. Strings, template literals and comments are skipped when
 * brackets are counted, so a brace in a message does not unbalance a body.
 *
 * First written as a repository's own probes during the outside trial of 2026-09-21, and moved
 * here so the next repository on the same stack need not write them again.
 */

/** A schema parse: the method call whose argument is read. `JSON.parse` and `Date.parse` are not one. */
const PARSE_CALL = /(?<!JSON|Date)\.(parse|safeParse|parseAsync|safeParseAsync)\(/g;

/** Every way a module exports a function: a declaration, a default, a const arrow or function. */
const EXPORTED_FN =
  /export\s+(?:default\s+)?(?:async\s+)?function\s*(?:\*\s*)?([A-Za-z_$][\w$]*)?\s*\(|export\s+(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?(?:function\s*(?:[A-Za-z_$][\w$]*)?\s*)?\(/g;

/** The 1-based line of an index. @param {string} text @param {number} index */
export const lineAt = (text, index) => text.slice(0, index).split("\n").length;

/** Comments blanked to spaces, line numbers kept: a comment is not code. @param {string} text */
export const stripComments = (text) =>
  text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");

/**
 * The index of the last character of the comment or string that starts at `i`, or null when none
 * does. A line comment with no newline after it ends at -1, as `indexOf` says.
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
    // A quoted string ends on its line; a quote that does not is an apostrophe in JSX text or a
    // character of a regex literal, and reading it as a string unbalanced every body after it.
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
    const ch = text[i] || "";
    const next = text[i + 1];
    // Each literal's end is found by a bounded search that always moves forward: an unterminated
    // comment or template runs to the end of the file, never back to its start.
    let end = -1;
    let comment = false;
    if (ch === "/" && next === "/") {
      end = text.indexOf("\n", i);
      comment = true;
    } else if (ch === "/" && next === "*") {
      const close = text.indexOf("*/", i + 2);
      end = close < 0 ? text.length : close + 2;
      comment = true;
    } else if (ch === "'" || ch === '"' || ch === "`") {
      // A quoted string ends on its line; a quote that does not is a character of a regex
      // literal, and reading it as a string would blank the rest of the file.
      let j = i + 1;
      while (j < text.length && text[j] !== ch && (ch === "`" || text[j] !== "\n"))
        j += text[j] === "\\" ? 2 : 1;
      if (text[j] === ch) end = j + 1;
      else if (ch === "`") end = text.length;
    }
    if (end < 0 && !comment) {
      out.push(ch);
      i++;
      continue;
    }
    const stop = end < 0 ? text.length : end;
    const piece = text.slice(i, stop);
    if (comment) out.push(o.comments === "keep" ? piece : blank(piece));
    else if (o.strings === "keep") out.push(piece);
    else out.push(ch + blank(piece.slice(1, -1)) + (piece.length > 1 ? piece.slice(-1) : ""));
    i = stop;
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

/**
 * Where a body starts after a parameter list: past a return type (whose angle brackets may hold
 * braces) and past `=>`. A `{` opens a block; anything else after `=>` is an expression body,
 * read to the end of its line. Null at a `;`.
 * @param {string} text @param {number} from @returns {{ at: number, block: boolean } | null}
 */
function bodyStart(text, from) {
  let angle = 0;
  for (let i = from; i < text.length; i++) {
    const ch = text[i];
    if (ch === "<") angle++;
    else if (ch === ">" && text[i - 1] !== "=") angle--;
    else if (ch === "{" && angle === 0) return { at: i, block: true };
    else if (ch === ">" && text[i - 1] === "=" && angle === 0) {
      const rest = (text.slice(i + 1).match(/^\s*/)?.[0] || "").length;
      if (text[i + 1 + rest] !== "{") return { at: i + 1 + rest, block: false };
    } else if (ch === ";") return null;
  }
  return null;
}

/** What a bracket does to the depth of a parameter list; a type's angle brackets count too. */
const DEPTH = /** @type {Record<string, number>} */ ({
  "{": 1,
  "(": 1,
  "[": 1,
  "<": 1,
  "}": -1,
  ")": -1,
  "]": -1,
  ">": -1,
});

/**
 * The names one parameter binds: `a: T`, `b = 1`, `...rest`, and every member of a destructured
 * `{ params: p, x }` or `[a, b]` (the bound name, not the key).
 * @param {string} part @returns {string[]}
 */
function boundNames(part) {
  if (!part.startsWith("{") && !part.startsWith("[")) {
    const m = part.match(/^(?:\.\.\.)?([A-Za-z_$][\w$]*)/);
    return m?.[1] ? [m[1]] : [];
  }
  const inner = part.slice(1, part.lastIndexOf(part[0] === "{" ? "}" : "]"));
  return inner
    .split(",")
    .map(
      (member) =>
        member.trim().match(/^(?:\.\.\.)?(?:[A-Za-z_$][\w$]*\s*:\s*)?([A-Za-z_$][\w$]*)/)?.[1],
    )
    .filter((n) => typeof n === "string");
}

/** The names a parameter list binds, split on its commas at depth zero. @param {string} params */
export function paramNames(params) {
  /** @type {string[]} */
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i <= params.length; i++) {
    const ch = params[i] || "";
    depth += DEPTH[ch] ?? 0;
    if ((ch === "," && depth === 0) || i === params.length) {
      parts.push(params.slice(start, i).trim());
      start = i + 1;
    }
  }
  return parts.filter(Boolean).flatMap(boundNames);
}

/**
 * The parameter names and body of the function whose `(` sits at `paren`, or null.
 * @param {string} text @param {number} paren @returns {{ params: string[], body: string } | null}
 */
export function functionAt(text, paren) {
  const paramsEnd = closeOf(text, paren, "()");
  if (paramsEnd < 0) return null;
  const start = bodyStart(text, paramsEnd);
  if (!start) return null;
  const bodyEnd = start.block ? closeOf(text, start.at, "{}") : text.indexOf("\n", start.at);
  if (bodyEnd < 0) return null;
  return {
    params: paramNames(text.slice(paren + 1, paramsEnd - 1)),
    body: text.slice(start.at, bodyEnd),
  };
}

/** The argument text of every schema parse call in a body. @param {string} body */
export function parsedArguments(body) {
  /** @type {string[]} */
  const args = [];
  for (const m of body.matchAll(PARSE_CALL)) {
    const open = (m.index ?? 0) + m[0].length - 1;
    const end = closeOf(body, open, "()");
    if (end > 0) args.push(body.slice(open + 1, end - 1));
  }
  return args;
}

/** The parameters no parse call names. @param {string[]} params @param {string} body */
export function unparsedParams(params, body) {
  const args = parsedArguments(body);
  return params.filter(
    (p) => !args.some((a) => new RegExp(`\\b${p.replace(/\$/g, "\\$")}\\b`).test(a)),
  );
}

/** Every exported function of a module: its name and the index of its `(`. @param {string} text */
export function exportedFunctions(text) {
  return [...text.matchAll(EXPORTED_FN)].map((m) => ({
    name: m[1] || m[2] || "default",
    index: m.index ?? 0,
    paren: (m.index ?? 0) + m[0].length - 1,
  }));
}

/**
 * The argument text of the call whose name ends at `m` (the match includes the `(`), or "".
 * @param {string} text @param {RegExpMatchArray} m
 */
export function callArguments(text, m) {
  const open = (m.index ?? 0) + m[0].length - 1;
  const end = closeOf(text, open, "()");
  return end > 0 ? text.slice(open, end) : "";
}
