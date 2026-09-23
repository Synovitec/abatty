/**
 * Behaviour preservation, as far as a machine can hold it. A refactor claims the behaviour did
 * not change, and the tests are the only statement of that behaviour a machine can check: green
 * before, green after, the same tests. A refactor that edits them has changed the evidence it is
 * judged by, and one that removes test cases has made the claim easier to meet. So over the
 * pushed range this counts the `refactor:` commits that remove test cases, always, and the ones
 * that edit a test without saying why on a `tests-changed: <reason>` line (a renamed function is
 * a reason; its callers in the tests move with it). A test added, or a test file renamed with
 * its cases intact, is not counted. Opt-in (`ratchet.enable`); every code preset enables it.
 */

/** @typedef {import("../index.mjs").Probe} Probe */

/** A test file in any of the layouts a pack uses: a folder of tests, a `.test`/`.spec` suffix, pytest's and Go's names. */
const TEST_FILE =
  /(^|\/)(tests?|__tests__|e2e|spec)\/|\.(test|spec)\.[cm]?[jt]sx?$|(^|\/)test_[^/]*\.py$|_test\.(py|go)$/;
const REFACTOR = /^refactor(\([^)]*\))?!?:/;
const REASON = /^tests-changed:\s*\S/m;
/** A test case, as the runners spell one: `test(`, `it(`, a pytest function, a Go test. */
const CASE = /\b(?:test|it)(?:\.\w+)?\s*\(|^\s*def test_|^func Test/gm;

/** @param {string} text */
const cases = (text) => (String(text).match(CASE) || []).length;

/** @type {Probe[]} */
export const probes = [
  {
    metric: "change.refactorTests",
    kind: "hard",
    optIn: true,
    standard: ["TEST.1", "FLOW.3"],
    title: "Refactors in the pushed range that rewrote the tests they are judged by",
    why: "A refactor is proven by the same tests passing before and after. A refactor that removes a test case has lowered the bar it claims to clear, and one that edits a test without a reason has changed the evidence silently. Write the behaviour change as a fix or a feature, or say on a `tests-changed:` line why the tests had to move.",
    approximates:
      "stands in for comparing behaviour before and after, which no text reading can do: it reads the commits whose subject is a refactor, the test files each one modified or deleted, and the number of test cases (test(, it(, def test_, func Test) in each before and after. A case rewritten to assert something weaker, with the count unchanged and a reason given, is a reviewer's to see.",
    emptyScanOk: true,
    scan: (c, o) => {
      if (!o.range)
        return { scanned: 0, findings: [], skipped: "no range (a rule about a push, not a tree)" };
      const log = c.git("log", "--format=%x1e%H%x1f%s%x1f%b%x1f", "--name-status", "-M", o.range);
      const findings = [];
      let scanned = 0;
      for (const record of log.split("\x1e").filter((r) => r.trim())) {
        const [sha = "", subject = "", body = "", files = ""] = record.split("\x1f");
        if (!REFACTOR.test(subject.trim())) continue;
        scanned++;
        const reasoned = REASON.test(body);
        for (const line of files.split("\n")) {
          const [status = "", ...paths] = line.trim().split("\t");
          const path = paths[paths.length - 1] || "";
          const was = paths[0] || "";
          if (!TEST_FILE.test(path) || !/^[MDR]/.test(status)) continue;
          const before = cases(c.git("show", `${sha}^:${was}`));
          const after = status.startsWith("D") ? 0 : cases(c.git("show", `${sha}:${path}`));
          const where = { path, line: 1 };
          if (after < before)
            findings.push({
              ...where,
              detail: `${subject.trim()}: ${before - after} test case(s) removed`,
            });
          // A file moved with its content intact (R100) is the same test under a new path.
          else if (!reasoned && status !== "R100")
            findings.push({
              ...where,
              detail: `${subject.trim()}: a test edited with no tests-changed: line`,
            });
        }
      }
      return { scanned, findings };
    },
    controls: [
      {
        name: "a refactor that drops a test case, and one that edits a test with no reason, count",
        files: {
          "src/a.ts": "export const a = 1;\n",
          "test/a.test.ts": "test('one', () => {});\ntest('two', () => {});\n",
          "test/b.test.ts": "test('b', () => { expect(1).toBe(1) });\n",
        },
        commits: [
          {
            files: {
              "src/a.ts": "export const a = 2;\n",
              "test/a.test.ts": "test('one', () => {});\n",
            },
            message: "refactor: simplify a",
          },
          {
            files: { "test/b.test.ts": "test('b', () => { expect(2).toBe(2) });\n" },
            message: "refactor(b): tidy",
          },
          {
            // a reason excuses an edit, never a test case removed
            files: { "test/b.test.ts": "// b is covered elsewhere\n" },
            message: "refactor(b): fold b\n\ntests-changed: b is covered by a",
          },
        ],
        range: "HEAD~3..HEAD",
        expect: 3,
      },
      {
        name: "a reasoned edit, a test added, and a fix that edits a test are not counted",
        files: {
          "src/a.ts": "export const a = 1;\n",
          "test/a.test.ts": "test('one', () => { a() });\n",
        },
        commits: [
          {
            files: {
              "src/a.ts": "export const b = 1;\n",
              "test/a.test.ts": "test('one', () => { b() });\n",
            },
            message:
              "refactor: rename a to b\n\ntests-changed: the function the test calls was renamed",
          },
          {
            files: { "test/c.test.ts": "test('c', () => {});\n" },
            message: "refactor: cover c",
          },
          {
            files: { "test/a.test.ts": "test('one', () => { b(); b() });\n" },
            message: "fix: b is called twice",
          },
        ],
        range: "HEAD~3..HEAD",
        expect: 0,
      },
    ],
  },
];
