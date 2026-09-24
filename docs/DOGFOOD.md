---
title: "Running abatty on abatty"
description: "What the instrument produced when it was pointed at the repository that builds it: the score and what is behind it, the bugs it found in its own code, the five rules it cannot hold and why, and the things it got wrong. Negative results included, because a dogfood page without them is marketing."
category: reference
status: living
audience: ["developer", "architect", "reviewer"]
tags: ["dogfood", "evidence", "negative-results"]
related: ["./CATALOG.md", "./STANDARDS_PROGRESS.md", "./SECRET_SCAN_BENCHMARK.md", "./PLAN.md"]
source_truth: ["../CLAUDE.md", "../README.md"]
scope: synovitec
last_verified: "2026-09-24"
---

# Running abatty on abatty

A page like this is usually an advertisement. This one is written so that a sceptic can use it
against us: the things that got worse are here, the things that are still broken are here, and
the claims we cannot support are marked as claims we cannot support.

Reproduce any of it:

```bash
npx abatty              # where the repository stands
npx abatty measure      # every check, with its evidence
npx abatty ratchet      # every number against its floor
npx abatty secrets --benchmark
npx abatty evidence
```

## Where it stands, on 2026-09-19

|                             |                                                   |
| --------------------------- | ------------------------------------------------- |
| Score                       | **75 of 100** over 54 applicable checks           |
| Present / partial / missing | 36 / 9 / 9                                        |
| Phase                       | 0, with 15 of 22 held                             |
| Enforced share              | 67 per cent of 45 present rules held by a machine |
| Catalog                     | 78 rules in 15 families                           |
| Ratchet                     | 16 metrics, green                                 |
| Tests                       | 263, one skipped                                  |

**The score is not a grade.** It is a way to compare this repository against itself over time. A
repository with a gate and a ratchet and a long context file scores below one with neither and a
short file, which tells you how much the number is worth on its own.

## What it found in its own code

These are bugs the instrument reported about the repository that builds it. Each was a real
defect, not a false positive.

- **Three em-dashes in output strings.** `CLAUDE.md` §7 forbids them anywhere, and three had been
  sitting in `src/core/gate.mjs` and `src/ui/dashboard.mjs` as separators and empty-cell
  placeholders. `FLOW-EMDASH` reported them; they are gone.
- **The secret scan missed six credential shapes.** Measured against its own published corpus it
  scored 100 per cent precision and **67 per cent recall**, missing the unquoted `API_KEY=...`
  that a `.env` file is made of, the password inside a connection string, a cloud API key, a
  registry token, a mail provider key and a storage account key. All six are shapes it carries
  now. The full account, including what the corpus is not, is in
  [`SECRET_SCAN_BENCHMARK.md`](./SECRET_SCAN_BENCHMARK.md).
- **The secret scan also flagged something it should not.** The throwaway
  `postgres://postgres:postgres@...` that the generated pipeline writes for a service container.
  Flagging it is how a scan teaches its reader to scroll past it.
- **`docs.indexDrift` passed while a document was genuinely missing from the index**, because the
  probe matched on a substring.
- **A coupled-paths rule refused a correct push.** The pair `templates/harness/` → `.claude/` was
  over-broad: the context template installs to the root. Four precise pairs replaced it.
- **The cache never hit**, because writing it created an untracked file that changed its own key.
- **The trust scan flagged ten lines of its own harness**, until it learned that a line which
  forbids a thing is not an instruction to do it.
- **Two modules crossed the 300-line budget** and the ratchet refused the push both times. Both
  were split on a real seam. Neither floor was raised.

The mapping in [`CRA_MAPPING.md`](./CRA_MAPPING.md) found one more: there was no coordinated
vulnerability disclosure policy. There is now, and `SEC-DISCLOSURE` is a rule.

## What it cannot hold, and why

Five rules of its own catalog are missing here, and they are open rather than waived. Two more
left this list once the package learned to hold them without a dependency: `CODE-DUP` on
2026-09-23 (`code.clones`) and `CODE-JSDOC` on 2026-09-24 (`code.undocumentedExports`, at zero
after the 30 undocumented exports its first reading found here were documented).

| Rule                                        | Why not                                                                                                                                           |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CODE-LINTER`, `CODE-MAXWARN`, `CODE-SHAPE` | This package has not adopted eslint. The gate reports the absent `lint` step as **skipped** rather than passing it, and the gap analysis names it |
| `TEST-COVERAGE`                             | Wants a coverage runner with thresholds                                                                                                           |
| `TEST-MUTATION`                             | Wants StrykerJS                                                                                                                                   |

Every one of them is a dependency, and `CLAUDE.md` §1.1 says the package has no runtime
dependency and that a dev dependency is a decision rather than a default. So the instrument
scores itself down for a decision it took deliberately, which is the correct behaviour and is
worth more than a green screen.

`SEC-AGENT-BYPASS` is missing for a different reason: the generated pipeline reports a bypassed
commit, and this repository's own pipeline is hand-written and does not yet.

## Where the instrument is wrong or incomplete

- **`abatty doctor` cannot be green on a machine that is not set up for an unattended run.** It is
  the night's pre-flight, not a repository health check, and CI runs it with `--skip-self-test`.
  That is a design decision badly named, and the name has not been fixed.
- **`abatty help` lists fewer commands than the README documents.** The README also claimed,
  when this page was first written, that `abatty ci --provider github` writes a pull-request
  template while no code did; `src/cli/ci.mjs` writes one since 2026-09-19, so that half is
  closed and `CLAUDE.md` §10 says so.
- **`abatty update` used to add a `lint` script to `package.json`** on every run here, and it had
  to be reverted by hand each time. Since 0.5.0 the lock records the scripts it offered, and one a
  repository removed is not offered again. The page said "not fixed" for two releases after it was,
  because its date was bumped without it being read, which is why freshness is now judged by
  commits rather than by that date.
- **Three of six presets are proven by nobody.** `node` is proven by this repository, `next` and
  `vite-react` by two others; `astro`, `python` and `docs` have a fixture repository the suite
  runs and no repository behind them. A fixture is not a proof and `abatty presets` says so.
- **The secret-scan benchmark is our own corpus**, not a third-party one, which is weaker evidence
  and is stated on the page that carries the number.
- **`abatty gate --fast` takes about two minutes here**, against a target of three seconds. The
  target is not met and the plan says so rather than moving the target.

## What an outside review found, 2026-09-19

An external reviewer probed the work and found six things. They are here because a page like this
is worth nothing if it only contains what its author noticed.

- **The trust scanner fired ten times on this repository and would have blocked a night here.**
  Its own pattern table, its own test fixtures, the permission deny-list that forbids `rm -rf /`,
  and research prose containing the words "Cyber Resilience **Act as a** deadline" and "they
  **act as a** ratchet". A night-blocking check at a near-zero false-positive budget, running at
  roughly one hundred per cent false positives on its author's own tree. Fixed: the scanner's own
  two files are exempt, a list that forbids what it names is read as forbidding, `act as` now
  needs both a second-person lead and a role-shaped object, and the secret pattern needs a
  determiner so "fewer output tokens" is prose again. A test now asserts the scan is clean on this
  repository, and a hostile fixture proves all seven attack shapes are still caught.
- **SARIF carried no line numbers.** Zero of eight ratchet results had a region, so a forge placed
  them at the top of the file rather than on the diff line, which was the entire argument for
  emitting SARIF. The renderer was correct; the probes never supplied a line. The two probes that
  scan for occurrences now report one finding per occurrence on its own line: 14 of 17 results
  carry a region, the three without are about a module rather than a line, and the totals and
  per-file floors are unchanged because the ratchet sums weights either way.
- **Six test assertions had been weakened rather than fixed.** Accepting either exit code at the
  exact point where the fifth gate outcome exists is the one thing those assertions must not do.
  Replaced with fixtures that decide the outcome instead of hoping for it, and with an end-to-end
  case driving real npm: a tool that runs and fails exits 3, one that cannot run exits 4. Verified
  by running the suite with `eslint`, `ruff` and `mypy` removed from the machine.
- **`abatty fix --phase 0` does nothing here**, while phase 0 stands at 15 of 22. The two fixers
  that exist write documents, both files already exist, and phase 0's gaps are a control run, a
  permission list and a pipeline step. The message is honest; the feature is unfinished. `C46` is
  partial again.
- **Three renderers each decided for themselves whether a finding had a location**, and two of
  them disagreed. A finding now carries `where`, attached once. The first attempt at this put the
  scrape in the renderer and the repository's own import graph refused it, correctly: `src/ui/`
  renders what it is given.
- **Four acceptance numbers were missed while the plan called their rows landed.** They are in
  `PLAN.md` §1 now, with the measurements. The one worth repeating: `npm test` is 92 s against a
  60 s target, and the obvious fix does not work. The suite is throughput-bound, 255 s of work
  over four cores, so about 64 s is the theoretical best. A concurrency flag moves it by two
  seconds and splitting the longest file moves it by none, both measured.

## A second review, 2026-09-20: a timezone bug, found by a control

The same reviewer ran the suite at 01:55 CEST and two cases failed that pass at UTC.
`docs.behindCode` reported a document as behind code it had been verified against **on the same
day**: the probe's same-day guard compared a UTC "today" against git's `%cs`, which is the
committer's local day. A hard metric, so it failed a gate, for every user east of Greenwich in
the hours before midnight and west of it after.

Three things about this are worth recording.

**A control case caught it, on something nobody was looking for.** `docs.behindCode`'s own
"a doc verified today holds" case is what went red. That is the entire argument for the control
mechanism, and this is the first time in this repository's history that it earned its keep on an
unknown rather than on a regression somebody expected.

**The fix was a class, not a line.** One `localToday()` and seven call sites moved onto it, so
the mistake is unavailable rather than patched. Then the suite was run across five timezones,
which found four more instances in the tests themselves and two nobody had looked at: the night
report matched hooks' UTC timestamps against a local folder name by string prefix, silently
dropping every Stop receipt for anybody not at Greenwich, and its own fixtures built UTC instants
out of local dates. None of that was in the review; all of it was the same bug.

**The suite could not see any of it.** It only ever ran at UTC, where the defect does not exist.
The regression cases now pin a zone whose calendar day differs from UTC's at whatever hour they
run, because named cities agree with UTC for several hours a day and a test that is only
sometimes a test is not one.

The same round found six agent-security rules citing `SEC.5`, which the published standard
defines as outbound webhook signing. The standard gained `SEC.7` for what those rules are
actually about.

## What the first Windows and Node 20 runs found, 2026-09-21

The package claims Node 20 and runs on Windows. Until an outside trial ran it on a Windows
machine and its own pipeline gained a `windows-latest` job and a Node 20 leg, neither claim
had been tested by anything.

- **`npm test` had never once run on Node 20.** `node --test "test/*.test.mjs"` relies on
  `--test` expanding the glob, which it does only from Node 21; on 20 the runner found no file
  and passed. `scripts/test.mjs` expands the glob now, and `CLAUDE.md` §2 says so.
- **Eight suite cases were red on Windows, and two of the eight were the code.** The hooks
  `init` writes were committed without their executable bit, so on every other machine the hook
  was skipped, which is a gate that never runs; and the git shim looked for a file named `git`,
  which Windows cannot run. The other six were tests written for the machine that wrote them.
- **`docs.behindCode` turns red the day after a merge, with no commit.** Its same-day guard
  excludes a move dated today, so a document verified on Friday against code merged on Saturday
  is green on Saturday's CI and red on Sunday's tree. `main` was red on this hard metric on
  2026-09-22 with nothing pushed; the five documents were re-read and dated the same day. The
  guard is honest about one thing (a doc and its code landing together) at the price of another
  (a verdict that changes overnight), and that trade is recorded here rather than resolved.

## Two targets that were restated rather than met

Honest failure is still failure, and the record should read that way.

- **`abatty version` in under 30 ms.** It went from 131 ms to 45 ms after the entry point was
  split. The target is unreachable: `node -e ""` alone costs 31 ms on this machine, so the
  remaining budget above the runtime's own floor is about 14 ms. The target was restated as a
  share above that floor rather than quietly dropped.
- **A ten-fold cache speed-up.** Also unreachable for the same reason, and restated on the same
  grounds.

## What got better, measured

- The test suite went from **225 s to 81 s** by splitting the one file that was 151 s of it.
- `startup.eagerModules`, the modules the entry point parses before it knows which command was
  asked for, went from **89 to 3**, and is now a floor that may only fall.
- `abatty explain CODE-SIZE-300` no longer names `bin/abatty.mjs`: **646 code lines to 291**. It
  still names `templates/harness/hooks/self-test.mjs` at 425, which ships into every repository
  that installs the package and is its own item on the plan.
