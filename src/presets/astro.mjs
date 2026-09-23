/**
 * The Astro preset: a content site or an app with islands, pages under src/pages, layouts and
 * components under src/, content collections, `astro check` as the typecheck, the browser
 * suite with axe over the built output, no database by default. NOT PROVEN by a repository
 * yet - a preset is real when a repository has run it, so `init` says so; the fixture in the
 * tests proves the package does not break on the shape, not the stack.
 */
import { COMMON_PROBES } from "./probes.mjs";

/** @type {import("./index.mjs").Preset} */
export const astro = {
  id: "astro",
  name: "Astro (content site, islands)",
  proven: "",
  detect: (deps) => deps.has("astro") && !deps.has("next"),
  adoption: {
    commands: {
      gate: "npm run gate:fast",
      gateFull: "npm run gate",
      standards: "npm run standards",
      lintFile: "npx eslint --max-warnings=0",
      test: "npm test",
      typecheck: "npm run typecheck",
    },
    sourceGlobs: ["src/", "scripts/", "tests/", "e2e/", ".woodpecker"],
    changelogRequiredFor: [
      "src/",
      "scripts/",
      ".woodpecker",
      "astro.config",
      "eslint.config",
      "tsconfig",
    ],
    protectedPaths: [".env", ".env.", "docker-compose.production", "prod.dont.touch"],
    lintExtensions: [".ts", ".tsx", ".js", ".mjs", ".astro"],
    // The opt-in probes a new repository on this stack starts with (ratchet.enable).
    ratchet: {
      enable: ["valid.wholeEnv", ...COMMON_PROBES],
    },
  },
  scripts: {
    typecheck: "astro check",
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
  devDependencies: ["dependency-cruiser", "knip", "prettier", "typescript", "@astrojs/check"],
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
      { label: "typecheck (CODE.3, astro check)", script: "typecheck", required: true },
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
    // No database suite by default: a content site has none; a repository that adds one adds
    // the suite to its own gate. The browser suite serves the built output.
    suites: [
      {
        name: "build + browser suite + axe (TEST.3, A11Y.1)",
        paths: /^(src\/(pages|layouts|components|content|i18n)\/|e2e\/|astro\.config)/,
        docker: false,
        steps: [
          { label: "build (astro build)", script: "build" },
          { label: "E2E + axe", script: "e2e", alternatives: ["test:e2e"] },
        ],
      },
    ],
  },
  rules: ["a11y.md", "i18n.md", "testing.md", "size-limits.md"],
  tooling: { dependencyCruiser: true, knip: true },
};
