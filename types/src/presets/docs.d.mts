/**
 * The documents preset: a repository at the design stage, or one that is documents alone (a
 * standard, a handbook, decisions, a schema, a mockup). No linter, no tests, no build: the gate
 * is the format check, the ratchet's document probes (front matter, citations, freshness) with
 * the changelog range, and the secret scan. Never detected from dependencies (there are none):
 * `init --stack docs`, or chosen for a repository with no package and no sources. NOT PROVEN by
 * a repository yet; `init` says so.
 */
/** @type {import("./index.mjs").Preset} */
export const docs: import("./index.mjs").Preset;
