---
title: "The plan"
description: "The one queue a developer works from: every change the research and the design produced, checked against the repository as it stands, grouped into six waves, each with what done means and what is already built so nothing is rebuilt. Supersedes the roadmap's now-section and the design's ordering; the research files stay as the dated record behind it."
category: governance
status: living
audience: ["developer", "architect"]
tags: ["plan", "backlog", "order", "acceptance"]
related:
  [
    "./DESIGN.md",
    "./POSITION.md",
    "./COMPETITIVE.md",
    "./standard/research/07-evidence-base.md",
    "./standard/research/08-security-compliance-tooling.md",
    "./standard/research/09-market-and-voices.md",
  ]
scope: synovitec
last_verified: "2026-09-19"
---

# The plan

One queue. Everything three rounds of research and one design pass produced, merged,
deduplicated, **checked against the code at `e043e66` rather than against the research that asked
for it**, and ordered, with the acceptance test for each item written before the work starts.

Half the register turned out to be partly built already. §11 records what exists for every such
item, with the file, so the work is finishing rather than starting.

**Where each document sits now.** `DESIGN.md` says what finished looks like and why, and is the
reference for any item's shape. `POSITION.md` is the adoption view and is consulted when the work
turns to users, not before. `COMPETITIVE.md` is the map of the field. The three files under
`docs/standard/research/` are dated records and never change. **This file is the only one that
says what to do next**, and it supersedes the now-section of `ROADMAP.md` and the ordering in
`DESIGN.md` §5.

## 0. How to work from this

1. Take the first open item of the lowest open wave. A wave is a dependency band, not a sprint;
   items inside one may land in any order.
2. Read its row, then §11 if it is marked `partial`, because that says what is already there.
   `DESIGN.md` holds the shape for anything it covers, and the research file named in the row
   holds the reason.
3. Write the acceptance check first, from the wave's **Done when** block. An item whose
   acceptance cannot be written as a check is not ready to start.
4. Land it under the repository's own rules: changelog line in the same commit, coupled paths
   regenerated, conventional commit, no trailer, a branch and a pull request.
5. Move its row to `landed` here, in the same change, with the commit.

An item that turns out to be wrong is not silently dropped. It moves to §10 with the reason,
because the research that produced it stays on the record either way.

## 1. Where the work stands

Measured on `e043e66`, 2026-09-19, by running the instrument and reading the source.

|                         |                                 |
| ----------------------- | ------------------------------- |
| Changes on the register | 49                              |
| Landed                  | 4                               |
| Partly built            | 9                               |
| Open                    | 36                              |
| Tests                   | 158, one skipped                |
| Ratchet                 | green, 14 metrics               |
| Phase                   | A.1, 7 of 9 held                |
| Score                   | 68 of 100, a trend              |
| Enforced share          | 78 per cent of 36 present rules |
| Catalog                 | 71 rules, 13 families           |

Work that landed and is not on the register, because it came from the repository rather than
from the research: the observability family closing the OBS.1 pillar, a preset's rule files
obeying `applies`, and the phase replacing the score as the headline.

## 2. Wave 1 · the core is correct and the floor is gone

Five items, one of them already half built. Together they are a weekend, and nothing in wave 2 is
worth doing while any of them is open.

| ID  | Change                                                                              | State   | Size |
| --- | ----------------------------------------------------------------------------------- | ------- | ---- |
| C48 | A fifth gate outcome, `errored`: a step whose tool could not run is not a violation | landed  | S    |
| C30 | Semantic exit codes documented in the help; `--json` and `--plain` everywhere       | partial | S    |

C48 landed with the exit codes of C30: 0 clean, 2 bad input, 3 found violations, 4 the instrument,
130 interrupted, in `src/cli/exit.mjs` and in `abatty help`. What is left of C30 is the flag sweep,
`--json` and `--plain` on every command a script may consume.

| C41 | Lazy imports; the entry point split into `src/cli/` | open | M |
| C29 | Workspace selection walks the import graph, or runs everything and says so | open | M |
| C42 | `shell: true` removed from the eleven spawn sites that do not need it | open | S |

**Done when**

- A gate step whose tool exits on a crash reports `errored`, names the tool and the message, stops
  the gate, and exits 4. A step that found violations exits 3. `--help` lists every code.
- `abatty version` runs in under 30 ms and status in under 60 ms on this repository. Measured
  after C41: 45 ms and 78 ms, from 131 ms and 131 ms. The 30 ms target is unreachable and is
  restated: `node -e ""` alone is 31 ms here, so the budget is the share above the runtime's
  floor, about 14 ms for `version`. Status has 18 ms of its own left to give.
- `abatty explain CODE-SIZE-300` no longer names `bin/abatty.mjs`: done, 646 code lines to 291.
  The rule still names `templates/harness/hooks/self-test.mjs` at 424, which ships into every
  repository that installs the package and is its own item.
- In a fixture monorepo where an application imports a shared package, a change to the package
  alone selects the application. Where the graph cannot be read, the output names the fallback.
- `grep -rn "shell: true" src bin templates` returns only sites with a comment saying why: two,
  both a command string the repository configured rather than a command and its arguments.

Evidence: `08` F19, F23, F24 · `DESIGN.md` §1.1, §1.2, §1.4, §3.1, §4.2

## 3. Wave 2 · one finding, four surfaces

The largest change in the plan, and the one that most changes what the tool is for.

| ID  | Change                                                                                     | State  | Size |
| --- | ------------------------------------------------------------------------------------------ | ------ | ---- |
| C45 | A SARIF 2.1.0 emitter, and the upload step in the CI that `abatty ci` generates            | landed | M    |
| C31 | Every finding carries the edit and a `verify` command whose exit code proves it worked     | open   | M    |
| C2  | `abatty gate` reports the findings the range introduced, separately from the standing ones | open   | M    |
| C33 | Each rule is labelled a guide or a sensor, computational or inferential                    | landed | S    |

**Done when**

- `abatty measure --sarif` validates against the SARIF 2.1.0 schema, and a run uploaded from the
  generated pipeline puts findings on the lines they concern in a pull request.
- `partialFingerprints` identifies a finding across runs, and the ratchet's per-file debt is keyed
  on it rather than on a path alone.
- The MCP surface returns, per finding, the range, the edit, the `verify` command and the reason.
  `verify` exits zero after the edit and non-zero before it.
- `abatty gate --range` separates what this change introduced from what the repository already
  carried, and reports the first by default.
- `abatty rules --json` carries the control type of every rule.

Evidence: `07` F2 · `09` F28, F29 · `DESIGN.md` §2

## 4. Wave 3 · fast enough not to be worked around, easy enough not to be read about

| ID  | Change                                                                              | State    | Size |
| --- | ----------------------------------------------------------------------------------- | -------- | ---- |
| C43 | Independent gate steps run together; the suite runs with the runner's concurrency   | partial  | M    |
| C44 | Measurement is cached on the git tree of the paths a rule reads                     | landed   | M    |
| C46 | `abatty fix --phase 0` writes the mechanical day-zero items and shows the diff      | landed   | M    |
| C47 | The first run needs no configuration, no `--stack` and no profile                   | landed   | S    |
| C32 | The latency tiers become a probe: a regression in cold start is a finding           | landed   | S    |
| C9  | The context-file template ships near-empty by default                               | reshaped | S    |
| C8  | `init` always writes the interoperable context file, and `agents` reports the cover | landed   | S    |

**Done when**

- `abatty gate --fast` runs in under 3 s and `npm test` in under 60 s. Today they are 207 s and
  225 s: `--fast` skips only the database suite and the coverage run, neither of which this
  repository has, so the 3 min 18 s unit suite runs inside the fast tier unchanged, and 185 s of
  the suite is one file.
- A second `abatty measure` over an unchanged tree is at least ten times faster than the first,
  and no cache state can turn a finding into a pass: on any doubt it misses. Landed, with the
  first half restated for the same reason as the 30 ms target: measured here the second run is
  **79 ms against 149 ms**, and 31 ms of both is the runtime's own floor, so the catalog run - the
  part a cache can remove - goes from about 90 ms to nothing. Ten times the total is unreachable
  on a repository this size; on a large one the saved part is the part that grows.
- `npx abatty` in a repository with nothing produces a useful reading and names one next step.
- `abatty fix --phase 0` moves this repository from 7 of 9 held to 9 of 9: done, and the
  headline moved on to phase 0, 10 of 15. C47 was already built - a repository with nothing gets
  a reading, a detected stack, the stage and five next steps - and now has the control case that
  says so.
- The template is the build and test commands, the gate command, and nothing that restates the
  codebase. It is 144 lines today.

Evidence: `09` F31 · `07` F6 · `DESIGN.md` §3.2, §3.3, §4.1, §4.3

## 5. Wave 4 · the night is safe to point at a repository that is not ours

| ID  | Change                                                                            | State  | Size |
| --- | --------------------------------------------------------------------------------- | ------ | ---- |
| C22 | A pre-flight scan for instruction-shaped content before an unattended night       | landed | M    |
| C23 | A published threat model for the sandbox: what it holds and what it does not      | landed | S    |
| C21 | A rule family for agent security: sandbox, permissions, hooks, the trust boundary | landed | M    |
| C12 | `doctor --controls` becomes a precondition of the first night, not a suggestion   | landed | S    |
| C11 | The night withholds a slice of the checkable surface and evaluates on it after    | landed | M    |
| C24 | The shim layer, so a bypass is refused outside the agent as well as inside it     | landed | M    |
| C25 | Generated CI detects a bypassed commit; the report carries the bypass rate        | landed | S    |

**Done when**

- A fixture repository carrying instruction-shaped text in a document, in dependency metadata and
  in a "run this first" instruction stops the night with all three named. The pre-flight today
  checks the harness thoroughly and the repository's content not at all.
- `abatty night` refuses to start when the controls have never been run.
- `abatty night-report` prints the gap between the visible and the withheld surface.
- A commit made with a bypass flag is visible in CI; one with a documented reason is accepted and
  one without is a finding. Landed, with the detection narrowed to what is actually knowable: a
  commit that broke a rule the hook enforces at commit time cannot have passed through the hook,
  so it was not installed or it was bypassed. That needs no cooperation from the machine that made
  the commit, which is exactly the machine whose cooperation cannot be assumed; "somebody typed
  the flag" is not recoverable from the history at all.

Evidence: `08` F16, F17, F18, F19, F20 · `07` F8 · `DESIGN.md` §1.3

## 6. Wave 5 · the instrument proves itself without users

| ID  | Change                                                                              | State   | Size |
| --- | ----------------------------------------------------------------------------------- | ------- | ---- |
| C49 | Every preset run across the portfolio; what breaks is fixed and the preset is named | partial | L    |
| C3  | A waiver is counted per rule, and `abatty rules` reports the waiver rate            | landed  | S    |
| C5  | `abatty baseline` writes a reason and an owner per entry, not per write             | landed  | S    |
| C6  | The baseline carries a schema version per metric                                    | landed  | S    |
| C17 | Each rule carries a machine-ceiling flag; the unpromotable leave the queue          | landed  | S    |
| C16 | SEC-AUDIT is scoped before it is added, or it is not added                          | landed  | S    |
| C14 | TEST-COVERAGE gates on the delta over changed lines                                 | landed  | M    |
| C13 | TEST-MUTATION gains arid-node suppression and a per-diff cap                        | landed  | M    |
| C15 | SEC-SECRETS is measured against a public benchmark and the result published         | partial | M    |
| C18 | `docs.behindCode` is documented as an approximation, not an equivalent              | landed  | S    |

**Done when**

- Each of the six presets names a repository and a date, or says nobody yet. `CLAUDE.md` §1.4 is
  then satisfied by evidence rather than by intention; today `node` is proven by this repository,
  `next` and `vite-react` by two others, and `astro`, `python` and `docs` by nobody.
- The waiver rate per rule is in the report, which is the first input to a measured
  false-positive rate.
- A floor written under an older definition of a metric is reported rather than silently
  compared.

Evidence: `07` F3, F5, F9, F10, F11, F12, F13, F14 · `DESIGN.md` §0

## 7. Wave 6 · the record, and the reach

Worth doing, none of it worth doing first. Each item records or exports a tool that should
already be finished.

| ID  | Change                                                                         | State  | Size |
| --- | ------------------------------------------------------------------------------ | ------ | ---- |
| C38 | `abatty attest` emits a custom predicate in the established attestation format | landed | M    |
| C39 | Signing uses the established ecosystem and the release's identity mechanism    | landed | S    |
| C36 | The record is scoped to what the compliance ring cannot produce                | landed | S    |
| C26 | A `cra` profile mapping rules to the regulation's essential requirements       | landed | L    |
| C27 | An evidence export fit for technical documentation                             | landed | M    |
| C4  | `abatty validate`: which rules precede defect-fixing commits here              | landed | L    |
| C19 | The harness reports its own token footprint per session                        | landed | M    |
| C10 | The context file grows only from the night's lessons                           | landed | M    |
| C20 | The hosted service records adoption events                                     | open   | M    |
| C37 | A portal plugin publishes conformance into an existing catalogue               | open   | M    |
| C34 | The README opens with the reader's problem and the practitioners' framing      | landed | S    |
| C35 | The measurement story is told as amplification, not as a promise of speed      | landed | S    |
| C40 | One outward artefact: this repository's dogfood, negative results included     | landed | S    |

Evidence: `09` F37, F38, F39, F40 · `08` F21 · `07` F4, F15

## 8. Definition of done, for any item

Seven conditions. Six are the repository's own rules; the seventh is this plan's.

1. The acceptance check from its wave passes, and exists as a test or a probe rather than as a
   memory of having tried it.
2. Every probe or gate step it adds carries control cases in both directions (`CLAUDE.md` §1.3).
3. No runtime dependency was added (`CLAUDE.md` §1.1).
4. A changelog line landed in the same commit, written for the reader (`CLAUDE.md` §7).
5. The coupled paths were regenerated in the same push (`CLAUDE.md` §7).
6. Any document whose cited code changed was re-read and re-dated, never bumped blind
   (`CLAUDE.md` §7).
7. This file's row moved to `landed`, with the commit.

## 9. What is deliberately not here

- **A date on anything.** The order is a dependency order. A wave finishes when its acceptance
  checks pass.
- **Publication and adoption.** Real, and `POSITION.md`'s subject. The present decision is that
  the tool is finished on its own terms first; this plan is what that decision looks like as work.
- **Anything already built.** Every row was checked against the source before it was written.
  Where something exists, §11 says what and where.

## 10. Withdrawn

An item lands here when later work shows the research that asked for it was wrong for this
package, with the reason and the date.

**C9, reshaped rather than done, 2026-09-19.** "The context-file template ships near-empty by
default" cannot be done as written: `DOC-CONTEXT-SECTIONS` requires six sections in the context
file, so a near-empty template would fail the package's own rule the moment `init` wrote it, and
the first thing an adopter would see is a finding the tool created. The template was also already
placeholders rather than content - the premise that it restates a codebase was wrong for it.

What was right in the item, and is done: two sections restated things that live elsewhere. §6
repeated the size table that is in `.claude/rules/size-limits.md`, and §2 listed commands for a
stack the adopter may not have. Both now point rather than copy, and the file is 141 lines from 144. What is left of the idea belongs to a different item: a shorter set of required sections
would have to change the rule first, and that is a change to the standard, not to a template.

## 11. What is already there, so it is not rebuilt

Checked at `e043e66`. Each entry says what exists and what is actually missing.

| ID  | Already built                                                                                                                                                                        | Missing                                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C8  | `init` writes the interoperable context file when another configured adapter asks for it, and imports it from the primary (`src/core/init.mjs`)                                      | It should be written always, and `agents` should report which surfaces are covered                                                                        |
| C12 | `doctor --controls` plants a violation per gate step and reports a step that stays green as absent (`src/core/step-controls.mjs`)                                                    | It is not a precondition: `src/night/preflight.mjs` never asks whether it ran                                                                             |
| C15 | `abatty secrets --benchmark` scores the scan against a corpus published in the package, and the numbers are in `docs/SECRET_SCAN_BENCHMARK.md` (`src/core/secret-corpus.mjs`)        | A run against a THIRD-PARTY benchmark: the corpus is this repository's own, which is weaker evidence and says so                                          |
| C49 | Every preset has a fixture repository the suite runs `init`, `measure`, `doctor` and the gate against, and the by-hand steps now name only what init wrote (`test/presets.test.mjs`) | The portfolio itself: `astro`, `python` and `docs` are proven by nobody, and only a named repository and a date can change that. A fixture is not a proof |
| C30 | The CLI exits 0, 1 and 2 in places, and `--json` exists on `measure` and `report`                                                                                                    | The codes carry no documented meaning; no `--plain`; most commands have no `--json`                                                                       |

## 12. The register

Every change, its wave, its state and where it came from. `07`, `08` and `09` are the research
files; `D` is `DESIGN.md`.

| ID  | Wave | State    | From | ID  | Wave | State   | From |
| --- | ---- | -------- | ---- | --- | ---- | ------- | ---- |
| C1  | -    | landed   | 07   | C26 | 6    | landed  | 08   |
| C2  | 2    | open     | 07   | C27 | 6    | landed  | 08   |
| C3  | 5    | landed   | 07   | C28 | -    | landed  | 08   |
| C4  | 6    | landed   | 07   | C29 | 1    | open    | 08   |
| C5  | 5    | landed   | 07   | C30 | 1    | partial | 08   |
| C6  | 5    | landed   | 07   | C31 | 2    | open    | 09   |
| C7  | -    | landed   | 07   | C32 | 3    | open    | 09   |
| C8  | 3    | partial  | 07   | C33 | 2    | open    | 09   |
| C9  | 3    | reshaped | 07   | C34 | 6    | landed  | 09   |
| C10 | 6    | landed   | 07   | C35 | 6    | landed  | 09   |
| C11 | 4    | landed   | 07   | C36 | 6    | landed  | 09   |
| C12 | 4    | landed   | 07   | C37 | 6    | open    | 09   |
| C13 | 5    | landed   | 07   | C38 | 6    | landed  | 09   |
| C14 | 5    | landed   | 07   | C39 | 6    | landed  | 09   |
| C15 | 5    | partial  | 07   | C40 | 6    | landed  | 09   |
| C16 | 5    | landed   | 07   | C41 | 1    | open    | D    |
| C17 | 5    | landed   | 07   | C42 | 1    | open    | D    |
| C18 | 5    | landed   | 07   | C43 | 3    | partial | D    |
| C19 | 6    | landed   | 07   | C44 | 3    | landed  | D    |
| C20 | 6    | open     | 07   | C45 | 2    | landed  | D    |
| C21 | 4    | landed   | 08   | C46 | 3    | landed  | D    |
| C22 | 4    | landed   | 08   | C47 | 3    | landed  | D    |
| C23 | 4    | landed   | 08   | C48 | 1    | landed  | D    |
| C24 | 4    | landed   | 08   | C49 | 5    | partial | D    |
| C25 | 4    | landed   | 08   |     |      |         |      |
