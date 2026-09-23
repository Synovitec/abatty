---
title: "Adoption plan - bootstrapping a new repository, transforming an existing one"
description: "How the engineering standard is applied: the day-0 checklist and file skeletons for a new project (where every metric is HARD from the first commit), the eleven-phase transformation programme for an existing project (ratchet first, correctness before size, size before types, coverage pinned early and raised last), with the per-repository reading kept apart in ADOPTION_STATUS.md so this plan stays general."
category: guide
status: living
audience: ["architect", "developer", "agent"]
tags: ["standards", "onboarding", "transformation", "ratchet", "phases", "checklist"]
related:
  [
    "./ENGINEERING_STANDARD.md",
    "https://github.com/Synovitec/ops-hub/blob/main/engineering/ADOPTION_STATUS.md",
    "./AUTONOMOUS_ADOPTION.md",
    "../../templates/harness/README.md",
  ]
scope: synovitec
last_verified: "2026-09-23"
source_truth:
  - "./ENGINEERING_STANDARD.md"
  - "../../templates/harness/**"
---

# Adoption plan

The standard (`ENGINEERING_STANDARD.md`) says what is required. This says how a repository gets there,
in two very different situations. Where a given repository stands is the dated reading in
`ADOPTION_STATUS.md`, kept apart so that nothing here is about one project.

The single most important difference between the two situations: **a new repository
measures zero on everything, so every metric is HARD from the first commit and no ratchet is
ever needed.** Ratchets exist only for debt. The transformation programme below is what it
costs to reach the state a new project starts in - roughly 300 commits and a week of one
agent's time on a 50k-line codebase, measured twice.

---

## A. A new project - day 0

Before either path, measure: `node ops-hub/engineering/tools/gap-analysis.mjs <repo>` writes
a dated report with every mechanism present, partial or missing and the phase that closes it.
Run it again after each phase; the two readings side by side are the progress.

Order matters. The instrument comes before the first feature, because the first feature is
the first chance to add a violation nothing catches.

### A.1 Checklist

0. **Install the instrument.** `npm i -D github:Synovitec/abatty#v0.1.0 && npx abatty init
--stack <next|vite-react|node>` writes the harness (item 12), the tooling (5b), the pre-push
   hook and the scripts (7), `CLAUDE.md` from the template and the day-0 documents (1, in part);
   `npx abatty measure` is the gap analysis, `npx abatty gate` the gate, `npx abatty
doctor` the self-test and the drift against the package, `npx abatty rules` the catalog of
   every check by phase (must before should) and `npx abatty explain <ID>` one check with its
   reason. The items below say what each of
   those means and what is still by hand: the ratchet (6) is the next slice of the package.
1. **Repository skeleton.** `CLAUDE.md` (from the skeleton in A.2), `CHANGELOG.md` with an
   `## [Unreleased]` section, `docs/README.md` index, `docs/CODE_CONVENTIONS.md`,
   `docs/STANDARDS_PROGRESS.md` (empty scoreboard), `docs/DECISIONS.md`.
2. **Toolchain pinned.** `.nvmrc`, lockfile committed, `npm ci` / `pnpm install
--frozen-lockfile` in CI, `.gitattributes` with `* text=auto eol=lf`, `.prettierrc`,
   `.prettierignore`, `.gitignore` covering env files, coverage, build output and any
   directory that will ever hold real data.
3. **TypeScript strict** (`strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`), or for
   a JavaScript repository `tsc --noEmit` over `checkJs` from day one so the count starts at
   zero.
4. **ESLint flat config** at `--max-warnings=0` with: `max-lines` 300 code lines per kind
   (the table in the standard, CODE.1) and 800 raw as the error cap, `max-lines-per-function:
60` (150 for component files), `complexity: 12`, `max-params: 4`,
   `jsx-a11y` recommended at error, `jsdoc/require-jsdoc` `publicOnly` at error with the
   fixer disabled and `jsdoc/no-types`, `no-restricted-imports` for the vendor SDKs that
   belong behind a provider interface, `react/jsx-no-literals` (or the stack's equivalent) for
   user-facing text, `no-console` outside scripts. Every block carries its reason in a
   comment above it.
5. **Zod at every boundary and one validated env module** (`src/lib/env.ts` or equivalent)
   before the first route exists.
   5b. **The import graph and dead code, from `templates/tooling/`:** `.dependency-cruiser.cjs`
   with one rule per arrow of the boundary map (CODE.5) and `knip.jsonc` (CODE.6), both in the
   gate from day 0 with nothing to baseline; `scripts/codemods/` exists the first time a change
   touches more than ten files (CODE.11); `code.clones` in `ratchet.enable` (no dependency),
   or a detector read as `dup.*`, when the first duplicate shape appears (CODE.12).
6. **The ratchet script** (`scripts/ci/check-standards.*`), copied from the reference
   implementation named in `ADOPTION_STATUS.md` and stripped of its stack-specific checks,
   with its control-case test file. The package (`abatty`, item 0) does not
   carry the ratchet yet: extracting the core (size, function shape, front matter, citations,
   behind-code, changelog range, per-file debt, score) into it is its next slice, and copying
   is the interim. On day 0 the HARD set is every metric. Write the baseline: it is
   all zeros, and that is the point.
7. **The gate script and the hook.** `scripts/ci/gate.mjs`, `.githooks/pre-push` calling it,
   `hooks:install` script setting `core.hooksPath`. Path-aware selection configured for the
   heavy suites this stack will have.
8. **Pre-commit hook** for the three things worth catching before a commit: a `console.log`
   added, a secret staged, a locale file touched without its siblings. Secret scanning shares
   ONE implementation with CI.
9. **CI on Woodpecker** (`ci.synovitec.com`): `checks` (format, lint, typecheck, unit,
   standards with `--range auto`, secret scan, audit), `integration` (real Postgres,
   coverage), `e2e` (Playwright + axe), `deploy` gated on all three. No GitHub Actions file
   at all.
10. **Coverage thresholds pinned in the test config** at the measured figure from the first
    suite, per area if the repository is heterogeneous. `reportOnFailure` on, or a red suite
    reports no coverage rather than a failure.
11. **Docs front matter check and index check** live from the first document.
12. **The agent harness**, from `templates/harness/`: `.claude/settings.json` (guard,
    protect, stop-gate, brief and lint-on-edit hooks; the repo's allow/deny rules),
    `abatty.config.json` at the root (commands, files, push policy, phases; the older
    `.claude/adoption.json` is still read and `abatty config --migrate` moves it), the nine hooks (the
    guards, the direction check and their self-test), `.claude/bin/` (a `git` earlier on `PATH`
    than the real one, refusing the force push and the hook bypass in shells the agent's own
    guard never sees), the path-scoped `.claude/rules/` for the stack (graphql,
    sequelize, mui, testing, i18n, a11y, pwa, size-limits - `init` takes the ones that apply:
    the practice files always, the library files only where the repository depends on the
    library, reported as n/a with the dependencies it looked for. Fixed 2026-09-18; before that
    a project with no ORM received the ORM rules), the
    `adopt-standards` skill and the `standards-reviewer` and `standards-adopter` agents
    (`verify-change` is named by the context template and is NOT shipped: do not list it as
    installed); `.claude/night/` in `.gitignore`. Domain reasoning that only
    matters in one directory goes to `.claude/rules/<topic>.md` with `paths:` front matter,
    keeping `CLAUDE.md` under 200 lines.
13. **The agent-readability score** computed from the ratchet metrics and printed by the gate.
    On a new repository it reads 100 and the interesting number is the first axis to drop.
14. **First ADR:** the stack, the locale set, the push policy on `main`, the icon policy,
    and the coverage scope. Five decisions, one entry each.
15. **The `CLAUDE.md` "known gaps" section exists and is empty**, so the next person knows
    where a gap goes.

### A.2 `CLAUDE.md` skeleton (200 lines maximum; the full template with the delivery rules, the skills table and the autonomy contract is `templates/harness/CLAUDE.md.template`)

```markdown
# CLAUDE.md - <project>

<Two sentences: what the product is, who the client is, who builds it.>
This file is the agent's entry point. The rules are the standard
(ops-hub/engineering/ENGINEERING_STANDARD.md); how they apply here is docs/CODE_CONVENTIONS.md;
the narrative is docs/README.md.

## 1. The non-negotiables <3 to 6; violating one is an incident, not a bug>

## 2. Commands <dev, gate, gate:fast, standards, test, e2e, db, hooks:install>

## 3. Boundary map <one row per module: responsibility, what to read first>

## 4. Known gaps between docs and code <the register; empty is a valid state>

## 5. Conventions that surprise <what a competent newcomer would get wrong>

## 6. Secrets and configuration <precedence, what beats what, invalidation delay>
```

### A.3 Baseline shape

```json
{
  "measuredAt": "YYYY-MM-DD",
  "note": "Written by `standards:baseline`. Raising a number here needs a reason in docs/STANDARDS_PROGRESS.md.",
  "coverage": { "lines": 0, "branches": 0, "measuredAt": "never" },
  "metrics": { "<metric>": 0 },
  "debt": { "<metric>": { "<path>": 0 } }
}
```

### A.4 The gate order

format → lint → typecheck → graph (dependency-cruiser) → dead code (knip) → unit → standards +
changelog range → [database suite + coverage if the data layer moved] → [build + browser suite

- axe if the UI moved]. Deferrals printed.

---

## B. An existing project - the transformation programme

Adapted twice already (React/Vite/Apollo → Next.js/Drizzle → this generic form). Two phases
of the original had no counterpart on the second stack and were closed as **not applicable**,
which is a legitimate phase outcome; "done" is not.

### B.1 Rules of engagement

1. **The standard is binding for new and modified code from day one.** An open phase is not
   a licence to add a violation to the file you are already editing.
2. **The ratchet is the enforcement until the rule is.** A phase is done only when its exit
   criteria are met AND its switch is flipped: the eslint rule set to error, the CI step made
   blocking, the metric promoted to HARD. Until then nothing stops it regressing.
3. **Every new guard is mutation-tested** before it is called a guard.
4. **Every phase logs measured numbers** - the number before, the number after, dated, in
   `STANDARDS_PROGRESS.md`. Never "improved".
5. **Raising a baseline number is allowed exactly once per case, in the same commit, with
   the reason written.** Silencing the step is not.
6. **Structural decisions get an ADR entry.** Numbering tidiness is never a reason to
   invent one.
7. **Do the work on a branch and merge deliberately.** A programme branch can end up
   hundreds of commits ahead of `main`; merging is its own step with its own risk, done
   hunk by hunk by intent (`resolving-merge-conflicts`), never by taking one side wholesale.
8. **The same change in more than ten files is a codemod** (CODE.11): the transform is the
   step, dry-run first, one commit that touches nothing else, the count in the message. A
   phase that rewrites by hand what a transform would have done is reviewed as such.

### B.2 The phases, and why in this order

Cheap and mechanical first, so the ratchet has something to hold. Correctness (validation,
caching, API shape) before size, because it rewrites the same files the size work will later
split - the other order splits a file and then rewrites the pieces. Size and complexity next,
the largest churn. Typecheck after the splits: a 2,300-line component is the hardest possible
thing to type. Coverage pinned early so the refactors cannot erode it, raised to target last
when the code has stopped moving. Docs and JSDoc are independent and run alongside.

| #   | Phase                                                                                                                                      | Size | Blocks on | Exit criterion (the switch)                                                                                                                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | The instrument: ratchet with per-file floors, gate + hook, CI step, control cases                                                          | S    | -         | `standards` blocking in CI; verified by lowering a baseline number and watching the step go red                                                                                                                                                |
| 1   | Lint to zero warnings                                                                                                                      | M    | 0         | `--max-warnings=0` in the lint script; the step blocking                                                                                                                                                                                       |
| 2   | Coverage pinned                                                                                                                            | S    | 0         | thresholds in the test config at the measured figure; CI fails on a drop                                                                                                                                                                       |
| 3   | Accessibility proxies to zero                                                                                                              | M    | -         | `jsx-a11y` at error with component mapping; icon-name, clickable-non-interactive and inline-style metrics HARD                                                                                                                                 |
| 4   | Zod: every boundary parses, one schema both sides, one env module, one local day                                                           | M    | -         | `valid.unparsedBoundary` HARD; `valid.rawEnv` at its documented floor; `valid.utcDay` HARD                                                                                                                                                     |
| 5   | Caching conformance (or the written decision not to cache tenant reads)                                                                    | M    | -         | every cache key carries every parameter; every write invalidates; metrics HARD - or "not applicable" with the reason                                                                                                                           |
| 6   | API conformance: bounded lists, one input object, payload returns, loaders per association                                                 | L    | 5         | metrics HARD; growth lists have a paginated twin, migrated, old field deprecated one release                                                                                                                                                   |
| 7   | Function shape to zero                                                                                                                     | L    | 5, 6      | the three rules unconditional in eslint at error; the exemption list (generated from the baseline's `debt`, never hand-maintained) empty                                                                                                       |
| 8   | File size to zero, per kind                                                                                                                | XL   | 7         | per-kind budgets enforced; `size.overBudget` HARD; `size.overRaw` at zero                                                                                                                                                                      |
| 9   | Typecheck to zero                                                                                                                          | L    | 8         | `tsc --noEmit` blocking in CI                                                                                                                                                                                                                  |
| 10  | Testing to target: real Postgres integration, branches first                                                                               | L    | 8         | floors at target; integration suite against a real database in a rolled-back transaction                                                                                                                                                       |
| 11  | Docs and JSDoc: front matter, index, citations, freshness by diff, JSDoc on the boundary surface                                           | M    | -         | `docs.*` metrics HARD; freshness step blocking; JSDoc rule at error on the named surfaces                                                                                                                                                      |
| 12  | The import graph and dead code: dependency-cruiser rules from the boundary map, known violations to zero; knip to zero                     | M    | 0         | `depcruise --ignore-known --output-type err` in the gate with an empty known-violations file; `knip --max-issues 0` in the gate; both proven red on a scratch violation                                                                        |
| 13  | Observability: a structured logger with redaction at the logger, no bare console from the server, a health endpoint, a SIGTERM that drains | M    | 0         | the redaction list covers the named fields and a test proves one is masked; `no-console` at error on the server's paths; the health endpoint answers and the SIGTERM handler fails it before draining, both proven by a test that watches them |
| -   | PWA to standard (independent)                                                                                                              | M    | -         | the never-stale-shell contract test green; asset references HARD                                                                                                                                                                               |
| -   | agent-readability score, printed then blocking on the weak axes                                                                            | S    | 4, 7      | printed on every gate run; blocking condition stated in axes and met                                                                                                                                                                           |

### B.3 Phase notes that saved the most time

- **Phase 0 - four of the probe's own checks were wrong on their first run**, each in a way
  that produced false positives (line-scoped attribute check, a handler-shape allowlist, a
  CRLF-blind regex, a placeholder guard with a bad boundary). Budget a day for the instrument
  to be wrong, and write the control cases before believing a number.
- **Phase 1 - `no-await-in-loop` in a server is often deliberate** (ordered DDL, batch loops
  written not to hammer a third party). Switch it off per directory with the reason above the
  block rather than "fixing" it into parallelism. `exhaustive-deps` is the dangerous one: a
  dependency that is a fresh object each render is an infinite loop and one repository
  allocated 4 GB before a single test ran.
- **Phase 3 - the plugin looks green when it is not** unless the component library is mapped
  into `settings['jsx-a11y']` AND `polymorphicPropName` is set. `<TableRow onClick>` stays
  invisible to it; the ratchet's own metric holds that gap.
- **Phase 4 - a shared schema carries message keys, not sentences**, or it reintroduces the
  hardcoded-French class of defect on both sides. Zod's `refine` never runs on an absent value:
  a missing param answered `Required` where every route had always answered `missing company`
  until `required_error` put it back.
- **Phase 6 - a `@deprecated` field still executes**, and the metric's regex skipped it for
  carrying the notice. Add the twin, migrate the callers, remove a release later.
- **Phase 7 - a component gets 150 lines, and complexity is what still guards it.** Chosen
  from the data: of 39 findings, a 150 allowance cleared 22 of 29 in components and left seven
  genuinely large ones; the ten in `.ts` were all procedure and kept 60. Verified in three
  directions (160 fails, 105 passes, 94 in a `.ts` fails).
- **Phase 7 and 8 interact:** splitting for shape adds signatures and pushed three files over
  their budget while every function passed. A ratchet that measured only shape would have
  recorded a clean win. The answer was to split the files too.
- **Phase 8 - `raw` binds more often than `code`**: 359 files over raw against 249 over code
  in one tree, because the JSDoc the standard requires counts. Every child of a split must be
  under budget on BOTH.
- **Phase 8 - shims are the point, not a shortcut.** A 3,055-line `utils/<vendor>Service.js` is
  a service, not a utility; it moved to `services/<vendor>/` and a 14-line re-export stayed at the
  old path because many modules import it.
- **Phase 9 - two plausible routes are traps** in a Sequelize codebase: class fields break
  every model at runtime, and a JSDoc `@typedef` + `@extends` was measured and made the count
  worse. Non-blocking on purpose until a route is found.
- **Phase 10 - measured flat at ~10 branches per file across four batches**, so "finish the
  zero-coverage bucket" lands at 82.7, not 85. Deciding whether presentational components
  count is a scope decision, not more tests; the standard already exempts them.
- **Phase 11 - touching `package.json`, the CI file or `CLAUDE.md` stales ten docs at once**,
  because they are the most-cited `source_truth` entries. That is the check working; budget
  for it. A green freshness run before the commit used to prove nothing because it read
  committed history only; an uncommitted `source_truth` edit now counts as today.
- **Parallel bursts:** several agents splitting on one checkout share one git index. The
  whole-tree ratchet is meaningless while any agent is mid-split; the integrator measures on a
  clean tree, each agent beats the committed ORIGINAL's function-shape count for its territory,
  and territories are disjoint directories. The written protocol is the
  `PARALLEL_REFACTOR_PROTOCOL.md` of the repository named in `ADOPTION_STATUS.md`; its finding
  that the agent count is not the binding constraint (the integrator is) transfers, and
  `isolation: worktree` on the subagent is the enforced form of a disjoint territory.

### B.4 What not to do, learned

- Bump `last_verified` without re-reading the doc against the code.
- Move a file into a laxer category instead of splitting it.
- Trade one long function for three that still breach.
- Add an inline `eslint-disable` to a limit held by a ratchet.
- Hand-maintain an exemption list; generate it from the baseline's `debt`.
- Read a green lint as a green function-shape count while the rules live only in the probe.
- Delete the config the probe loads because a plan written in advance said to. A plan is
  checked before it is executed.
- Rewrite a historical number in the log to today's figure.

---

## C. Where each repository stands

That reading is project-specific and dated, so it lives in [`ADOPTION_STATUS.md`](https://github.com/Synovitec/ops-hub/blob/main/engineering/ADOPTION_STATUS.md)
rather than here: one table per reading, the reference implementation of each mechanism, and
the shortest path for each repository. This plan stays general.

---

## D. Maintaining this plan

This document is `docs.behindCode` for the whole organisation: its `source_truth` names the
files in the three repositories it summarises. When one of them moves, re-read the row, then
bump the date. The rules of §B.1 apply to it. The per-repository numbers live in
`ADOPTION_STATUS.md`, where a new reading goes beside the old one, dated, never over it.
