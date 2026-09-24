/**
 * Succession (standard DOC.2): a dated reading names the one that replaced it. `abatty measure`
 * writes `GAP_ANALYSIS_<date>.md` on every run, and an adopter's series ran with one reading that
 * named no successor: an agent that lands on it reads a superseded score as the current one, and
 * no docs probe said so. Opt-in, because a repository whose documents carry no dated series has
 * nothing here to count.
 */
import { posix } from "node:path";
import { frontMatter } from "./lib.mjs";

/** A dated reading: `<stem>_<YYYY-MM-DD>.md` (or `-<date>`), one of a series sharing its stem. */
export const DATED_READING = /^(.+?)[_-](\d{4}-\d{2}-\d{2})\.md$/;

const FM = (extra = "") =>
  `---\ntitle: "T"\ndescription: "D"\ncategory: reference\nstatus: living\n${extra}---\n\n# T\n`;

/**
 * The dated readings of a list of paths, by series (folder and stem), each series oldest first.
 * @param {string[]} paths
 * @returns {string[][]}
 */
export function readingSeries(paths) {
  /** @type {Map<string, string[]>} */
  const series = new Map();
  for (const p of paths) {
    const m = DATED_READING.exec(posix.basename(p));
    if (!m) continue;
    const key = `${posix.dirname(p)}/${m[1]}`;
    series.set(key, [...(series.get(key) || []), p]);
  }
  return [...series.values()]
    .filter((s) => s.length > 1)
    .map((s) => s.sort((a, b) => dateOf(a).localeCompare(dateOf(b))));
}

/** @param {string} p */
function dateOf(p) {
  return DATED_READING.exec(posix.basename(p))?.[2] || "";
}

/**
 * Where a `superseded_by` value points, as a repository path: relative to the document, or from
 * the root when the document's folder does not hold it.
 * @param {string} doc @param {string} value @param {(p: string) => boolean} exists
 */
function successorOf(doc, value, exists) {
  const near = posix.normalize(posix.join(posix.dirname(doc), value));
  return exists(near) ? near : exists(value.replace(/^\.\//, "")) ? value : "";
}

/** @type {import("../index.mjs").Probe[]} */
export const probes = [
  {
    metric: "docs.supersededChain",
    kind: "ratchet",
    optIn: true,
    probation: true,
    standard: ["DOC.2"],
    title: "Documents replaced by a newer one that do not name it",
    why: "A dated reading that does not name its successor reads as the current one: an agent that lands on the older gap analysis quotes its score as today's. The front matter's superseded_by is the one link from the old reading to the new, and an archived document without one leaves its reader nowhere.",
    approximates:
      "stands in for knowing which document replaced which: in a dated series (`<stem>_<date>.md` in one folder) where one reading names a successor, every reading but the newest must; every archived document must; a superseded_by naming nothing counts wherever it is. A series nobody chained (nightly reports, a log) is a record, not a succession, and is not read",
    axis: "docs-freshness",
    lossAt: 10,
    emptyScanOk: true,
    scan: (c) => {
      const exists = (/** @type {string} */ p) => c.exists(p);
      const nextOf = new Map(
        c.docFiles.map((f) => {
          const fm = frontMatter(c.read(f));
          return [
            f,
            { fm, next: fm && typeof fm.superseded_by === "string" ? fm.superseded_by : "" },
          ];
        }),
      );
      // Only a series that started a chain owes one: a nightly report records its night and is
      // replaced by nothing, while a reading whose predecessor names it is the next link.
      const older = new Set(
        readingSeries(c.docFiles)
          .filter((s) => s.some((f) => nextOf.get(f)?.next))
          .flatMap((s) => s.slice(0, -1)),
      );
      const findings = [];
      for (const f of c.docFiles) {
        const { fm, next } = nextOf.get(f) || { fm: null, next: "" };
        if (next && !successorOf(f, next, exists))
          findings.push({ path: f, line: 1, detail: `superseded_by \`${next}\` names nothing` });
        else if (!next && older.has(f))
          findings.push({
            path: f,
            line: 1,
            detail: "a newer reading exists and this one does not name it",
          });
        else if (!next && fm?.status === "archived")
          findings.push({ path: f, line: 1, detail: "archived without superseded_by" });
      }
      return { scanned: c.docFiles.length, findings };
    },
    controls: [
      {
        name: "a chain that stops before the newest reading, an archived doc alone, a dangling link",
        files: {
          "docs/GAP_ANALYSIS_2026-09-20.md": FM('superseded_by: "./GAP_ANALYSIS_2026-09-21.md"\n'),
          "docs/GAP_ANALYSIS_2026-09-21.md": FM(),
          "docs/GAP_ANALYSIS_2026-09-22.md": FM(),
          "docs/old.md": FM().replace("living", "archived"),
          "docs/moved.md": FM('superseded_by: "./gone.md"\n'),
        },
        expect: 3,
      },
      {
        name: "a chained series, a newest reading, a dated note alone and a link from the root hold",
        files: {
          "docs/GAP_ANALYSIS_2026-09-20.md": FM('superseded_by: "./GAP_ANALYSIS_2026-09-21.md"\n'),
          "docs/GAP_ANALYSIS_2026-09-21.md": FM(),
          "docs/notes/2026-09-19-forums.md": FM(),
          "docs/reports/night-2026-09-19.md": FM(),
          "docs/reports/night-2026-09-20.md": FM(),
          "docs/old.md": FM('superseded_by: "docs/GAP_ANALYSIS_2026-09-21.md"\n').replace(
            "living",
            "archived",
          ),
        },
        expect: 0,
      },
    ],
  },
];
