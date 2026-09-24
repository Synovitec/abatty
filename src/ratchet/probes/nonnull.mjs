/**
 * The non-null assertion, counted: the escape `types.escapes` does not see. To pass a coverage
 * gate an adopter's agent replaced two `?? 0` fallbacks with `!` (`day[h]! += n`): the uncovered
 * branches were gone, and the escape that replaced them was in no count at all, so both numbers
 * went green while the debt moved into the one form nothing measured. Opt-in (`ratchet.enable`),
 * because a repository's existing assertions are a floor to hold, not a red to wake up to.
 */
import { codeOnly, lineAt } from "./lex.mjs";

/** @typedef {import("../index.mjs").Probe} Probe */

/**
 * A postfix `!` on an expression: after a name, a call or an index, and before what can follow an
 * expression (a member, an index, a closing bracket, a separator, an assignment, the line's end).
 * `!=` and `!==` are comparisons and JSX text is prose, so neither reads as one.
 */
const FOLLOWS = String.raw`[.[(]|\s*[)\]};,?]|\s+=(?!=)|\s*(?:\*\*|\?\?|&&|\|\||[-+*/%&|^])=(?!=)|\s+(?:===?|!==?|as\b)`;
/**
 * `:` is not in the list: `name!: string` is a class field's definite assignment, not an
 * assertion. The line's end counts outside TSX only, where a `!` ending a line is JSX text
 * (`Saved!`) as often as it is an assertion.
 */
const NON_NULL = new RegExp(String.raw`[\w)\]]!(?=${FOLLOWS}|\s*$)`, "gm");
const NON_NULL_TSX = new RegExp(String.raw`[\w)\]]!(?=${FOLLOWS})`, "gm");

/** @type {Probe[]} */
export const probes = [
  {
    metric: "types.nonNull",
    kind: "ratchet",
    optIn: true,
    standard: ["CODE.3"],
    title: "Non-null assertions (`!`) in the TypeScript sources",
    why: "A non-null assertion tells the compiler a value is there without proving it, which is the escape strict index access exists to prevent; and it is the cheapest way to make an uncovered fallback branch disappear. Counted, it can only fall.",
    approximates:
      "stands in for the compiler's own reading: a text reading, strings and comments blanked, of a postfix `!` after a name, a call or an index and before a member, an index, a closing bracket, a separator, an assignment or the end of the line; one before an arithmetic operator (`x! + 1`) is missed, a class field's `name!:` is not counted, and in TSX a `!` ending a line is read as JSX text and a `!` in JSX text before a bracket (`(new!)`) is still counted",
    emptyScanOk: true,
    scan: (c) => {
      const files = c.sourceFiles.filter((f) => /\.[cm]?tsx?$/.test(f));
      const findings = [];
      for (const f of files) {
        const text = codeOnly(c.read(f));
        for (const m of text.matchAll(f.endsWith(".tsx") ? NON_NULL_TSX : NON_NULL))
          findings.push({
            path: f,
            line: lineAt(text, m.index ?? 0),
            detail: "a non-null assertion",
          });
      }
      return { scanned: files.length, findings };
    },
    controls: [
      {
        name: "an assertion on an index, a member, a call, a compound assignment, a line's end, a call through it, a cast, an object value and a comparison",
        files: {
          "src/a.ts":
            "export function f(day: number[], h: number, m: Map<string, number>) {\n  day[h]! += 1;\n  const v = m.get('x')!.toFixed();\n  g(day[0]!);\n  return m.get('y')!\n}\nexport const k = (cb?: () => void, x?: number) => { cb!(); const y = x! as number; const o = { a: x! }; return x! === 1; };\n",
        },
        expect: 8,
      },
      {
        name: "comparisons, negations, a string, a comment, JSX text and a class field's definite assignment are not assertions",
        files: {
          "src/a.tsx":
            "export const A = (x: number | null) => {\n  if (x!=null && x !== 1 && !x) return null;\n  // do not use x!\n  const s = 'wow! really';\n  return <p>Hello! world\n    Saved!\n  </p>;\n};\n",
          "src/entity.ts": "export class User {\n  name!: string;\n}\n",
          "src/b.js": "export const c = a!.b;\n",
        },
        expect: 0,
      },
    ],
  },
];
