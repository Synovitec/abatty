/**
 * The opt-in probes every code preset starts a new repository with. One list, because five
 * presets spelling it out drifted the day a probe was added to four of them, and the copies were
 * the clones the package's own ratchet counts.
 */

/** Stack-neutral opt-in probes: exemptions, refactors that drop tests, clones, coverage exclusions, non-null assertions (none in a repository without TypeScript). */
export const COMMON_PROBES = [
  "fn.shapeExemptions",
  "change.refactorTests",
  "code.clones",
  "test.coverageExclusions",
  "types.nonNull",
  "docs.supersededChain",
];
