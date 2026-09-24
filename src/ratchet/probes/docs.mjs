/**
 * Documents (standard DOC.2..4): front matter, the index against the tree, and citations that
 * resolve. Freshness against the diff (DOC.5) is in freshness.mjs.
 */
import { dirname, posix } from "node:path";
import { frontMatterFaults } from "./frontmatter.mjs";
import { frontMatter, matchesAny, regexes } from "./lib.mjs";

const CITATION =
  /`([^`\s]+\/[^`\s]*\.(?:mjs|cjs|js|ts|tsx|jsx|json|jsonc|md|ya?ml|sql|ps1|sh|toml|css)(?::\d+)?)`/g;
// A path the index names, taken whole: bounded at both ends so one document's name cannot be
// matched inside another's. Covers a backticked path, a link target and a bare mention.
const NAMED = /(?:^|[\s`([<|])((?:[\w.-]+\/)*[\w.-]+\.md)(?=[\s`)\]>|,.:]|$)/gm;
const FM = (extra = "") =>
  `---\ntitle: "T"\ndescription: "D"\ncategory: reference\nstatus: living\n${extra}---\n\n# T\n`;

/** @type {import("../index.mjs").Probe[]} */
export const probes = [
  {
    metric: "docs.frontMatter",
    // 2: a document also counts when a YAML reader would refuse its front matter or read it as
    // another structure (a duplicate key, a key indented under a scalar, a quote left open).
    version: 2,
    kind: "ratchet",
    standard: ["DOC.2"],
    title:
      "Documents without title, description and status in their front matter, or with front matter a YAML reader refuses",
    why: "The front matter is what lets a machine list, date and index the documents; without it every doc check is a guess. A block a YAML reader refuses is no front matter to a site generator or a content schema, even when a hand reading finds its keys.",
    axis: "docs-freshness",
    lossAt: 30,
    scan: (c) => {
      const findings = [];
      for (const f of c.docFiles) {
        const text = c.read(f);
        const fm = frontMatter(text);
        const missing = ["title", "description", "status"].filter(
          (k) => !fm || !fm[k] || !String(fm[k]).length,
        );
        const [fault, ...more] = frontMatterFaults(text);
        if (!fm) findings.push({ path: f, line: 1, detail: "no front matter" });
        else if (missing.length)
          findings.push({ path: f, line: 1, detail: `front matter without ${missing.join(", ")}` });
        else if (fault)
          findings.push({
            path: f,
            line: fault.line,
            detail: `front matter a YAML reader refuses: ${fault.fault}${more.length ? ` (and ${more.length} more)` : ""}`,
          });
      }
      return { scanned: c.docFiles.length, findings };
    },
    controls: [
      {
        name: "a doc opening with a heading has no front matter",
        files: { "docs/a.md": "# A\n\ntext\n" },
        expect: 1,
      },
      {
        name: "front matter without a status is reported",
        files: { "docs/a.md": '---\ntitle: "A"\ndescription: "D"\n---\n# A\n' },
        expect: 1,
      },
      {
        name: "a duplicate key, a key indented under a scalar and an open quote each count",
        files: {
          "docs/a.md": FM("status: stable\n"),
          "docs/b.md": FM('owner: "platform"\n  reviewed: yes\n'),
          "docs/c.md": FM('tags: ["x"\n'),
          "docs/d.md": FM('summary: "open\n'),
        },
        expect: 4,
      },
      {
        name: "the three keys present hold, with a list, a block scalar and a quoted colon",
        files: {
          "docs/a.md": FM(),
          "docs/b.md": FM('tags:\n- a\n- b\nnotes: |\n  due: soon\nrelated: ["./a.md"] # c\n'),
          "docs/c.md": FM('owner: "Issue #4: platform"\nlast_verified: 2026-09-24\n'),
        },
        expect: 0,
      },
    ],
  },
  {
    metric: "docs.indexDrift",
    kind: "ratchet",
    standard: ["DOC.3"],
    title: "Documents under docs/ that the index does not name",
    why: "A document nobody can find is a document nobody reads; the index is the one entry point and it is equal to the tree or it is wrong.",
    axis: "docs-freshness",
    lossAt: 30,
    scan: (c) => {
      const index = c.docFiles.find((f) => /^docs\/(README|SOMMAIRE|INDEX)\.md$/i.test(f));
      if (!index) return { scanned: 0, findings: [] };
      // The paths the index actually names, each taken whole. A substring match read PLAN.md as
      // named because the index carries standard/ADOPTION_PLAN.md, so a document whose name ends
      // another document's name was invisible to this check: it reported nothing and the missing
      // row stayed missing.
      const named = new Set();
      for (const m of c.read(index).matchAll(NAMED)) named.add(String(m[1]).replace(/^\.\//, ""));
      const others = c.docFiles.filter((f) => f !== index);
      const findings = [];
      for (const f of others) {
        const rel = f.slice("docs/".length);
        if (!named.has(rel) && !named.has(posix.basename(f)))
          findings.push({ path: f, detail: `not in ${index}` });
      }
      return { scanned: others.length, findings };
    },
    controls: [
      {
        name: "a doc the index does not name",
        files: {
          "docs/README.md": "# Index\n\n| `A.md` |\n",
          "docs/A.md": FM(),
          "docs/B.md": FM(),
        },
        expect: 1,
      },
      {
        name: "every doc named holds",
        files: {
          "docs/README.md": "# Index\n\n`A.md` `B.md`\n",
          "docs/A.md": FM(),
          "docs/B.md": FM(),
        },
        expect: 0,
      },
      {
        // The case the substring match could not see: PLAN.md is missing from the index and
        // ADOPTION_PLAN.md ends with it, so the check reported nothing while the row was absent.
        name: "a doc whose name ends another doc's name is still missing",
        files: {
          "docs/README.md": "# Index\n\n| `standard/ADOPTION_PLAN.md` |\n",
          "docs/standard/ADOPTION_PLAN.md": FM(),
          "docs/PLAN.md": FM(),
        },
        expect: 1,
      },
      {
        name: "the longer name is named in its own right",
        files: {
          "docs/README.md": "# Index\n\n| `standard/ADOPTION_PLAN.md` | `PLAN.md` |\n",
          "docs/standard/ADOPTION_PLAN.md": FM(),
          "docs/PLAN.md": FM(),
        },
        expect: 0,
      },
    ],
  },
  {
    metric: "docs.citations",
    kind: "ratchet",
    standard: ["DOC.4"],
    title: "Path citations in documents that do not resolve",
    why: "A doc cites the code it describes; a citation that no longer resolves is the first sign the doc is behind, and a reader following it lands nowhere. A document that describes another repository (a standard, a guide) is exempt through citationsExempt.",
    axis: "docs-freshness",
    lossAt: 40,
    scan: (c, o) => {
      const findings = [];
      let scanned = 0;
      const exempt = regexes(o.config.citationsExempt);
      for (const f of c.docFiles) {
        if (matchesAny(f, exempt)) continue;
        const text = c.read(f);
        const dir = dirname(f);
        for (const m of text.matchAll(CITATION)) {
          const raw = (m[1] || "").replace(/:\d+$/, "");
          if (/[*?{<>$]/.test(raw) || raw.startsWith("http")) continue;
          scanned++;
          const candidates = [raw, posix.normalize(posix.join(dir, raw))].filter(
            (p) => !p.startsWith("../"),
          );
          if (!candidates.length) continue;
          if (!candidates.some((p) => c.exists(p))) {
            const line = text.slice(0, m.index).split("\n").length;
            findings.push({ path: f, line, detail: `\`${m[1]}\` does not resolve` });
          }
        }
      }
      return { scanned, findings };
    },
    controls: [
      {
        name: "a cited path that does not exist",
        files: { "docs/a.md": FM() + "See `src/gone.ts:12`.\n" },
        expect: 1,
      },
      {
        name: "a cited path that exists, from the root or the doc's folder",
        files: {
          "docs/a.md": FM() + "See `src/here.ts` and `../src/here.ts`.\n",
          "src/here.ts": "export {};\n",
        },
        expect: 0,
      },
      {
        name: "a glob is not a citation",
        files: { "docs/a.md": FM() + "Under `src/**/*.ts`.\n" },
        expect: 0,
      },
    ],
  },
];
