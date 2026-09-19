/**
 * Code and boundaries: the context file's cap (AIR.1), type escapes (CODE.3), raw env reads
 * outside the env module (VALID.3), wide barrels (CODE.5).
 */
import { lines, matchesAny, regexes } from "./lib.mjs";

const ESCAPE = /(:\s*any\b|<any>|\bas any\b|@ts-ignore|@ts-nocheck|@ts-expect-error)/g;
const RAW_ENV = /\bprocess\.env(\.|\[)/g;

/**
 * The 1-based line an offset falls on. WHY it matters: a finding without a line is placed at the
 * top of the file by every forge that reads SARIF, which is not the diff line a reviewer is
 * looking at, and the whole argument for emitting SARIF was that placement beats precision.
 * @param {string} text @param {number} index
 */
const lineAt = (text, index) => text.slice(0, index).split("\n").length;
const REEXPORT = /^\s*export\s+(\*|\{[^}]*\})\s+from\s+/;

/** @type {import("../index.mjs").Probe[]} */
export const probes = [
  {
    metric: "context.overCap",
    kind: "ratchet",
    standard: ["AIR.1"],
    title: "Lines of the agent's context file over its cap",
    why: "The context file is read whole at the start of every session; past the cap the model stops holding it and confidently applies the wrong half. The excess is the number of lines to move into path-scoped rules.",
    axis: "navigability",
    lossAt: 400,
    scan: (c, o) => {
      if (!c.contextFile) return { scanned: 0, findings: [] };
      const n = lines(c.read(c.contextFile).replace(/\n$/, "")).length;
      return {
        scanned: 1,
        findings:
          n > o.config.contextMax
            ? [
                {
                  path: c.contextFile,
                  detail: `${n} lines > ${o.config.contextMax}`,
                  weight: n - o.config.contextMax,
                },
              ]
            : [],
      };
    },
    controls: [
      {
        name: "a 210-line context file is 10 over",
        files: {
          "CLAUDE.md": Array.from({ length: 210 }, (_, i) => `line ${i}`).join("\n") + "\n",
        },
        expect: 10,
      },
      {
        name: "a 50-line context file holds",
        files: { "CLAUDE.md": Array.from({ length: 50 }, (_, i) => `line ${i}`).join("\n") + "\n" },
        expect: 0,
      },
    ],
  },
  {
    metric: "types.escapes",
    kind: "ratchet",
    standard: ["CODE.3"],
    title: "any and ts-ignore escapes in the sources",
    why: "Every escape is a place the compiler was told to look away; the count is the honest measure of how strict the types are.",
    axis: "type-safety",
    lossAt: 300,
    scan: (c, o) => {
      const exempt = regexes(o.config.exempt);
      const files = c.sourceFiles.filter((f) => !matchesAny(f, exempt));
      const findings = [];
      // One finding per occurrence, each on its line, rather than one per file carrying a count.
      // The total and the per-file debt are identical either way - the ratchet sums the weights -
      // so the floor does not move, and a reviewer gets the finding on the line that caused it.
      for (const f of files) {
        const text = c.read(f);
        const isTs = /\.tsx?$/.test(f);
        for (const m of text.matchAll(ESCAPE)) {
          if (!isTs && !m[0].startsWith("@ts-")) continue;
          findings.push({ path: f, line: lineAt(text, m.index ?? 0), detail: `escape: ${m[0]}` });
        }
      }
      return { scanned: files.length, findings };
    },
    controls: [
      {
        name: "two any and one ts-ignore count three",
        files: {
          "src/a.ts": "export const x: any = 1;\n// @ts-ignore\nexport const y = x as any;\n",
        },
        expect: 3,
      },
      {
        name: "a typed file counts none",
        files: { "src/a.ts": "export const x: number = 1;\n" },
        expect: 0,
      },
      {
        name: "'any' in a JavaScript identifier is not an escape",
        files: { "src/a.js": "export const anyone = 1; export const company: any = 2;\n" },
        expect: 0,
      },
    ],
  },
  {
    metric: "valid.rawEnv",
    kind: "ratchet",
    standard: ["VALID.3"],
    title: "process.env reads outside the env module",
    why: "A raw process.env read fails at the line that reads it, in production; one module parsed at boot fails at start, on the developer's screen. The count is the number of reads to move.",
    axis: "boundary-clarity",
    lossAt: 150,
    scan: (c, o) => {
      const exempt = regexes(o.config.exempt);
      const env = new RegExp(o.config.envModule);
      const files = c.sourceFiles.filter((f) => !matchesAny(f, exempt) && !env.test(f));
      const findings = [];
      for (const f of files) {
        const text = c.read(f);
        for (const m of text.matchAll(RAW_ENV))
          findings.push({
            path: f,
            line: lineAt(text, m.index ?? 0),
            detail: "raw process.env read",
          });
      }
      return { scanned: files.length, findings };
    },
    controls: [
      {
        name: "a read in a service counts",
        files: { "src/service.ts": "export const k = process.env.KEY;\n" },
        expect: 1,
      },
      {
        name: "the env module itself is the one place",
        files: { "src/lib/env.ts": "export const env = { k: process.env.KEY };\n" },
        expect: 0,
      },
      {
        name: "a script is exempt",
        files: { "scripts/x.mjs": "console.log(process.env.HOME);\n" },
        expect: 0,
      },
    ],
  },
  {
    metric: "code.barrels",
    kind: "ratchet",
    standard: ["CODE.5"],
    title: "Re-exports over the barrel width in index files",
    why: "A wide barrel hides who imports what, defeats tree-shaking and makes every import a potential cycle; the excess over the width is what to import from the defining file instead.",
    axis: "navigability",
    lossAt: 100,
    scan: (c, o) => {
      const files = c.sourceFiles.filter((f) => /(^|\/)index\.[cm]?[jt]sx?$/.test(f));
      const findings = [];
      for (const f of files) {
        const n = lines(c.read(f)).filter((l) => REEXPORT.test(l)).length;
        if (n > o.config.barrelMax)
          findings.push({
            path: f,
            detail: `${n} re-exports > ${o.config.barrelMax}`,
            weight: n - o.config.barrelMax,
          });
      }
      return { scanned: files.length, findings };
    },
    controls: [
      {
        name: "twelve re-exports is two over the width of ten",
        files: {
          "src/index.ts":
            Array.from({ length: 12 }, (_, i) => `export { a${i} } from "./a${i}";`).join("\n") +
            "\n",
        },
        expect: 2,
      },
      {
        name: "three re-exports hold",
        files: {
          "src/index.ts":
            'export { a } from "./a";\nexport * from "./b";\nexport { c } from "./c";\n',
        },
        expect: 0,
      },
    ],
  },
];
