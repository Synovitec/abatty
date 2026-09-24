/**
 * The ratchet's configuration: the budgets by kind (standard CODE.1), the exempt paths, the
 * caps, and how a repository overrides them through `ratchet` in its adoption config or in
 * `abatty.config.json` at its root.
 */

/**
 * @typedef {import("./index.mjs").RatchetConfig} RatchetConfig
 * @typedef {import("./index.mjs").KindBudget} KindBudget
 */

/** Where the committed floor lives when the config names no other path. */
export const BASELINE_DEFAULT = "scripts/ci/standards-baseline.json";
/** The sentence written into every baseline, so whoever opens the file by hand reads how a number may move before editing one. */
export const BASELINE_NOTE =
  "Written by `abatty baseline`. A number here may only fall; raising one needs a reason in docs/STANDARDS_PROGRESS.md and `--reason` on the command.";

/**
 * The code-line budgets by kind (standard CODE.1), matched in order on the repository-relative
 * path; the first match wins and the last row is the module budget. A repository replaces the
 * whole list through `ratchet.kinds`.
 * @type {KindBudget[]}
 */
export const DEFAULT_KINDS = [
  { match: "\\.(test|spec)\\.[cm]?[jt]sx?$|(^|/)(tests?|__tests__|e2e)/", kind: "test", max: 400 },
  {
    match: "(^|/)app/.*/(page|layout|template|loading|error|not-found)\\.[jt]sx?$",
    kind: "page",
    max: 100,
  },
  { match: "(^|/)hooks?/|(^|/)use[A-Z]\\w*\\.[jt]sx?$", kind: "hook", max: 150 },
  { match: "(^|/)(utils?|helpers?)/", kind: "utility", max: 100 },
  { match: "(^|/)(api/.*/route|middleware|resolvers?|models?)(/|\\.)", kind: "route", max: 200 },
  {
    match: "(^|/)(db/)?schema\\.[jt]s$|(^|/)drizzle/[^/]+\\.[jt]s$|(^|/)prisma/schema",
    kind: "orm-schema",
    max: 500,
  },
  { match: "\\.(tsx|jsx)$|(^|/)components?/", kind: "component", max: 250 },
  { match: "(^|/)(schemas?|validation|validators?)/", kind: "schema", max: 250 },
];

/**
 * A test folder at any depth, as a regex source. One definition: the exempt list below and the
 * probes of what ships (probes/lib.mjs) both read it, and two copies were one edit from drifting.
 */
export const TEST_FOLDERS = "(^|/)(tests?|__tests__|e2e)/";

/**
 * Paths exempt from the per-kind budget and the shape rules (still under the 800 cap): generated
 * code, migrations, seeders, vendored UI, config files, constant tables, and the CLI scripts,
 * hooks and tests where a sequential procedure is the point. Regex sources on the relative path.
 */
export const DEFAULT_EXEMPT = [
  "(^|/)(generated|__generated__|vendor|vendored)/",
  "(^|/)(migrations|seeders|seeds)/",
  "(^|/)(i18n|locales|messages|dictionaries)/",
  "(^|/)[^/]*\\.config\\.[cm]?[jt]s$",
  "^scripts/",
  "^bin/",
  "^\\.claude/hooks/",
  // At any depth: a monorepo keeps its tests under apps/<app>/tests/, and a root-only pattern
  // held those to the test budget while the same folder at the root was exempt.
  TEST_FOLDERS,
];

/** @type {RatchetConfig} */
export const DEFAULT_CONFIG = {
  local: "abatty.probes.mjs",
  include: [],
  exclude: [],
  hard: [],
  ratchet: [],
  mustScan: [],
  cap: 800,
  defaultMax: 300,
  contextMax: 200,
  barrelMax: 10,
  kinds: DEFAULT_KINDS,
  exempt: DEFAULT_EXEMPT,
  envModule: "(^|/)env\\.[cm]?[jt]s$",
  citationsExempt: [],
  changelog: "CHANGELOG.md",
  changelogFragments: "",
  changelogRequiredFor: [
    "src/",
    "server/",
    "apps/",
    "packages/",
    "scripts/",
    "migrations/",
    "drizzle/",
    "prisma/",
  ],
  coupled: [],
  enable: [],
};

/**
 * The ratchet config of a repository: the defaults, then `ratchet` in the adoption config, and
 * the changelog names the adoption config already carries.
 * @param {Record<string, any> | null | undefined} adoption
 * @returns {RatchetConfig}
 */
export function resolveConfig(adoption) {
  const r = adoption?.ratchet && typeof adoption.ratchet === "object" ? adoption.ratchet : {};
  /** @type {RatchetConfig} */
  const c = { ...DEFAULT_CONFIG, ...r };
  if (adoption?.files?.changelog) c.changelog = String(adoption.files.changelog);
  if (adoption?.files?.changelogFragments)
    c.changelogFragments = String(adoption.files.changelogFragments);
  if (Array.isArray(adoption?.changelogRequiredFor) && !r.changelogRequiredFor)
    c.changelogRequiredFor = adoption.changelogRequiredFor.map(String);
  if (Array.isArray(adoption?.coupled) && !r.coupled) c.coupled = adoption.coupled;
  return c;
}

/** The baseline path a repository names, or the standard's default. @param {Record<string, any> | null | undefined} adoption */
export function baselinePath(adoption) {
  return String(adoption?.files?.baseline || BASELINE_DEFAULT);
}
