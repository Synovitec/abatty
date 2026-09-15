/**
 * The Next.js (App Router) preset - what paycore_dms proved: a single npm app, flat modules
 * under src/, Drizzle or Prisma for the schema, Vitest, Playwright + axe, Woodpecker CI.
 * A preset says what a stack's repository looks like; the standard says what must hold.
 */
/** @type {import("./index.mjs").Preset} */
export const next: import("./index.mjs").Preset;
