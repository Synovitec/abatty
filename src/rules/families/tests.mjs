/**
 * Tests: a runner and tests, integration on a real database, coverage pinned, the browser suite
 * with axe and its retry policy, mutation testing. Standard TEST-1..5, DATA-4, A11Y-1.
 */

/** @type {import("../index.mjs").Rule[]} */
export const rules = [
  {
    id: "TEST-UNIT",
    family: "Tests",
    title: "A unit test runner and tests",
    standard: ["TEST-1"],
    level: "must",
    enforcement: "hard",
    phase: "2 / 10",
    why: "A change without a test that goes red on the bug is a change nobody can verify; the runner is the first feedback loop an agent has.",
    next: "Add vitest and colocated tests for services and guards",
    check: (c) => {
      const runner = c.has("vitest") ? "vitest" : c.has("jest") ? "jest" : "";
      const testFiles = c.files(/\.(test|spec)\.(ts|tsx|js|jsx|mjs)$/);
      return {
        status: runner && testFiles.length > 0 ? "present" : runner ? "partial" : "missing",
        evidence: `${runner || "no runner"}, ${testFiles.length} test file(s)`,
      };
    },
  },
  {
    id: "TEST-INTEGRATION",
    family: "Tests",
    title: "Integration tests against a real Postgres",
    standard: ["TEST-2", "DATA-4"],
    level: "must",
    enforcement: "hard",
    phase: "10",
    why: "A mocked database proves the mock; constraints, RLS and transactions only fail on the real engine.",
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
    title: "Coverage thresholds pinned, reportOnFailure on",
    standard: ["TEST-4"],
    level: "must",
    enforcement: "hard",
    phase: "2",
    why: "A threshold pinned at today's figure is a floor coverage cannot fall below unnoticed; reportOnFailure keeps the report when the suite is red, which is when it is read.",
    next: "Pin thresholds at today's measured figure per area; set reportOnFailure: true",
    check: (c) => {
      const cfg = c
        .files(/vitest(\.\w+)?\.config\.(ts|js|mjs|mts)$/)
        .map(c.read)
        .join("\n");
      const thresholds = /thresholds/.test(cfg);
      // The flag may live in the config or on the CI script's command line; both hold TEST-4.
      const rofScript = Object.entries(c.scripts).find(([, v]) => /reportOnFailure/.test(v));
      const rof = /reportOnFailure/.test(cfg)
        ? "config"
        : rofScript
          ? "`" + rofScript[0] + "` flag"
          : "";
      return {
        status: thresholds && rof ? "present" : thresholds ? "partial" : "missing",
        evidence: `${thresholds ? "thresholds set" : "no thresholds"}${rof ? ", reportOnFailure (" + rof + ")" : ", no reportOnFailure"}`,
      };
    },
  },
  {
    id: "TEST-E2E",
    family: "Tests",
    title: "Playwright with axe",
    standard: ["TEST-3", "A11Y-1"],
    level: "must",
    enforcement: "hard",
    phase: "3",
    why: "The critical journeys are proven in a browser, and the accessibility violations axe can count are refused on the same run.",
    next: "Add @axe-core/playwright on the critical journeys, blocking",
    check: (c) => {
      const pw = c.has("@playwright/test");
      const axe = c.has("@axe-core/playwright") || c.has("axe-playwright");
      return {
        status: pw && axe ? "present" : pw ? "partial" : "n/a",
        evidence: `${pw ? "playwright" : "no playwright"}${axe ? " + axe" : ""}`,
      };
    },
  },
  {
    id: "TEST-E2E-CONFIG",
    family: "Tests",
    title: "retries CI-only and trace on-first-retry",
    standard: ["TEST-3"],
    level: "should",
    enforcement: "review",
    phase: "3",
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
    title: "Mutation testing wired",
    standard: ["TEST-5"],
    level: "should",
    enforcement: "hard",
    phase: "10",
    why: "A test that passes when the code is broken proves nothing; the mutation score is the measure of the tests, not of the code.",
    next: "Add StrykerJS on changed files per PR with break at today's floor",
    check: (c) => {
      const s = c.has("@stryker-mutator/core");
      return { status: s ? "present" : "missing", evidence: s ? "stryker present" : "none" };
    },
  },
];
