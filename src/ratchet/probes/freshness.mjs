/**
 * Freshness (standard DOC.5): whether a document is behind the code it names, judged by commits
 * rather than by its typed date, and the dangling source_truth entry that switches that check
 * off. Its own module, apart from the other document probes, because it is the one that reads the
 * history rather than the tree.
 */
import { dirname, posix } from "node:path";
import { frontMatter } from "./lib.mjs";

const FM = (extra = "") =>
  `---\ntitle: "T"\ndescription: "D"\ncategory: reference\nstatus: living\n${extra}---\n\n# T\n`;

/** A diff line of a document that only moves a verification date. */
const DATE_LINE = /^[+-]\s*(last_verified|last_reviewed|updated)\s*:/;

/**
 * The newest commit that changed `path` beyond a document's verification date, as a sha, or ""
 * when git has none within reach (a file never committed). A commit whose only change to a
 * DOCUMENT under the path is a date line is passed over: bumping the date re-read nothing, and a
 * source doc whose date alone moved has not moved. In any other file a date line is content: a
 * config whose `updated:` changed has moved. A re-read with no edit is not read here but from a
 * `docs-verified:` line naming the document (see `readOf`), one rule for both.
 * @param {import("../../rules/context.mjs").RepoContext} c @param {string} path
 */
function lastChange(c, path) {
  const log = c.git("log", "-50", "--format=%H", "--", path);
  for (const sha of log.split("\n").filter(Boolean)) {
    let file = "";
    for (const l of c.git("show", "--format=", "-U0", sha, "--", path).split("\n")) {
      if (l.startsWith("+++ ")) file = l.slice(4).replace(/^b\//, "");
      if (/^(\+\+\+|---)\s/.test(l) || !/^[+-]/.test(l)) continue;
      if (file.endsWith(".md") && DATE_LINE.test(l)) continue;
      return sha;
    }
  }
  return "";
}

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
    version: 2,
    standard: ["DOC.5"],
    title: "Documents whose source_truth changed after the document last did",
    why: "Freshness is measured against the diff, never the calendar: when the code a doc names changed after the doc last did, the doc is unverified against what it describes, and an agent reading it confidently does the wrong thing. It is judged by commits, not by the typed date: a date that could be bumped without reading anything made the rule a habit of date-bump commits, and flagged a decision log updated in the very commit as its source. The count is a prompt to re-read, not a claim that the doc is wrong.",
    axis: "docs-freshness",
    lossAt: 20,
    approximates:
      "whether a document is still true. It counts one observable fact instead: a commit changed a cited path after the last commit that changed the document itself, a commit that only moves a document's verification date counting for neither side; a `docs-verified:` line naming a document's path counts as a re-read of it at that commit, and names only the documents it lists. A document never committed falls back to its typed last_verified date; a shallow clone is not judged at all. It is wrong in both directions - an unrelated edit to the document counts as a re-read, a change to a part of the source the document never described counts as a move, and a document that went stale because code it does NOT cite changed counts as fresh. Read a finding as a prompt to re-read, never as a verdict that the document is wrong.",
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
      // A re-read that changed nothing, named in a commit message: `docs-verified: <paths>`
      // records which documents were read, with no edit to invent. Newest first.
      const namedIn = c
        .git("log", "-500", "-i", "--grep=docs-verified:", "--format=%H%x1f%B%x1e")
        .split("\x1e")
        .map((record) => record.trim().split("\x1f"))
        .filter(([sha]) => sha)
        .map(([sha = "", body = ""]) => ({
          sha,
          paths: (body.match(/^\s*docs-verified:(.*)$/gim) || []).flatMap((line) =>
            line
              .replace(/^\s*docs-verified:/i, "")
              .split(/[\s,;]+/)
              .map((w) => w.replace(/^[`'"(]+|[`'".):]+$/g, ""))
              .filter((w) => w.endsWith(".md")),
          ),
        }));
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
          const moved = lastChange(c, p);
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
        // The typed date alone re-reads nothing: bumping it after the source moved used to be the
        // whole cure, and a rule that a date satisfies trains date-bump commits.
        name: "a date bumped alone after the source moved is not a re-read",
        files: {
          "docs/a.md": FM(`last_verified: "2020-01-01"\nsource_truth:\n  - "src/x.ts"\n`),
          "src/x.ts": "export {};\n",
        },
        commits: [
          { files: { "src/x.ts": "export const later = 1;\n" }, message: "feat: later" },
          {
            files: {
              "docs/a.md": FM(`last_verified: "2099-01-01"\nsource_truth:\n  - "src/x.ts"\n`),
            },
            message: "docs: date",
          },
        ],
        expect: 1,
      },
      {
        name: "a doc changed in the same commit as its source, or after it, is fresh whatever its date says",
        files: {
          "docs/a.md": FM(`last_verified: "2020-01-01"\nsource_truth:\n  - "src/x.ts"\n`),
          "docs/b.md": FM(`last_verified: "2020-01-01"\nsource_truth:\n  - "src/y.ts"\n`),
          "src/x.ts": "export {};\n",
          "src/y.ts": "export {};\n",
        },
        commits: [
          {
            files: {
              "src/x.ts": "export const later = 1;\n",
              "docs/a.md":
                FM(`last_verified: "2020-01-01"\nsource_truth:\n  - "src/x.ts"\n`) +
                "\nThe later export.\n",
            },
            message: "feat: later, and its doc",
          },
          { files: { "src/y.ts": "export const y = 1;\n" }, message: "feat: y" },
          {
            files: {
              "docs/b.md":
                FM(`last_verified: "2020-01-01"\nsource_truth:\n  - "src/y.ts"\n`) +
                "\nWhat y is.\n",
            },
            message: "docs: y",
          },
        ],
        expect: 0,
      },
      {
        name: "a re-read that changed nothing is on the record, and a source doc whose date alone moved has not moved",
        files: {
          "docs/a.md": FM(`last_verified: "2020-01-01"\nsource_truth:\n  - "src/x.ts"\n`),
          "docs/b.md": FM(`last_verified: "2020-01-01"\nsource_truth:\n  - "./c.md"\n`),
          "docs/c.md": FM(`last_verified: "2020-01-01"\n`),
          "src/x.ts": "export {};\n",
        },
        commits: [
          { files: { "src/x.ts": "export const later = 1;\n" }, message: "feat: later" },
          {
            files: {
              "docs/a.md": FM(`last_verified: "2099-01-01"\nsource_truth:\n  - "src/x.ts"\n`),
              "docs/c.md": FM(`last_verified: "2099-01-01"\n`),
            },
            message: "docs: re-read\n\ndocs-verified: a.md still describes x.ts",
          },
        ],
        expect: 0,
      },
      {
        name: "a re-read named in a commit message counts for the documents it names, and only those",
        files: {
          "docs/a.md": FM(`last_verified: "2020-01-01"\nsource_truth:\n  - "src/x.ts"\n`),
          "docs/b.md": FM(`last_verified: "2020-01-01"\nsource_truth:\n  - "src/x.ts"\n`),
          "src/x.ts": "export {};\n",
        },
        commits: [
          { files: { "src/x.ts": "export const later = 1;\n" }, message: "feat: later" },
          {
            files: { "notes.txt": "read\n" },
            message: "chore: re-read\n\ndocs-verified: docs/a.md, still describes x.ts",
          },
        ],
        expect: 1,
      },
      {
        // One meaning for the line: a date bumped on two documents re-reads only the one it names,
        // and a config's `updated:` line is content, not a document's date.
        name: "a docs-verified line re-reads the documents it names only, and a config's date is a move",
        files: {
          "docs/a.md": FM(`last_verified: "2020-01-01"\nsource_truth:\n  - "src/x.ts"\n`),
          "docs/b.md": FM(`last_verified: "2020-01-01"\nsource_truth:\n  - "src/x.ts"\n`),
          "docs/c.md": FM(`last_verified: "2020-01-01"\nsource_truth:\n  - "config/app.yml"\n`),
          "src/x.ts": "export {};\n",
          "config/app.yml": "updated: 1\n",
        },
        commits: [
          { files: { "src/x.ts": "export const later = 1;\n" }, message: "feat: later" },
          {
            files: {
              "docs/a.md": FM(`last_verified: "2099-01-01"\nsource_truth:\n  - "src/x.ts"\n`),
              "docs/b.md": FM(`last_verified: "2099-01-01"\nsource_truth:\n  - "src/x.ts"\n`),
            },
            message: "docs: dates\n\ndocs-verified: docs/a.md, still describes x.ts",
          },
          { files: { "config/app.yml": "updated: 2\n" }, message: "chore: config" },
        ],
        expect: 2,
      },
    ],
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
