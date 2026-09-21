# CLAUDE.md - abatty

abatty is an engineering standard as an installable instrument: the standard ships under
`docs/standard/`, and the package is what a repository installs (the harness, the gate, the
ratchet, the rules, the measurement). Built by Synovitec, open source under Apache-2.0.

This file is the agent's entry point and stays under 200 lines; what matters in one part of the
tree only lives in `.claude/rules/<topic>.md` with `paths:` front matter. The rules are the
standard (`docs/standard/ENGINEERING_STANDARD.md`); the whole rule catalog as data is
`docs/CATALOG.md`; the narrative is indexed in `docs/README.md`. Where this file and the standard
disagree, this file wins for this repository and §10 records why. Nothing here is enforcement:
what must happen at a fixed point is a hook in `.claude/settings.json`.

## 1. The non-negotiables

Violating one of these is an incident, not a bug.

1. **The package has no runtime dependency.** `dependencies` stays empty. A feature that needs
   one is a feature that waits, or a separate package.
2. **No trace of the tools.** This repository opted into the scrub: no file, commit message,
   pull request or issue names a tool, a vendor or a model. The guard refuses the commit day and
   night. `.claude/` and `CLAUDE.md` are the two names that cannot go, because the agent needs
   them to read its own settings.
3. **A guard nobody has watched fail is not a guard.** Every probe carries control cases in both
   directions, and every gate step proves it can go red (`abatty doctor --controls`). A check
   that reports nothing is indistinguishable from a check that is switched off.
4. **A preset is real only when a named repository has run it.** The preset names the repository
   and the date, or it says nobody yet. Never claim one that has not.
5. **The gate runs before a push, never bypassed.** Hook bypass is not a workflow.

## 2. Commands

```bash
npm run gate               # `abatty gate`: format, lint, typecheck, graph, dead code, unit, the
                           # ratchet + changelog range, secrets, audit, scrub. One implementation
npm run gate:fast          # the same without the heavy suites; this package has none
npm test                   # node --test over test/*.test.mjs (expanded by scripts/test.mjs, so Node 20 runs it too)   npm run typecheck   # tsc --noEmit
npm run standards          # the ratchet alone over the pushed range
npm run standards:baseline # today's numbers as the floor; zeros promoted to hard
npm run types              # the .d.ts emit; types/ is committed and equal to a fresh emit
npm run format             # prettier --write .                   npm run hooks:install
node bin/abatty.mjs <cmd>  # the CLI from the source tree: measure, doctor, rules, explain, ratchet
```

`abatty doctor` is green only on a machine set up for a night: it wants `ABATTY_AGENT` (or
`agent.command` in `~/.abatty/config.json`) and, with the scrub on, `attribution.commit` empty in
`~/.claude/settings.json`. `--skip-self-test` reads the drift alone, which is what CI wants.

## 3. Boundary map

| Module                                      | Responsibility                                                                        | Read first                    |
| ------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------- |
| `src/rules/`                                | the rule catalog as data, and the repository context every check reads                | `docs/CATALOG.md`             |
| `src/ratchet/`                              | the probes: a metric, a scan, control cases in both directions                        | `README.md`                   |
| `src/core/`                                 | init, update, gate, doctor, config, secrets, scrub, the gap analysis                  | -                             |
| `src/night/`                                | the unattended runner, the preflight, the sandbox and its probe                       | `README.md`                   |
| `src/presets/` `src/packs/` `src/profiles/` | what a stack looks like, what a language's tools are, what a standard ships as a unit | -                             |
| `src/cli/` `src/ui/`                        | argument parsing and the terminal; no rule logic                                      | -                             |
| `templates/`                                | what `init` writes into a repository; the hooks are the enforcement                   | `templates/harness/README.md` |

`src/rules/` and `src/ratchet/` never import from `src/cli/` or `src/ui/`: a rule must be
readable by the MCP server and the hosted dashboard, neither of which has a terminal.
`templates/` is data to this package and code to the repository that installs it, so nothing
under `src/` imports from it; it is read as a file.

## 4. Conventions that surprise

- **The vocabulary is stored reversed** (`src/core/vocabulary.mjs`) so the file passes the scan
  it defines. The hooks carry their own copy; the two are checked against each other.
- **`templates/harness/hooks/` is the source; `.claude/hooks/` is an install.** Edit the
  template, then `abatty update`. Editing the installed copy makes it drift and `doctor` says so.
- **The harness lock records what is installed here**, not what the package ships. A file `init`
  kept has no ancestor, so `update` writes the package's version beside it rather than over it.
- **A rule states the practice; the profile names the tool.** A check that hard-codes one tool is
  a bug: `node --test` is a unit runner exactly as vitest is.
- **The guard reads flags from argv, not from a heredoc body.** A rule or a README may write the
  bypass flags down; a quoted argument is still argv and is still refused.
- **`.abatty/` is ignored by git** and holds the reports, the installed harness copies and the
  control outcomes. Nothing in it is an input a rule may depend on except `controls.json`.

## 5. Secrets and configuration

The package reads no credential. `abatty.config.json` at the root is the one config, validated
against `schema/abatty.config.schema.json`; the hooks trust it and it is read-only to the night's
worker. The agent's executable is never in the repository: `ABATTY_AGENT` or
`~/.abatty/config.json` on the machine that runs the night. `abatty serve` takes its bearer token
from `--token` or `ABATTY_TOKEN` and refuses to start without one unless auth is explicitly off.

## 6. Size, shape and quality limits

File budgets per kind and the 800-line hard cap are in the ratchet (`abatty ratchet`), with
today's floor in `scripts/ci/standards-baseline.json`; a number may only fall, by its total and
per file. JSDoc on every export in `src/` that says WHY, since `types/` is generated from it.
Every module opens with a comment naming what it is for. A number that must go up is a decision
written in `docs/STANDARDS_PROGRESS.md` in the same commit.

## 7. Delivery rules - every change is recorded

- **Every commit that touches source, tests, scripts or docs adds a line under `## [Unreleased]`
  in `CHANGELOG.md`, in the same commit**, written for the reader, not the committer. The gate
  and the Stop hook check this over the pushed range; a push without it fails.
- **Coupled paths.** A change under `src/rules/families/` regenerates `docs/CATALOG.md`
  (`abatty rules --md`) in the same push. The pairs are in `abatty.config.json` under `coupled`.
- **Versioning.** SemVer in `package.json`; `abatty` in `abatty.config.json` is the version this
  repository follows and `update` moves it. On a bump, `[Unreleased]` becomes `## [x.y.z] - date`.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`),
  one behaviour per commit, the message says why. **No em-dash anywhere** (code, copy, commits;
  the separator is `·` or a hyphen). **No co-authorship trailer** and no trailer naming a tool,
  a vendor or a model: the scrub is on and the guard refuses the commit. The trailer's literal
  name is itself in the vocabulary, so write about it the way this line does.
- **Branches:** `<type>/<short-description>`; `adopt/standards-<date>` for unattended runs.
  `main` is pushed through a pull request. Never red on purpose.
- **Docs move with the code.** A doc whose `source_truth` or cited file changed is re-read
  against the code and its `last_verified` bumped in the same change, or left stale, never
  bumped blind.

## 8. Skills and agents

| Name                         | Use it when                                                                          | It must not                                                |
| ---------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| `/adopt-standards --phase N` | Running one phase of the adoption programme (unattended-safe)                        | Push to `main`, merge, raise a floor, install a dependency |
| `standards-reviewer` (agent) | Before every phase commit and any refactor claiming to preserve behaviour; read-only | Edit anything                                              |
| `standards-adopter` (agent)  | Daytime: one territory (directory, phase, metric) of the programme                   | Work outside its territory                                 |

An agent or skill not in this table is not to be invented mid-task. Agent memory lives in
`.claude/agent-memory/<agent>/`, one pattern per file.

## 9. Autonomy contract

**In an unattended run (`ADOPTION_RUN=1`) you never ask.** You take the default below, write one
bullet to `docs/ADOPTION_DECISIONS.md` (date, phase, situation, default taken, the alternative),
and continue. A phase blocked twice is marked `blocked` with the reason in
`docs/ADOPTION_STATE.json` and the next phase starts. In an interactive session you may ask only
when two readings of the request lead to materially different work.

| Situation                                                           | Default                                                                                                                                |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| A ratchet number must rise to land a step                           | Refuse the step; split differently; never raise a floor at night                                                                       |
| A probe or a gate step would be added without control cases         | Refuse it; a guard nobody has watched fail is not a guard                                                                              |
| A runtime dependency would make the change easy                     | Refuse it; write it, or leave the feature undone and say so                                                                            |
| A preset would be claimed as proven                                 | Only a named repository and a date prove one; otherwise nobody yet                                                                     |
| A rule reads one tool where it means a practice                     | Fix the rule, with a case for the tool it missed                                                                                       |
| The seam of a split is unclear                                      | Split by what a piece is FOR; if no seam is visible, leave the file and record `seam-unclear`                                          |
| The same change would touch more than ten files                     | A codemod under `scripts/codemods/`, dry-run first, one commit, the count in the message                                               |
| A refactor would change behaviour the tests do not cover            | Stop it, restore the original, record `behaviour-risk`                                                                                 |
| A doc is behind the code it cites                                   | Re-read and fix, then bump the date; if too large, leave it stale and record `doc-left-stale`                                          |
| A dependency would be added or upgraded                             | Not at night; record `dependency-deferred`                                                                                             |
| The harness (`.claude/`, the root config, a hook) needs a change    | Not at night: it is read-only and the Stop gate reads the config from the base branch. Record `harness-change`; the morning applies it |
| Something looks like a secret or PII                                | Do not read or move it; record `sensitive-path`                                                                                        |
| The gate is red for a reason outside the change (network, registry) | Use `gate:fast`, record `gate-deferred`; never bypass the hook                                                                         |
| Time or budget is nearly out mid-step                               | Finish or revert to the last commit; never leave a half-step                                                                           |

## 10. Known gaps between docs and code, and deviations from the standard

- `abatty doctor` cannot be green on a machine that is not set up for a night (§2). It is the
  night's pre-flight, not a repository health check, and CI runs it with `--skip-self-test`.
- The `node` preset is proven by this repository as of 2026-09-18; `astro`, `python` and `docs`
  are still proven by nobody.
- `abatty help` lists fewer commands than the README documents. The pull-request template claim
  is no longer a gap: `abatty ci --provider github` writes one (`src/cli/ci.mjs`).
- The `lint` step is skipped here: this repository has no `lint` script, because it has not
  adopted eslint (below). The gate reports a step whose script is absent as skipped, and the
  gap analysis names it, so it is visible rather than silently green.
- TEST-COVERAGE, TEST-MUTATION, CODE-DUP and CODE-JSDOC are missing here: each wants a
  dependency (coverage thresholds, StrykerJS, jscpd, eslint-plugin-jsdoc) and §1.1 says a
  dependency is a decision, not a default. They are open, not waived.
