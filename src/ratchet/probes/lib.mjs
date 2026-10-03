/**
 * What every probe shares: the exempt test, the kind budget of a path, a regex list compiled
 * once, the front matter of a document.
 */
import { TEST_FOLDERS } from "../config.mjs";

/** Compile regex sources once per call site. @param {string[]} sources */
export function regexes(sources) {
  return sources.map((s) => new RegExp(s));
}

/** True when a path matches any of the sources. @param {string} path @param {RegExp[]} list */
export function matchesAny(path, list) {
  return list.some((re) => re.test(path));
}

/**
 * The code-line budget of a path: the first kind whose pattern matches, else the module budget.
 * @param {string} path @param {import("../index.mjs").RatchetConfig} config
 * @returns {{ kind: string, max: number }}
 */
export function budgetOf(path, config) {
  for (const k of config.kinds)
    if (new RegExp(k.match).test(path)) return { kind: k.kind, max: k.max };
  return { kind: "module", max: config.defaultMax };
}

/**
 * The front matter of a Markdown document as a flat map: scalar values as strings, `[...]`
 * lists as arrays of strings, `- item` lists under a key as arrays. Null when the document does
 * not open with `---`.
 * @param {string} text
 * @returns {Record<string, string | string[]> | null}
 */
export function frontMatter(text) {
  // One line ending before anything is read. A file checked out with CRLF on Windows kept its
  // `\r` on the last line of the block, `(.*)$` could not cross it, and the last key of every
  // document was silently dropped: a ratchet red on one operating system only.
  const t = (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text).replace(/\r\n?/g, "\n");
  if (!t.startsWith("---")) return null;
  const end = t.indexOf("\n---", 3);
  if (end < 0) return null;
  const body = t.slice(3, end).split("\n");
  /** @type {Record<string, string | string[]>} */
  const out = {};
  let key = "";
  // A `[...]` list the formatter wrapped: opened on the key's line or on the indented line below
  // an empty key, closed lines later. Read as nothing, a wrapped `source_truth` switched the
  // freshness check off for its document without a word, and Prettier wraps any list past its
  // print width.
  /** @type {string | null} */
  let flow = null;
  for (const line of body) {
    // A key at the margin ends a list that never closed: read as the list's text, it swallowed
    // every key after it, `status` and `source_truth` included. What it held so far is kept.
    if (flow !== null && /^[A-Za-z_][\w-]*:/.test(line))
      [out[key], flow] = [listOf(`${flow}]`), null];
    if (flow !== null) {
      // A comment on a continuation line is not an item, and one after the closing bracket
      // left the list open to the end of the block.
      flow += " " + line.replace(/\s+#.*$/, "").trim();
      if (flow.endsWith("]")) [out[key], flow] = [listOf(flow), null];
      continue;
    }
    const current = out[key];
    const opens = key && /^\s+\[/.test(line) && Array.isArray(current) && !current.length;
    if (opens) {
      flow = line.replace(/\s+#.*$/, "").trim();
      if (flow.endsWith("]")) [out[key], flow] = [listOf(flow), null];
      continue;
    }
    const item = line.match(/^\s+-\s+(.*)$/);
    if (item && key) {
      const prev = out[key];
      out[key] = [...(Array.isArray(prev) ? prev : []), unquote(item[1] || "")];
      continue;
    }
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!kv) continue;
    key = kv[1] || "";
    const raw = (kv[2] || "").replace(/\s+#.*$/, "").trim();
    if (raw.startsWith("[") && raw.endsWith("]")) out[key] = listOf(raw);
    else if (raw.startsWith("[")) [out[key], flow] = [[], raw];
    else out[key] = raw === "" ? [] : unquote(raw);
  }
  return out;
}

/** The items of a `[...]` list, unquoted. @param {string} raw */
function listOf(raw) {
  return raw
    .slice(1, -1)
    .split(",")
    .map((s) => unquote(s.trim()))
    .filter(Boolean);
}

/** @param {string} s */
function unquote(s) {
  return s.replace(/^["']|["']$/g, "");
}

/**
 * A test folder at any depth, read here as well as through the exempt list: a repository with its
 * own list may not name one, and a probe of what ships never reads a test's setup.
 */
const TEST_DIR = new RegExp(TEST_FOLDERS);

/**
 * The JavaScript and TypeScript sources a probe of what ships reads: outside the exempt list and
 * outside test folders at any depth, where a monorepo keeps them (`apps/<app>/tests/`). A test's
 * setup that logs and carries on, or a fixture's random password, is not what a user meets.
 * @param {import("../../rules/context.mjs").RepoContext} c @param {{ config: { exempt: string[] } }} o
 */
export function shippedScripts(c, o) {
  const exempt = regexes(o.config.exempt);
  return c.sourceFiles.filter(
    (f) => /\.[cm]?[jt]sx?$/.test(f) && !TEST_DIR.test(f) && !matchesAny(f, exempt),
  );
}

/** Lines of a text, CRLF or LF. @param {string} text */
export function lines(text) {
  return text.split(/\r?\n/);
}

/** Folders of records written at a point in time: the archive, decisions, sprints, retrospectives. */
const POINT_IN_TIME =
  /(^|\/)_?(archived?s?|adrs?|decisions?|sprints?|retros?|retrospectives?|post-?mortems?)\//i;
/** A file named as an archive: `MODULE-ARCHIVE.md`, `archive-2026.md`. */
const ARCHIVE_NAME = /(^|\/)([^/]*[-_.])?archived?([-_.][^/]*)?\.[a-z]+$/i;
/** The statuses of a decision record once decided. */
const DECIDED = ["accepted", "rejected", "superseded"];

/**
 * Whether a document is a record of the past, which names the code as it was on purpose: by its
 * folder (an archive, decisions, sprints), its file name (an archive), an archived, deprecated or
 * decided status, or a successor named. Read by every probe that holds a document to today's code.
 * @param {string} path @param {any} fm the document's front matter, or null
 */
export function pastRecord(path, fm) {
  const status = String(fm?.status || "").toLowerCase();
  return (
    POINT_IN_TIME.test(path) ||
    ARCHIVE_NAME.test(path) ||
    ["archived", "deprecated", ...DECIDED].includes(status) ||
    Boolean(fm?.superseded_by)
  );
}
