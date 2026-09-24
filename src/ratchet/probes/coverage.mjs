/**
 * What a coverage floor does not measure. A floor on the total holds while the code it would
 * fall on is excluded from the count: split a file, then list the half nobody tests in the
 * coverage exclusions, and the number stays green over code no test reaches. An adopter watched
 * it happen in one week. This counts the exclusions, by list and inline, so they can only
 * shrink. Opt-in (`ratchet.enable`).
 */
import { closeOf, codeOnly, lineAt } from "./lex.mjs";

/** @typedef {import("../index.mjs").Probe} Probe */

/** The JavaScript configs a coverage run reads its exclusions from. */
const JS_CONFIG = /(^|\/)(vitest(\.\w+)?|vite|jest)\.config\.[cm]?[jt]s$/;
/** The JSON configs of the JavaScript coverage tools. */
const JSON_CONFIG = /(^|\/)(\.nycrc(\.json)?|\.c8rc(\.json)?)$/;
/** The Python coverage configs. */
const PY_CONFIG = /(^|\/)(\.coveragerc|setup\.cfg|pyproject\.toml)$/;
/**
 * A comment that takes the next lines out of the count, in each tool's spelling. Node's own
 * runner has one too (`node:coverage ignore next`, and `disable` up to its `enable`, which closes
 * the region and is not a second exclusion): read through istanbul's spelling alone, a
 * `node --test` suite could exclude code no count saw.
 */
const INLINE =
  /\/\*\s*(?:istanbul|c8|v8)\s+ignore\b[^*]*\*\/|\/\/\s*(?:istanbul|c8|v8)\s+ignore\b[^\n]*|\/\*\s*node:coverage\s+(?:ignore\s+next|disable)\b[^*]*\*\/|\/\/\s*node:coverage\s+(?:ignore\s+next|disable)\b[^\n]*|#\s*pragma:\s*no\s*cover\b/g;

/**
 * The entries of the array a key opens (strings and regular expressions), wherever the key appears.
 * @param {string} text @param {RegExp} key a pattern ending just before the `[`
 * @returns {{ index: number, count: number }[]}
 */
function arrays(text, key) {
  const out = [];
  for (const m of text.matchAll(new RegExp(key.source, "g"))) {
    const open = text.indexOf("[", (m.index ?? 0) + m[0].length - 1);
    const close = closeOf(text, open, "[]");
    if (open < 0 || close < 0) continue;
    const inner = text.slice(open + 1, close - 1);
    out.push({
      index: open,
      count: (inner.match(/["'`][^"'`\n]+["'`]|\/[^/\n]+\/[a-z]*/g) || []).length,
    });
  }
  return out;
}

/** @param {import("../index.mjs").RepoContext} c @param {string} f */
function listed(c, f) {
  const text = c.read(f);
  if (JS_CONFIG.test(f)) {
    // Inside a coverage block only: vitest's own `test.exclude` names test files, not code. Every
    // block, since a workspace config carries one per project.
    const code = codeOnly(text, { strings: "keep" });
    const inBlock = [...code.matchAll(/\bcoverage\s*:\s*\{/g)].flatMap((b) => {
      const start = b.index ?? 0;
      const end = closeOf(code, code.indexOf("{", start), "{}");
      return end < 0
        ? []
        : arrays(code.slice(start, end), /\bexclude\s*:\s*\[/).map((a) => ({
            ...a,
            index: a.index + start,
          }));
    });
    return [...inBlock, ...arrays(code, /\bcoveragePathIgnorePatterns\s*:\s*\[/)].map((a) => ({
      line: lineAt(text, a.index),
      count: a.count,
    }));
  }
  if (JSON_CONFIG.test(f))
    return arrays(text, /"exclude"\s*:\s*\[/).map((a) => ({
      line: lineAt(text, a.index),
      count: a.count,
    }));
  if (PY_CONFIG.test(f)) {
    // Every `omit =` and the indented lines under it, in an ini or a toml coverage section.
    const own = /\.coveragerc$/.test(f);
    return [...text.matchAll(/^\s*omit\s*=\s*(\[[^\]]*\]|.*(?:\n[ \t]+\S.*)*)/gm)]
      .filter((m) => own || /coverage/.test(text.slice(0, m.index)))
      .map((m) => ({
        line: lineAt(text, m.index ?? 0),
        count: (m[1] || "")
          .replace(/[[\]"',]/g, " ")
          .split(/\s+/)
          .filter(Boolean).length,
      }));
  }
  return [];
}

/** @type {Probe[]} */
export const probes = [
  {
    metric: "test.coverageExclusions",
    kind: "ratchet",
    optIn: true,
    standard: ["TEST.4"],
    title: "Code taken out of the coverage count, by list or inline",
    why: "A coverage floor holds only over the code it counts. Every exclusion is code the floor stopped watching, and splitting a file then excluding the untested half keeps the number green while nothing tests it. The exclusions may exist; they may only shrink.",
    approximates:
      "stands in for the coverage tool's own resolution of its config: a text reading of the entries of a coverage exclude list (vitest or vite `coverage.exclude`, jest `coveragePathIgnorePatterns`, nyc or c8 `exclude`, coverage.py `omit`) plus each inline ignore comment (istanbul, c8, v8, Node's `node:coverage ignore next` and `disable`, `pragma: no cover`); a glob counts as one entry whatever it matches",
    emptyScanOk: true,
    scan: (c) => {
      const findings = [];
      const configs = c.files(JS_CONFIG).concat(c.files(JSON_CONFIG), c.files(PY_CONFIG));
      for (const f of configs)
        for (const { line, count } of listed(c, f))
          if (count)
            findings.push({
              path: f,
              line,
              weight: count,
              detail: `${count} path(s) excluded from coverage`,
            });
      for (const f of c.sourceFiles) {
        // Comments only: a message that quotes the directive is not one.
        const text = codeOnly(c.read(f), { comments: "keep" });
        for (const m of text.matchAll(INLINE))
          findings.push({
            path: f,
            line: lineAt(text, m.index ?? 0),
            detail: `ignored inline: ${m[0].slice(0, 40)}`,
          });
      }
      return { scanned: configs.length + c.sourceFiles.length, findings };
    },
    controls: [
      {
        name: "a vitest coverage list, a jest list, a python omit and an inline ignore",
        files: {
          "vitest.config.ts":
            "export default { test: { exclude: ['e2e/**'], coverage: { thresholds: { lines: 80 }, exclude: ['src/legacy/**', 'src/split-half.ts'] } } };\n",
          "apps/api/jest.config.js":
            "module.exports = { coveragePathIgnorePatterns: ['/generated/'] };\n",
          // one block per project, and one omit per section: every one is read
          "packages/ui/vitest.config.mjs":
            "export default { projects: [{ test: { coverage: { exclude: ['a/**'] } } }, { test: { coverage: { exclude: ['b/**'] } } }] };\n",
          "tools/setup.cfg": "[coverage:run]\nomit = a/*\n[coverage:report]\nomit = b/*\n",
          ".coveragerc": "[run]\nomit =\n    app/migrations/*\n    app/settings.py\n",
          "src/a.ts": "/* v8 ignore next */\nexport const a = 1;\n",
          "src/b.mjs":
            "/* node:coverage disable */\nexport const b = 1;\n/* node:coverage enable */\n// node:coverage ignore next 2\nexport const c = 2;\n",
        },
        expect: 12,
      },
      {
        name: "a test exclude outside the coverage block, and coverage with nothing excluded",
        files: {
          "vitest.config.ts":
            "export default { test: { exclude: ['e2e/**'], coverage: { thresholds: { lines: 80 } } } };\n",
          "src/a.ts": "export const note = '/* istanbul ignore next */ quoted in a message';\n",
          "src/b.mjs": "/* node:coverage enable */\nexport const b = '// node:coverage disable';\n",
        },
        expect: 0,
      },
    ],
  },
];
