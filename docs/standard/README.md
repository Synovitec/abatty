---
title: "The engineering standard"
description: "The Synovitec engineering standard in the open, versioned with this package: the standard itself, the adoption plan, the enforcement map, the autonomous-adoption protocol, the lessons, the sourced practices and the research behind them. Moved here from the company's operations repository on 2026-09-15 so that anyone who installs abatty can read what it enforces."
category: reference
status: living
audience: ["architect", "developer", "agent", "reviewer"]
tags: ["standard", "index"]
related: ["../README.md", "./ENGINEERING_STANDARD.md", "./ADOPTION_PLAN.md"]
---

# The engineering standard

**Version 2026.09.15** - the standard is versioned with the package that enforces it: a rule
that changes level, a rule added or removed, is a changelog entry of `abatty` and a new version
here. The rule catalog (`../CATALOG.md`, generated from `src/rules/`) is the executable reading
of this standard; each rule's `standard` IDs point into `ENGINEERING_STANDARD.md`.

| Document                                                  | What it is                                                                                              |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| [`ENGINEERING_STANDARD.md`](./ENGINEERING_STANDARD.md)    | The standard: the principles, the instrument (ratchet, gate, CI, harness), the rules by family with IDs |
| [`ADOPTION_PLAN.md`](./ADOPTION_PLAN.md)                  | Day 0 for a new repository (§A), the transformation programme for an existing one (§B)                  |
| [`ENFORCEMENT_MAP.md`](./ENFORCEMENT_MAP.md)              | Every rule and what insures it today (hard, ratchet, review, prose); how a rule moves up a level        |
| [`AUTONOMOUS_ADOPTION.md`](./AUTONOMOUS_ADOPTION.md)      | The harness and the unattended night: settings, hooks, skill, agents, runner, canary                    |
| [`LESSONS.md`](./LESSONS.md)                              | The defects behind the rules, one sentence each, with the check that now catches them                   |
| [`BEST_PRACTICES.md`](./BEST_PRACTICES.md)                | The sourced practices the standard distilled, by cluster                                                |
| [`guides/`](./guides/A11Y.md)                             | Accessibility, internationalisation, progressive web app: depth and reasons                             |
| [`research/`](./research/01-runtime-framework-tooling.md) | The dated research the practices came from, with sources; a record, not a rule                          |

Where a document names a path (`scripts/ci/gate.mjs`, `.githooks/pre-push`, `templates/harness/`),
it is the path in a repository that adopts the standard, or in this package's templates; the
readings of the company's own repositories stay in its operations repository.

## How it changes

A change to a rule's text or level is proposed as a pull request that names the rule, the
level before and after, and the reason; the changelog carries it under its own heading because
a rule that moves up can turn a green repository red. The lessons catalogue gains an entry when
a defect recurs or a guard caught it. `CONTRIBUTING.md` at the root says the rest.
