/**
 * Code, the surface a linter sees: lint at zero, the shape limits, JSDoc on the boundary.
 * Standard CODE.1..4, CODE.7. The structure of the code (graph, dead code, duplication, size,
 * barrels, format) is code-structure.mjs, the same family.
 */

import { JS_SOURCES, SOURCES } from "../applies.mjs";
import { perPack } from "../../packs/rules.mjs";

/** @type {import("../index.mjs").Rule[]} */
export const rules = [
  {
    id: "CODE-ESLINT",
    family: "Code",
    title: "A linter configured, for every language in the tree",
    standard: ["CODE.4"],
    level: "must",
    enforcement: "hard",
    phase: "1",
    ...SOURCES,
    why: "The linter is where most rules of the standard become an error a machine refuses; without a config there is nothing to hold them. Each language pack names its linter; the rule keeps the same words.",
    next: "Add the pack's linter config (eslint.config.js with the day-0 block from CODE.1; ruff for Python)",
    check: (c) => perPack(c, "linter"),
  },
  {
    id: "CODE-MAXWARN",
    family: "Code",
    title: "lint runs with a warning as an error (--max-warnings=0, --error-on-warnings)",
    standard: ["CODE.4"],
    level: "must",
    enforcement: "hard",
    phase: "1",
    ...JS_SOURCES,
    why: "A warning nobody has to fix is a rule nobody follows; at zero, a warning is an error with a softer name.",
    next: "Make a warning fail the lint script: --max-warnings=0 (ESLint, oxlint) or --error-on-warnings (Biome)",
    check: (c) => {
      const lintScripts = [
        ["package.json", c.scripts.lint],
        ...c
          .files(/^(apps|packages|services)\/[^/]+\/package\.json$/)
          .map((q) => [q, c.readJson(q)?.scripts?.lint]),
      ].filter(([, v]) => v && /eslint|oxlint|biome/.test(String(v)));
      const first = lintScripts[0];
      const lint = first
        ? [String(first[0]), String(first[1])]
        : c.scripts.lint
          ? ["lint", c.scripts.lint]
          : null;
      return {
        status:
          lint && /max-warnings[= ]0|--error-on-warnings/.test(lint[1] || "")
            ? "present"
            : lint
              ? "partial"
              : "missing",
        evidence: lint ? "`" + lint[1] + "`" : "no lint script",
      };
    },
  },
  {
    id: "CODE-SHAPE",
    family: "Code",
    title:
      "Function shape held: max-lines, max-lines-per-function, complexity, max-params in the linter or the ratchet",
    standard: ["CODE.1", "CODE.2"],
    level: "must",
    enforcement: "hard",
    phase: "7 / 8",
    ...JS_SOURCES,
    why: "An 800-line file and a 150-line function are what an agent cannot read whole, and what a reviewer cannot hold; the four limits are the shape a module keeps.",
    next: "Add the four rules at warn under --max-warnings=0, exemptions generated from the baseline debt",
    check: (c) => {
      // CODE.1 is held by ESLint max-lines or by the ratchet's size metrics, so a baseline with a
      // size family stands for max-lines.
      const sizeRatchet = Boolean(c.readJson(c.firstFile(/standards-baseline\.json$/) || "")?.size);
      // The same four limits under whichever name the repository's linter gives them: ESLint and
      // oxlint share the kebab names, Biome renamed every one of them.
      const ALSO = {
        "max-lines": "noExcessiveLinesPerFile",
        "max-lines-per-function": "noExcessiveLinesPerFunction",
        complexity: "noExcessiveCognitiveComplexity",
        "max-params": "useMaxParams",
      };
      /** @param {string} r */
      const inLint = (r) =>
        new RegExp(`['"]?(${r}|${ALSO[/** @type {keyof ALSO} */ (r)]})['"]?\\s*:`).test(c.lintText);
      const shape = ["max-lines", "max-lines-per-function", "complexity", "max-params"].map((r) => [
        r,
        inLint(r) ? "ok" : r === "max-lines" && sizeRatchet ? "ok (ratchet size)" : "MISSING",
      ]);
      return {
        status: shape.every(([, v]) => v !== "MISSING")
          ? "present"
          : shape.some(([, v]) => v !== "MISSING")
            ? "partial"
            : "missing",
        evidence: shape.map(([r, v]) => `${v} ${r}`).join(", "),
      };
    },
  },
  {
    id: "CODE-JSDOC",
    family: "Code",
    title: "jsdoc/require-jsdoc publicOnly on the exported surface",
    standard: ["CODE.7"],
    level: "must",
    enforcement: "hard",
    phase: "11",
    ...JS_SOURCES,
    why: "An export without a block is a contract nobody wrote down; the block says why it exists, which is the one thing the code cannot say.",
    next: "Add eslint-plugin-jsdoc (typescript-flavor on TS) with the fixer disabled",
    check: (c) => {
      const rule = /jsdoc\/require-jsdoc/.test(c.lintText);
      const probe = c.script(/jsdoc|check-limits/);
      return {
        status: rule ? "present" : probe ? "partial" : "missing",
        evidence: rule ? "a linter rule" : probe ? "probe script only (" + probe[0] + ")" : "none",
      };
    },
  },
];
