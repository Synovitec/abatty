/**
 * Freshness (standard DOC.5): whether a document is behind the code it names, judged by commits
 * rather than by its typed date, and the dangling source_truth entry that switches that check
 * off. Its own module, apart from the other document probes, because it is the one that reads the
 * history rather than the tree.
 */
import { dirname, posix } from "node:path";
import { lastChange, verifiedIn } from "./history.mjs";
import { frontMatter } from "./lib.mjs";
import { BEHIND_CODE_CONTROLS } from "./freshness-controls.mjs";

const FM = (extra = "") =>
  `---\ntitle: "T"\ndescription: "D"\ncategory: reference\nstatus: living\n${extra}---\n\n# T\n`;

/**
 * The tree prefix of a source_truth entry: the folders before the segment that holds the first
 * glob character, without a trailing slash; an entry starting with `./` or `../` is read from the
 * document's folder, any other from the root. Null when the entry leaves the repository. The
 * whole segment goes, not the text after the character: `src/core/secret*.mjs` cut at the star
 * left `src/core/secret`, a path that never exists, and a live entry read as dangling.
 * @param {string} entry @param {string} doc the document's path
 */
function prefixOf(entry, doc) {
  const i = entry.search(/[*?{[]/);
  const raw = (i < 0 ? entry : entry.slice(0, entry.lastIndexOf("/", i) + 1)).replace(/\/+$/, "");
  const p = /^\.\.?\//.test(raw) ? posix.normalize(posix.join(dirname(doc), raw)) : raw;
  return p.startsWith("../") || p === ".." ? null : p;
}

/** @type {import("../index.mjs").Probe[]} */
export const probes = [
  {
    metric: "docs.behindCode",
    kind: "ratchet",
    // 2: judged by commits, not by the typed date. A floor written under 1 is reported as
    // redefined rather than compared: the two numbers answer different questions.
    // 3: whitespace ignored outside Python and YAML, comment-only commits ignored: counted
    // differently, so a floor written under 2 is reported as redefined.
    // 4: a Markdown source moves when its body does, not its front matter.
    version: 4,
    standard: ["DOC.5"],
    title: "Documents whose source_truth changed after the document last did",
    why: "Freshness is measured against the diff, never the calendar: when the code a doc names changed after the doc last did, the doc is unverified against what it describes, and an agent reading it confidently does the wrong thing. It is judged by commits, not by the typed date: a date that could be bumped without reading anything made the rule a habit of date-bump commits, and flagged a decision log updated in the very commit as its source. The count is a prompt to re-read, not a claim that the doc is wrong.",
    axis: "docs-freshness",
    lossAt: 20,
    approximates:
      "whether a document is still true. It counts one observable fact instead: a commit changed a cited path after the last commit that changed the document itself, a commit that only moves a document's verification date, or only reformats (outside Python and YAML, where indentation is meaning) or rewrites a comment in code, counting for neither side; a cited Markdown source moves only when its body does, not its front matter; what abatty writes as its own record (the version pin, the baseline, the harness lock) moves no source, a floor edited by hand in the baseline included; a `docs-verified:` line naming a document's path counts as a re-read of it at that commit, and names only the documents it lists. A document never committed falls back to its typed last_verified date; a shallow clone is not judged at all. It is wrong in both directions - an unrelated edit to the document counts as a re-read, a change to a part of the source the document never described counts as a move, and a document that went stale because code it does NOT cite changed counts as fresh. Read a finding as a prompt to re-read, never as a verdict that the document is wrong.",
    scan: (c) => {
      // A shallow clone's oldest commit adds every file at once, so it read as the last change of
      // every document and every source, and every document read fresh: a floor above zero then
      // failed as unlocked in a pipeline that checks out one commit. There is no history to judge
      // by, and saying so is the honest verdict.
      if (c.git("rev-parse", "--is-shallow-repository") === "true")
        return {
          scanned: 0,
          findings: [],
          skipped:
            "a shallow clone has no history to judge freshness by; fetch the full history (fetch-depth: 0) where this metric must hold",
        };
      const findings = [];
      let scanned = 0;
      // Newest first: a smaller index is a later commit on this branch's history.
      const order = new Map(
        c
          .git("log", "--format=%H", "-5000")
          .split("\n")
          .filter(Boolean)
          .map((sha, i) => [sha, i]),
      );
      const at = (/** @type {string} */ sha) => order.get(sha) ?? Number.MAX_SAFE_INTEGER;
      const namedIn = verifiedIn(c);
      /** The newest re-read of a document: its own last real change, or a message naming it. */
      const readOf = (/** @type {string} */ doc) => {
        const own = lastChange(c, doc);
        const named = namedIn.find((v) => v.paths.some((p) => p === doc || doc.endsWith(`/${p}`)));
        if (!named) return own;
        return !own || at(named.sha) < at(own) ? named.sha : own;
      };
      const dateOf = (/** @type {string} */ sha) => c.git("log", "-1", "--format=%cs", sha);
      for (const f of c.docFiles) {
        const fm = frontMatter(c.read(f));
        const truth = fm && Array.isArray(fm.source_truth) ? fm.source_truth : [];
        const verified = fm && typeof fm.last_verified === "string" ? fm.last_verified : "";
        if (!truth.length || !verified) continue;
        if (["archived", "deprecated", "stable"].includes(String(fm?.status))) continue;
        scanned++;
        const read = readOf(f);
        const behind = [];
        for (const entry of truth) {
          const p = prefixOf(entry, f);
          if (!p || !c.exists(p)) continue;
          const moved = lastChange(c, p, { bodyOnly: true });
          if (!moved) continue;
          if (read) {
            if (at(moved) < at(read)) behind.push(`${entry} changed ${dateOf(moved)}`);
          } else {
            const last = dateOf(moved);
            if (last && last > verified) behind.push(`${entry} moved ${last}`);
          }
        }
        if (behind.length)
          findings.push({
            path: f,
            detail: `${read ? `last changed ${dateOf(read)}` : `verified ${verified}`}; ${behind.join("; ")}`,
          });
      }
      return { scanned, findings };
    },
    controls: BEHIND_CODE_CONTROLS,
  },
  {
    metric: "docs.danglingSource",
    kind: "hard",
    standard: ["DOC.5"],
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
        name: "a star inside a file name keeps the folder that holds it",
        files: {
          "docs/a.md": FM('source_truth:\n  - "src/core/secret*.mjs"\n'),
          "src/core/secrets.mjs": "export {};\n",
        },
        expect: 0,
      },
      {
        name: "a star inside a file name in a folder that is gone",
        files: { "docs/a.md": FM('source_truth:\n  - "src/gone/secret*.mjs"\n') },
        expect: 1,
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
