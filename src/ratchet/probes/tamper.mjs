/**
 * The tests an agent's change is judged by, changed by the same change. An agent that cannot make
 * a test pass has cheaper ways out than the fix: remove the case, skip it, rewrite the snapshot,
 * silence the checker, lower the threshold. Published measurements of agents that cheated found
 * most of the cheating was done to the tests. `change.refactorTests` reads refactors only; this
 * reads every commit in the range, which is what a night pushes, and names each way out by what it
 * did. A reviewer decides whether it was the right change; the probe makes sure one is asked.
 */

import { contentLines } from "./diff.mjs";

/** @typedef {import("../index.mjs").Probe} Probe */

const TEST_FILE =
  /(^|\/)(tests?|__tests__|e2e|spec)\/|\.(test|spec)\.[cm]?[jt]sx?$|(^|\/)test_[^/]*\.py$|_test\.(py|go)$/;
const SNAPSHOT = /(^|\/)__snapshots__\/|\.snap$/;
/**
 * A test case, as `change.refactorTests` counts one, and a subtest of the platform's runner
 * (`t.test(`), which that lookbehind would otherwise read as a method call.
 */
const CASE =
  /(?<![.\w$])(?:test|it)(?:\.(?:only|each|concurrent))?\s*\(|\bt\.test\s*\(|^\s*def test_|^func Test/;
/**
 * A case or a suite set aside, or every other case set aside by `only`, in each runner's
 * spelling: the method forms, the x/f prefixes, pytest's marks, Go's `t.Skip`, and the platform
 * runner's options (`test("a", { skip: true }, fn)`) and context (`t.skip()`, `t.todo()`).
 */
const PARKED =
  /(?<![.\w$])(?:it|test|describe|suite)\.(?:skip|only|todo)\s*\(|(?<![.\w$])[xf](?:it|describe|test)\s*\(|(?<![.\w$])(?:test|it|describe|suite)\s*\([^)]*\{[^}]*\b(?:skip|todo|only)\s*:\s*(?!false\b)|\bt\.(?:skip|todo)\s*\(|@pytest\.mark\.(?:skip|xfail)|\bt\.Skip(?:Now)?\(/;
/** Prose, where naming a suppression is writing about it. */
const PROSE = /\.(md|mdx|markdown|txt|rst|adoc)$|(^|\/)CHANGELOG[^/]*$/i;
/**
 * A line with its string and pattern literals blanked, so a rule's advice or a check that names a
 * suppression is not one. A pattern literal is a slash after an operator or an opening bracket.
 */
const bare = (/** @type {string} */ l) =>
  l
    .replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g, '""')
    .replace(
      /(^\s*|[=(,:[!&|?{;]\s*)\/(?![*/])(?:[^/\\\n[]|\\.|\[(?:[^\]\\]|\\.)*\])+\/[a-z]*/g,
      "$1/x/",
    );
// Built from words, so this file does not carry, and count as, what it looks for.
const SILENCE = new RegExp(
  [
    ["eslint", "disable"].join("-"),
    ["@ts", "ignore"].join("-"),
    ["@ts", "expect-error"].join("-"),
    ["@ts", "nocheck"].join("-"),
    ["biome", "ignore"].join("-"),
    "#\\s*no" + "qa",
    "#\\s*type:\\s*ig" + "nore",
    "//\\s*no" + "lint",
    "(?:c8|v8|istanbul)\\s+ig" + "nore",
  ].join("|"),
);
/** A coverage or quality threshold and its number, as the configs spell one. */
const THRESHOLD =
  /(?<![\w-])(threshold|lines|branches|functions|statements|fail_under|fail-under|minimum_coverage|coverage_threshold|check-coverage)\b["']?\s*[:=]\s*["']?(\d+(?:\.\d+)?)/i;
const REASON = /^tests-changed:\s*\S/m;

/**
 * One commit's ways out, from its zero-context diff.
 * @param {string} subject @param {string} body @param {string} diff
 * @returns {{ path: string, line: number, detail: string }[]}
 */
function waysOut(subject, body, diff) {
  /** @type {Map<string, { cases: number, parked: number, silenced: number, snapshot: boolean, lowered: string[], removed: Map<string, number> }>} */
  const files = new Map();
  for (const [file, l] of contentLines(diff)) {
    const f = files.get(file) || {
      cases: 0,
      parked: 0,
      silenced: 0,
      snapshot: false,
      lowered: /** @type {string[]} */ ([]),
      removed: /** @type {Map<string, number>} */ (new Map()),
    };
    files.set(file, f);
    const sign = l[0] === "+" ? 1 : -1;
    const text = l.slice(1);
    if (TEST_FILE.test(file) && CASE.test(text) && !PARKED.test(text)) f.cases += sign;
    if (TEST_FILE.test(file) && PARKED.test(text)) f.parked += sign;
    if (!PROSE.test(file) && SILENCE.test(bare(text))) f.silenced += sign;
    if (SNAPSHOT.test(file)) f.snapshot = true;
    const t = THRESHOLD.exec(text);
    if (t && !TEST_FILE.test(file)) {
      const key = String(t[1]).toLowerCase();
      if (sign < 0) f.removed.set(key, Number(t[2]));
      else if (f.removed.has(key) && Number(t[2]) < Number(f.removed.get(key)))
        f.lowered.push(`${key} ${f.removed.get(key)} to ${t[2]}`);
    }
  }
  const s = subject.trim();
  const reasoned = REASON.test(body);
  /** @type {{ path: string, line: number, detail: string }[]} */
  const out = [];
  // A case turned into a skipped one is counted as skipped, not also as removed; and a case
  // moved to another file in the same commit (a suite split in two) is not removed at all.
  const lost = (/** @type {{ cases: number, parked: number }} */ f) =>
    -(f.cases + Math.max(f.parked, 0));
  const net = [...files.values()].reduce((n, f) => n + lost(f), 0);
  for (const [path, f] of files) {
    const at = (/** @type {string} */ detail) =>
      out.push({ path, line: 1, detail: `${s}: ${detail}` });
    if (net > 0 && lost(f) > 0) at(`${Math.min(lost(f), net)} test case(s) removed`);
    if (f.parked > 0) at(`${f.parked} case(s) skipped or focused`);
    if (f.silenced > 0) at(`${f.silenced} checker suppression(s) added`);
    if (f.snapshot && !reasoned) at("a snapshot rewritten with no tests-changed: line");
    for (const l of f.lowered) at(`a threshold lowered (${l})`);
  }
  return out;
}

/**
 * Every way out the commits of a range took, one finding per file and kind. Exported for the
 * night report, which reads the night branch the same way the ratchet reads a push.
 * @param {(...args: string[]) => string} git @param {string} range
 */
export function tamperIn(git, range) {
  const shas = git("rev-list", "--no-merges", range).split("\n").filter(Boolean);
  const findings = shas.flatMap((sha) =>
    waysOut(
      git("log", "-1", "--format=%s", sha),
      git("log", "-1", "--format=%b", sha),
      git(
        "-c",
        "core.quotePath=false",
        "show",
        "--format=",
        "-U0",
        "--no-color",
        "--no-ext-diff",
        sha,
      ),
    ),
  );
  return { scanned: shas.length, findings };
}

/** @type {Probe[]} */
export const probes = [
  {
    metric: "change.testTamper",
    kind: "ratchet",
    probation: true,
    standard: ["TEST.1", "TEST.5"],
    title: "Commits in the pushed range that weakened the tests or the checks they are judged by",
    why: "A change that makes the tests pass by changing the tests has made the claim easier, not the code better: a case removed, skipped or focused, a snapshot rewritten, a checker silenced, a threshold lowered. Each can be right, and each is the first thing to read in a review, above all in a change nobody watched being made. Say why on a `tests-changed:` line, or put the test back.",
    approximates:
      "stands in for reading every test edit for intent, which no text reading can do: per commit in the range, the test cases lost across the commit's test files (net, so cases moved from one file to another cancel, and so do cases removed in one file while as many are added in another), the skip, todo and only markers a test file gained, the suppression comments a code file gained outside its strings, the snapshots rewritten without a reason, and a coverage or quality threshold whose number fell. A case rewritten to assert something weaker, with the count unchanged, is not seen; a shallow clone is not judged.",
    emptyScanOk: true,
    scan: (c, o) => {
      if (!o.range)
        return { scanned: 0, findings: [], skipped: "no range (a rule about a push, not a tree)" };
      // A shallow checkout cannot list the range, and an empty list read green on the run that
      // judges the push.
      if (c.git("rev-parse", "--is-shallow-repository") === "true")
        return {
          scanned: 0,
          findings: [],
          skipped: "a shallow clone: the range's commits are not here",
        };
      return tamperIn((...a) => c.git(...a), o.range);
    },
    // One control per way out, each expecting exactly one finding: a detector that broke cannot
    // hide behind another that double-counted.
    controls: [
      ...[
        ["a case removed", { "test/a.test.ts": "test('one', () => {});\n" }],
        [
          "a case skipped",
          { "test/a.test.ts": "test.skip('one', () => {});\ntest('two', () => {});\n" },
        ],
        [
          "a case skipped by the platform runner's options",
          { "test/a.test.ts": "test('one', { skip: true }, () => {});\ntest('two', () => {});\n" },
        ],
        ["a subtest removed", { "test/b.test.mjs": "test('b', async (t) => {\n});\n" }],
        [
          "a checker silenced",
          { "src/a.ts": `// ${["@ts", "ignore"].join("-")}\nexport const a = 2;\n` },
        ],
        ["a snapshot rewritten", { "test/__snapshots__/a.test.ts.snap": "exports[`a`] = `2`;\n" }],
        [
          "a threshold lowered",
          {
            "vitest.config.ts":
              "export default { test: { coverage: { thresholds: { lines: 60 } } } };\n",
          },
        ],
      ].map(([name, files]) => ({
        name: /** @type {string} */ (name),
        files: {
          "src/a.ts": "export const a = 1;\n",
          "test/a.test.ts": "test('one', () => {});\ntest('two', () => {});\n",
          "test/b.test.mjs": "test('b', async (t) => {\n  await t.test('inner', () => {});\n});\n",
          "test/__snapshots__/a.test.ts.snap": "exports[`a`] = `1`;\n",
          "vitest.config.ts":
            "export default { test: { coverage: { thresholds: { lines: 80 } } } };\n",
        },
        commits: [{ files: /** @type {Record<string, string>} */ (files), message: "fix: a" }],
        range: "HEAD~1..HEAD",
        expect: 1,
      })),
      {
        name: "a case added, a moved case, a reasoned snapshot, a raised threshold, a tighter size budget, and a suppression named in prose or in a string",
        files: {
          "src/a.ts": `// ${["eslint", "disable"].join("-")}-next-line\nexport const a = 1;\n`,
          "test/a.test.ts": "test('one', () => { assert.ok(/x/.test(s)) });\n",
          "test/__snapshots__/a.test.ts.snap": "exports[`a`] = `1`;\n",
          "vitest.config.ts":
            "export default { test: { coverage: { thresholds: { lines: 60 } } } };\n",
          ".config.yml": "max-lines: 300\n",
        },
        commits: [
          {
            // a regex's .test( is not a case: rewriting the line removes none
            files: { "test/a.test.ts": "test('one', () => {});\ntest('two', () => {});\n" },
            message: "test: two",
          },
          {
            files: { "test/__snapshots__/a.test.ts.snap": "exports[`a`] = `2`;\n" },
            message: "feat: a renders two\n\ntests-changed: the output changed on purpose",
          },
          {
            files: {
              "vitest.config.ts":
                "export default { test: { coverage: { thresholds: { lines: 85 } } } };\n",
              ".config.yml": "max-lines: 250\n",
              "src/a.ts": "export const a = 1;\n",
            },
            message: "chore: raise the floor",
          },
          {
            // a suite split in two: the case moved, none was removed
            files: {
              "test/a.test.ts": "test('one', () => {});\n",
              "test/b.test.ts": "test('two', () => {});\n",
            },
            message: "test: split a",
          },
          {
            files: {
              "CHANGELOG.md": `- the rule now names // ${["@ts", "ignore"].join("-")} comments\n`,
              "src/rule.ts": `export const advice = "remove the ${["@ts", "ignore"].join("-")} comment";\n`,
            },
            message: "docs: advice",
          },
        ],
        range: "HEAD~5..HEAD",
        expect: 0,
      },
    ],
  },
];
