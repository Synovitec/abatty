# abatty

**abatty** (abatty.io) is an engineering standard as an installable instrument, open source under
Apache-2.0. The standard itself - the rules, the enforcement map, the adoption plan, the lessons,
the research - ships with the package under [`docs/standard/`](docs/standard/README.md), versioned
with it; the package is the part you install in a repository: the harness, the gate, the ratchet,
the analysis tooling, the measurement, per stack, kept in step. Contributions under a DCO:
[`CONTRIBUTING.md`](CONTRIBUTING.md).

```sh
npm i -D github:Synovitec/abatty
npx abatty                       # the repository at a glance: score, families, harness, nights, next steps
npx abatty init --stack next     # the instrument, from the templates and the preset
npx abatty measure               # the gap analysis: score, every check, next steps by phase
npx abatty gate --fast           # the path-aware gate (the pre-push hook and the night run it too)
npx abatty ratchet --range auto  # the ratchet: every probe against the committed baseline, per total and per file
npx abatty baseline              # today's numbers as the floor; zeros promoted to HARD
npx abatty doctor                # the harness self-test and the drift against the package
npx abatty presets               # the stacks, and which repository proved each
npx abatty scrub                 # opt-in: no trace of the tools in files (--fix), commit messages (--commits), pull requests (--prs)
npx abatty dashboard --open      # one page over the reports of one or many repositories, light and dark
npx abatty rules                 # the rule catalog: what must hold, why, what insures it, when the plan installs it
npx abatty explain CODE-DEADCODE # one rule, its reason, and its finding in this repository
```

Every command prints for a terminal (colour, glyphs, bars, timings) and degrades to plain text
in a pipe or CI; `--json` on `measure` and `report` is the machine-readable form. Each
measurement writes a dated report under `.abatty/reports/` (ignored by git); the dashboard is
built from those and needs no server: `abatty dashboard repoA repoB --open`.

## The rule catalog

Every check abatty makes is a rule, as data: an ID, a family, the statement, the standard's
IDs it holds, **must** or **should**, what insures it once present (**hard**: a machine refuses
the work; **ratchet**: a number that may only fall; **review**: the reviewer's checklist;
**prose**: nothing yet), the adoption-plan phase that installs it, the reason in two sentences,
and the check itself, a pure function of the repository's context. `abatty measure` runs the
catalog; `abatty rules` lists it (`--family`, `--level`, `--phase`, `--json`, `--md`); `abatty explain
<ID>` opens one rule against the repository; [`docs/CATALOG.md`](docs/CATALOG.md) is the
whole of it, kept equal to the code by a test.

The number the catalog exists for is the **enforced share**: of the rules a repository has,
the part a machine holds (hard, ratchet) against the part a reviewer or a sentence holds
(review, prose). `abatty` and `abatty measure` print it beside the score, the report and the
dashboard carry it, and `abatty rules --enforcement prose` lists what a night moves up a level
next; the `adopt-standards` skill moves one rule up per night once the phase's checks are done.

A repository extends the catalog with its own rules in `abatty.rules.mjs` at its root, the same
shape:

```js
export const rules = [
  {
    id: "OWN-OWNERS",
    family: "Ownership",
    title: "An OWNERS file names the team",
    level: "must",
    enforcement: "prose",
    phase: "0",
    why: "A repository without an owner is a repository nobody answers for; the file is the name.",
    next: "Add OWNERS at the root",
    check: (c) => ({
      status: c.exists("OWNERS") ? "present" : "missing",
      evidence: c.exists("OWNERS") ? "OWNERS" : "none",
    }),
  },
];
```

The context `c` gives a rule the repository as git keeps it (`files`, `firstFile`, `read`,
`readJson`, `exists`, `git`), its package (`pkg`, `scripts`, `script`, `deps`, `has`), its
configs (`eslintText`, `tsconfigText`, `ciText`) and its sources (`sourceFiles`, `docFiles`,
`isTs`); nothing of the repository is executed. A rule is waived with a reason in
`.claude/adoption.json` → `rules.waived` (`"CODE-DUP": "not measured on a prototype"`, or
`{ "reason": ..., "until": "2026-12-31" }`): listed, not scored, and since that file is
read-only to the night's worker, a waiver is a human's decision.

## What `init` writes

| Where          | What                                                                                                                                                                                                                                                                                                                      | Kept if it exists                         |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `.claude/`     | `settings.json` (the hooks wired), `adoption.json` (the one config the hooks trust: commands, files, push policy, phases, `mcpServers`, `rules.waived`), `mcp.night.json` (the only MCP servers a night has), the seven hooks and their self-test, the `adopt-standards` skill, the two agents, the preset's `rules/*.md` | yes; `adoption.json` is merged key by key |
| root           | `.dependency-cruiser.cjs` (the import graph: cycles, orphans, one rule per arrow of the boundary map), `knip.jsonc` (dead code), `.githooks/pre-push`, `CLAUDE.md` (the template, placeholders to fill), `CHANGELOG.md`                                                                                                   | yes                                       |
| `package.json` | `gate`, `gate:fast`, `graph`, `dead`, `typecheck`, `lint`, `format:check`, `hooks:install`                                                                                                                                                                                                                                | an existing script is never replaced      |
| `docs/`        | `README.md` (the index), `STANDARDS_PROGRESS.md`, `ADOPTION_DECISIONS.md`                                                                                                                                                                                                                                                 | yes                                       |

Dependencies are named, never installed (`npm i -D dependency-cruiser knip ...` is printed): a
dependency change is a decision. Then by hand: fill `CLAUDE.md`, write the boundary-map rules
in `.dependency-cruiser.cjs`, on an existing repository `depcruise --baseline` once and knip at
today's count, `npm run hooks:install`, `abatty doctor`, `abatty measure`, `npm run gate`.

## The gate

One implementation, three callers: `npm run gate`, `.githooks/pre-push`, the night's Stop hook.
Always on, in this order - format (Prettier with `--end-of-line auto`), lint at zero warnings,
typecheck, the import graph, dead code, unit tests, the abatty ratchet with the changelog
check over the pushed range - then the preset's heavy suites only when the push or the working
tree touches their paths, deferred loudly to CI when Docker is absent. A step whose script the
repository does not have yet is reported as skipped, so a fresh repository can run the gate
before everything exists; the gap analysis names what is missing.

## Presets

A preset says what a stack's repository looks like (paths, scripts, gate steps and suites, the
rules files); the standard says what must hold. A preset is real when a repository has run it:

| Preset       | Proven by                                                                                                            |
| ------------ | -------------------------------------------------------------------------------------------------------------------- |
| `next`       | paycore_dms, 2026-09-14: instrument, harness, graph and dead code in the gate, first unattended night closed a phase |
| `vite-react` | Paycore-Task-Manager, 2026-09-13: instrument and harness; graph and dead code pending                                |
| `node`       | nobody yet - `init` says so                                                                                          |

## Provenance, and the scrub as an option

**Provenance is the default.** A tool that audits an agent's runs does not erase them: the
agent's trailer on the commits it made is the audit trail, and nothing in the harness refuses a
commit for naming it. A repository may ask for more: `provenance.trailer` in its config names a
disclosure line every unattended commit carries, and the guard refuses a night commit written
without it.

**The scrub is opt-in** (`scrub.enabled: true` in the adoption config or in
`abatty.config.json`), for white-label work where the client's history names no tool, no
vendor, no model, with the reason in the repository's decisions file. Once on, four layers hold
it:

- `abatty scrub` scans the tracked files, a commit range (`--commits`, `--range`) and the
  pull requests (`--prs`); `--fix` rewrites files by the word map; `--history` prints the
  `git filter-repo` command for an existing history and never runs it (a rewrite is a
  deliberate step from a fresh clone, followed by a force-push and the hosting provider's
  purge request, because old commits stay reachable by SHA until then).
- The guard (`.claude/hooks/guard.mjs`) refuses a `git commit`, `git tag -m`, `gh pr create`,
  `gh pr edit` or `gh issue create` whose text names one, day and night: a commit is the one
  thing a night cannot rewrite.
- A `commit-msg` hook for humans (`abatty scrub --message`, a no-op where the scrub is off),
  and the gate's scan of the files before a push where the repository wired it.
- The agent's executable is never in the repository: `ABATTY_AGENT` or `agent.command` in
  `~/.abatty/config.json`, on the machine that runs the night.

The words live in `src/core/vocabulary.mjs`, stored reversed so that the file passes the scan
it defines; the hooks carry a copy. Two names cannot go because the agent itself requires them
to read its settings and its context: the `.claude/` folder and `CLAUDE.md`. A line that
mentions only those is not a finding. A repository allows its own product terms through
`scrub.allow` (path substrings), with the reason in its decisions file. This package opted in
on its first day and keeps it (`abatty.config.json`).

## Roadmap

[`docs/ROADMAP.md`](docs/ROADMAP.md): what changes next, in the order the evidence dictates, each
item with the evidence that put it there.

## The ratchet

`abatty ratchet` measures every mechanical rule the linter cannot state and refuses a number
that goes the wrong way; `abatty baseline` writes today's numbers as the floor. A **probe** is
data with one function: `{ metric, kind, standard, title, why, scan(ctx), controls }`. Two
kinds: **hard** must be zero, now and forever; **ratchet** holds today's number and may only
fall, by its total **and per file** (the `debt` in the baseline), so debt cannot relocate: a
file may improve, never worsen, and a file not on the list carries none. A metric at zero is
promoted to hard by the baseline writer; a hard metric above zero is never recorded; a floor
that rose is refused without `--reason`, and the reason belongs in `docs/STANDARDS_PROGRESS.md`
too. A probe that scans zero files where the baseline saw some fails the run, so a moved path
never reports green forever. The changelog check over the pushed range (CHANGE-1) is one probe
among the others; the gate passes it the range.

The built-in probes: `size.overBudget`, `size.excessCode`, `size.overRaw` (CODE-1, the budgets
by kind of file and the 800 cap), `context.overCap` (AIR-1), `types.escapes` (CODE-3),
`valid.rawEnv` (VALID-3), `code.barrels` (CODE-5), `docs.frontMatter`, `docs.indexDrift`,
`docs.citations`, `docs.behindCode`, `docs.danglingSource` (DOC-2..5), `change.changelogMissing`
(CHANGE-1). A readability score over the same numbers is printed as a trend, never a gate.

Every probe carries its **control cases in both directions**, and `abatty ratchet --controls`
runs them on throwaway repositories; the package's own test runs them on every push, so a probe
with no failing control case cannot be added. A repository adds its own probes in
`abatty.probes.mjs` at its root, the same shape, controls required, a built-in name refused;
it configures the ratchet under `ratchet` in its adoption config or in `abatty.config.json` at
its root (`kinds` and their budgets, `exempt` paths, `cap`, `contextMax`, `barrelMax`,
`envModule`, `include`/`exclude` of metrics, `hard`/`ratchet` overrides, `mustScan`) and names
the baseline through `files.baseline` (default `scripts/ci/standards-baseline.json`).

## What is not here yet

The night runner in Node (one implementation for Windows and POSIX), the `update` command (a
three-way merge that keeps a repository's own edits), `night-report` (the learning
distillation), and the dashboard over every repository's report. The function-shape probe
(CODE-2) is not here: ESLint holds it (`CODE-SHAPE`).

## Development

```sh
npm test                 # node:test, temp repositories, the real self-test
npm run typecheck        # checkJs strict, zero findings, no file under ts-nocheck
npm run gate             # format, typecheck, tests, the ratchet, no trace of the tools
npm run standards        # this package against its own baseline (scripts/ci/standards-baseline.json)
node bin/abatty.mjs rules --md > docs/CATALOG.md   # after a rule changed; the test is red until it is run
```

The templates and the rules are owned here (`templates/`, `src/rules/`); a change to a rule
appends its ID to the list in `test/rules.test.mjs`, which is red for a rename or a loss.
