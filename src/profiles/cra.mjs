/**
 * The `cra` profile: the regulation's essential requirements, mapped onto rules that already
 * exist, and carrying no rules of its own.
 *
 * WHY no rules. A profile that invented "CRA rules" would be selling the idea that holding them
 * makes a product conform, which is not true and not something a source-code tool can make true.
 * This profile is a LENS: name it beside a real profile (`"profiles": ["synovitec", "cra"]`) and
 * the mapping reads that profile's findings against the requirements, saying for each one what
 * the rules named actually evidence and - the part that matters - what they do not.
 *
 * The mapping itself is in cra-requirements.mjs, with the warning that belongs at the top of any
 * such table: a mapping is not a conformity assessment and is not legal advice.
 */
import { REGULATION, REQUIREMENTS, mappingShape } from "./cra-requirements.mjs";

const shape = mappingShape();

/** @type {import("./index.mjs").Profile} */
export const cra = {
  id: "cra",
  name: "The Cyber Resilience Act, as a lens over an engineering standard",
  description: `A mapping of ${shape.total} essential requirements onto the rules of whichever profile it is named beside: ${shape.withRules} have at least one rule that bears on them and ${shape.withoutRules} have none at all, which is the table's most useful column. Not a conformity assessment, not legal advice, and it carries no rules of its own.`,
  // Deliberately empty: see the module comment. A lens adds no checks.
  rules: [],
  // One phase, and it is a reading rather than work: the mapping does not tell anybody what to
  // build next, because the requirements it leaves empty are not engineering practices at all.
  phases: [
    {
      id: "R",
      title: "Read the mapping: what the standard evidences, and the far larger part it does not",
      size: "S",
      blocksOn: [],
      exit: "`abatty evidence` read by somebody who has also read the regulation",
      stages: ["design", "build", "run"],
    },
  ],
  standard: { document: "docs/CRA_MAPPING.md" },
  tools: {
    regulation: REGULATION.name,
    annex: REGULATION.annex,
    requirements: String(REQUIREMENTS.length),
  },
};
