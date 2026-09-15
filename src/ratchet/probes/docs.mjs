/**
 * Documents (standard DOC-2..5): front matter, the index against the tree, citations that
 * resolve, freshness against the diff, and the dangling source_truth entry that switches a
 * doc's update trigger off.
 */
import { dirname, posix } from "node:path";
import { frontMatter, matchesAny, regexes } from "./lib.mjs";

const CITATION =
  /`([^`\s]+\/[^`\s]*\.(?:mjs|cjs|js|ts|tsx|jsx|json|jsonc|md|ya?ml|sql|ps1|sh|toml|css)(?::\d+)?)`/g;
const FM = (extra = "") =>
  `---\ntitle: "T"\ndescription: "D"\ncategory: reference\nstatus: living\n${extra}---\n\n# T\n`;

/**
 * The tree prefix of a source_truth entry: everything before the first glob character, without
 * a trailing slash; an entry starting with `./` or `../` is read from the document's folder,
 * any other from the root. Null when the entry leaves the repository.
 * @param {string} entry @param {string} doc the document's path
 */
function prefixOf(entry, doc) {
  const i = entry.search(/[*?{[]/);
  const raw = (i < 0 ? entry : entry.slice(0, i)).replace(/\/+$/, "");
  const p = /^\.\.?\//.test(raw) ? posix.normalize(posix.join(dirname(doc), raw)) : raw;
  return p.startsWith("../") || p === ".." ? null : p;
}

/** @type {import("../index.mjs").Probe[]} */
export const probes = [
  {
    metric: "docs.frontMatter",
    kind: "ratchet",
    standard: ["DOC-2"],
    title: "Documents without title, description and status in their front matter",
    why: "The front matter is what lets a machine list, date and index the documents; without it every doc check is a guess.",
    axis: "docs-freshness",
    lossAt: 30,
    scan: (c) => {
      const findings = [];
      for (const f of c.docFiles) {
        const fm = frontMatter(c.read(f));
        const missing = ["title", "description", "status"].filter(
          (k) => !fm || !fm[k] || !String(fm[k]).length,
        );
        if (!fm) findings.push({ path: f, line: 1, detail: "no front matter" });
        else if (missing.length)
          findings.push({ path: f, line: 1, detail: `front matter without ${missing.join(", ")}` });
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
      { name: "the three keys present hold", files: { "docs/a.md": FM() }, expect: 0 },
    ],
  },
  {
    metric: "docs.indexDrift",
    kind: "ratchet",
    standard: ["DOC-3"],
    title: "Documents under docs/ that the index does not name",
    why: "A document nobody can find is a document nobody reads; the index is the one entry point and it is equal to the tree or it is wrong.",
    axis: "docs-freshness",
    lossAt: 30,
    scan: (c) => {
      const index = c.docFiles.find((f) => /^docs\/(README|SOMMAIRE|INDEX)\.md$/i.test(f));
      if (!index) return { scanned: 0, findings: [] };
      const text = c.read(index);
      const others = c.docFiles.filter((f) => f !== index);
      const findings = [];
      for (const f of others) {
        const rel = f.slice("docs/".length);
        if (!text.includes(rel) && !text.includes(posix.basename(f)))
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
    ],
  },
  {
    metric: "docs.citations",
    kind: "ratchet",
    standard: ["DOC-4"],
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
  {
    metric: "docs.behindCode",
    kind: "ratchet",
    standard: ["DOC-5"],
    title: "Documents whose source_truth moved after their last_verified date",
    why: "Freshness is measured against the diff, never the calendar: when the code a doc names was committed after the doc was verified, the doc is behind, and an agent reading it confidently does the wrong thing.",
    axis: "docs-freshness",
    lossAt: 20,
    scan: (c) => {
      const findings = [];
      let scanned = 0;
      for (const f of c.docFiles) {
        const fm = frontMatter(c.read(f));
        const truth = fm && Array.isArray(fm.source_truth) ? fm.source_truth : [];
        const verified = fm && typeof fm.last_verified === "string" ? fm.last_verified : "";
        if (!truth.length || !verified) continue;
        if (["archived", "deprecated", "stable"].includes(String(fm?.status))) continue;
        scanned++;
        const behind = [];
        for (const entry of truth) {
          const p = prefixOf(entry, f);
          if (!p || !c.exists(p)) continue;
          const last = c.git("log", "-1", "--format=%cs", "--", p);
          if (last && last > verified && last !== c.today) behind.push(`${entry} moved ${last}`);
        }
        if (behind.length)
          findings.push({ path: f, detail: `verified ${verified}; ${behind.join("; ")}` });
      }
      return { scanned, findings };
    },
    controls: [
      {
        name: "the source moved after the doc was verified",
        files: {
          "docs/a.md": FM('last_verified: "2020-01-01"\nsource_truth:\n  - "src/x.ts"\n'),
          "src/x.ts": "export {};\n",
        },
        commits: [
          {
            files: { "src/x.ts": "export const later = 1;\n" },
            message: "feat: later",
            date: "2021-06-01T12:00:00Z",
          },
        ],
        expect: 1,
      },
      {
        name: "a doc verified today holds",
        files: {
          "docs/a.md": FM(
            `last_verified: "${new Date().toISOString().slice(0, 10)}"\nsource_truth:\n  - "src/x.ts"\n`,
          ),
          "src/x.ts": "export {};\n",
        },
        expect: 0,
      },
    ],
  },
  {
    metric: "docs.danglingSource",
    kind: "hard",
    standard: ["DOC-5"],
    title: "source_truth entries that name nothing in the tree",
    why: "A dangling source_truth entry is the doc's update trigger switched off: the code it watched is gone or renamed and the doc will never be marked behind again.",
    axis: "docs-freshness",
    lossAt: 5,
    scan: (c) => {
      const findings = [];
      let scanned = 0;
      for (const f of c.docFiles) {
        const fm = frontMatter(c.read(f));
        const truth = fm && Array.isArray(fm.source_truth) ? fm.source_truth : [];
        for (const entry of truth) {
          const p = prefixOf(entry, f);
          if (p === null) continue;
          scanned++;
          if (!p || !c.exists(p))
            findings.push({ path: f, detail: `source_truth \`${entry}\` names nothing` });
        }
      }
      return { scanned, findings };
    },
    controls: [
      {
        name: "an entry naming a file that is gone",
        files: { "docs/a.md": FM('source_truth:\n  - "src/gone/**"\n') },
        expect: 1,
      },
      {
        name: "an entry naming a folder that exists",
        files: { "docs/a.md": FM('source_truth:\n  - "src/**"\n'), "src/x.ts": "export {};\n" },
        expect: 0,
      },
      {
        name: "an entry relative to the document's folder resolves from there",
        files: {
          "docs/standard/a.md": FM('source_truth:\n  - "./guides/*.md"\n  - "../../src/**"\n'),
          "docs/standard/guides/g.md": FM(),
          "src/x.ts": "export {};\n",
        },
        expect: 0,
      },
    ],
  },
];
