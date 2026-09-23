/**
 * Duplication, measured without a dependency. Two copies of a block fix one bug twice, or once.
 * The standard asks for the count of clones as a number that may only fall (CODE.12), and the
 * tool this package once named for it is a dependency a repository has to decide on; this reading
 * is the practice without the tool. Each source file is reduced to its meaningful lines (comments
 * gone, whitespace collapsed, a line of brackets or an import dropped), every run of WINDOW such
 * lines is hashed, and a run that appears in two places is a clone. Adjacent windows merge into
 * one clone, charged once, to the lexicographically smaller of its two places, so a rename does
 * not move the debt. Opt-in (`ratchet.enable`); every code preset enables it.
 */
import { codeOnly } from "./lex.mjs";
import { matchesAny, regexes } from "./lib.mjs";

/** @typedef {import("../index.mjs").Probe} Probe */

/** How many meaningful lines a clone must span: short enough to catch a copied block, long enough that two `if` guards are not one. */
const WINDOW = 6;
/** A line that carries no logic of its own: brackets, an import, a lone keyword. */
const TRIVIAL =
  /^(?:[{}()[\];,]*|import\b.*|export\s*\{[^}]*\}\s*(?:from\s.*)?;?|from\s.*import.*|(?:return|break|continue|else|try|finally|default:)[;{]?)$/;
const TEST_FILE =
  /(^|\/)(tests?|__tests__|e2e)\/|\.(test|spec)\.[cm]?[jt]sx?$|(^|\/)test_[^/]*\.py$/;

/**
 * The meaningful lines of a source, each with its line number. A `#` comment is dropped for the
 * languages that write one.
 * @param {string} f @param {string} text @returns {{ text: string, line: number }[]}
 */
function meaningful(f, text) {
  const py = /\.py$/.test(f);
  return codeOnly(text, { strings: "keep" })
    .split("\n")
    .map((raw, i) => ({
      text: (py ? raw.replace(/(^|\s)#.*$/, "") : raw).replace(/\s+/g, " ").trim(),
      line: i + 1,
    }))
    .filter((l) => l.text && !TRIVIAL.test(l.text));
}

/** @type {Probe[]} */
export const probes = [
  {
    metric: "code.clones",
    kind: "ratchet",
    optIn: true,
    standard: ["CODE.12"],
    title: "Blocks of code that appear in two places",
    why: "Two copies of a block fix one bug twice, or once. The count is the repeated blocks of at least six meaningful lines in the sources (tests and the exempt paths left out), each counted once; it may only fall.",
    approximates:
      "stands in for a token-level clone detector, which would be a dependency: a line-level reading, comments removed, whitespace collapsed and literals kept, with brackets, imports and lone keywords dropped. A copy whose names were changed on every line is not seen; one with a comment or blank lines added is.",
    axis: "navigability",
    lossAt: 200,
    scan: (c, o) => {
      const exempt = regexes(o.config.exempt);
      const files = c.sourceFiles
        .filter((f) => !matchesAny(f, exempt) && !TEST_FILE.test(f))
        .sort();
      /** @type {Map<string, { file: string, at: number }[]>} window text → where it starts */
      const seen = new Map();
      /** @type {Map<string, { text: string, line: number }[]>} */
      const lines = new Map();
      for (const f of files) {
        const l = meaningful(f, c.read(f));
        lines.set(f, l);
        for (let i = 0; i + WINDOW <= l.length; i++) {
          const key = l
            .slice(i, i + WINDOW)
            .map((x) => x.text)
            .join("\n");
          seen.set(key, [...(seen.get(key) || []), { file: f, at: i }]);
        }
      }
      const findings = [];
      for (const f of files) {
        const l = lines.get(f) || [];
        let inRun = false;
        for (let i = 0; i + WINDOW <= l.length; i++) {
          const key = l
            .slice(i, i + WINDOW)
            .map((x) => x.text)
            .join("\n");
          const others = (seen.get(key) || []).filter(
            (p) => p.file !== f || Math.abs(p.at - i) >= WINDOW,
          );
          if (!others.length) {
            inRun = false;
            continue;
          }
          if (inRun) continue;
          inRun = true;
          // Charged once: to the smaller of the two places, the other place stays quiet.
          const first = others[0];
          if (!first || first.file < f || (first.file === f && first.at < i)) continue;
          const at = lines.get(first.file)?.[first.at]?.line ?? 1;
          findings.push({
            path: f,
            line: l[i]?.line ?? 1,
            detail: `repeated at ${first.file}:${at}`,
          });
        }
      }
      return { scanned: files.length, findings };
    },
    controls: [
      {
        name: "the same eight-line block in two files is one clone, charged once",
        files: {
          "src/a.ts": `export function checkA(input: Record<string, unknown>) {\n${Array.from({ length: 8 }, (_, i) => `  if (input.f${i} === undefined) throw new Error("f${i} is required");`).join("\n")}\n  return input;\n}\n`,
          "src/b.ts": `// a copy, with a comment the reading ignores\nexport function checkB(input: Record<string, unknown>) {\n${Array.from({ length: 8 }, (_, i) => `  if (input.f${i} === undefined)   throw new Error("f${i} is required");`).join("\n")}\n  return input;\n}\n`,
        },
        expect: 1,
      },
      {
        name: "shared imports and brackets are not a clone, and a test copying a source is not read",
        files: {
          "src/a.ts":
            'import { a } from "./x";\nimport { b } from "./y";\nimport { c } from "./z";\n{\n}\n{\n}\nexport const one = a + b + c;\n',
          "src/b.ts":
            'import { a } from "./x";\nimport { b } from "./y";\nimport { c } from "./z";\n{\n}\n{\n}\nexport const two = a * b * c;\n',
          "src/c.ts": `${Array.from({ length: 8 }, (_, i) => `export const v${i} = compute(${i});`).join("\n")}\n`,
          "test/c.test.ts": `${Array.from({ length: 8 }, (_, i) => `export const v${i} = compute(${i});`).join("\n")}\n`,
        },
        expect: 0,
      },
    ],
  },
];
