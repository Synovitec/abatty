/**
 * The documents preset: a repository at the design stage, or one that is documents alone (a
 * standard, a handbook, decisions, a schema, a mockup). No linter, no tests, no build: the gate
 * is the format check, the ratchet's document probes (front matter, citations, freshness) with
 * the changelog range, and the secret scan. Never detected from dependencies (there are none):
 * `init --stack docs`, or chosen for a repository with no package and no sources. NOT PROVEN by
 * a repository yet; `init` says so.
 */

/** @type {import("./index.mjs").Preset} */
export const docs = {
  id: "docs",
  name: "Documents (design stage: a standard, decisions, a schema, a mockup)",
  proven: "",
  detect: () => false,
  adoption: {
    commands: {
      gate: "npm run gate:fast",
      gateFull: "npm run gate",
      standards: "npm run standards",
    },
    sourceGlobs: ["docs/", "README.md", "CHANGELOG.md"],
    changelogRequiredFor: ["docs/"],
    protectedPaths: [".env", ".env."],
    lintExtensions: [".md"],
    lintOnEdit: false,
    stage: "design",
  },
  scripts: {
    "format:check": "prettier --check --end-of-line auto .",
    standards: "abatty ratchet",
    "standards:baseline": "abatty baseline",
    gate: "abatty gate",
    "gate:fast": "abatty gate --fast",
    "hooks:install": "git config core.hooksPath .githooks",
  },
  devDependencies: ["prettier"],
  gate: {
    always: [
      {
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
      {
        label: "abatty ratchet: the document probes + changelog range (DOC.2, DOC.5, CHANGE.2)",
        script: "standards",
        rangeArg: true,
        required: true,
      },
      { label: "secret scan (SEC.1)", builtin: "secrets" },
    ],
    suites: [],
  },
  rules: [],
  tooling: { dependencyCruiser: false, knip: false },
};
