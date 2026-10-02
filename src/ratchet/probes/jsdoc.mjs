/**
 * Exports with no doc comment (standard CODE.7), read without a dependency. The rule was held only
 * by a linter plugin, so a repository that would not add one, this package included, could not
 * hold it at all. An exported declaration is a contract; the block above it is where the contract
 * says why it exists. Presence and nothing more: whether the block says WHY is a reviewer's.
 */
import { codeOnly, lineAt } from "./lex.mjs";
import { shippedScripts } from "./lib.mjs";

/** An exported declaration: what a caller outside the file can use. Re-exports are not one. */
const EXPORT =
  /^[ \t]*export\s+(?:default\s+)?(?:declare\s+)?(?:async\s+)?(?:function\*?|const|let|var|class|abstract\s+class|type|interface|enum)\s+([\w$]+)/gm;

/**
 * The body of the `/** *\/` block that ends right above the last line, or null. Read line by line
 * from the bottom: blank lines, decorators and line comments (a linter directive, a note) sit
 * between the block and the export without taking the block away from it. It was one regex over
 * everything above the export, which backtracked on a CRLF file (a line end matched two ways
 * under a run of `//` lines) and took minutes for one export, which hung `doctor` on Windows.
 * @param {string[]} lines the file up to the export, split on `\n`; the last is the export's own
 * @returns {string | null}
 */
function blockAbove(lines) {
  let i = lines.length - 2;
  for (; i >= 0; i--) {
    const l = String(lines[i]).trim();
    if (l && !l.startsWith("@") && !l.startsWith("//")) break;
  }
  const last = i >= 0 ? String(lines[i]).trimEnd() : "";
  if (!last.endsWith("*/")) return null;
  // Up to the block's own `/**`: a `/*` in its prose (`/api/*`) is text, and a `*/` met first
  // means the comment above closed without a doc block opening.
  /** @type {string[]} */
  const parts = [];
  for (let j = i; j >= 0; j--) {
    const l = j === i ? last.slice(0, -2) : String(lines[j]);
    const open = l.lastIndexOf("/**");
    if (l.lastIndexOf("*/") > open) return null;
    if (open >= 0) return [l.slice(open + 3), ...parts].join("\n");
    parts.unshift(l);
  }
  return null;
}

/**
 * Whether a doc comment ends right above a position, blank lines and decorators aside.
 * @param {string} text the file with strings blanked and comments kept @param {number} at
 */
function documented(text, at) {
  const body = blockAbove(text.slice(0, at).split("\n"));
  if (body === null) return false;
  // A block of `@typedef`s documents types, not the export that happens to follow it.
  const lines = body
    .split("\n")
    .map((l) => l.replace(/^\s*\*?\s?/, "").trim())
    .filter(Boolean);
  return (
    !lines.length ||
    !lines.every(
      (l) => /^@(typedef|callback|import)\b/.test(l) || /^[}|&]/.test(l) || /^\*\s/.test(l),
    )
  );
}

/** @type {import("../index.mjs").Probe[]} */
export const probes = [
  {
    metric: "code.undocumentedExports",
    kind: "ratchet",
    optIn: true,
    probation: true,
    standard: ["CODE.7"],
    title: "Exported declarations with no doc comment above them",
    why: "An export is a contract other files rely on, and the block above it is where the contract says why it exists, which is the one thing the code cannot say. The count is the number of contracts nobody wrote down; it may only fall. No dependency is needed to hold it.",
    approximates:
      "stands in for knowing each export is explained: a text reading of `export function`, `const`, `class`, `type`, `interface` and `enum` declarations in JavaScript and TypeScript sources outside test folders, counting those with no `/** */` block directly above; presence only, since whether the block says why is a reviewer's reading",
    emptyScanOk: true,
    scan: (c, o) => {
      const files = shippedScripts(c, o);
      const findings = [];
      for (const f of files) {
        const text = codeOnly(c.read(f), { comments: "keep" });
        // A TypeScript overload repeats the name; the first declaration is the one documented.
        const seen = new Set();
        for (const m of text.matchAll(EXPORT)) {
          const at = m.index ?? 0;
          if (seen.has(m[1])) continue;
          seen.add(m[1]);
          if (!documented(text, at))
            findings.push({
              path: f,
              line: lineAt(text, at),
              detail: `export ${m[1]} has no doc comment`,
            });
        }
      }
      return { scanned: files.length, findings };
    },
    controls: [
      {
        name: "a function, a constant and a type exported with no block above them",
        files: {
          "src/a.ts": [
            "export function load() { return 1; }",
            "// a line comment is not a doc comment",
            "export const LIMIT = 3;",
            "/* nor is a block that does not open with two stars */",
            "export type Id = string;",
            "/** @typedef {{ a: number }} Shape */",
            "export const SHAPES = [];",
            "",
          ].join("\n"),
        },
        expect: 4,
      },
      {
        name: "documented exports, a decorated class, a re-export and a test file hold",
        files: {
          "src/a.ts": [
            "/** Loads the one thing, because the cache cannot. */",
            "export async function load() { return 1; }",
            "",
            "/**",
            " * The ceiling, from the provider's contract.",
            " */",
            "export const LIMIT = 3;",
            "/** A service, registered by the container. */",
            "@Injectable()",
            "export class Service {}",
            'export { load as fetch } from "./b";',
            'const note = "export function hidden() {}";',
            // a directive between the block and the export, a /* in the block's prose, overloads
            "/** Routes matching /api/* go to the proxy. */",
            "// lint-directive-next-line some-rule",
            "export function route(a) { return a; }",
            "/** One name, two signatures. */",
            "export function pick(a: string): string;",
            "export function pick(a: number): number;",
            "export function pick(a: unknown) { return a; }",
            "",
          ].join("\n"),
          "src/__tests__/a.ts": "export function helper() {}\n",
        },
        expect: 0,
      },
      {
        // The shape that hung doctor for minutes on Windows: CRLF, a long run of line comments,
        // code under it, then a documented export. Read in a blink, one finding (the first).
        name: "a CRLF file with a long run of line comments above code is read in linear time",
        files: {
          "src/history.ts": [
            ...Array.from({ length: 40 }, (_, i) => `// ${i} a version note`),
            "export const VERSION = '1';",
            "",
            "/** Why the next one exists. */",
            "export const NEXT = '2';",
            "",
          ].join("\r\n"),
        },
        expect: 1,
      },
    ],
  },
];
