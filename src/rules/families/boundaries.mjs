/**
 * Boundaries: every input parsed by a schema, one validated env module, a calendar day taken
 * from the clock it is compared to. Standard VALID.1..3, VALID.5.
 */

import { BOUNDARY, SOURCES } from "../applies.mjs";
import { probeFindings } from "../probe-count.mjs";
import { matchesAny, regexes } from "../../ratchet/probes/lib.mjs";
import { SAFE_INSTANT } from "../../ratchet/probes/code.mjs";

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
      // The ratchet's own reading (valid.rawEnv): its env module, configurable as
      // `ratchet.envModule`, and its exempt list. A probe fixture or a script named env is not
      // the repository's env module, and a read in an exempt file is not a read the ratchet holds.
      const { findings, config } = probeFindings(c, "valid.rawEnv");
      const exempt = regexes(config.exempt);
      const moduleRe = new RegExp(config.envModule);
      // Every module, not the first: a monorepo keeps one per workspace, and naming one of six
      // read as the other five not counting.
      const modules = c.sourceFiles.filter((f) => moduleRe.test(f) && !matchesAny(f, exempt));
      const named =
        modules.length > 1
          ? `${modules.length} env modules: ${modules.slice(0, 4).join(", ")}${modules.length > 4 ? ` and ${modules.length - 4} more` : ""}`
          : modules[0] || "no env module";
      const raw = findings.length;
      return {
        status: modules.length && raw <= 3 ? "present" : modules.length ? "partial" : "missing",
        evidence: `${named}; ${raw} raw process.env read(s) elsewhere`,
      };
    },
  },
  {
    id: "VALID-LOCAL-DAY",
    family: "Boundaries",
    title: "A calendar day comes from one function, derived from the clock it is compared to",
    standard: ["VALID.5"],
    level: "must",
    enforcement: "hard",
    phase: "4",
    ...SOURCES,
    why: "A date is not an instant: an instant is a point on a universal line, a date is a question about somebody's calendar. A day sliced off a UTC timestamp answers it for Greenwich and for nobody else, and compared against a local day - a commit date, a deadline, a date a person typed - it is wrong for the length of the machine's offset, once a day, every day. The suite does not see it because the pipeline runs at UTC.",
    next: "Put the derivation in one function the whole repository calls, and pin a regression test to a zone whose calendar day differs from UTC's at the hour it runs",
    check: (c) => {
      // The practice, not one language's expression of it: a day taken off a UTC instant, in
      // whichever of the tree's languages wrote it. Assembled at the seam the rule is about so
      // that this file is not an offender against the rule it states.
      //
      // Wider than the `valid.utcDay` metric on purpose: the metric honours the repository's
      // exempt list and so reads the sources alone, while the practice holds in a test too - a
      // test that derives the expected day in UTC is how four of them hid here. The evidence
      // names the file, so a rule that reads missing beside a metric that reads zero says which
      // of the two found something rather than leaving a reader to guess.
      const forms = [
        new RegExp(
          "\\.to(?:ISO|JSON)String\\(\\)\\s*" + "\\.(?:slice|substring|substr)\\(\\s*0\\s*,\\s*10",
        ),
        new RegExp("\\.to(?:ISO|JSON)String\\(\\)\\s*" + "\\.split\\(\\s*[\"'`]T[\"'`]"),
        new RegExp("utcnow\\(\\)\\s*" + "\\.(?:date|strftime)\\("),
      ];
      // A day taken off an instant built for it (Date.UTC, a noon anchor) on the same line is not
      // the bug, as valid.utcDay already reads it: a calendar computed in UTC on purpose was flagged.
      const offends = (/** @type {string} */ text) =>
        forms.some((re) =>
          [...text.matchAll(new RegExp(re.source, "g"))].some(
            (m) =>
              !SAFE_INSTANT.test(text.slice(text.lastIndexOf("\n", m.index ?? 0) + 1, m.index)),
          ),
        );
      const hits = c.sourceFiles.flatMap((f) => (offends(c.read(f)) ? [f] : []));
      return {
        status: hits.length ? "missing" : "present",
        evidence: hits.length
          ? `${hits.length} file(s) take a calendar day off a UTC instant, first ${hits[0]}`
          : "no calendar day taken off a UTC instant",
      };
    },
  },
];
