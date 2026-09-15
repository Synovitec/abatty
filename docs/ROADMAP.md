---
title: "Roadmap"
description: "What abatty changes next and why, in the order the evidence of its first days dictates: the ratchet in the package, one runner, update, a root config, fixture repositories, then agent adapters, open-format skills, an MCP surface, the report and the learning distillation, the dashboard hosted, CI templates; later the hardening and the reach. Each item carries the evidence that put it there."
category: governance
status: living
audience: ["developer", "architect"]
tags: ["roadmap", "plan"]
related: ["./README.md", "../README.md", "./STANDARDS_PROGRESS.md"]
---

# Roadmap

Grounded in what the first days showed, not in what a framework usually has. Done items move
to the changelog; the order here is the order of the evidence.

## Now - the gaps that hurt every day

| #   | Change | Evidence | Size |
| --- | ------ | -------- | ---- |

## Any project - what stops a stranger's repository from a meaningful score

Read on 2026-09-15 against the code as it is. Four facts decide it: the config lives under the
agent's folder and points at the standard and the plan through relative paths into a sibling
`ops-hub` checkout; the repository root is the nearest folder with a `.git` or a
`package.json`, and the context reads scripts and dependencies from that one file; a rule has a
check but no "does this apply" predicate, so a repository without ESLint is scored as missing
ESLint, never as not needing it; a preset is one per repository, detected from npm
dependencies, and there are three. What is already there to build on: a repository's own rules
in `abatty.rules.mjs`, dated waivers with a reason, an `n/a` status the catalog barely uses, a
preset that is real only when a named repository proved it, and a `doctor` that sees drift.

The four blockers come first; without them the rest is polish on a tool for three
repositories. Item 17 above is part of this list and is not repeated; 1 to 11 are done.

| #   | Change                                                                                                                                                                                                                                                                                                                        | Evidence                                                                                                                                                    | Tier      | Size   |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ------ |
| 22  | **Presets per workspace, composed**: `apps/web`, `apps/mobile` and `packages/db` are three presets, each detected and gated in its own folder, the repository-level rules once; `sql`, `docs`, `python`, `expo`, `tauri` next, each real only when a named repository ran it                                                  | One preset per repository, detected from the root `package.json`; the lint-script check is the only rule that looks under `apps/`, `packages/`, `services/` | structure | 2 days |
| 23  | **Coupled paths as one mechanism**: "when this changes, that changes in the same push", declared as pairs of globs and checked over the pushed range by the gate and the stop hook; covers schema and migration mapping, API and client, a doc and the code it describes                                                      | The changelog-range check and `DOC-FRESHNESS` are two hand-written cases of it                                                                              | structure | 1 day  |
| 24  | **Every gate step proves it can go red**: `INST-CONTROLS` extended from the ratchet's probes to each gate step, language-neutral; `doctor` runs the failing control and reports a step that stays green as absent                                                                                                             | The lessons catalogue: prove a check in both directions on a tree where the answer is known; today only the probes have controls                            | structure | 1 day  |
| 25  | **Language packs beyond JavaScript**: the extensions, the formatter, the linter, the typecheck and the dead-code tool come from a pack; the rules keep the same words                                                                                                                                                         | Source files are found by extension, `isTs` is a count of two extensions, `lintExtensions` is a fixed list                                                  | structure | 2 days |
| 27  | **Distribution**: a license, a registry publish (item 17), a version pinned per repository and recorded in the config, a README a stranger can act on in two minutes; `scrub` moves to an opt-in package with its purpose stated; then one repository outside the company, and its reading published beside the internal ones | `UNLICENSED`, a git-URL install, a README that assumes `ops-hub` was read; proven on two repositories of one company since 2026-09-14                       | reach     | 2 days |

## Next - the shape of a framework

| #   | Change | Evidence | Size |
| --- | ------ | -------- | ---- |

## Later - hardening and reach

| #   | Change | Evidence | Size |
| --- | ------ | -------- | ---- |

## Done

- 2026-09-15 · a stage for the repository (#21): design, build, run; rules and phases belong to
  stages; a repository under design is read for what it is.

- 2026-09-15 · rules say where they apply (#20): `applies` and `when` on the rules; n/a with
  the reason instead of missing; the profile names the tools.

- 2026-09-15 · profiles (#19): the standard as a package; the built-in `synovitec` profile; a
  repository names its own, a file or a package, alone or on top.

- 2026-09-15 · publishable to the registry (#17): the manifest, the release workflow on a tag,
  the tarball proven by an install into a clean project. The first publish is a human's tag.

- 2026-09-15 · the allowance and the resumable night (#16): sessions or tokens as the cap under a
  subscription; the spend in `run.json` after every session; `--resume`.

- 2026-09-15 · sandboxed nights (#15): an OS boundary under the guard (bubblewrap, sandbox-exec,
  a container), built by the runner and proven by a probe before the first session.

- 2026-09-15 · rule-ID namespacing (#14): `FAMILY.N` with a dot across the standard, the
  rules, the templates and the catalog; the hyphen form retired and kept out by a test.

- 2026-09-15 · the secret scan and the audit in the gate (#13): one scanner for the hook, the
  gate and CI; the audit deferred loudly offline.

- 2026-09-15 · type declarations from the JSDoc (#12): `types/`, committed and kept equal by
  a test; a `types` condition on every export.

- 2026-09-15 · CI from the gate (#11, #26): the pipeline generated from the preset's gate for
  two providers, the PR template, the ruleset printed for import; the CI rules read the
  generated files.

- 2026-09-15 · the dashboard hosted (#10): `abatty serve` and `abatty publish`, the reports of
  every repository in one place, the score as a badge, no dependency added.

- 2026-09-15 · `night-report` (#9): the distillation of a night's evidence into proposed
  lessons with their evidence and their check; the Stop gate logs every block so the morning
  sees what was cured.

- 2026-09-15 · the MCP server (#8): six typed tools over stdio, scoped to one repository,
  declared for a night like any server; the skill calls them when declared.

- 2026-09-15 · the skill in the open format (#7): the skill's front matter and body are the
  format's and agent-neutral, placed by each adapter; the rules layout the adapter maps came
  with #6.

- 2026-09-15 · agent adapters (#6): the harness talks to an agent through an adapter; three
  adapters, `abatty agents`, the context and the rules written per adapter, the runner's flags
  from the adapter, and a night refused where the adapter has no hooks, with the lost
  guarantees named. The honest limit stands: the enforcement is the hooks, and an agent
  without a hook protocol gets the context, the rules, the gate and CI, never a night.

- 2026-09-15 · fixture repositories per preset (#5): `astro` added with its fixture; `express`
  is the `node` preset's own fixture (it detects Express, Fastify, Hono and Koa), so no preset
  of its own. Every preset now has a fixture; `next` and `vite-react` also have a repository.

- 2026-09-15 · the root config (#4, and #18 with it): `abatty.config.json` with its schema,
  `abatty config`, the hooks and the package reading it first, read-only at night; nothing of
  the config points outside the repository any more.

- 2026-09-15 · `abatty update` (#3): the three-way merge of the harness against the installed
  copy, the lock in the repository, the installed copies kept on the machine, conflicts left
  beside the file; `doctor` names the installed version.

- 2026-09-15 · one runner in Node (#2): `abatty night`, the two shell runners removed, the stub
  night as the package's test on every push; on the way, the self-test's no-op gate that a POSIX
  shell rejected, fixed.

- 2026-09-15 · provenance as the default, the scrub as an option (#30): `scrub.enabled` off
  unless a repository opts in, `provenance.trailer` as the disclosure option the guard holds at
  night, the rule, the screens and the self-test following; this package keeps its own scrub on.

- 2026-09-15 · the enforced share (#29): the part of a repository's present rules a machine
  holds, on every screen and in every report, the rules to move up next named, and the night's
  objective of one rule up a level per night in the skill. This package reads 83% of 23 on the
  day.

- 2026-09-15 · the license and the standard in the open (#28): Apache-2.0 with a DCO; the
  standard and its documents under `docs/standard/`, versioned with the package and shipped in
  it; the templates point at the packaged copy; the company's operations repository keeps
  only its own dated readings.

- 2026-09-15 · the ratchet in the package (#1): `abatty ratchet` and `abatty baseline`, probes
  as modules with controls both ways, per-file floors, the scanned-zero guard, zero promoted to
  HARD, a rise refused without a reason, the changelog range as a probe, a repository's own
  probes, the root config for the ratchet, the readability score. Proven on this package
  (its own baseline, the ratchet in its gate).

- 2026-09-14 · the rule catalog: every check as data (level, insurance, phase, reason, the
  check as a pure function of a typed context); `abatty rules`, `abatty explain`; a
  repository's own rules file and dated waivers; `docs/CATALOG.md` kept equal by a test; the
  generated module and its `@ts-nocheck` gone. The ratchet (#1) builds on it.

- 2026-09-14 · v0.1.0: `init`, `measure`, `gate`, `doctor`, three presets; proven on the
  reference repository.
- 2026-09-14 · no trace of the tools: `scrub`, the vocabulary, the guard rule, the agent's
  executable out of the repository; the history rewritten to a single clean commit.
- 2026-09-14 · the terminal: colour, glyphs, bars, tables, timings; `abatty` alone is the
  repository at a glance. The report (`.abatty/reports/`) and the dashboard (`abatty dashboard
--open`), light and dark, over one or many repositories.
