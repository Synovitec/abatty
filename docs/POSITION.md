---
title: "Position 2026-09-18: the distance between an instrument and a product"
description: "An honest assessment of abatty against what the research says drives tool adoption: what is built and works, what is missing, what the realistic ceiling is, and the order the remaining work has to happen in. Written from the evidence base, not from taste."
category: reference
status: living
audience: ["architect", "developer", "reviewer"]
tags: ["position", "adoption", "diffusion", "roadmap", "product"]
related: ["./standard/research/07-evidence-base.md", "./ROADMAP.md", "../README.md"]
scope: synovitec
last_verified: "2026-09-18"
---

# Position: the distance between an instrument and a product

Read with `docs/standard/research/07-evidence-base.md`, which carries the sources. That document
asks whether the mechanisms are right. This one asks whether anyone will ever use them, which is a
different question with its own literature and its own evidence.

The summary, stated once and without softening: the instrument is real, unusually complete for a
0.1.0, and it works on itself. The product does not exist. Those are two projects, and the repository
is about ninety per cent the first and ten per cent the second. Nothing below is a judgement of
taste; every line is graded against something measured, either in the adoption research or in this
repository on 2026-09-18 at commit `583f9ce`.

## 1. What adoption actually depends on

Tool adoption in an open ecosystem is a diffusion process and it has been measured. A longitudinal
study of how automation tools spread across npm, using repository badges as the trace and survival
analysis on adoption times, found that social exposure, competition and observability significantly
affect adoption, and that early adopters differ considerably from other developers in social
standing and technological openness. Its companion study of 294,941 repositories found badges
adopted in 46 per cent of packages, and that the non-trivial ones, which display build status,
coverage and dependency freshness, are mostly reliable assessment signals correlating with more
tests, better pull requests and fresher dependencies.

Three consequences for this package:

- A tool spreads when a visible person uses it visibly. Not when it is good.
- The fact of using it must be observable to third parties. This is what the score, the badge and
  the dashboard in `src/ui/dashboard.mjs` are for, and it is the right instinct.
- The observable signal has to mean something, or it becomes a badge that signals nothing. That is
  the same requirement as rule validity in the evidence base, arriving from the marketing side.

None of the three can start before the package is installable.

## 2. Scorecard

Measured on 2026-09-18 at `583f9ce`, on the repository itself.

| Dimension           | What the evidence says                                                       | State today                                                                                                                                                                                    | Verdict           |
| ------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| Reliability         | Trust collapses on the first false alarm and does not return                 | `abatty gate` green on itself with every step it ships, 145 tests (144 pass, 1 skipped), 0 runtime dependencies, the first dogfood found 9 real defects and the switch to its own gate a tenth | Strong            |
| Latency             | A slow gate is a bypassed gate                                               | status 241 ms, `abatty measure` 254 ms, but the pre-push gate is 3 min 22 s, dominated by the unit suite; a gate that slow is one a team learns to start and walk away from                    | Risk              |
| Precision           | The survival threshold is under 10 per cent effective false positives        | Unmeasured at every level                                                                                                                                                                      | Blocker           |
| Rule validity       | Only 25 of 202 rules in the best-known catalog were fault-prone              | Catalog unvalidated; the headline score is a composite of composites                                                                                                                           | Blocker           |
| Interoperability    | AGENTS.md is the cross-tool standard and often the only mechanism present    | Tool-native files only                                                                                                                                                                         | Blocker, cheap    |
| Distribution        | Nothing diffuses that cannot be installed                                    | Not published; one tag; no release                                                                                                                                                             | Blocker, cheapest |
| Surface area        | Competition and complexity slow diffusion                                    | 25 commands, 12.2k lines, 214 files, 1.4 MB unpacked, 454.6 kB packed                                                                                                                          | Risk              |
| Documentation       | Accretive documents become unreadable, which this package measures elsewhere | `README.md` at 33.8 kB and 4,973 words                                                                                                                                                         | Risk              |
| Social proof        | Early adopters differ in standing; exposure drives adoption                  | One human maintainer, no external users, no external issues                                                                                                                                    | The real gate     |
| Legibility of value | Observability significantly affects adoption                                 | The proposition needs about 5,000 words to state                                                                                                                                               | Risk              |

### 2.1 The package did not run its own gate (fixed 2026-09-18)

Found while checking this document's numbers on 2026-09-18, and it qualifies the Reliability row
above. `README.md` says of the gate: "One implementation, three callers: `npm run gate`,
`.githooks/pre-push`, the night's Stop hook." In this repository that is not true.

`npm run gate` is a hand-written chain (`format:check && typecheck && test && standards &&
secrets && scrub`). `abatty gate --fast`, the command the package ships and documents, runs the
preset's steps instead, reaches the lint step and goes red in 3.9 s, because `init` wrote
`lint: eslint . --max-warnings=0` into `package.json` for a tool this repository does not have and
has consciously not adopted (see `CLAUDE.md` §10). So the two gates check different things, the
green one is the one that is not the product, and the flagship command fails on its own package.

It was the same defect as the seven the first dogfood found, one level out: a mechanism that is
documented, believed and not in force.

**Resolved the same day.** `gate` and `gate:fast` now call `abatty gate`, the vestigial `lint`
script is gone so the step reports as skipped, and the scrub became a built-in gate step rather
than a line in a hand-written chain, so a repository that opted in keeps it whichever way the
gate is called. The switch turned on three steps the hand-written chain never ran: the import
graph, dead code and the audit. Dead code found ten unused exports, now deleted, and two knip
patterns that matched nothing, which is the same `0 findings across 0 files` this standard
refuses elsewhere. The Reliability row above is qualified for the record, not because the defect
stands.

## 3. The three things that decide it

### 3.1 It is not published, and everything else depends on that

Zero downloads, zero users, zero feedback, and therefore none of the waiver telemetry, precision
data or adoption events that the whole differentiation strategy in the evidence base requires. Both
`abatty` and the scoped name were still free on the registry when checked. `publishConfig.provenance`
is set, the release workflow in `.github/workflows/release.yml` exists and fires on a tag, the gate
is green. The distance between here and a real package is one tag push.

Every item in section 5 below is ordered behind this one, because each of them is worth more with
ten users than with none.

### 3.2 The surface area is a single-maintainer liability and the platform is absorbing its lower half

Twenty-five commands, 12.2k lines, one human. A comparable open toolkit documented the risk
precisely: between January and July 2026 the platform vendor shipped natively and for free a large
part of the orchestration layer such toolkits used to hand-roll, and the toolkit responded by
deleting the redundant parts and keeping only opinionated workflow and domain judgement.

The exposed half of this package is the harness cluster: `abatty init`, `update`, `doctor`, `agents`,
`mcp`, `night`, `night-report`, `serve`, `publish`, `dashboard`. The durable half is the gate, the
ratchet and the rule catalog in `src/rules/index.mjs`, because no vendor ships a company's standard.

A tool with twenty-five commands and no users is a personal instrument with a command line. The
widely used version of this package has four commands on its front page and the other twenty-one
behind a help flag.

### 3.3 The README is the product for the first sixty seconds

`README.md` is 4,973 words. The research on agent context files found they become complex,
hard-to-read artefacts that evolve like configuration code through frequent small additions, and
this package measures that failure in other repositories through `context.overCap`. The same
accretion has happened here.

There is a second, quieter reach problem. The prose register is dense and literary, with long
compound sentences and semicolon chains. A reader who shares the author's language will enjoy it. A
developer skimming on a phone in Seoul, São Paulo or Bangalore will not finish the first screen.
That is not a criticism of the writing, it is a statement about the size of the audience it can
reach.

## 4. What is strong and should be defended

This section exists so the assessment stays honest in both directions. These are not small things.

- **Zero runtime dependencies** in a category where the alternatives pull in hundreds. That is a
  supply-chain posture and a trust signal at the same time.
- **`abatty doctor --controls`**, which plants a violation per gate step and reports any step that
  stays green as absent. Nothing else found in the survey verifies its own verifier, and the
  reward-hacking literature says this is the correct instinct.
- **The rule catalog as data**, with the reason, the standard IDs, the enforcement level and the
  check as a pure function of the repository context, in `src/rules/index.mjs` and
  `src/rules/families/`. That is the substrate for the validation nobody else can run.
- **Profiles**, in `src/profiles/index.mjs`, so a client project carries its own standard on the
  same instrument. The multi-tenant story is already built rather than planned.
- **The dogfood worked.** Running the instrument on itself over one day found nine real defects,
  seven of them in the harness hooks, and moved docs-freshness to 100 and the score to 71. The
  figure it moved FROM is not one number, and that is worth recording: the same pre-dogfood tree
  reads 52 against the catalog as it stood that morning and 54 against the catalog as it stands
  now, because fixing TEST-UNIT changed what the catalog counts. A score is therefore not
  comparable across versions of the rules that produced it, which is exactly the schema-version
  problem C6 raises for the ratchet's floors, arriving in the headline number too. That is the
  strongest single piece of evidence in this document that the thing does something, and the
  clearest warning against quoting its score across releases.

## 5. Is a hundred thousand developers realistic

Not for the package as currently scoped, and it is the wrong target to steer by.

A hundred thousand developers in this ecosystem means the tier of the formatter, the linter, the
hook installer and the test runner. Every tool at that tier shares one property this package lacks:
a single job, stateable in one clause, solved better than the alternative, with almost no
configuration. The current self-description, an engineering standard as an installable instrument,
is not a sentence a developer can act on in two seconds.

The ladder that is worth steering by, with the numbers that actually mean something:

| Horizon  | Milestone                                                                       | Why this number                                            |
| -------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Month 1  | Published and installable; 50 weekly downloads                                  | Binary, not growth: the name is claimed and the loop opens |
| Month 3  | 500 weekly downloads, 5 repositories that are not ours, 3 issues from strangers | A stranger filing an issue is the best usefulness signal   |
| Month 6  | 2,000 weekly downloads, one adopter we did not know, one write-up not ours      | First evidence of diffusion rather than distribution       |
| Month 12 | 10,000 weekly downloads                                                         | Top few per cent of the registry; a real community         |

A hundred thousand, if it ever arrives, arrives through a wedge, never through the full instrument.

## 6. The wedge

One claim in the whole survey is both unoccupied and defensible, and it is not the standard.

**abatty is the gate that agent-written code has to pass.**

The evidence for the problem is quantified and citable: code smells are 89.3 per cent of
the issues introduced, more than 15 per cent of commits from every coding agent introduce at least one
issue, and 22.7 per cent of them survive to the latest revision, with the cumulative surviving count
past 100,000 by February 2026. In parallel, every model tested could saturate the visible test suite
while the gap to held-out tests grew with task length. Hundreds of thousands of developers have that
problem today, and the existing answers review the code after it is written.

The four features the survey found unclaimed by anyone map onto that wedge without modification: a
measured false-positive rate for the tool's own rules, a catalog validated against the repository's
defect history, a harness that reports its own token cost and proves its gate can go red, and a
human-owned justified baseline with schema-versioned metric definitions.

## 7. The next ninety days, in order

Order matters more than content here. Items 1 to 3 are days of work, not weeks.

1. **Publish.** Tag and release. Claim the name. Nothing else moves until this is done. Until it
   is, the README installs from the branch and says so: on 2026-09-18 the first command on the
   front page was `npm i -D abatty` against a registry that answers 404, which is the one kind of
   error a reader meets before anything else the page claims.
2. **Cut the front page to four commands**: `init`, `gate`, `ratchet`, `doctor`. The rest move behind
   a help flag. Target a hero section under 150 words and a terminal recording under 30 seconds.
   Partly done 2026-09-18 (evidence base C1): the hero is 54 words and says what the package does
   rather than what it is, the two-minute path runs install, init, gate, controls and only then the
   reading, and the command block leads with those four. What is left of this item is the cut
   itself, the twenty commands are still on the page under a heading rather than behind a help
   flag, and the recording.
3. **Emit AGENTS.md from `abatty init`** alongside the tool-native files, and report surface coverage
   in `abatty agents`. This removes the interoperability objection for one day of work.
4. ~~**Implement C7 from the evidence base**: a floor above the current value is a finding.~~ Done
   2026-09-18: `improved` fails the run and prints as `FLOOR UNLOCKED`, so an improvement is
   recorded in the change that earned it. This repository was carrying a floor of 9 against a
   value of 0 when it landed.
5. **Ship the waiver reason and count it per rule.** This turns the first ten users into the
   precision dataset that everything in section 6 depends on.
6. **Write one artefact aimed outward**: the dogfood numbers, what the standard cost and what it
   caught, with the nine defects named. Observability drives diffusion, and the only observable
   asset the project currently owns is the honesty of its own measurements.
7. **Then** the night, the hosted dashboard and `abatty validate`.

## 8. What could kill it

- **Building inward.** The repository grew by 5,661 lines in one day and gained no users. That ratio
  is the failure mode, stated as a number.
- **Platform absorption** of the harness half before a user base exists in the gate half.
- **Shipping noise.** Publishing with an unscoped audit step or a loud default rule set and spending
  the first hundred users' trust in a single release. The industrial evidence is that trust is the
  scarce resource and that it does not come back.
- **Bus factor one** on a 1.4 MB package with twenty-five commands and a standard document that
  grows with it.

## 9. How this document is judged

It is wrong if, in ninety days, the package is published, the front page is four commands, and the
milestones in section 5 are missed anyway. In that case the wedge in section 6 is the thing to
re-examine, not the plan in section 7. Re-read this file against the download numbers, not against
the score.
