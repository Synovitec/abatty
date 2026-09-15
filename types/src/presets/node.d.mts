/**
 * The plain Node service preset (Express, Fastify, Hono, a worker, a CLI): no browser suite,
 * a source root under src/ or server/. NOT PROVEN by a repository yet - the standard's rule
 * is that a preset is real when a repository has run it, so `init` says so and the gap
 * analysis will name what the first Node repository finds.
 */
/** @type {import("./index.mjs").Preset} */
export const node: import("./index.mjs").Preset;
