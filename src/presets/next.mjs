/**
 * The Next.js (App Router) preset - what paycore_dms proved: a single npm app, flat modules
 * under src/, Drizzle or Prisma for the schema, Vitest, Playwright + axe, Woodpecker CI.
 * A preset says what a stack's repository looks like; the standard says what must hold.
 */

/** @type {import("./index.mjs").Preset} */
export const next = {
  id: "next",
  name: "Next.js (App Router)",
  proven:
    "paycore_dms, 2026-09-14 (instrument, harness, graph and dead code in the gate, first unattended night closed a phase)",
  detect: (deps) => deps.has("next"),
  adoption: {
    commands: {
      gate: "npm run gate:fast",
      gateFull: "npm run gate",
      standards: "npm run standards",
      lintFile: "npx eslint --max-warnings=0",
      test: "npm test",
      typecheck: "npm run typecheck",
    },
    sourceGlobs: ["src/", "scripts/", "tests/", "e2e/", "drizzle/", "prisma/", ".woodpecker"],
    changelogRequiredFor: [
      "src/",
      "scripts/",
      "drizzle/",
      "prisma/",
      ".woodpecker",
      "eslint.config",
      "tsconfig",
    ],
    protectedPaths: [
      "drizzle/",
      "prisma/migrations/",
      "migrations/",
      ".env",
      ".env.",
      "docker-compose.production",
      "prod.dont.touch",
    ],
    lintExtensions: [".ts", ".tsx", ".js", ".jsx", ".mjs"],
  },
  scripts: {
    typecheck: "tsc --noEmit",
    lint: "eslint . --max-warnings=0",
    "format:check": "prettier --check --end-of-line auto .",
    graph: "depcruise src --config .dependency-cruiser.cjs --ignore-known --output-type err",
    "graph:mermaid": "depcruise src --config .dependency-cruiser.cjs --output-type mermaid",
    dead: "knip --max-issues 0",
    standards: "abatty ratchet",
    "standards:baseline": "abatty baseline",
    gate: "abatty gate",
    "gate:fast": "abatty gate --fast",
    "hooks:install": "git config core.hooksPath .githooks",
  },
  devDependencies: ["dependency-cruiser", "knip", "prettier", "typescript"],
  gate: {
    // Always on, in this order; a step whose script is absent is reported as skipped, so a
    // repository can run the gate before everything exists. --fast stops before the suites.
    always: [
      {
        // Run directly, never through the repository's script: on a Windows worktree the files are
        // CRLF and "prettier --check ." reports every file; --end-of-line auto is the standard's form.
        label: "format",
        command: ["npx", "prettier", "--check", "--end-of-line", "auto", "."],
        requires: [
          ".prettierrc",
          ".prettierrc.json",
          ".prettierrc.js",
          ".prettierrc.cjs",
          ".prettierrc.mjs",
          ".prettierrc.yaml",
          ".prettierrc.yml",
          "prettier.config.js",
          "prettier.config.cjs",
          "prettier.config.mjs",
        ],
      },
      { label: "lint (CODE-4)", script: "lint" },
      { label: "typecheck (CODE-3)", script: "typecheck" },
      {
        label: "import graph (CODE-5)",
        script: "graph",
        requires: [".dependency-cruiser.cjs", ".dependency-cruiser.js", ".dependency-cruiser.mjs"],
      },
      {
        label: "dead code (CODE-6)",
        script: "dead",
        requires: ["knip.jsonc", "knip.json", "knip.ts"],
      },
      { label: "unit tests (TEST-1)", script: "test" },
      {
        label: "abatty ratchet + changelog range (CHANGE-2)",
        script: "standards",
        rangeArg: true,
      },
    ],
    // Path-aware: run when the push or the working tree touches the paths; need Docker or are
    // deferred loudly to CI.
    suites: [
      {
        name: "database suite + coverage (DATA-4, TEST-4)",
        paths:
          /^(drizzle\/|prisma\/|migrations\/|src\/db\/|src\/server\/|tests\/(rls|integration|db)\/)/,
        docker: true,
        steps: [
          {
            label: "integration suite against a real Postgres",
            script: "test:integration",
            alternatives: ["test:rls", "test:db"],
          },
          { label: "coverage gate (TEST-4)", script: "coverage" },
        ],
      },
      {
        name: "build + browser suite + axe (TEST-3, A11Y-1)",
        paths: /^(src\/app\/|src\/components\/|src\/i18n\/|app\/|components\/|e2e\/)/,
        docker: true,
        steps: [
          { label: "build (the browser suite serves the production output)", script: "build" },
          { label: "E2E + axe", script: "e2e", alternatives: ["e2e:client", "test:e2e"] },
        ],
      },
    ],
  },
  rules: ["testing.md", "i18n.md", "a11y.md", "pwa.md", "size-limits.md"],
  tooling: { dependencyCruiser: true, knip: true },
};
