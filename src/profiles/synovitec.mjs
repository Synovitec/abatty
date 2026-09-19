/**
 * The built-in profile: the standard the package was built on, as one package of rules,
 * phases, presets and harness rule files. Every rule's text and every phase here is one
 * company's; a repository that names another profile carries another standard with the same
 * instrument.
 */
import { rules as documents } from "../rules/families/documents.mjs";
import { rules as instrument } from "../rules/families/instrument.mjs";
import { rules as harness } from "../rules/families/harness.mjs";
import { rules as code } from "../rules/families/code.mjs";
import { rules as codeStructure } from "../rules/families/code-structure.mjs";
import { rules as types } from "../rules/families/types.mjs";
import { rules as boundaries } from "../rules/families/boundaries.mjs";
import { rules as data } from "../rules/families/data.mjs";
import { rules as tests } from "../rules/families/tests.mjs";
import { rules as security } from "../rules/families/security.mjs";
import { rules as delivery } from "../rules/families/delivery.mjs";
import { rules as platform } from "../rules/families/platform.mjs";
import { rules as observability } from "../rules/families/observability.mjs";
import { rules as agentSecurity } from "../rules/families/agent-security.mjs";

/** The adoption plan's phases (ADOPTION_PLAN.md §B.2), as data. @type {import("./index.mjs").Phase[]} */
export const PHASES = [
  {
    id: "A.1",
    title:
      "Day 0: the context file, the changelog, a decisions log, the harness, a CI that can fail",
    size: "S",
    blocksOn: [],
    exit: "the documents family present; the changelog gate and a CI step that can go red",
    stages: ["design", "build", "run"],
  },
  {
    id: "0",
    title: "The instrument: ratchet with per-file floors, gate + hook, CI step, control cases",
    size: "S",
    blocksOn: [],
    exit: "`standards` blocking in CI; verified by lowering a baseline number and watching the step go red",
    stages: ["build", "run"],
  },
  {
    id: "1",
    title: "Lint to zero warnings",
    size: "M",
    blocksOn: ["0"],
    exit: "`--max-warnings=0` in the lint script; the step blocking",
    stages: ["build", "run"],
  },
  {
    id: "2",
    title: "Coverage pinned",
    size: "S",
    blocksOn: ["0"],
    exit: "thresholds in the test config at the measured figure; CI fails on a drop",
    stages: ["build", "run"],
  },
  {
    id: "3",
    title: "Accessibility proxies to zero",
    size: "M",
    blocksOn: [],
    exit: "`jsx-a11y` at error with component mapping; icon-name, clickable-non-interactive and inline-style metrics HARD",
    stages: ["build", "run"],
  },
  {
    id: "4",
    title: "Zod: every boundary parses, one schema both sides, one env module",
    size: "M",
    blocksOn: [],
    exit: "`valid.unparsedBoundary` HARD; `valid.rawEnv` at its documented floor",
    stages: ["build", "run"],
  },
  {
    id: "5",
    title: "Caching conformance (or the written decision not to cache tenant reads)",
    size: "M",
    blocksOn: [],
    exit: "every cache key carries every parameter; every write invalidates; metrics HARD - or not applicable with the reason",
    stages: ["build", "run"],
  },
  {
    id: "6",
    title:
      "API conformance: bounded lists, one input object, payload returns, loaders per association",
    size: "L",
    blocksOn: ["5"],
    exit: "metrics HARD; growth lists have a paginated twin, migrated, old field deprecated one release",
    stages: ["build", "run"],
  },
  {
    id: "7",
    title: "Function shape to zero",
    size: "L",
    blocksOn: ["5", "6"],
    exit: "the three rules unconditional in eslint at error; the exemption list empty",
    stages: ["build", "run"],
  },
  {
    id: "8",
    title: "File size to zero, per kind",
    size: "XL",
    blocksOn: ["7"],
    exit: "per-kind budgets enforced; `size.overBudget` HARD; `size.overRaw` at zero",
    stages: ["build", "run"],
  },
  {
    id: "9",
    title: "Typecheck to zero",
    size: "L",
    blocksOn: ["8"],
    exit: "`tsc --noEmit` blocking in CI",
    stages: ["build", "run"],
  },
  {
    id: "10",
    title: "Testing to target: real database integration, branches first",
    size: "L",
    blocksOn: ["8"],
    exit: "floors at target; integration suite against a real database in a rolled-back transaction",
    stages: ["build", "run"],
  },
  {
    id: "11",
    title:
      "Docs and JSDoc: front matter, index, citations, freshness by diff, JSDoc on the boundary surface",
    size: "M",
    blocksOn: [],
    exit: "`docs.*` metrics HARD; freshness step blocking; JSDoc rule at error on the named surfaces",
    stages: ["build", "run"],
  },
  {
    id: "12",
    title:
      "The import graph and dead code: dependency-cruiser rules from the boundary map, known violations to zero; knip to zero",
    size: "M",
    blocksOn: ["0"],
    exit: "`depcruise --ignore-known --output-type err` and `knip --max-issues 0` in the gate, both proven red on a scratch violation",
    stages: ["build", "run"],
  },
  {
    // OBS.1 was in the standard from the first day and the plan scheduled nothing for it, so a
    // repository could finish every phase with logs nobody can query and a stop that drops the
    // work in flight. A service's own phase, at the run stage, where the surface exists.
    id: "13",
    title:
      "Observability: a structured logger with redaction at the logger, no bare console from the server, a health endpoint, and a SIGTERM that drains",
    size: "M",
    blocksOn: ["0"],
    exit: "the redaction list covers the named fields and a test proves one is masked; `no-console` at error on the server's paths; the health endpoint answers and the SIGTERM handler fails it before draining, both proven by a test that watches them",
    stages: ["run"],
  },
];

/** @type {import("./index.mjs").Profile} */
export const synovitec = {
  id: "synovitec",
  name: "The Synovitec engineering standard",
  description:
    "The standard the package was built on and proved on two repositories: fifteen phases, the rules of fifteen families, four stack presets, the harness rule files per stack topic.",
  rules: [
    ...documents,
    ...instrument,
    ...harness,
    ...code,
    ...codeStructure,
    ...types,
    ...boundaries,
    ...data,
    ...tests,
    ...security,
    ...delivery,
    ...platform,
    ...observability,
    ...agentSecurity,
  ],
  phases: PHASES,
  presets: ["next", "astro", "vite-react", "node"],
  harnessRules: [
    "a11y.md",
    "graphql.md",
    "i18n.md",
    "mui.md",
    "pwa.md",
    "sequelize.md",
    "size-limits.md",
    "testing.md",
  ],
  standard: {
    document: "docs/standard/ENGINEERING_STANDARD.md",
    plan: "docs/standard/ADOPTION_PLAN.md",
  },
  // The rules say the practice; the profile names the tools the company chose for it.
  tools: {
    ci: "Woodpecker or GitHub Actions",
    database: "Postgres",
    schema: "Zod",
    browser: "Playwright with axe",
    unit: "Vitest",
    linter: "ESLint (flat config)",
    formatter: "Prettier",
    deadCode: "knip",
    importGraph: "dependency-cruiser",
    mutation: "StrykerJS",
  },
};
