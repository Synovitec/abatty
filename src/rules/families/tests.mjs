/**
 * Tests: a runner and tests, integration on a real database, coverage pinned, the browser suite
 * with axe and its retry policy, mutation testing. Standard TEST.1..5, DATA.4, A11Y.1.
 */

import { BROWSER, DATABASE, JS_SOURCES, SOURCES } from "../applies.mjs";
import { perPack } from "../../packs/rules.mjs";

/**
 * Everywhere a repository configures a test-quality tool: the tool's own files, whichever tool,
 * plus the scripts and the pipeline that invoke it. A rule reads the practice out of all three,
 * because a threshold on a command line holds exactly as much as one in a config file, and a
 * check that reads only one vendor's file name is a check about that vendor.
 * @param {import("../context.mjs").RepoContext} c @param {RegExp} files
 */
function toolText(c, files) {
  const found = c.files(files);
  // The PATHS as well as the contents: `stryker.conf.json` and `codecov.yml` say which tool is
  // configured by existing, and their contents may never repeat the tool's own name.
  return [...found, ...found.map(c.read), ...Object.values(c.scripts), c.ciText].join("\n");
}

/** Wherever a coverage run is configured, in any of the ecosystems a repository may use. */
const COVERAGE_FILES =
  /(^|\/)(vitest(\.\w+)?\.config\.[cm]?[jt]s|jest\.config\.[cm]?[jt]s|\.nycrc(\.json|\.ya?ml)?|\.c8rc(\.json)?|codecov\.ya?ml|\.codecov\.ya?ml|\.coveragerc|pyproject\.toml|setup\.cfg|sonar-project\.properties)$/;

/** Wherever a mutation run is configured. */
const MUTATION_FILES =
  /(^|\/)(stryker(\.\w+)*\.conf\.(json|jsonc|js|mjs|cjs|ts)|\.stryker\.conf\.[\w.]+|mutmut\.ini|setup\.cfg|pyproject\.toml|infection\.json(\.dist)?|pitest\.\w+)$/;

/** @type {import("../index.mjs").Rule[]} */
export const rules = [
  {
    id: "TEST-UNIT",
    family: "Tests",
    title: "A unit test runner and tests, for every language in the tree",
    standard: ["TEST.1"],
    level: "must",
    enforcement: "hard",
    phase: "2 / 10",
    ...SOURCES,
    why: "A change without a test that goes red on the bug is a change nobody can verify; the runner is the first feedback loop an agent has.",
    next: "Add a unit runner (vitest, jest, bun test or node --test) and colocated tests for services and guards",
    check: (c) => {
      const others = perPack(c, "test", (p) => p.id !== "javascript");
      const testFiles = c.files(/\.(test|spec)\.(ts|tsx|js|jsx|mjs)$/);
      if (!c.stack.js) {
        const py = c.files(/(^|\/)(test_[^/]*\.py|[^/]*_test\.py)$/).length;
        return { ...others, evidence: `${others.evidence}, ${py} test file(s)` };
      }
      // The rule states the practice - a runner and tests - and the platform's own runner is one:
      // `node --test` ships with Node and carries no dependency and no config file to look for.
      const platform = Boolean(c.script(/\bnode\b[^&|]*--test|(^|\W)node:test(\W|$)/));
      // The script that runs the tests names the runner before an installed package does: a
      // monorepo whose tests run on `bun test` read as jest, because one app depended on it.
      const byScript = (/** @type {string} */ s) =>
        /\bvitest\b/.test(s)
          ? "vitest"
          : /\bbun test\b/.test(s)
            ? "bun test"
            : /\bjest\b/.test(s)
              ? "jest"
              : /\bnode\b[^&|]*--test/.test(s)
                ? "node --test"
                : "";
      // A root script that only hands the run to the workspaces (`turbo run test`, `nx run-many`,
      // a recursive run) names no runner: the workspaces' own test scripts do, and a monorepo
      // whose apps run `bun test` read as jest because one app depended on it.
      const workspaces = () =>
        c
          .files(/(^|\/)package\.json$/)
          .filter((f) => f !== "package.json")
          .map((f) => byScript(String(c.readJson(f)?.scripts?.test || "")))
          .find(Boolean) || "";
      const runner =
        byScript(String(c.scripts.test || "")) ||
        workspaces() ||
        (c.has("vitest")
          ? "vitest"
          : c.script(/\bbun test\b/)
            ? "bun test"
            : c.has("jest")
              ? "jest"
              : platform
                ? "node --test"
                : "");
      const js = runner && testFiles.length > 0 ? "present" : runner ? "partial" : "missing";
      return {
        status:
          others.status === "n/a"
            ? js
            : js === "present" && others.status === "present"
              ? "present"
              : js === "missing" && others.status === "missing"
                ? "missing"
                : "partial",
        evidence: `${runner || "no runner"}, ${testFiles.length} test file(s)${others.status === "n/a" ? "" : "; " + others.evidence}`,
      };
    },
  },
  {
    id: "TEST-INTEGRATION",
    family: "Tests",
    title: "Integration tests against a real database",
    standard: ["TEST.2", "DATA.4"],
    level: "must",
    enforcement: "hard",
    phase: "10",
    ...DATABASE,
    why: "A mocked database proves the mock; constraints, row-level policies and transactions only fail on the real engine.",
    next: "Stand up Testcontainers or the local dev DB; rolled-back transaction per test; no ORM mocking",
    check: (c) => {
      const integ =
        c.has("testcontainers") || c.has("@testcontainers/postgresql")
          ? "testcontainers"
          : c.firstFile(/vitest\.integration\.config|vitest\.rls\.config|tests\/integration/);
      return { status: integ ? "present" : "missing", evidence: integ || "none" };
    },
  },
  {
    id: "TEST-COVERAGE",
    family: "Tests",
    title: "Coverage is gated on the change, with a floor under the tree",
    standard: ["TEST.4"],
    level: "must",
    enforcement: "hard",
    phase: "2",
    ...SOURCES,
    why: "A threshold on the tree total is the wrong question asked loudly: a whole new untested file passes while the total holds, and a refactor that deletes well-tested code fails for improving the codebase. What a reviewer wants to know is whether THIS change is tested, which is the coverage of the lines it touched. The total is still worth a floor, so coverage cannot drift down unnoticed; it is a floor, not the gate.",
    next: "Gate on the coverage of the changed lines (a patch status, a diff-coverage step, or the runner's changed-files mode), keep a threshold on the total as a floor, and keep the report when the suite is red, which is when it is read",
    check: (c) => {
      const text = toolText(c, COVERAGE_FILES);
      if (!/coverage|nyc|c8|codecov|cobertura|lcov/i.test(text))
        return { status: "missing", evidence: "nothing measures coverage" };
      const floor =
        /thresholds|coverageThreshold|check-coverage|fail_under|minimum_coverage|coverage_threshold/i.test(
          text,
        );
      // The delta gate, in whichever shape the ecosystem spells it: a patch status, a diff
      // coverage tool, or a runner told to look only at what changed.
      const delta =
        /diff[-_]?cover|patch:|patch_?status|--changed\b|changedSince|--since\b|--diff\b|compare[-_]?branch|newCodePeriod|new_code/i.test(
          text,
        );
      // Most runners write the report before they set the exit code, so it survives a red suite
      // by default. Vitest discards it unless told otherwise, so the flag is asked for THERE and
      // nowhere else: a rule that demanded it of every ecosystem would be asking for a vitest
      // option by name.
      const vitest = /vitest/i.test(text);
      const kept = !vitest || /reportOnFailure/i.test(text);
      const has = [
        floor ? "a floor on the total" : "",
        delta ? "a gate on the change" : "",
        vitest && kept ? "reportOnFailure" : "",
      ].filter(Boolean);
      const lacks = [
        floor ? "" : "no floor on the total",
        delta
          ? ""
          : "no gate on the changed lines, so an untested new file passes while the total holds",
        kept
          ? ""
          : "vitest discards the coverage report when the suite is red, which is when it is read",
      ].filter(Boolean);
      return {
        status: floor && delta && kept ? "present" : "partial",
        evidence: [has.join(", "), lacks.join("; ")].filter(Boolean).join(" · "),
      };
    },
  },
  {
    id: "TEST-E2E",
    family: "Tests",
    title: "A browser suite with an accessibility scan on the same run",
    standard: ["TEST.3", "A11Y.1"],
    level: "must",
    enforcement: "hard",
    phase: "3",
    ...BROWSER,
    why: "The critical journeys are proven in a browser, and the accessibility violations axe can count are refused on the same run.",
    next: "Add @axe-core/playwright on the critical journeys, blocking",
    check: (c) => {
      const pw = c.has("@playwright/test");
      const axe = c.has("@axe-core/playwright") || c.has("axe-playwright");
      return {
        status: pw && axe ? "present" : pw ? "partial" : "missing",
        evidence: `${pw ? "playwright" : "no playwright"}${axe ? " + axe" : ""}`,
      };
    },
  },
  {
    id: "TEST-E2E-CONFIG",
    family: "Tests",
    title: "retries CI-only and trace on-first-retry",
    standard: ["TEST.3"],
    level: "should",
    enforcement: "review",
    phase: "3",
    ...BROWSER,
    why: "Retries on a developer's machine hide flakiness; a trace on the first retry is the evidence when CI fails.",
    next: "Set retries: process.env.CI ? 2 : 0 and trace: 'on-first-retry'",
    check: (c) => {
      const pw = c.has("@playwright/test");
      const cfg = c
        .files(/playwright\.config\.(ts|js|mjs)$/)
        .map(c.read)
        .join("\n");
      return {
        status: !pw
          ? "n/a"
          : /on-first-retry/.test(cfg) && /retries/.test(cfg)
            ? "present"
            : "partial",
        evidence: pw
          ? `${/on-first-retry/.test(cfg) ? "trace ok" : "no on-first-retry"}, ${/retries/.test(cfg) ? "retries set" : "no retries policy"}`
          : "-",
      };
    },
  },
  {
    id: "TEST-MUTATION",
    family: "Tests",
    title: "Mutation testing wired, bounded to the change and to what a mutant can prove",
    standard: ["TEST.5"],
    level: "should",
    enforcement: "hard",
    phase: "10",
    ...SOURCES,
    why: "A test that passes when the code is broken proves nothing; the mutation score is the measure of the tests, not of the code. Unbounded, it is also the slowest check anybody has ever switched off: it mutates the whole tree on every run, and it mutates nodes no test could ever observe - a log line, a message string, a piece of code with no behaviour behind it - so it reports survivors nobody can kill and a run nobody waits for.",
    next: "Bound it twice before you trust it: mutate what the change touched (--since / --incremental / a diff-driven glob) and ignore the nodes a mutant cannot prove anything about (arid nodes, excluded mutators, ignore patterns), with a floor it breaks at",
    check: (c) => {
      const text = toolText(c, MUTATION_FILES);
      const runner =
        c.has("@stryker-mutator/core") ||
        /stryker|mutmut|infection|pitest|mutant|mutation[-_]?test/i.test(text);
      if (!runner) return { status: "missing", evidence: "nothing mutates the code" };
      // Scoped to the change, so it finishes; and told what not to mutate, so what survives is
      // a real gap in the tests rather than a line no assertion could ever reach.
      const scoped = /--since\b|incremental|--changed\b|changed[-_]?files|diff|paths-?from/i.test(
        text,
      );
      const arid =
        /ignorers|excludedMutations|ignore[-_]?patterns|"ignore"|aridNode|arid|also-?copy|exclude/i.test(
          text,
        );
      const floor = /break|threshold|score|--fail|MUTPY_|min[-_]?score/i.test(text);
      const lacks = [
        scoped ? "" : "unbounded: it mutates the whole tree on every run",
        arid ? "" : "nothing is ignored, so a log line counts as a surviving mutant",
        floor ? "" : "no floor to break at",
      ].filter(Boolean);
      return {
        status: scoped && arid ? "present" : "partial",
        evidence: lacks.length
          ? lacks.join("; ")
          : "bounded to the change, with the nodes a mutant cannot prove ignored",
      };
    },
  },
];
