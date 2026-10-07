---
title: "The road to 1.0"
description: "How abatty gets to a version it can promise: a weekly release candidate replayed by its adopters, a scope freeze on new surfaces, and a 1.0 that covers the node and next presets only."
category: governance
status: living
audience: ["developer", "architect", "agent"]
tags: ["versioning", "release", "roadmap"]
related: ["../VERSIONING.md", "../../CONTRIBUTING.md"]
last_verified: "2026-10-07"
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

## Amendments

Each lifts the freeze for one named surface, says why the freeze's own list does not cover it,
and lands in a pull request of its own, so it can be declined without touching a candidate.

- **2026-10-03 · `init --apply`** (a flag on an existing command; proposed). The adopters'
  first hour was the steps `init` leaves by hand, typed one at a time, and a step typed wrong was
  the first red they met (Tocoda's report of 2026-10-02, item 6). That is install friction, not
  a miss the freeze lists. The flag takes the steps a machine can take safely (the dependency
  install, the executable bits, the hooks, the ratchet's first floor) and stops at the first
  that fails; the rest stay by hand. It adds no config key, probe or output field, the contract
  snapshot does not move, and `init` without it prints what it printed before.

- **2026-10-03 · The 1.0 scope** (accepted by the maintainer on 2026-10-03; it also accepts the
  `init --apply` entry above). Six outside reviews of rc.11 and rc.12 agreed on one thing the
  freeze could not fix: the engineering held, and a stranger could not see what the tool was for
  or get a green first run. Releases stop until 1.0, the work is replayed from a local package,
  and these surfaces land before the freeze starts, so the contract snapshot counts its two
  unchanged minors from the last of them:
  1. **A minimal built-in profile, the default of a new repository.** About a dozen
     stack-neutral rules: the gate, CI running it, the controls and the ratchet (what abatty
     is), a linter, a formatter and unit tests, the secret scan, the audit, the lockfile, no
     tracked `.env`, and the 800-line cap. `init` under it writes the config, the scripts, the
     git hooks, the ignore files, the tool configs its gate steps need and the day-one
     workflow; the agent harness only with `--agent`, the Synovitec documents and the
     per-commit changelog line only under the `synovitec` profile. A repository whose config
     names no profile keeps `synovitec`, so no adopter's reading moves.
  2. **`init` ends green** on a fresh repository of each 1.0 preset, with `--apply`.
  3. **`abatty prove`**: the controls run on any repository, with no config and nothing
     written, and the verdict per step.
  4. **`abatty check`**: the changed files only, in seconds, where it can be done without a
     second implementation of the gate; dropped from 1.0, not delayed for, if it cannot.
  5. **The probation decisions**: `docs.frontMatterSyntax` and `docs.danglingRefs` leave
     probation, every finding over twenty-eight local repositories having been read and found
     real; `change.testTamper` becomes opt-in, since failing a push on an unexplained
     suppression is a team's policy, not a default.

  Item 4 was dropped from 1.0 the same day: most of a gate's time is the test suite, and running
  only the tests a change touches is each runner's own feature (vitest and jest have one, plain
  `node --test` has none), so doing it honestly is a second gate per runner. `gate --fast`
  already leaves the suites out, and a fresh repository's gate runs in seconds. Items 1, 2, 3 and
  5 landed.

- **2026-10-07 · 0.8.0 ships without its own candidate** (accepted by the maintainer on
  2026-10-07). The rc.4 replays found misses, the worst being `prove` calling a JavaScript
  repository's working checks absent and `update` adding scripts whose tools were missing. By
  item 1 that asks for an rc.5 and its replay before the final version. The maintainer chose to
  ship 0.8.0 instead: `latest` had stood at 0.6.1 through four candidates, so a plain install
  got the oldest code; every fix since rc.4 is held by a test; and the contract snapshot
  has not moved since rc.4. The exception is to item 1 alone. Item 4 still asks for two
  consecutive candidates replayed clean, and 0.8.0 counts as neither, so the next minor's
  candidates start that count.
