/**
 * The plain Node service preset (Express, Fastify, Hono, a worker, a CLI): no browser suite,
 * a source root under src/ or server/. Proven by this package itself, which is the first
 * repository to run it; what that first run found is in the changelog (a shallow config merge,
 * a lock that recorded the wrong ancestor, a self-test that failed a repository for opting into
 * the scrub, a rule that read one test runner, a guard that read flags out of a heredoc).
 */
/** @type {import("./index.mjs").Preset} */
export const node: import("./index.mjs").Preset;
