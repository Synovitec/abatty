/**
 * The React + Vite preset (a client under src/, a Node server under server/, the shape
 * Paycore-Task-Manager has: Apollo, Sequelize, MUI). What that repository proved on
 * 2026-09-13: the ratchet with per-file floors, JSDoc and import boundaries at eslint error,
 * the harness. The graph and dead-code gates are not wired there yet (ADOPTION_STATUS names
 * the shortest path), so `proven` names the date of what is.
 */

/** @type {import("./index.mjs").Preset} */
export const viteReact = {
  id: "vite-react",
  name: "React + Vite (client) with a Node server",
  proven: "Paycore-Task-Manager, 2026-09-13 (instrument and harness; graph and dead code pending)",
  detect: (deps) => deps.has("vite") && deps.has("react") && !deps.has("next"),
  adoption: {
    commands: {
      gate: "npm run gate:fast",
      gateFull: "npm run gate",
      standards: "npm run standards",
      lintFile: "npx eslint --max-warnings=0",
      test: "npm test",
      typecheck: "npm run typecheck",
    },
    sourceGlobs: ["src/", "server/", "scripts/", "tests/", "e2e/", "migrations/", ".woodpecker"],
    changelogRequiredFor: [
      "src/",
      "server/",
      "scripts/",
      "migrations/",
      ".woodpecker",
      "eslint.config",
      "tsconfig",
    ],
    protectedPaths: [
      "migrations/",
      "server/migrations/",
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
    graph: "depcruise src server --config .dependency-cruiser.cjs --ignore-known --output-type err",
    "graph:mermaid": "depcruise src server --config .dependency-cruiser.cjs --output-type mermaid",
    dead: "knip --max-issues 0",
    standards: "abatty ratchet",
    "standards:baseline": "abatty baseline",
    gate: "abatty gate",
    "gate:fast": "abatty gate --fast",
    "hooks:install": "git config core.hooksPath .githooks",
  },
  devDependencies: ["dependency-cruiser", "knip", "prettier", "typescript"],
  gate: {
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
      { label: "lint (CODE.4)", script: "lint" },
      { label: "typecheck (CODE.3)", script: "typecheck" },
      {
        label: "import graph (CODE.5)",
        script: "graph",
        requires: [".dependency-cruiser.cjs", ".dependency-cruiser.js", ".dependency-cruiser.mjs"],
      },
      {
        label: "dead code (CODE.6)",
        script: "dead",
        requires: ["knip.jsonc", "knip.json", "knip.ts"],
      },
      { label: "unit tests (TEST.1)", script: "test" },
      {
        label: "abatty ratchet + changelog range (CHANGE.2)",
        script: "standards",
        rangeArg: true,
      },
      { label: "secret scan (SEC.1)", builtin: "secrets" },
      { label: "audit (SEC.1)", builtin: "audit" },
    ],
    suites: [
      {
        name: "database suite + coverage (DATA.4, TEST.4)",
        paths: /^(migrations\/|server\/(models|migrations|db)\/|tests\/(integration|db)\/)/,
        docker: true,
        steps: [
          {
            label: "integration suite against a real database",
            script: "test:integration",
            alternatives: ["test:db"],
          },
          { label: "coverage gate (TEST.4)", script: "coverage" },
        ],
      },
      {
        name: "build + browser suite + axe (TEST.3, A11Y.1)",
        paths: /^(src\/|e2e\/)/,
        docker: false,
        steps: [
          { label: "build", script: "build" },
          { label: "E2E + axe", script: "e2e", alternatives: ["test:e2e"] },
        ],
      },
    ],
  },
  rules: [
    "testing.md",
    "i18n.md",
    "a11y.md",
    "graphql.md",
    "sequelize.md",
    "mui.md",
    "size-limits.md",
  ],
  tooling: { dependencyCruiser: true, knip: true },
};
