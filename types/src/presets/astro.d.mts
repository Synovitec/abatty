/**
 * The Astro preset: a content site or an app with islands, pages under src/pages, layouts and
 * components under src/, content collections, `astro check` as the typecheck, the browser
 * suite with axe over the built output, no database by default. NOT PROVEN by a repository
 * yet - a preset is real when a repository has run it, so `init` says so; the fixture in the
 * tests proves the package does not break on the shape, not the stack.
 */
/** @type {import("./index.mjs").Preset} */
export const astro: import("./index.mjs").Preset;
