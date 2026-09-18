---
title: "Adoption decisions"
description: "The decisions taken alone by the unattended adoption nights (/adopt-standards): date, phase, situation, the default taken, the alternative set aside, what the morning must re-read."
category: governance
status: living
audience: ["developer", "agent"]
tags: ["standards", "adoption", "decisions"]
related: ["./README.md", "./STANDARDS_PROGRESS.md"]
---

# Adoption decisions

## 2026-09-18 · day 0 of this repository's own adoption

The package ran its own instrument for the first time. These are the calls taken by hand, with
the alternative each set aside.

- **The `node` preset, named rather than detected.** `detect` looks for a web framework
  (Express, Fastify, Hono, Koa) and abatty is a CLI, so nothing matched and the repository read
  as having no stack. Taken: `init --stack node`, and the stack recorded in the config, which is
  what a repository whose shape the detector does not know is meant to do. Set aside: widening
  `detect` to "a package with a `bin` and no framework", which would have claimed repositories
  the `docs` preset is for. Left as a gap, not a waiver.
- **`.claude/` is committed and ignored by the format check.** It is a verbatim install of
  `templates/`, which is ignored for the same reason (the hooks keep long single-line statements
  on purpose), and `doctor` is what keeps the two equal. `templates/harness/` and `.claude/` are
  now a coupled pair, so the harness this repository runs cannot drift from the one it ships.
- **dependency-cruiser and knip installed as dev dependencies.** A dependency is a decision:
  these two are what the gate's graph and dead-code steps run, and the rule about them is one
  this package holds every other repository to. The no-dependency rule covers `dependencies`,
  which stays empty.
- **The graph cruises `src` and `bin`.** `bin/abatty.mjs` is the entry point; cruising `src`
  alone reported `src/core/scrub-map.mjs` as an orphan although the CLI imports it. A false
  orphan teaches a team to ignore the check.
- **Five import cycles committed as the graph's known violations** (`core/init` with
  `core/update`, `core/doctor` with both, `ratchet/baseline` with `ratchet/index`,
  `profiles/index` with `rules/index`). They are real and pre-existing; the baseline is the
  tool's own per-finding debt and may only shrink. Set aside: breaking them in the same change
  as the adoption, which would have mixed a refactor into a day-0 commit.
- **TEST-COVERAGE, TEST-MUTATION, CODE-DUP, CODE-JSDOC and CODE-SHAPE left missing.** Each wants
  a dependency (coverage thresholds, StrykerJS, jscpd, eslint-plugin-jsdoc, ESLint itself) and a
  floor set at today's figure. They are open and named in `CLAUDE.md` §10, not waived: a waiver
  would stop them being counted, and they should be counted.
- **`doctor` is the night's pre-flight, not a repository health check.** Two of its checks are
  facts of the machine (an agent on PATH, the attribution setting in the user's settings), so it
  cannot be green in CI or on a fresh clone. Recorded as a deviation in `CLAUDE.md` §10 rather
  than softened; CI runs `--skip-self-test`.

- **`doc-left-stale` for the five standard documents.** `docs.behindCode` is red with five
  findings (`ADOPTION_PLAN`, `AUTONOMOUS_ADOPTION`, `BEST_PRACTICES`, `ENFORCEMENT_MAP`,
  `ENGINEERING_STANDARD`): each carries `last_verified: 2026-09-14` and cites sources that moved
  on 2026-09-15. It is red on `origin/main` too, untouched, so the gate has never passed on a
  push here; `core.hooksPath` was not set in this clone until today, which is how a red gate was
  pushed. The cure is to re-read each document against the code it cites and bump the date in
  the same change; blind bumping is what the rule exists to refuse, and re-reading 2,000 lines of
  standard is its own piece of work. Left stale and named, not waived.

## 2026-09-18 · C7, and the package running its own gate

- **`improved` is a failing status now (C7).** A floor above the value it measures is slack the
  gate keeps accepting: nine findings could come back for free while the number said nine. The
  run is red until `abatty baseline` records what was earned, in the change that earned it, which
  is also the only moment anyone knows why it moved. Set aside: a warning instead of a failure,
  which is the one-sided ratchet this package already has and which left this repository carrying
  a floor of 9 against a value of 0 for four days.
- **Two metrics promoted to HARD by that lock-in.** `size.excessCode` and `size.overBudget` were
  both at zero when the floor was recorded, and the baseline writer promotes a zero to hard. They
  may now never rise, which is a real tightening taken deliberately: it is the documented
  behaviour and P.2 is the reason for it. Reversing it is a config override with a written reason,
  not an edit of the baseline.
- **`gate` and `gate:fast` call `abatty gate`.** They were a hand-written chain that ran format,
  typecheck, unit, the ratchet, secrets and the scrub, while the command the package ships ran a
  different list and went red on a lint step for a linter this repository has not adopted. Two
  gates that check different things is worse than either. Set aside: adopting eslint to make the
  step pass, which is a dependency and a decision of its own; the vestigial `lint` script is gone
  instead and the step now reports as skipped, which the gap analysis names.
- **The scrub became a built-in gate step.** It was a line in the hand-written chain, so pointing
  `gate` at `abatty gate` would have dropped non-negotiable 2 for every repository that opted in.
  It is skipped where `scrub.enabled` is off, and it is emitted into generated CI as well, so the
  gate and CI cannot list different steps.
- **Three steps the old chain never ran are now on: the import graph, dead code and the audit.**
  Dead code found ten unused exports (six re-exports in `src/ratchet/index.mjs` that nothing
  imported, `countMatches`, and three terminal colour helpers) and two knip patterns that matched
  nothing. The exports are deleted and the patterns corrected: a pattern that matches nothing is
  the `0 findings across 0 files` this standard refuses everywhere else.
