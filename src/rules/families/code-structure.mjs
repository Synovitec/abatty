/**
 * Code, its structure: the import graph, dead code, duplication, file size, barrels, format.
 * Standard CODE.1, CODE.4..6, CODE.12. The same family as code.mjs, split by what reads it.
 */
import { JS_SOURCES, SOURCES } from "../applies.mjs";
import { perPack } from "../../packs/rules.mjs";

/** @type {import("../index.mjs").Rule[]} */
export const rules = [
  {
    id: "CODE-ARCH-IMPORTS",
    family: "Code",
    title: "no-restricted-imports / import boundaries hold the architecture",
    standard: ["CODE.4", "CODE.5"],
    level: "must",
    enforcement: "hard",
    phase: "1",
    ...JS_SOURCES,
    why: "A vendor SDK imported outside its provider home, or a component reaching the database, is the architecture eroding one import at a time; the linter refuses the import.",
    next: "Ban vendor SDKs outside their provider home and enforce the import direction",
    check: (c) => {
      // Biome renamed the first of them; nothing of its own answers the second.
      const ok = /no-restricted-imports|noRestrictedImports|no-restricted-paths/.test(c.lintText);
      return { status: ok ? "present" : "missing", evidence: ok ? "rule present" : "none" };
    },
  },
  {
    id: "CODE-ARCH-GRAPH",
    family: "Code",
    title:
      "The import graph is checked: dependency-cruiser with no-circular, no-orphans and one rule per arrow of the boundary map, in the gate",
    standard: ["CODE.5"],
    level: "must",
    enforcement: "hard",
    phase: "12",
    ...JS_SOURCES,
    why: "The boundary map in the context file is a wish until the graph is checked: a cycle, an orphan and a forbidden arrow are then refused by the gate, not hoped against.",
    next: "Copy the dependency-cruiser template, write one rule per arrow of the boundary map, add the graph step to the gate; on an existing repository start from --baseline",
    check: (c) => {
      const config = c.firstFile(/(^|\/)\.dependency-cruiser\.(cjs|js|mjs|json)$/);
      const gateText = c.read(c.firstFile(/^scripts\/ci\/gate\.(mjs|js|ts)$/) || "");
      const run =
        c.script(/depcruise|dependency-cruise/) ||
        (/depcruise|dependency-cruiser/.test(gateText) ? ["gate", "gate.mjs"] : null);
      const known = c.firstFile(/(^|\/)\.dependency-cruiser-known-violations\.json$/);
      const knownCount = known ? (c.readJson(known) || []).length : 0;
      return {
        status:
          config && run
            ? knownCount === 0
              ? "present"
              : "partial"
            : config || c.has("dependency-cruiser")
              ? "partial"
              : "missing",
        evidence: config
          ? config +
            (run ? ", run by " + run[0] : ", not run by any script") +
            (known ? ", " + knownCount + " known violation(s)" : "")
          : c.has("dependency-cruiser")
            ? "dependency installed, no config"
            : "none",
      };
    },
  },
  {
    id: "CODE-DEADCODE",
    family: "Code",
    title: "Dead code is a gate: files, dependencies, exports and types at zero issues",
    standard: ["CODE.6"],
    level: "must",
    enforcement: "hard",
    phase: "12",
    ...SOURCES,
    why: "Dead code is read, maintained and reasoned about for nothing; an unused dependency is an attack surface. knip at zero makes both a refusal instead of a cleanup.",
    next: "Copy the knip template, add knip --max-issues 0 to the gate (start at today's count, ratchet dead.knipIssues to zero)",
    check: (c) => {
      const config =
        c.firstFile(/(^|\/)knip\.(json|jsonc|ts|js|mjs)$/) ||
        (c.pkg.knip ? "package.json#knip" : null);
      const gateText = c.read(c.firstFile(/^scripts\/ci\/gate\.(mjs|js|ts)$/) || "");
      const run = c.script(/\bknip\b/) || (/\bknip\b/.test(gateText) ? ["gate", "gate.mjs"] : null);
      const max = run
        ? Number((String(run[1] || "").match(/--max-issues[= ](\d+)/) || [0, 0])[1])
        : 0;
      const others = perPack(c, "dead", (p) => p.id !== "javascript");
      if (!c.stack.js) return others;
      const js =
        run && max === 0 ? "present" : run || config || c.has("knip") ? "partial" : "missing";
      const jsEvidence = run
        ? "run by " +
          run[0] +
          (max ? " at --max-issues " + max : " at 0") +
          (config ? ", " + config : ", no config (plugins only)")
        : config || (c.has("knip") ? "dependency installed, not run" : "none");
      return {
        status:
          others.status === "n/a"
            ? js
            : js === "present" && others.status === "present"
              ? "present"
              : js === "missing" && others.status === "missing"
                ? "missing"
                : "partial",
        evidence: `javascript: ${jsEvidence}${others.status === "n/a" ? "" : "; " + others.evidence}`,
      };
    },
  },
  {
    id: "CODE-DUP",
    family: "Code",
    title: "Duplication measured as a ratchet metric",
    standard: ["CODE.12"],
    level: "should",
    enforcement: "ratchet",
    phase: "12",
    ...JS_SOURCES,
    why: "Two copies of a block fix one bug twice, or once; the count of clones is a number that may only fall. The practice is the number, not a tool: the package's own reading needs no dependency, and a repository's own detector counts as well.",
    next: "Add code.clones to ratchet.enable (no dependency) and record the floor with abatty baseline, or read your own clone detector into the ratchet as a metric",
    check: (c) => {
      // Any clone count with a floor holds the rule: the package's `code.clones`, or a metric a
      // repository's own probe reads from its detector (`dup.clones` was the first one seen).
      const metrics = Object.keys(
        c.readJson(c.firstFile(/standards-baseline\.json$/) || "")?.metrics || {},
      );
      const floored = metrics.find((m) => /(^|\.)clones$|^dup\./.test(m));
      const script = c.script(/jscpd|\bcpd\b|simian|\bdupl\b/);
      const enabled = (c.adoption?.ratchet?.enable || []).includes("code.clones");
      const status =
        floored || script ? "present" : enabled || c.has("jscpd") ? "partial" : "missing";
      return {
        status,
        evidence: floored
          ? `${floored} in the baseline`
          : script
            ? "script " + script[0]
            : enabled
              ? "code.clones enabled, no floor yet (abatty baseline)"
              : c.has("jscpd")
                ? "a clone detector installed, not in the ratchet"
                : "not measured",
      };
    },
  },
  {
    id: "CODE-SIZE-800",
    family: "Code",
    title: "No source file over the 800-line cap",
    standard: ["CODE.1"],
    level: "must",
    enforcement: "hard",
    phase: "8",
    ...JS_SOURCES,
    why: "Past 800 lines a file has more than one responsibility, and no reader, human or model, holds it whole.",
    next: "Split by responsibility; a file a generator writes (an OpenAPI client, a schema dump) is not split but moved under a generated/ folder, which the budgets exempt; the ratchet holds the count",
    check: (c) => {
      const over = budgeted(c).filter((f) => c.read(f).split(/\r?\n/).length > 800);
      return {
        status: over.length === 0 ? "present" : "partial",
        evidence: over.length ? `${over.length} file(s): ${over.slice(0, 5).join(", ")}` : "none",
      };
    },
  },
  {
    id: "CODE-SIZE-300",
    family: "Code",
    title:
      "Source files over 300 code lines (the threshold where an agent stops reading a file whole)",
    standard: ["CODE.1"],
    level: "should",
    enforcement: "ratchet",
    phase: "8",
    ...JS_SOURCES,
    why: "Three hundred code lines is where an agent starts reading a file in pieces and editing what it did not read; per-kind budgets keep modules under it.",
    next: "Per-kind budgets in the ratchet, then split worst-first; a generated file goes under a generated/ folder instead, which the budgets exempt",
    check: (c) => {
      const over = budgeted(c)
        .map((f) => /** @type {[string, number]} */ ([f, c.codeLines(c.read(f))]))
        .filter(([, n]) => n > 300)
        .sort((a, b) => b[1] - a[1]);
      return {
        status: over.length === 0 ? "present" : over.length <= 10 ? "partial" : "missing",
        evidence: `${over.length} file(s)${
          over.length
            ? ": " +
              over
                .slice(0, 5)
                .map(([f, n]) => `${f} (${n})`)
                .join(", ")
            : ""
        }`,
      };
    },
  },
  {
    id: "CODE-BARRELS",
    family: "Code",
    title: "No wide barrel files",
    standard: ["CODE.5"],
    level: "must",
    enforcement: "ratchet",
    phase: "8",
    ...JS_SOURCES,
    why: "A wide barrel hides who imports what, defeats tree-shaking and makes every import a potential cycle; import from the defining file.",
    next: "Import from the defining file; keep barrels leaf-level",
    check: (c) => {
      const barrels = c
        .files(/(^|\/)index\.(ts|js)$/)
        .filter((f) => (c.read(f).match(/^export .* from /gm) || []).length > 10);
      return {
        status: barrels.length === 0 ? "present" : "partial",
        evidence: barrels.length
          ? `${barrels.length} index file(s) re-exporting >10 modules`
          : "none",
      };
    },
  },
  {
    id: "CODE-FORMAT",
    family: "Code",
    title: "A formatter configured and the format checked, for every language in the tree",
    standard: ["CODE.4"],
    level: "must",
    enforcement: "hard",
    phase: "1",
    ...SOURCES,
    why: "Formatting argued in review is attention taken from the change; one formatter, checked, ends the argument.",
    next: "Add Prettier and a format check with --end-of-line auto in the gate",
    check: (c) => {
      const tools = perPack(c, "formatter");
      const checked = c.script(/prettier|format/);
      return {
        status:
          tools.status === "present" && checked
            ? "present"
            : tools.status === "missing"
              ? "missing"
              : "partial",
        evidence: `${tools.evidence}${checked ? ", format script" : ", no format script"}`,
      };
    },
  },
];

/** The source files a size budget applies to: not declarations, scripts, tests, generated SDKs or catalogues. @param {import("../index.mjs").RepoContext} c */
function budgeted(c) {
  return c.sourceFiles.filter(
    (f) => !/\.d\.ts$|(^|\/)(scripts|tests?|e2e|sdk|i18n|locales|openapi-src)\//.test(f),
  );
}
