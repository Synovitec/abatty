/**
 * Names a document cites that the code no longer has (standard DOC.4). `docs.citations` checks
 * the paths a document cites; a function, a constant or a class named in backticks rots as
 * quietly, and a study of popular repositories found such a reference in more than a quarter of
 * them, lasting years. The condition that keeps it precise is the history: a name counts only
 * when the code had it at the document's last change and has it nowhere now, so a concept or
 * another tool's option, never in the code, is never read as gone.
 */

import { frontMatter } from "./lib.mjs";

/** A backticked span that is one identifier, optionally called: `lastChange`, `lastChange()`. */
const SPAN = /(?<!`)`([A-Za-z_$][\w$]{3,})(\(\))?`(?!`)/g;
/**
 * A name shaped like code rather than a word: an inner capital (`loadOrders`, `ShellRole`), an
 * underscore (`HAS_DB`), or written as a call. `pnpm`, `feat` and `LICENSE` are words, and they
 * sit in the code's comments and strings, so a plain word read as a name gone was noise.
 */
const CODE_SHAPED = /[a-z][A-Z]|[A-Z][a-z]+[A-Z]|_/;
/** The code a name is looked for in, at any depth, now and at a past commit. */
const CODE = ["*.js", "*.mjs", "*.cjs", "*.ts", "*.tsx", "*.jsx", "*.py"];

/**
 * The identifiers a document cites in backticks, fenced blocks left out.
 * @param {string} text
 */
export function citedNames(text) {
  const prose = text.replace(/```[\s\S]*?```/g, "");
  const names = [...prose.matchAll(SPAN)]
    .filter((m) => m[2] || CODE_SHAPED.test(String(m[1])))
    .map((m) => String(m[1]));
  return [...new Set(names)];
}

/**
 * The names of a list found in the code, at a commit or (with no commit) in the working tree:
 * the same files on both sides, so a name kept only in a test is not read as gone.
 * @param {import("../../rules/context.mjs").RepoContext} c @param {string[]} names @param {string} [at]
 */
function foundIn(c, names, at) {
  const out = c.git(
    "grep",
    "-o",
    "-w",
    "-h",
    "-F",
    ...names.flatMap((n) => ["-e", n]),
    ...(at ? [at] : []),
    "--",
    ...CODE,
  );
  return new Set(out.split("\n").map((l) => l.replace(/^[0-9a-f]+:/, "").trim()));
}

const FM = (extra = "") =>
  `---\ntitle: "T"\ndescription: "D"\ncategory: reference\nstatus: living\n${extra}---\n\n# T\n`;

/** @type {import("../index.mjs").Probe[]} */
export const probes = [
  {
    metric: "docs.danglingRefs",
    kind: "ratchet",
    probation: true,
    standard: ["DOC.4"],
    title: "Names a document cites that the code had and has no longer",
    why: "A document that names a function, a constant or a class tells its reader where to look; once the name is gone, the reader looks for something that does not exist, or finds the document and trusts it. Fix the document, or the code, whichever is wrong: about half such references are fixed by changing the code back.",
    approximates:
      "stands in for knowing each name a document cites still means what it did: a single-backtick identifier of four characters or more, outside fenced blocks, counts when the code (JavaScript, TypeScript, Python, at any depth) had it at the document's last commit and has it nowhere now; a name renamed in a string only, or a document never committed, is not seen",
    axis: "docs-freshness",
    lossAt: 20,
    emptyScanOk: true,
    scan: (c) => {
      const findings = [];
      let scanned = 0;
      for (const doc of c.docFiles) {
        const text = c.read(doc);
        // A record of the past names what the code was then, on purpose: an archived or a
        // superseded document is not read, as docs.behindCode does not read one.
        const fm = frontMatter(text);
        if (["archived", "deprecated"].includes(String(fm?.status)) || fm?.superseded_by) continue;
        scanned++;
        const cited = citedNames(text);
        if (!cited.length) continue;
        const now = foundIn(c, cited);
        const gone = cited.filter((n) => !now.has(n));
        if (!gone.length) continue;
        const at = c.git("log", "-1", "--format=%H", "--", doc);
        if (!at) continue;
        const had = foundIn(c, gone, at);
        for (const n of gone.filter((g) => had.has(g)))
          findings.push({
            path: doc,
            detail: `\`${n}\` was in the code when this document last changed, and is nowhere now`,
          });
      }
      return { scanned, findings };
    },
    controls: [
      {
        name: "a function renamed after the document named it",
        files: {
          "docs/a.md": FM() + "\nCall `loadOrders` to read them.\n",
          "src/orders.ts": "export function loadOrders() { return []; }\n",
        },
        commits: [
          {
            files: { "src/orders.ts": "export function fetchOrders() { return []; }\n" },
            message: "refactor: rename",
          },
        ],
        expect: 1,
      },
      {
        name: "a name still there, a concept, a fenced block, an archived record and a plain word hold",
        files: {
          "docs/a.md":
            FM() +
            "\nCall `fetchOrders`; set `maxWarnings` in the linter; the `orders` are read here.\n\n```js\nloadOrders();\n```\n",
          "docs/old.md": FM().replace("living", "archived") + "\nCall `loadOrders`.\n",
          "src/orders.ts": "// the orders, read\nexport function loadOrders() { return []; }\n",
        },
        commits: [
          {
            files: { "src/orders.ts": "export function fetchOrders() { return []; }\n" },
            message: "refactor: rename",
          },
        ],
        expect: 0,
      },
    ],
  },
];
