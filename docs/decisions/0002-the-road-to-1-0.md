---
title: "The road to 1.0"
description: "How abatty gets to a version it can promise: a weekly release candidate replayed by its adopters, a scope freeze on new surfaces, and a 1.0 that covers the node and next presets only."
category: governance
status: living
audience: ["developer", "architect", "agent"]
tags: ["versioning", "release", "roadmap"]
related: ["../VERSIONING.md", "../../CONTRIBUTING.md"]
last_verified: "2026-09-24"
---

# 0002 - The road to 1.0

- Status: accepted
- Date: 2026-09-24

## Context

1.0 is a promise, not a feature: past it, only a major version may turn an adopter's green run
red (docs/VERSIONING.md). The week before this decision, every release was replayed by the two
adopting repositories after it was published, and every replay found a must-level miss. That
made each miss cost a patch release. The surfaces an adopter depends on also kept moving: new
config keys, a redefined probe twice in two days, a new exit code on `ci --check`.

The instruments for a promise now exist:

- the contract as a committed snapshot (`test/contract/surface.json`);
- every adopter report as a permanent case (`test/adopter-corpus.test.mjs`);
- release candidates under the `next` tag;
- migrations `abatty update` runs itself;
- per-check probation evidence in the report.

## Decision

1. **A weekly release candidate.** The week's work ships as `0.X.0-rc.N` under `next`. The
   adopters replay it, and a report comes back as a corpus case before its fix. When a replay
   finds no must-level miss, one commit sets the final version and it ships as `0.X.0`. A patch
   between candidates is only for a must-level miss in the field.
2. **A scope freeze on new surfaces.** Until 1.0 only stabilising work lands:
   - misses the adopters report;
   - the open gaps (a lint step here, a floor under total coverage, branch protection read from
     the forge);
   - probation decisions, check by check.

   A new command, config key, probe or output field waits for 1.x unless it closes one of those.
   A change to a surface still rewrites the contract snapshot and is named under Upgrading.

3. **1.0 covers the `node` and `next` presets only.** `astro`, `python` and `docs` stay
   experimental, outside the promise, until a named repository runs each. A preset names its
   repository and the date only once the repository's owner confirms it (CLAUDE.md §1.4).
4. **The promise is made when the evidence says so:**
   - the contract snapshot unchanged across two consecutive minors;
   - two consecutive candidates replayed with no must-level miss;
   - every check either out of probation or declared optional.

## Consequences

Features slow down for a few weeks; that is the point. The adopters carry a real part of the
testing, so their reports have to keep turning into corpus cases, or the replay loses its value.
A preset outside the promise is still shipped and still usable; it simply may change in a minor
after 1.0.
