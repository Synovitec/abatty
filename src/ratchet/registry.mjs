/**
 * The probes this package ships, in one list: every one the ratchet measures unless a
 * repository's config leaves it off (opt-in) or out. Kept apart from the ratchet's own engine
 * (src/ratchet/index.mjs), which reads the list and never needs to know what is on it; the
 * engine had grown past its budget with each probe added here.
 */
import { probes as sizeProbes } from "./probes/size.mjs";
import { probes as docsProbes } from "./probes/docs.mjs";
import { probes as freshnessProbes } from "./probes/freshness.mjs";
import { probes as successionProbes } from "./probes/succession.mjs";
import { probes as frontMatterProbes } from "./probes/frontmatter.mjs";
import { probes as catchLogProbes } from "./probes/catchlog.mjs";
import { probes as weakRandomProbes } from "./probes/weakrandom.mjs";
import { probes as jsdocProbes } from "./probes/jsdoc.mjs";
import { probes as actionProbes } from "./probes/actions.mjs";
import { probes as refsProbes } from "./probes/refs.mjs";
import { probes as tamperProbes } from "./probes/tamper.mjs";
import { probes as journeyProbes } from "./probes/journeys.mjs";
import { probes as codeProbes } from "./probes/code.mjs";
import { probes as changeProbes } from "./probes/change.mjs";
import { probes as startupProbes } from "./probes/startup.mjs";
import { probes as boundaryProbes } from "./probes/boundary.mjs";
import { probes as apiProbes } from "./probes/api.mjs";
import { probes as shapeProbes } from "./probes/shape.mjs";
import { probes as coverageProbes } from "./probes/coverage.mjs";
import { probes as nonNullProbes } from "./probes/nonnull.mjs";
import { probes as sqlDateProbes } from "./probes/sqldate.mjs";
import { probes as refactorProbes } from "./probes/refactor.mjs";
import { probes as cloneProbes } from "./probes/clones.mjs";

/** @type {import("./index.mjs").Probe[]} */
export const BUILTIN_PROBES = [
  ...sizeProbes,
  ...codeProbes,
  ...docsProbes,
  ...freshnessProbes,
  ...successionProbes,
  ...frontMatterProbes,
  ...changeProbes,
  ...startupProbes,
  ...boundaryProbes,
  ...apiProbes,
  ...shapeProbes,
  ...refactorProbes,
  ...cloneProbes,
  ...coverageProbes,
  ...nonNullProbes,
  ...sqlDateProbes,
  ...catchLogProbes,
  ...weakRandomProbes,
  ...jsdocProbes,
  ...actionProbes,
  ...refsProbes,
  ...tamperProbes,
  ...journeyProbes,
].map((p) => ({ ...p, source: "abatty" }));
