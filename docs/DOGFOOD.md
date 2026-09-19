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
last_verified: "2026-09-19"
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

|                             |                                                       |
| --------------------------- | ----------------------------------------------------- |
| Score                       | **74 of 100** over 54 applicable checks, on `511d041` |
| Present / partial / missing | 35 / 10 / 9                                           |
| Phase                       | 0, with 15 of 22 held                                 |
| Enforced share              | 67 per cent of 45 present rules held by a machine     |
| Catalog                     | 78 rules in 15 families                               |
| Ratchet                     | 15 metrics, green                                     |
| Tests                       | 231, one skipped                                      |

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

Five rules of its own catalog are missing here, and they are open rather than waived:

| Rule                                        | Why not                                                                                                                                           |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CODE-LINTER`, `CODE-MAXWARN`, `CODE-SHAPE` | This package has not adopted eslint. The gate reports the absent `lint` step as **skipped** rather than passing it, and the gap analysis names it |
| `CODE-JSDOC`                                | Wants `eslint-plugin-jsdoc`                                                                                                                       |
| `CODE-DUP`                                  | Wants `jscpd`                                                                                                                                     |
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
- **`abatty help` lists fewer commands than the README documents**, and the README has claimed
  that `abatty ci --provider github` writes a pull-request template, which no code does.
- **`abatty update` silently adds a `lint` script to `package.json`** on every run here, and it
  has to be reverted by hand each time. It is a real sharp edge and it is not fixed.
- **Three of six presets are proven by nobody.** `node` is proven by this repository, `next` and
  `vite-react` by two others; `astro`, `python` and `docs` have a fixture repository the suite
  runs and no repository behind them. A fixture is not a proof and `abatty presets` says so.
- **The secret-scan benchmark is our own corpus**, not a third-party one, which is weaker evidence
  and is stated on the page that carries the number.
- **`abatty gate --fast` takes about two minutes here**, against a target of three seconds. The
  target is not met and the plan says so rather than moving the target.

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
