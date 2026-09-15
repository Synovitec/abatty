/**
 * The Python preset: ruff for format and lint, mypy for types, pytest for tests, vulture for
 * dead code, the ratchet and the secret scan from the package. The gate steps are commands
 * (a Python project has no npm scripts of its own); `init` writes a private package.json for
 * `npm run gate` and the hooks, as for documents. Detected from the tree (pyproject.toml,
 * requirements.txt, .py sources), never from npm dependencies. NOT PROVEN by a repository yet;
 * `init` says so, and the first Python repository names what is wrong.
 */
/** @type {import("./index.mjs").Preset} */
export const python: import("./index.mjs").Preset;
