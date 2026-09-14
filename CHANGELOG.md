# Changelog

Keep a Changelog, SemVer. Every commit that touches source, tests, scripts or docs adds a line
under Unreleased in the same commit.

## [Unreleased]

### Added

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
