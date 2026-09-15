/**
 * The React + Vite preset (a client under src/, a Node server under server/, the shape
 * Paycore-Task-Manager has: Apollo, Sequelize, MUI). What that repository proved on
 * 2026-09-13: the ratchet with per-file floors, JSDoc and import boundaries at eslint error,
 * the harness. The graph and dead-code gates are not wired there yet (ADOPTION_STATUS names
 * the shortest path), so `proven` names the date of what is.
 */
/** @type {import("./index.mjs").Preset} */
export const viteReact: import("./index.mjs").Preset;
