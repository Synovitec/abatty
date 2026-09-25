/**
 * The control cases of `docs.behindCode`, both directions: kept beside the probe rather than in it,
 * because the probe is what a repository is judged by and these are the proof that it can go red
 * and stay green, which grow with every false reading an adopter reports.
 */

/** A document with front matter and whatever `extra` keys the case needs. @param {string} [extra] */
const FM = (extra = "") =>
  `---
title: "T"
description: "D"
category: reference
status: living
${extra}---

# T
`;

/** @type {import("../index.mjs").Control[]} */
export const BEHIND_CODE_CONTROLS = [
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
            FM(`last_verified: "2020-01-01"\nsource_truth:\n  - "src/y.ts"\n`) + "\nWhat y is.\n",
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
  {
    // A reformat or a reworded comment changes nothing a document describes; a private
    // field's `#` is code in JavaScript, not a comment.
    // In Python and YAML the indentation is the meaning: a statement moved out of a block moved.
    name: "a cited file only reformatted or recommented has not moved; a private field or a Python reindent has",
    files: {
      "docs/a.md": FM(`last_verified: "2020-01-01"\nsource_truth:\n  - "src/x.ts"\n`),
      "docs/b.md": FM(`last_verified: "2020-01-01"\nsource_truth:\n  - "src/y.mjs"\n`),
      "docs/c.md": FM(`last_verified: "2020-01-01"\nsource_truth:\n  - "src/z.py"\n`),
      "src/x.ts": "// the export\nexport function x() {\nreturn 1;\n}\n",
      "src/y.mjs": "export class Y {}\n",
      "src/z.py": "def z(a):\n    if a:\n        a = 1\n    return a\n",
      // a document citing documents: one's front matter is rewritten (a split's new globs),
      // the other's body changes
      "docs/d.md": FM(
        `last_verified: "2020-01-01"\nsource_truth:\n  - "docs/p.md"\n  - "docs/q.md"\n`,
      ),
      "docs/p.md": FM(`source_truth:\n  - "src/x.ts"\n`) + "The rule.\n",
      "docs/q.md": FM("") + "The other rule.\n",
    },
    commits: [
      {
        files: { "docs/p.md": FM(`source_truth:\n  - "src/y.mjs"\n`) + "The rule.\n" },
        message: "docs: p cites the file the split moved it to",
      },
      {
        files: {
          "src/x.ts": "// the one export there is\nexport function x() {\n  return 1;\n}\n",
        },
        message: "style: format and a comment",
      },
      {
        files: { "src/y.mjs": "export class Y {\n  #count = 0;\n}\n" },
        message: "feat: count",
      },
      {
        // only the indentation moved: the return now sits inside the branch
        files: { "src/z.py": "def z(a):\n    if a:\n        a = 1\n        return a\n" },
        message: "fix: a is always one",
      },
      {
        files: { "docs/q.md": FM("") + "The other rule, changed.\n" },
        message: "docs: q says something else",
      },
    ],
    expect: 3,
  },
  {
    // An upgrade moved the version pin in the manifest and the config and rewrote the baseline;
    // read as moves, every document citing them went behind and their re-read moved the progress
    // log (two adopters' replays of 0.7.0-rc.1). A script beside the pin still moves the manifest.
    name: "abatty's own records (the version pin, the baseline, the harness lock) move no source; a script beside the pin, or a bin keyed abatty, does",
    files: {
      "docs/pin.md": FM(`last_verified: "2020-01-01"\nsource_truth:\n  - "abatty.config.json"\n`),
      "docs/log.md": FM(
        `last_verified: "2020-01-01"\nsource_truth:\n  - "scripts/ci/standards-baseline.json"\n`,
      ),
      "docs/pkg.md": FM(`last_verified: "2020-01-01"\nsource_truth:\n  - "package.json"\n`),
      "docs/lock.md": FM(`last_verified: "2020-01-01"\nsource_truth:\n  - ".claude/"\n`),
      "docs/bin.md": FM(`last_verified: "2020-01-01"\nsource_truth:\n  - "tool/package.json"\n`),
      ".claude/harness.lock.json": '{\n  "abatty": "0.6.1"\n}\n',
      "tool/package.json": '{\n  "bin": {\n    "abatty": "bin/abatty.mjs"\n  }\n}\n',
      "abatty.config.json": '{\n  "abatty": "0.6.1",\n  "stack": "node"\n}\n',
      "scripts/ci/standards-baseline.json": '{\n  "metrics": { "size.overBudget": 3 }\n}\n',
      "package.json": '{\n  "name": "p",\n  "devDependencies": {\n    "abatty": "^0.6.1"\n  }\n}\n',
    },
    commits: [
      {
        files: {
          "abatty.config.json": '{\n  "abatty": "0.7.0",\n  "stack": "node"\n}\n',
          ".claude/harness.lock.json": '{\n  "abatty": "0.7.0",\n  "files": {}\n}\n',
          "tool/package.json": '{\n  "bin": {\n    "abatty": "cli/abatty.mjs"\n  }\n}\n',
          "scripts/ci/standards-baseline.json": '{\n  "metrics": { "size.overBudget": 2 }\n}\n',
          "package.json":
            '{\n  "name": "p",\n  "devDependencies": {\n    "abatty": "^0.7.0"\n  }\n}\n',
        },
        message: "chore: abatty update, then abatty baseline",
      },
      {
        files: {
          "package.json":
            '{\n  "name": "p",\n  "scripts": { "test": "vitest run" },\n  "devDependencies": {\n    "abatty": "^0.7.1"\n  }\n}\n',
        },
        message: "chore: a test script, and the pin",
      },
    ],
    // package.json (a script beside the pin) and tool/package.json (a bin keyed abatty)
    expect: 2,
  },
];
