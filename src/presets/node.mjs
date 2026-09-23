/**
 * The plain Node service preset (Express, Fastify, Hono, a worker, a CLI): no browser suite,
 * a source root under src/ or server/. Proven by this package itself, which is the first
 * repository to run it; what that first run found is in the changelog (a shallow config merge,
 * a lock that recorded the wrong ancestor, a self-test that failed a repository for opting into
 * the scrub, a rule that read one test runner, a guard that read flags out of a heredoc).
 */

/** @type {import("./index.mjs").Preset} */
export const node = {
  id: "node",
  name: "Node service (Express / Fastify / Hono / worker)",
  proven: "abatty, 2026-09-18 (instrument, harness, graph and dead code in the gate; five bugs)",
  detect: (deps) =>
    !deps.has("next") &&
    !deps.has("vite") &&
    !deps.has("astro") &&
    (deps.has("express") || deps.has("fastify") || deps.has("hono") || deps.has("koa")),
  adoption: {
    commands: {
      gate: "npm run gate:fast",
      gateFull: "npm run gate",
      standards: "npm run standards",
      lintFile: "npx eslint --max-warnings=0",
      test: "npm test",
      typecheck: "npm run typecheck",
    },
    sourceGlobs: ["src/", "server/", "scripts/", "tests/", "migrations/", ".woodpecker"],
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
      "prisma/migrations/",
      "drizzle/",
      ".env",
      ".env.",
      "docker-compose.production",
      "prod.dont.touch",
    ],
    lintExtensions: [".ts", ".js", ".mjs"],
    // The opt-in probes a new repository on this stack starts with (ratchet.enable).
    ratchet: {
      enable: ["valid.wholeEnv", "fn.shapeExemptions", "change.refactorTests", "code.clones"],
    },
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
    "hooks:install": "abatty hooks",
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
      { label: "unit tests (TEST.1)", script: "test", required: true },
      {
        label: "abatty ratchet + changelog range (CHANGE.2)",
        script: "standards",
        rangeArg: true,
        required: true,
      },
      { label: "secret scan (SEC.1)", builtin: "secrets" },
      { label: "audit (SEC.1)", builtin: "audit" },
      { label: "no trace of the tools (scrub)", builtin: "scrub" },
    ],
    suites: [
      {
        name: "database suite + coverage (DATA.4, TEST.4)",
        paths:
          /^(migrations\/|prisma\/|drizzle\/|src\/db\/|server\/db\/|tests\/(integration|db)\/)/,
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
    ],
  },
  rules: ["testing.md", "size-limits.md"],
  tooling: { dependencyCruiser: true, knip: true },
};
