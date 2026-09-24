/**
 * A caught error whose only handling is a console line (standard OBS.1). An adopter's components
 * caught a failed save, wrote it to the console and went on: the user saw a form that looked
 * saved, the error tracker saw nothing, and no metric counted it, because a console call is not
 * an empty catch. Opt-in, like every probe that reads one family of languages.
 */
import { closeOf, codeOnly, lineAt } from "./lex.mjs";
import { shippedScripts } from "./lib.mjs";

const TRY_CATCH = /\bcatch\s*(?:\([^()]*\)\s*)?\{/g;
const PROMISE_CATCH = /\.catch\s*\(/g;
const CONSOLE = /\bconsole\.\w+\s*\(/g;
const ARROW = /^(?:async\s*)?(?:\([^()]*\)|[\w$]+)\s*(?::[^=]*)?=>\s*([\s\S]*)$/;
const FUNCTION = /^(?:async\s+)?function\s*[\w$]*\s*\([^()]*\)\s*\{([\s\S]*)\}$/;

/**
 * True when a handler body does nothing but console calls, at least one of them.
 * @param {string} body code with strings and comments blanked
 */
function onlyLogs(body) {
  let rest = body;
  let calls = 0;
  for (let m = CONSOLE.exec(rest); m; m = CONSOLE.exec(rest)) {
    const end = closeOf(rest, m.index + m[0].length - 1, "()");
    if (end < 0) return false;
    rest = rest.slice(0, m.index) + rest.slice(end).replace(/^\s*;/, "");
    CONSOLE.lastIndex = m.index;
    calls++;
  }
  CONSOLE.lastIndex = 0;
  return calls > 0 && /^[\s;]*$/.test(rest);
}

/**
 * The body of a `.catch(...)` argument when it is a handler this probe can read, else null.
 * @param {string} arg
 */
function handlerBody(arg) {
  if (/^console\.\w+$/.test(arg)) return "console.log()";
  const fn = FUNCTION.exec(arg);
  if (fn) return fn[1] || "";
  const arrow = ARROW.exec(arg);
  if (!arrow) return null;
  const rest = (arrow[1] || "").trim();
  return rest.startsWith("{") && rest.endsWith("}") ? rest.slice(1, -1) : rest;
}

/** @type {import("../index.mjs").Probe[]} */
export const probes = [
  {
    metric: "obs.catchOnlyLogs",
    kind: "ratchet",
    optIn: true,
    probation: true,
    standard: ["OBS.1"],
    title: "Caught errors whose only handling is a console line",
    why: "A catch that writes to the console and carries on turns a failure into a success the user believes: the form looks saved, the error tracker receives nothing, and the console is read by nobody in production. Handle it (a state the user sees, a fallback, a retry), rethrow it, or report it through the logger the error tracker reads.",
    approximates:
      "stands in for knowing what a failure costs: a `catch` block, or a `.catch()` handler, whose every statement is a `console.*` call, in JavaScript and TypeScript sources, comments and strings left out; a catch that also sets state, returns or rethrows is not counted, even when what it does is not enough",
    emptyScanOk: true,
    scan: (c, o) => {
      const files = shippedScripts(c, o);
      const findings = [];
      for (const f of files) {
        const code = codeOnly(c.read(f));
        for (const m of code.matchAll(TRY_CATCH)) {
          const open = (m.index ?? 0) + m[0].length - 1;
          const end = closeOf(code, open, "{}");
          if (end > 0 && onlyLogs(code.slice(open + 1, end - 1)))
            findings.push({
              path: f,
              line: lineAt(code, m.index ?? 0),
              detail: "a catch that only logs",
            });
        }
        for (const m of code.matchAll(PROMISE_CATCH)) {
          const open = (m.index ?? 0) + m[0].length - 1;
          const end = closeOf(code, open, "()");
          const body = end > 0 ? handlerBody(code.slice(open + 1, end - 1).trim()) : null;
          if (body !== null && onlyLogs(body))
            findings.push({
              path: f,
              line: lineAt(code, m.index ?? 0),
              detail: "a .catch() that only logs",
            });
        }
      }
      return { scanned: files.length, findings };
    },
    controls: [
      {
        name: "a try/catch, a .catch(console.error) and an arrow handler that only log",
        files: {
          "src/save.ts": [
            "export async function save(api) {",
            "  try {",
            "    await api.put();",
            "  } catch (e) {",
            '    console.error("save failed", e);',
            "  }",
            "}",
            "export const load = (api) => api.get().catch(console.error);",
            "export const sync = (api) => api.post().catch((e) => { console.warn(e); });",
            "",
          ].join("\n"),
        },
        expect: 3,
      },
      {
        name: "a catch that rethrows, sets state or returns, and one written in a string or a comment",
        files: {
          "src/save.ts": [
            "export async function save(api, setError) {",
            "  try { await api.put(); } catch (e) { console.error(e); throw e; }",
            "  try { await api.put(); } catch (e) { console.error(e); setError(e); }",
            "  const r = await api.get().catch((e) => { console.error(e); return null; });",
            '  const note = "try {} catch (e) { console.log(e) }";',
            "  // .catch(console.error) is what this file never does",
            "  return [r, note];",
            "}",
            "",
          ].join("\n"),
          "apps/web/tests/e2e/setup/global-setup.ts":
            "export default async () => { try { await seed(); } catch (e) { console.warn(e); } };\n",
        },
        expect: 0,
      },
    ],
  },
];
