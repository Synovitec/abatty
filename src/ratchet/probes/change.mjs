/**
 * Delivery (standard CHANGE.1, CHANGE.2): over the pushed range, every commit that touches
 * source is followed or accompanied by a changelog touch, and every coupled pair the
 * repository declares (a schema and its migration, an API and its client, a document and the
 * code it describes) holds the same way. One mechanism (src/core/coupled.mjs), two probes. A
 * rule about commits, so it reads the range alone, never the tree; with no range there is
 * nothing to judge and the probe says so.
 */
import { changelogPairs, commitsOf, coupledFindings, normalisePairs } from "../../core/coupled.mjs";

/** @type {import("../index.mjs").Probe[]} */
export const probes = [
  {
    metric: "change.changelogMissing",
    kind: "hard",
    standard: ["CHANGE.1"],
    title: "Source commits in the pushed range after the last changelog entry",
    why: "A change that is not written in the same push is lost to the next reader; the [Unreleased] section is where the push writes it, and the range is where the gate checks.",
    emptyScanOk: true,
    scan: (c, o) => {
      if (!o.range)
        return {
          scanned: 0,
          findings: [],
          skipped: "no range (pass --range <a..b>, or auto for the push)",
        };
      const commits = commitsOf(c.git, o.range);
      return {
        scanned: commits.length,
        findings: coupledFindings(commits, changelogPairs(o.config)),
      };
    },
    controls: [
      {
        name: "a source commit with no changelog touch after it",
        files: { "CHANGELOG.md": "# Changelog\n\n## [Unreleased]\n", "src/a.ts": "export {};\n" },
        commits: [{ files: { "src/a.ts": "export const a = 1;\n" }, message: "feat: a" }],
        range: "HEAD~1..HEAD",
        expect: 1,
      },
      {
        name: "the same commit followed by its changelog line",
        files: { "CHANGELOG.md": "# Changelog\n\n## [Unreleased]\n", "src/a.ts": "export {};\n" },
        commits: [
          { files: { "src/a.ts": "export const a = 1;\n" }, message: "feat: a" },
          {
            files: { "CHANGELOG.md": "# Changelog\n\n## [Unreleased]\n\n- a\n" },
            message: "docs: changelog",
          },
        ],
        range: "HEAD~2..HEAD",
        expect: 0,
      },
      {
        name: "a docs-only commit needs no changelog line",
        files: { "CHANGELOG.md": "# Changelog\n", "docs/a.md": "# a\n" },
        commits: [{ files: { "docs/a.md": "# a\n\nmore\n" }, message: "docs: a" }],
        range: "HEAD~1..HEAD",
        expect: 0,
      },
    ],
  },
  {
    metric: "context.unsourcedGrowth",
    kind: "hard",
    standard: ["AIR.1"],
    title: "Lines added to the context file in this push with no lesson behind them",
    why: "A context file grows one reasonable line at a time until it hits the cap and stops being read whole, and every one of those lines was reasonable to whoever added it. The discipline that keeps it short is not a budget, it is a source: a line goes in because something went wrong and was written down, not because it seemed useful at the time. So a push that grows the file must also touch the lessons it grew from.",
    emptyScanOk: true,
    approximates:
      "whether each added line traces to a lesson. It checks something narrower and mechanical instead: that a push which grew the context file also touched the lessons catalogue, or said which lesson in a commit message. A push can satisfy that and still add a line nobody learned - which is a conversation for review, and a far smaller conversation than the one about a file that has quietly doubled.",
    scan: (c, o) => {
      if (!o.range)
        return { scanned: 0, findings: [], skipped: "no range (a rule about a push, not a tree)" };
      const file = c.contextFile;
      if (!file) return { scanned: 0, findings: [], skipped: "no context file" };
      const [from] = String(o.range).split("..");
      const stat = c.git("diff", "--numstat", String(o.range), "--", file).trim();
      if (!stat) return { scanned: 1, findings: [] };
      const added = Number(stat.split(/\s+/)[0]) || 0;
      const removed = Number(stat.split(/\s+/)[1]) || 0;
      const grew = added - removed;
      if (grew <= 0) return { scanned: 1, findings: [] };
      // The two ways a push says where the growth came from: it moved the lessons catalogue in
      // the same range, or a commit message named the lesson.
      const lessons = c
        .git("diff", "--name-only", String(o.range))
        .split("\n")
        .some((f) => /LESSONS\.md$|(^|\/)lessons\//i.test(f.trim()));
      const cited = /\blesson\b/i.test(c.git("log", "--format=%B", String(o.range)));
      if (lessons || cited) return { scanned: 1, findings: [] };
      return {
        scanned: 1,
        findings: [
          {
            path: file,
            detail: `+${grew} line(s) since ${from || "the base"} with no lesson behind them: touch the lessons catalogue in the same push, or name the lesson in the commit`,
            weight: grew,
          },
        ],
      };
    },
    controls: [
      {
        name: "the context file grows and nothing says why",
        files: { "CLAUDE.md": "# c\n\nrule one\n", "docs/standard/LESSONS.md": "# lessons\n" },
        commits: [
          {
            files: { "CLAUDE.md": "# c\n\nrule one\nrule two\nrule three\n" },
            message: "docs: more",
          },
        ],
        range: "HEAD~1..HEAD",
        expect: 2,
      },
      {
        name: "it grows in a push that also wrote the lesson down",
        files: { "CLAUDE.md": "# c\n\nrule one\n", "docs/standard/LESSONS.md": "# lessons\n" },
        commits: [
          {
            files: {
              "CLAUDE.md": "# c\n\nrule one\nrule two\n",
              "docs/standard/LESSONS.md": "# lessons\n\n- the night kept doing X\n",
            },
            message: "docs: rule two",
          },
        ],
        range: "HEAD~1..HEAD",
        expect: 0,
      },
      {
        name: "a push that shortens the context file is never a finding",
        files: { "CLAUDE.md": "# c\n\none\ntwo\nthree\n", "docs/standard/LESSONS.md": "# l\n" },
        commits: [{ files: { "CLAUDE.md": "# c\n\none\n" }, message: "docs: shorter" }],
        range: "HEAD~1..HEAD",
        expect: 0,
      },
    ],
  },
  {
    metric: "change.coupledMissing",
    kind: "hard",
    standard: ["CHANGE.2"],
    title:
      "Coupled paths: a `when` path changed in the pushed range without its `then` path after it",
    why: "When this changes, that changes in the same push: a schema without its migration, an API without its client, a document behind the code it describes. Declared as pairs in the config (coupled), judged per commit, cured by a new commit.",
    emptyScanOk: true,
    scan: (c, o) => {
      const pairs = normalisePairs(o.config.coupled);
      if (!pairs.length)
        return {
          scanned: 0,
          findings: [],
          skipped: "no coupled pairs declared (config → coupled)",
        };
      if (!o.range)
        return {
          scanned: 0,
          findings: [],
          skipped: "no range (pass --range <a..b>, or auto for the push)",
        };
      const commits = commitsOf(c.git, o.range);
      return { scanned: commits.length, findings: coupledFindings(commits, pairs) };
    },
    controls: [
      {
        name: "the schema changed, no migration after it",
        files: { "src/db/schema.ts": "export {};\n", "migrations/0001.sql": "-- one\n" },
        commits: [
          { files: { "src/db/schema.ts": "export const t = 1;\n" }, message: "feat: a column" },
        ],
        range: "HEAD~1..HEAD",
        config: {
          coupled: [
            {
              when: "src/db/schema.ts",
              then: "migrations/",
              why: "a schema change ships its migration",
            },
          ],
        },
        expect: 1,
      },
      {
        name: "the migration in a later commit of the range",
        files: { "src/db/schema.ts": "export {};\n", "migrations/0001.sql": "-- one\n" },
        commits: [
          { files: { "src/db/schema.ts": "export const t = 1;\n" }, message: "feat: a column" },
          { files: { "migrations/0002.sql": "-- two\n" }, message: "feat: its migration" },
        ],
        range: "HEAD~2..HEAD",
        config: { coupled: [{ when: "src/db/schema.ts", then: "migrations/" }] },
        expect: 0,
      },
      {
        name: "a glob pair: the API and its client in the same commit",
        files: { "src/api/users.ts": "export {};\n", "src/client/users.ts": "export {};\n" },
        commits: [
          {
            files: {
              "src/api/users.ts": "export const u = 1;\n",
              "src/client/users.ts": "export const u = 1;\n",
            },
            message: "feat: users",
          },
        ],
        range: "HEAD~1..HEAD",
        config: { coupled: [{ when: "src/api/**/*.ts", then: "src/client/**" }] },
        expect: 0,
      },
    ],
  },
];
