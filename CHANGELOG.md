# Changelog

Keep a Changelog, SemVer. Every commit that touches source, tests, scripts or docs adds a line
under Unreleased in the same commit.

## [Unreleased]

### Added

- The root config (roadmap #4): `abatty.config.json` at the repository root is the one config,
  with a JSON Schema the package ships (`schema/abatty.config.schema.json`) and a `$schema` line;
  `abatty config` lists the files, the resolved values and the problems against the schema
  (`--json`, `--migrate` to move the older `.claude/adoption.json` to the root, `--dry-run`);
  `doctor` refuses a config the schema refuses. `init` writes the root file; every reader of the
  package (the rules' context, the ratchet, the scrub, the report, the runner) and every hook
  (`configPath()`), the self-test and the stub read the root file first, the older place still
  read and the root winning key by key. The guard, the file guard, the direction check and the
  runner treat the root config as part of the harness: read-only at night, identical to the base
  or no night.
- `abatty update` (roadmap #3): the harness to the package's version, the repository's edits
  kept - a three-way merge per file against the installed copy (`init` and `update` write
  `.claude/harness.lock.json` with the version and the formatting-blind hash of every shipped
  file, and keep the installed copies under `.abatty/harness/<version>/`); untouched files take
  the new version, files edited while the package did not change them are kept, files both
  changed are merged with `git merge-file`, a conflict leaves `<file>.abatty-new` beside yours;
  `adoption.json` gains the template's new keys and keeps every value set here; the absent
  scripts are added; `--dry-run`, `--force`. `doctor` names the installed version when it is
  not the package's.

### Changed

- The night runner is one implementation in Node, `abatty night` (roadmap #2), replacing
  `night-run.ps1` and `night-run.sh`: the same pre-flight (self-test, harness identical to the
  base, gate green, canary), the same loop (sessions per phase, a crash retried once, fifteen
  denials an abort, the harness checked before every session, the wrap-up, the push only when
  nothing was loosened), the same files under `.claude/night/`, the same exit codes; JSON in
  and out (no BOM, no locale), the agent called directly (no shell rewriting the prompt).
  `test/night.test.mjs` runs the whole runner with the stub: the happy path, canary only, six
  abort paths, three refusals.
- The harness self-test spelled its no-op gate `node -e process.exit(0)`, which a POSIX shell
  rejects (a subshell in the argument); quoted now, so the self-test and `doctor` are green on
  Linux and macOS. The stub agent answers `--version` with the version the harness requires,
  and the tests hand it to the self-test as the agent on PATH.
- Provenance is the default; the scrub is opt-in (roadmap #30). `scrub.enabled` (off unless
  set) in the adoption config or `abatty.config.json`: the guard refuses a commit, a tag, a
  pull request or an issue that names a tool only where the repository opted in; `abatty scrub
  --message` is a no-op otherwise; the report, the status screen and the dashboard show the
  no-trace figure only where it is on; `FLOW-TRAILER` is n/a otherwise. The opposite option,
  `provenance.trailer`: a disclosure line every unattended commit carries, the guard refusing a
  night commit written without it; the skill writes it. The self-test proves both (default,
  scrub on, provenance on). This package keeps the scrub on for itself.

### Added

- The enforced share (roadmap #29): of the rules a repository has, the part held by a machine
  (hard, ratchet) against the part held by a reviewer or a sentence (review, prose), on the
  status and measure screens, in the report and its JSON, in the dated gap analysis and on the
  dashboard, with the rules to move up next; `abatty rules --enforcement <hard|ratchet|review|prose>`;
  the `adopt-standards` skill records the share and, budget remaining, moves one rule up a
  level per night the way the enforcement map says.
- The license and the standard in the open (roadmap #28): Apache-2.0 (`LICENSE`,
  `package.json`), contributions under a DCO (`CONTRIBUTING.md`); the standard, the adoption
  plan, the enforcement map, the autonomous-adoption protocol, the lessons, the best practices,
  the guides and the research moved into `docs/standard/`, versioned with the package
  (2026.09.15) and shipped in it; the templates and the context-file template point at the
  packaged copy (`node_modules/abatty/docs/standard/...`), never at a sibling checkout.
- `ratchet.citationsExempt`: documents that describe another repository (a standard, a guide)
  are exempt from `docs.citations`; `scrub.allow` is read from `abatty.config.json` too.
- `docs/ROADMAP.md`: items 28 to 30 - the license and the standard in the open, the enforced
  share as the main number, provenance as the default with the scrub as an option - each with
  its evidence and its tier.
- The ratchet in the package (`src/ratchet/`): `abatty ratchet [--range auto] [--json]
  [--controls]` and `abatty baseline [--reason] [--dry-run]`. Probes as data with one function
  (`{ metric, kind, standard, title, why, scan, controls }`), thirteen built in (size by kind
  and the 800 cap, the context file's cap, type escapes, raw env reads, barrels, front matter,
  the index, citations, freshness, dangling source_truth, the changelog over the pushed range),
  each with control cases both ways that the package's test runs. HARD is zero forever, RATCHET
  may only fall per total and per file; zero promotes to HARD, a rise is refused without a
  reason, scanned-zero fails where the baseline saw files. A repository's own probes in
  `abatty.probes.mjs` (validated, controls required); the config under `ratchet` in the
  adoption config or in `abatty.config.json` at the root; a readability score as a trend.
- The presets write `standards: abatty ratchet` and `standards:baseline`; the gate's ratchet
  step now runs. This package holds its own baseline (`scripts/ci/standards-baseline.json`)
  and runs the ratchet in its gate.
- `docs/ROADMAP.md`: the "any project" section - the four facts in the code that stop a
  stranger's repository from a meaningful score, and items 18 to 27 (a root config with nothing
  outside the repository, profiles, an `applies` predicate, a stage, presets per workspace,
  coupled paths, gate steps that prove they can go red, language packs, CI from the gate,
  distribution), each with its evidence and its tier.
- The rule catalog (`src/rules/`): every check as data - ID, family, statement, the standard's
  IDs, must or should, what insures it (hard, ratchet, review, prose), the phase, the reason,
  the check as a pure function of a typed repository context. `abatty measure` runs it; the
  scores of the reference repositories are unchanged (80/100, 29/100).
- `abatty rules [--family] [--level] [--phase] [--json|--md]` and `abatty explain <ID> [dir]`; the
  dated report and the dashboard carry the level and the insurance of every check;
  `docs/CATALOG.md` is the catalog as a document, kept equal by a test.
- A repository's own rules from `abatty.rules.mjs` (validated; a built-in ID is refused) and
  waivers with a reason in `adoption.json` → `rules.waived` (listed, not scored, `until` dated).
- The `adopt-standards` skill reads the catalog: `abatty rules` for the phase's checks, must
  before should, `abatty explain <ID>` before touching a check it does not understand; the
  wrap-up measures with `abatty measure` and never adds a waiver itself.

- Fixture repositories for the `vite-react` and `node` presets in the tests: detection from
  the dependencies, `init`, `measure`, `doctor` in step, the gate skeleton stopping at the
  first missing tool by name. A preset is still proven only by a repository that ran it.

### Fixed

- The next steps of `status` and of the dashboard sorted phase 0 last (a zero read as "no
  phase"); they now sort by the phase's number, must before should within a phase, and the
  status screen names the waived rules and the catalog problems.

### Removed

- The generated gap analysis and its port script: the checks live here, typed; the one
  `@ts-nocheck` is gone.

- The terminal: a zero-dependency styling layer (colour, glyphs, bars, tables, timings) that
  degrades to plain text in a pipe or CI; `abatty` alone is the repository at a glance (score,
  families, harness, no-trace, nights, next steps); every command prints a scorecard.
- The report: one dated JSON per measurement under `.abatty/reports/` (`abatty report`,
  written by `measure` and `status` too), the shape the status screen and the dashboard read.
- The dashboard: `abatty dashboard [repo ...] --open`, one self-contained page over the reports
  of one or many repositories - a score dial with the 70/90 ticks, families as stacked bars,
  the next steps in plan order, the nights, every check with filters; light and dark; the
  trend once there are two readings.
- `docs/ROADMAP.md`: what changes next and why.

- `abatty scrub`: no trace of the tools in a repository. Scans files, commit messages and pull
  requests; `--fix` rewrites files by a word map that protects the two names the agent requires;
  `--message` is the commit-msg hook; `--history` prints the filter-repo command for an existing
  history. The words are stored reversed in `vocabulary.mjs`; the hooks carry a copy and the
  guard refuses a commit, a tag, a pull request or an issue that names one, day and night. The
  agent's executable is read from `ABATTY_AGENT` or `~/.abatty/config.json`, never from the
  repository. This repository is scanned by its own gate and its own hooks.

### Changed

- The template folder is `templates/harness` and is owned here (no sync from ops-hub any more);
  the context-file template is `agent-context.md.template`; the stub is `stub-agent.*`.
- Every mention of the tools in the package's files was rewritten by the map or by hand (the
  runner's identifiers, the fixtures' server names, the docs' audience values).

- The package, the command and the repository are named **abatty** (`npm i -D github:Synovitec/abatty`, `npx abatty ...`); `@synovitec/standards` and the `standards` command were the working names of the first day.

## [0.1.0] - 2026-09-14

### Added

- The `abatty` command: `init --stack <next|vite-react|node>` (the harness, the tooling, the
  hook, the scripts and the day-0 documents from the templates and the preset; existing files
  kept, `--force` to overwrite, `--dry-run`), `measure` (the gap analysis as a library: score,
  every check, next steps by phase, the dated report with the standard's front matter), `gate`
  (the path-aware gate ported from paycore_dms's, driven by the preset: format with
  `--end-of-line auto`, lint, typecheck, import graph, dead code, unit tests, ratchet with the
  changelog range, then the suites by path, deferred without Docker), `doctor` (the repository's
  harness self-test and the formatting-blind drift against the shipped templates), `presets`.
- Three presets: `next` (proven by paycore_dms), `vite-react` (Paycore-Task-Manager), `node`
  (not yet proven, said so).
- The templates synced from `ops-hub/engineering/templates` with a test that fails when they
  differ; the gap analysis generated from `ops-hub/engineering/tools/gap-analysis.mjs`.
- Proven on paycore_dms: `measure` reads 80/100 over 63 checks like the ops-hub tool, `gate
  --fast` runs its seven steps green (761 tests), `doctor` reads its Prettier-formatted harness
  as in step.
