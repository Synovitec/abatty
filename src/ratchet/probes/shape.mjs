/**
 * The shape rules switched off where they should hold. The standard sets a function's length,
 * its parameters and its complexity, and forbids disabling one inline to make code fit; a
 * repository adopting the rules on a large tree lists the files they are still off for. Both are
 * exemptions, and this counts them so they can only shrink. Opt-in (`ratchet.enable`); every
 * preset enables it for a new repository. Moved from the outside trial's own probe, which counted
 * the list alone, widened to the inline form and to every linter a pack names.
 */
import { codeOnly, lineAt } from "./lex.mjs";

/** @typedef {import("../index.mjs").Probe} Probe */

/**
 * An inline switch-off of a shape rule, whichever linter: an eslint or oxlint directive naming
 * one, a biome ignore of a complexity rule, a ruff noqa of a complexity or argument-count code,
 * a pylint disable of a too-many check.
 */
const INLINE_OFF =
  /(?:eslint|oxlint)-disable(?:-next-line|-line)?[^\n]*\b(?:max-lines|max-lines-per-function|max-params|max-depth|max-statements|complexity)\b|biome-ignore\s+lint\/complexity\/\w+|#\s*noqa:[^\n]*\b(?:C901|PLR091[1-7])\b|pylint:\s*disable=[^\n]*\btoo-many-(?:branches|statements|arguments|locals|lines)\b/g;

/** @type {Probe[]} */
export const probes = [
  {
    metric: "fn.shapeExemptions",
    kind: "ratchet",
    optIn: true,
    standard: ["CODE.2"],
    title: "Shape rules switched off inline or by an exemption list",
    why: "A function over its length, its parameters or its complexity is where an agent stops reading whole. The rules may be off for a file while a large tree adopts them, from a list that may only shrink, and never inline to make one function fit. The count is the inline switch-offs plus the files the list `ratchet.shapeList` names.",
    approximates:
      "stands in for a parser, which would be a dependency: a text reading of a directive that switches off a shape rule (eslint, oxlint, biome, ruff, pylint spellings) in a source file, plus the length of the `files` array of the JSON list `ratchet.shapeList` points to; that the listed files still fail is the linter's check, not this one's",
    axis: "navigability",
    lossAt: 50,
    emptyScanOk: true,
    scan: (c, o) => {
      const findings = [];
      for (const f of c.sourceFiles) {
        const text = codeOnly(c.read(f), { comments: "keep" });
        for (const m of text.matchAll(INLINE_OFF))
          findings.push({
            path: f,
            line: lineAt(text, m.index ?? 0),
            detail: `switched off inline: ${m[0].slice(0, 60)}`,
          });
      }
      const list =
        typeof o.config.shapeList === "string" && o.config.shapeList
          ? c.readJson(o.config.shapeList)
          : null;
      for (const path of Array.isArray(list?.files) ? list.files : [])
        findings.push({ path: String(path), line: 1, detail: `exempted by ${o.config.shapeList}` });
      return { scanned: c.sourceFiles.length, findings };
    },
    controls: [
      {
        name: "a shape rule switched off inline, in two linters' spellings, and a listed file count",
        config: { shapeList: "scripts/ci/shape-exemptions.json" },
        files: {
          "src/a.ts":
            "// eslint-disable-next-line max-params, no-console\nexport function f(a, b, c, d, e) {}\n",
          "src/b.py": "def g(a, b, c, d, e, f):  # noqa: PLR0913\n    pass\n",
          "scripts/ci/shape-exemptions.json": '{ "files": ["src/c.ts"] }\n',
          "src/c.ts": "export const c = 1\n",
        },
        expect: 3,
      },
      {
        name: "a switch-off of another rule is not a shape exemption, and an empty list is zero",
        config: { shapeList: "scripts/ci/shape-exemptions.json" },
        files: {
          "src/a.ts": "// eslint-disable-next-line no-console\nconsole.log(1)\n",
          "src/fixture.ts": 'export const f = "// eslint-disable-next-line max-params"\n',
          "scripts/ci/shape-exemptions.json": '{ "files": [] }\n',
        },
        expect: 0,
      },
    ],
  },
];
