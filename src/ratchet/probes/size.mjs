/**
 * Size (standard CODE.1): every file answers to the budget of its kind, excess is measured
 * beside the count, and 800 raw lines is the cap for anything.
 */
import { budgetOf, matchesAny, regexes } from "./lib.mjs";

/** A file of n export lines. @param {number} n @param {string} [pad] */
const LONG = (n, pad = "x") =>
  Array.from({ length: n }, (_, i) => `export const v${i} = "${pad}";`).join("\n") + "\n";

/** @type {import("../index.mjs").Probe[]} */
export const probes = [
  {
    metric: "size.overBudget",
    kind: "ratchet",
    standard: ["CODE.1"],
    title: "Source files over the code-line budget of their kind",
    why: "Past its budget a file has more than one responsibility and no reader, human or model, holds it whole; the count is the number of files to split.",
    axis: "navigability",
    lossAt: 40,
    scan: (c, o) => {
      const exempt = regexes(o.config.exempt);
      const files = c.sourceFiles.filter((f) => !matchesAny(f, exempt));
      const findings = [];
      for (const f of files) {
        const { kind, max } = budgetOf(f, o.config);
        const code = c.codeLines(c.read(f));
        if (code > max) findings.push({ path: f, detail: `${code} code lines > ${max} (${kind})` });
      }
      return { scanned: files.length, findings };
    },
    controls: [
      {
        name: "a 320-line module is over the 300 budget",
        files: { "src/big.ts": LONG(320) },
        expect: 1,
      },
      { name: "a 120-line module holds", files: { "src/ok.ts": LONG(120) }, expect: 0 },
      {
        name: "a 120-line utility is over its 100 budget",
        files: { "src/utils/u.ts": LONG(120) },
        expect: 1,
      },
      {
        name: "a 320-line script is exempt from the kind budget",
        files: { "scripts/tool.mjs": LONG(320) },
        expect: 0,
      },
      {
        name: "a repository's own kinds replace the defaults",
        files: { "src/big.ts": LONG(320) },
        config: { kinds: [{ match: "^src/", kind: "wide", max: 400 }] },
        expect: 0,
      },
    ],
  },
  {
    metric: "size.excessCode",
    kind: "ratchet",
    standard: ["CODE.1"],
    title: "Code lines over budget, summed",
    why: "Splitting one file into eight where one child lands over budget improves the count by one and the excess by hundreds; the excess says how far a file is from its budget, not only that it is.",
    axis: "navigability",
    lossAt: 3000,
    scan: (c, o) => {
      const exempt = regexes(o.config.exempt);
      const files = c.sourceFiles.filter((f) => !matchesAny(f, exempt));
      const findings = [];
      for (const f of files) {
        const { kind, max } = budgetOf(f, o.config);
        const code = c.codeLines(c.read(f));
        if (code > max)
          findings.push({
            path: f,
            detail: `${code - max} over the ${kind} budget`,
            weight: code - max,
          });
      }
      return { scanned: files.length, findings };
    },
    controls: [
      { name: "20 lines over is an excess of 20", files: { "src/big.ts": LONG(320) }, expect: 20 },
      { name: "under budget is zero", files: { "src/ok.ts": LONG(50) }, expect: 0 },
    ],
  },
  {
    metric: "size.overRaw",
    kind: "hard",
    standard: ["CODE.1"],
    title: "Source files over the 800-line cap, exempt kinds included",
    why: "800 raw lines is the cap for anything; moving a file into a laxer category instead of splitting it is gaming the metric, so the cap counts every file.",
    axis: "navigability",
    lossAt: 5,
    scan: (c, o) => {
      const findings = [];
      for (const f of c.sourceFiles) {
        const n = c.read(f).split(/\r?\n/).length;
        if (n > o.config.cap) findings.push({ path: f, detail: `${n} lines > ${o.config.cap}` });
      }
      return { scanned: c.sourceFiles.length, findings };
    },
    controls: [
      {
        name: "a 900-line script is over the cap even though exempt from the budget",
        files: { "scripts/huge.mjs": LONG(900) },
        expect: 1,
      },
      { name: "a 400-line file is under the cap", files: { "src/mid.ts": LONG(400) }, expect: 0 },
    ],
  },
];
