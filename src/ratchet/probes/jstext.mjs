/**
 * JavaScript functions read from their text, as the boundary probes need them: a function's
 * parameters and body, the arguments of every schema parse, a module's exported functions, a
 * call's arguments, and the two framework conventions that mark a boundary (a route file, a
 * "use server" module). Text, not a parser: a parser is a dependency, and every probe that reads
 * through these says so in its `approximates`. The literals and brackets are `lex.mjs`'s.
 *
 * First written as a repository's own probes during the outside trial of 2026-09-21, and moved
 * here so the next repository on the same stack need not write them again.
 */
import { closeOf } from "./lex.mjs";

/** A route handler's file, under the app router's `app/api`. */
export const ROUTE_FILE = /(^|\/)app\/api\/.*route\.[jt]sx?$/;
/** A module of server actions: the directive on its first statement. */
export const USE_SERVER = /^\s*(['"])use server\1/m;

/** A schema parse: the method call whose argument is read. `JSON.parse` and `Date.parse` are not one. */
const PARSE_CALL = /(?<!JSON|Date)\.(parse|safeParse|parseAsync|safeParseAsync)\(/g;

/** Every way a module exports a function: a declaration, a default, a const arrow or function. */
const EXPORTED_FN =
  /export\s+(?:default\s+)?(?:async\s+)?function\s*(?:\*\s*)?([A-Za-z_$][\w$]*)?\s*\(|export\s+(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?(?:function\s*(?:[A-Za-z_$][\w$]*)?\s*)?\(/g;

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
function paramNames(params) {
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
