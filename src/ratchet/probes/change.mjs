/**
 * Delivery (standard CHANGE.1): over the pushed range, every commit that touches source is
 * followed or accompanied by a changelog touch. A rule about commits, so it reads the range
 * alone, never the tree; with no range there is nothing to judge and the probe says so.
 */

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
      const log = c.git("log", "--reverse", "--format=%h%x00%s", o.range);
      if (!log) return { scanned: 0, findings: [] };
      const commits = log.split("\n").map((l) => l.split("\0"));
      const required = o.config.changelogRequiredFor;
      const changelog = o.config.changelog;
      /** @type {{ path: string, detail: string }[]} */
      let offenders = [];
      for (const [sha, subject] of commits) {
        const files = c
          .git("show", "--name-only", "--format=", String(sha))
          .split("\n")
          .filter(Boolean);
        if (files.includes(changelog)) {
          offenders = [];
          continue;
        }
        if (files.some((f) => required.some((p) => f.startsWith(p) || f.includes(p))))
          offenders.push({
            path: String(sha),
            detail: `${subject} (no ${changelog} touch after it)`,
          });
      }
      return { scanned: commits.length, findings: offenders };
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
];
