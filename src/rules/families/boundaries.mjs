/**
 * Boundaries: every input parsed by a schema, one validated env module. Standard VALID.1..3.
 */

import { BOUNDARY } from "../applies.mjs";

/** @type {import("../index.mjs").Rule[]} */
export const rules = [
  {
    id: "VALID-ZOD",
    family: "Boundaries",
    title: "A schema library validates every boundary",
    standard: ["VALID.1"],
    level: "must",
    enforcement: "hard",
    phase: "4",
    ...BOUNDARY,
    why: "A request, a form, a webhook, an env: everything that crosses into the program is parsed once at the edge or trusted everywhere inside. The schema is the type the runtime checks.",
    next: "Add zod and parse every request, form and env at the edge",
    check: (c) => {
      const zod = c.has("zod");
      return { status: zod ? "present" : "missing", evidence: zod ? "zod present" : "no zod" };
    },
  },
  {
    id: "VALID-ENV",
    family: "Boundaries",
    title: "One validated env module; no raw process.env elsewhere",
    standard: ["VALID.3"],
    level: "must",
    enforcement: "ratchet",
    phase: "4",
    ...BOUNDARY,
    why: "A raw process.env read fails at the line that reads it, in production, at 3 a.m.; one module parsed at boot fails at start, on the developer's screen.",
    next: "Create one env module (env.ts under src/lib or the server config folder) parsed at boot; ratchet valid.rawEnv to its documented floor",
    check: (c) => {
      const envModule = c.firstFile(/(^|\/)(src\/)?(lib\/|config\/)?env\.(ts|js|mjs)$/);
      const raw = c.sourceFiles
        .filter((f) => f !== envModule)
        .reduce((n, f) => n + (c.read(f).match(/process\.env\./g) || []).length, 0);
      return {
        status: envModule && raw <= 3 ? "present" : envModule ? "partial" : "missing",
        evidence: `${envModule || "no env module"}; ${raw} raw process.env read(s) elsewhere`,
      };
    },
  },
];
