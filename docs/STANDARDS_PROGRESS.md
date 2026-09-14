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

| Metric                                                    | Day 0 (2026-09-14)                                                             | Now       | Target | Held by                                                          | Rule   |
| --------------------------------------------------------- | ------------------------------------------------------------------------------ | --------- | ------ | ---------------------------------------------------------------- | ------ |
| `tsc --noEmit` over `checkJs` strict                      | 0                                                                              | **0**     | 0      | `npm run typecheck` in the gate                                  | CODE 3 |
| Files under `// @ts-nocheck`                              | 1 (`src/core/gap-analysis.mjs`, generated from an untyped script; 48 findings) | **1**     | 0      | the header names it; typed when the checks move here             | CODE 3 |
| Tests                                                     | 13                                                                             | **21**    | -      | `npm test` in the gate                                           | TEST 1 |
| Templates in sync with ops-hub                            | yes                                                                            | **yes**   | yes    | `test/templates.test.mjs`, `doctor --templates-only` in the gate | -      |
| Prettier                                                  | clean                                                                          | **clean** | clean  | `format:check` in the gate                                       | CODE 4 |
| Lines naming a tool, a vendor or a model (`abatty scrub`) | 341 (day 0, before the scrub)                                                  | **0**     | 0      | `abatty scrub .` in the gate, the commit-msg hook, the guard     | -      |

## Log

### 2026-09-14 - Day 0

The first slice: `init`, `measure`, `gate`, `doctor`, three presets, the templates and the gap
analysis synced from ops-hub. Proven on paycore_dms (measure 80/100 as the ops-hub tool; the
gate green in seven steps; doctor in step). One named debt: the generated gap analysis is
untyped until its checks move into the package for good.
