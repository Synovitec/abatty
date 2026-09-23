/**
 * The Python preset: ruff for format and lint, mypy for types, pytest for tests, vulture for
 * dead code, the ratchet and the secret scan from the package. The gate steps are commands
 * (a Python project has no npm scripts of its own); `init` writes a private package.json for
 * `npm run gate` and the hooks, as for documents. Detected from the tree (pyproject.toml,
 * requirements.txt, .py sources), never from npm dependencies. NOT PROVEN by a repository yet;
 * `init` says so, and the first Python repository names what is wrong.
 */

/** @type {import("./index.mjs").Preset} */
export const python = {
  id: "python",
  name: "Python (ruff, mypy, pytest)",
  proven: "",
  pack: "python",
  detect: () => false,
  detectFiles: (files) =>
    files(/^(pyproject\.toml|requirements\.txt|setup\.py|Pipfile)$/).length > 0 ||
    files(/\.py$/).length > 0,
  adoption: {
    commands: {
      gate: "npm run gate:fast",
      gateFull: "npm run gate",
      standards: "npm run standards",
      lintFile: "ruff check",
      test: "pytest -q",
      typecheck: "mypy .",
    },
    sourceGlobs: ["src/", "app/", "tests/", "scripts/", "migrations/"],
    changelogRequiredFor: ["src/", "app/", "scripts/", "migrations/", "pyproject.toml"],
    protectedPaths: [
      "migrations/",
      "alembic/versions/",
      ".env",
      ".env.",
      "docker-compose.production",
    ],
    lintExtensions: [".py"],
    // The opt-in probes a new repository on this stack starts with (ratchet.enable).
    ratchet: { enable: ["fn.shapeExemptions", "change.refactorTests", "code.clones"] },
  },
  scripts: {
    standards: "abatty ratchet",
    "standards:baseline": "abatty baseline",
    gate: "abatty gate",
    "gate:fast": "abatty gate --fast",
    "hooks:install": "abatty hooks",
  },
  devDependencies: [],
  gate: {
    always: [
      {
        label: "format",
        command: ["ruff", "format", "--check", "."],
        requires: ["pyproject.toml", "ruff.toml", ".ruff.toml"],
      },
      {
        label: "lint (CODE.4)",
        command: ["ruff", "check", "."],
        requires: ["pyproject.toml", "ruff.toml", ".ruff.toml"],
      },
      {
        label: "typecheck (CODE.3)",
        command: ["mypy", "."],
        requires: ["mypy.ini", ".mypy.ini", "pyproject.toml"],
      },
      {
        label: "dead code (CODE.6)",
        command: ["vulture", "."],
        requires: ["vulture.toml", "pyproject.toml"],
      },
      {
        label: "unit tests (TEST.1)",
        command: ["pytest", "-q"],
        requires: ["pytest.ini", "conftest.py", "pyproject.toml", "tests"],
        required: true,
      },
      {
        label: "abatty ratchet + changelog range (CHANGE.2)",
        script: "standards",
        rangeArg: true,
        required: true,
      },
      { label: "secret scan (SEC.1)", builtin: "secrets" },
    ],
    suites: [
      {
        name: "database suite (DATA.4, TEST.2)",
        paths: /^(migrations\/|alembic\/|src\/db\/|tests\/(integration|db)\/)/,
        docker: true,
        steps: [
          {
            label: "integration suite against a real database",
            command: ["pytest", "-q", "-m", "integration"],
          },
        ],
      },
    ],
  },
  rules: ["testing.md", "size-limits.md"],
  tooling: { dependencyCruiser: false, knip: false },
};
