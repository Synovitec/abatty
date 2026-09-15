---
title: "Standards progress - abatty"
description: "This package measured against the standard it ships: typecheck strict over checkJs at zero with one named exception, tests over temp repositories, format checked, templates proven in sync with ops-hub. The dated log of every deliberate change of a floor."
category: governance
status: living
audience: ["developer", "agent"]
tags: ["standards", "scoreboard"]
related: ["./README.md", "../README.md"]
---

# Standards progress

## Scoreboard

| Metric                                                             | Day 0 (2026-09-14)                                                                          | Now       | Target | Held by                                                             | Rule   |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | --------- | ------ | ------------------------------------------------------------------- | ------ |
| `tsc --noEmit` over `checkJs` strict                               | 0                                                                                           | **0**     | 0      | `npm run typecheck` in the gate                                     | CODE 3 |
| Files under `// @ts-nocheck`                                       | 1 (`src/core/gap-analysis.mjs`, generated from an untyped script; 48 findings)              | **0**     | 0      | the checks moved into `src/rules/`, typed, on 2026-09-14            | CODE 3 |
| Tests                                                              | 13                                                                                          | **32**    | -      | `npm test` in the gate                                              | TEST 1 |
| Templates in sync with ops-hub                                     | yes                                                                                         | **yes**   | yes    | `test/templates.test.mjs`, `doctor --templates-only` in the gate    | -      |
| Prettier                                                           | clean                                                                                       | **clean** | clean  | `format:check` in the gate                                          | CODE 4 |
| Lines naming a tool, a vendor or a model (`abatty scrub`)          | 341 (day 0, before the scrub)                                                               | **0**     | 0      | `abatty scrub .` in the gate, the commit-msg hook, the guard        | -      |
| Enforced share (`abatty measure`: present rules held by a machine) | 83% of 23 (2026-09-15)                                                                      | **83%**   | 100%   | the catalog's enforcement level per rule; a night moves one rule up | P 1    |
| Ratchet metrics above zero (`npm run standards`)                   | 4 of 13 (2026-09-15: size.overBudget 1, size.excessCode 9, types.escapes 7, valid.rawEnv 7) | **4**     | 0      | `scripts/ci/standards-baseline.json`, the ratchet in the gate       | P 2    |

## Log

### 2026-09-14 - Day 0

The first slice: `init`, `measure`, `gate`, `doctor`, three presets, the templates and the gap
analysis synced from ops-hub. Proven on paycore_dms (measure 80/100 as the ops-hub tool; the
gate green in seven steps; doctor in step). One named debt: the generated gap analysis is
untyped until its checks move into the package for good.

### 2026-09-14 - The catalog

The checks moved into the package as the rule catalog (`src/rules/`, 65 rules in 13 families,
typed): the `@ts-nocheck` file and the port script are gone, 0 files under the escape. Tests
21 -> 32. The scores of the reference repositories are unchanged by the port (paycore_dms
80/100 over 63, abatty 29/100 over 51), which is the proof the checks are the same.

### 2026-09-15 - The ratchet

The ratchet moved into the package (`abatty ratchet`, `abatty baseline`, thirteen probes with
their controls). This package baselined itself the same day: nine metrics at zero and
promoted to HARD; four ratchets with their debt on the list - `size.overBudget` 1 and
`size.excessCode` 9 (`src/rules/families/code.mjs`, 9 code lines over the module budget),
`types.escapes` 7 (the escape patterns quoted in the probe's and a rule's own source),
`valid.rawEnv` 7 (the terminal layer's colour switches, the same quoted patterns). The hook
and stub templates are exempt from the kind budget through `abatty.config.json` (they are
sequential procedures where stdout is the interface), still under the 800 cap. Tests 32 -> 53.

### 2026-09-15 - The standard in the open

`LICENSE` (Apache-2.0), `CONTRIBUTING.md` (DCO). The standard's fifteen documents moved into
`docs/standard/` and pass this repository's own instrument: front matter and the index at
zero, citations exempt for the standard's documents because they cite the paths of a
repository that adopts it (`ratchet.citationsExempt`), and the two research notes that quote
the vendor's own documentation allowed through `scrub.allow` with the reason in
`abatty.config.json` - a rewritten citation would be a false one.

### 2026-09-15 - Provenance by default

The scrub became opt-in for every repository; this one keeps it on (`abatty.config.json` →
`scrub.enabled`), the decision of its first day. A repository that does not opt in keeps the
agent's trailer as its audit trail and may ask for a disclosure trailer of its own
(`provenance.trailer`), which the guard holds on unattended commits.

### 2026-09-15 - The runner in Node

`abatty night` replaces the two shell runners; `test/night.test.mjs` drives it with the stub
through the happy path, canary only, six abort paths and three refusals, on every push. The
same slice fixed a self-test defect the first week never saw because it ran on Windows: the
no-op gate `node -e process.exit(0)` is a syntax error to a POSIX shell, so `doctor` was red on
Linux and macOS for a reason that was not the harness. Tests 55 -> 62.

### 2026-09-15 - update

`abatty update` merges the package's harness with a repository's own edits; the reference
repository's harness was synced by hand three times in one day before it. Tests 62 -> 70.

### 2026-09-15 - The root config

`abatty.config.json` at the root, validated against the schema the package ships, read first
by every hook and every command; this repository's own config carries the `$schema` line and
validates. Tests 70 -> 74.

### 2026-09-15 - Fixtures per preset

The `astro` preset and its fixture; four presets, four fixtures, two of them also proven by a
repository. Tests 74 -> 75.

### 2026-09-15 - Agent adapters

Three adapters; the primary's id derived from its folder so this package names no tool; the
night refused without hooks. Tests 75 -> 80.
