# Changelog

Keep a Changelog, SemVer. Every commit that touches source, tests, scripts or docs adds a line
under Unreleased in the same commit.

## [Unreleased]

### Added

- **`docs/POSITION.md`**: where the package stands against the adoption evidence rather than
  against taste. A scorecard graded on the repository at `583f9ce`, the wedge the survey found
  unoccupied, a ninety-day order and what would kill it. Checked before landing: the package
  size (454.6 kB packed, 1.4 MB unpacked, 214 files), the README (4,973 words, 33.8 kB) and
  `publishConfig.provenance` are exact. Three figures were not and are corrected in place: the
  suite is 143 tests and not 136, the first dogfood found nine defects and not six, and the
  latency row claimed a 6.7 s gate where the gate this repository runs before a push takes
  196 s.

### Fixed

- **The scrub's vocabulary check reads the command per line again.** The guard collapses every
  newline into a space before splitting the result on newlines, so the split returned the whole
  command as one line and `onlyRequiredPaths`, which exists to excuse a line whose only mention
  is the agent's own folder, could never excuse anything. A multi-line commit message was judged
  as a single line and refused for the prose around its one allowed mention. It now splits the
  raw command, with control cases for a multi-line message that is clean and one that names a
  tool on a later line. The single-line case was the only one ever tested.
- **A finding the check turned up: this repository does not run its own gate.** `npm run gate`
  is a hand-written chain, while `abatty gate --fast`, the command the package ships and the
  README calls "one implementation, three callers", goes red here in 3.9 s at the lint step,
  because `init` wrote a `lint` script for eslint and this repository has consciously not
  adopted it. Recorded in `CLAUDE.md` §10 and `docs/POSITION.md` §2.1 as the open decision it
  is: the cure changes what the gate checks, so it is not a correction to make silently.

### Fixed

- **The rule catalog carries each rule's next step.** Without it a rule could change the advice
  it gives and the generated catalog stay byte-identical, so the coupled pair between
  `src/rules/families/` and `docs/CATALOG.md` was refusing a push it could never be cured of.
- **The push guard reads the branch a push targets, not a word in the command.** `-` and `/`
  are word boundaries, so `\bmain\b` matched inside `fix/merge-to-main-1` and `main-nav-rework`
  and the guard refused them as pushes to the base branch. It now takes the last non-flag
  argument and the destination side of a refspec (`HEAD:main`, `:main`), with control cases in
  both directions.
- **git can run the hooks it is given.** `init` wrote `.githooks/pre-commit`, `pre-push` and
  (now) `commit-msg` without the executable bit, and git skips a hook it cannot execute with
  nothing but a hint. The pre-push hook is the gate: on this repository it never ran, which is
  how `origin/main` came to be red on `docs.behindCode` while every push looked clean. `init`
  now sets the bit on disk and in the index, repairs it on a hook it keeps, and the self-test
  refuses a wired hook whose index mode is not 100755.
- **The hooks read the repository's config again.** `init` writes `abatty.config.json` at the
  root and also wired `ADOPTION_CONFIG` at the older place, which `init` does not write, so
  every hook fell back to the template's defaults: the scrub off where the repository had opted
  in, no coupled pairs for the Stop gate, the repository's protected paths replaced by the
  template's, and nothing said so. The pin is gone, `configPath()` decides as it always
  documented, and the self-test now refuses a settings file that pins a path that is not there
  and checks that the hooks read the config it reads.
- **The harness lock records what is installed, not what the package ships.** A file `init`
  kept (the repository already had its own) was recorded at the package's hash, so `update`
  read it as "your edit; the package did not change this file" and never delivered a change to
  it again. A kept file now carries no ancestor, `update` writes the package's version beside
  it, and a file that really was installed keeps its ancestor across a re-run of `init`.
- **The config merges at every depth.** A repository that had set one key of a block lost the
  rest of it, and the harness self-test then failed on the state file it could no longer find.
- **A repository that opted into the scrub passes its own self-test.** The case for the default
  read the repository's config instead of a default one, so opting in failed the harness on the
  night it was installed for.
- **The guard reads flags from argv, not from a heredoc body.** Writing a rule, a README or a
  fixture that names the bypass flags is not an attempt to use them; a quoted argument is still
  argv and is still refused. Both directions are control cases in the self-test.
- **A unit runner is a practice, not a product.** `node --test` ships with Node and needs no
  dependency and no config file; TEST-UNIT read only vitest and jest, so a repository with its
  tests in the tree and green scored missing on having them.
- The test suite is hermetic: it no longer inherits `ADOPTION_CONFIG` from the harness a
  developer installed in this repository, which pointed the fixtures' hooks at a file that was
  not there.

### Changed

- **The five standard documents are re-read against the code and dated again.** They carried
  `last_verified: 2026-09-14` while citing sources that moved on 2026-09-15, so `docs.behindCode`
  was red on `origin/main` and the gate could not pass on a push. The read found and corrected:
  five references to the older config path where the root config is what the hooks now resolve;
  a `verify-change` skill the plan listed as installed and `init` has never shipped; and the
  preset rule files being described as "take the ones that apply" where `init` writes every one
  the preset lists whatever the repository depends on, so a project with no ORM receives the ORM
  rules. `AUTONOMOUS_ADOPTION.md` documented the `ADOPTION_CONFIG` pin as a feature; that entry
  now records it as the defect it was. `ENFORCEMENT_MAP.md` records that FLOW.2 claimed Hard
  while the pre-push hook was not executable and nothing ran, and the standard gains the
  invariant that reading found missing: a hook that is wired is not thereby running, which is
  P.1 applied one level up.

### Added

- **The evidence base for the instrument** (`docs/standard/research/07-evidence-base.md`): what
  the published research, the industrial reports and the competing repositories say about the
  parts this package is made of, each finding graded and mapped to the rule, probe or command it
  bears on, with twenty consequent changes. It is the first research file about the instrument
  rather than about a technology cluster, and it records what is genuinely unclaimed: a measured
  false-positive rate for a tool's own rules, a catalog validated against the defect history of
  the repository it runs in, a harness that proves its gate can go red, and a human-owned,
  schema-versioned baseline.
- **abatty runs its own instrument** (roadmap #27): the harness, the gate, the hooks, the
  import graph and the dead-code check are installed here, `doctor` is green on a machine set
  up for a night, and `CLAUDE.md` is this repository's own rather than the template's. The
  `node` preset is proven by a named repository for the first time, and the six bugs above are
  what that first run found. The boundary map is enforced (the rules and the probes never reach
  the terminal, nothing imports the templates), the five pre-existing import cycles are the
  graph's committed debt, and `templates/harness/` is coupled to `.claude/` so the harness this
  repository runs cannot drift from the one the package ships.
- Distribution (roadmap #27): the version this repository follows is pinned in the config
  (`abatty`, written by `init`, moved by `update`, read by `doctor`); the README opens with
  the two-minute path a stranger can act on. The registry publish, the license and the
  standard in the open were done before; a repository outside the company is what is left.
- Language packs beyond JavaScript (roadmap #25): a pack names a language's extensions,
  test shape, manifest and tools; the context detects the packs of a tree and reads the
  sources of every pack; the linter, formatter, typecheck, dead-code and test rules judge
  per pack with the same words, the JavaScript-only rules are n/a elsewhere, the step
  controls plant in the pack's language and skip a tool that is not installed; the Python
  pack and an unproven `python` preset (ruff, mypy, pytest, vulture as commands), detected
  from the tree.
- Every gate step proves it can go red (roadmap #24): `abatty doctor --controls` plants a
  language-neutral violation per always-on step (an unformatted file, a debugger statement,
  a type error, a failing test, an unused export, an oversized file, a planted key), runs the
  step, removes the file, and reports a step that stays green as absent; the outcome is
  written to `.abatty/controls.json`, and INST-CONTROLS reads it beside the probes' controls.
- Coupled paths as one mechanism (roadmap #23): pairs of paths (`coupled` in the config: a
  prefix or a glob, a `why`) judged per commit over the pushed range, an offender cured only
  by a later commit touching the counterpart; the ratchet's `change.coupledMissing` probe
  (hard, with controls) for the gate and CI, the Stop hook's check at night, and the
  changelog rule re-expressed on the same mechanism.
- Presets per workspace, composed (roadmap #22): the workspaces of a monorepo read from the
  root's `workspaces` field, a pnpm workspace file or the conventional folders, each detected
  from its own dependencies or named in the config (`workspaces`), gated in its own folder by
  its own preset's steps after the root's, the built-in steps and the ratchet once at the
  root; `init` writes each workspace's preset scripts in its own package; the status screen
  and the report list them. The `docs` preset for a repository at the design stage or
  documents alone, chosen when there is no package and no sources. The status screen moved
  to its own CLI module.
- A stage for the repository (roadmap #21): design, build or run, named in the config
  (`stage`, `init --stage`) or read from the tree (documents alone are design, a deploy
  surface is run); a rule belongs to stages (`stages`) and is n/a at another with the stage
  named; the profile's phases carry their stages (day 0 alone at design, `phasesFor`); the
  report, the gap analysis, the status screen and `explain` carry the stage.
- Rules say where they apply (roadmap #20): `applies`, a predicate over the repository's
  facts (`c.stack`: package, sources, browser application, server, database, catalogues,
  service worker), and `when`, the sentence the catalog prints; where a rule does not apply
  its finding is n/a with the reason, never missing. Thirty-five rules carry one; a
  documents-only repository is read on the documents, the instrument, the harness and
  delivery alone. The rule statements name the practice, the profile names the tools
  (`tools`): the linter, the formatter, the database, the browser suite, CI.
- Profiles (roadmap #19): a standard as a package of rules, phases, presets and harness rule
  files. The 65 rules, the thirteen phases and the four presets become the built-in
  `synovitec` profile; a repository names the profiles it follows (`profiles` in the config: a
  built-in id, a file or an installed package exporting `profile`), its own rules file on
  top; `abatty profiles` lists them; the report and the catalog name them. `validate` moved
  to its own module; `./profiles` is a package export.
- Publishable to the registry (roadmap #17): the package's `repository`, `bugs`, `keywords`
  and `publishConfig` (public, with provenance), `prepublishOnly` running the gate, the
  package's own checks workflow and a release workflow publishing a `vX.Y.Z` tag after the
  gate; a test packs the tarball, installs it in a clean project and runs `init` from it,
  and asserts the tarball carries what the CLI needs and nothing of the repository's own.
  The name `abatty` is free on the registry; the first publish is a human's tag.
- The allowance and the resumable night (roadmap #16): a night's cap in the unit the account
  is billed in, dollars, sessions or tokens (`allowance` in the config, `--max-sessions`,
  `--max-tokens`), any one reached ending the night with the wrap-up not run; the spend
  written to `run.json` after every session, and `--resume` continuing an interrupted night
  counting what it spent, with the canary of that night standing.
- Sandboxed nights (roadmap #15): the OS boundary under the guard, the layer below its text
  match. The runner builds it from `sandbox` in the config (bubblewrap on Linux, `sandbox-exec`
  on macOS, a container image anywhere; `mode` auto, required or off; `--sandbox` for one
  night), keeps the tree, the hooks' log folder and the agent's state writable, mounts the
  harness, the root config and the protected paths read-only and the rest of the machine
  read-only, then proves it with a probe before the first session: a sandbox that does not
  hold refuses the night. The driver is written to `run.json` and the night report.
- Rule-ID namespacing (roadmap #14): a standard ID is `FAMILY.N` with a dot (`CODE.6`,
  `DOC.2`), a namespace of its own that no error code, hash name or third-party identifier
  shares; the hyphen form of the first days is retired across the standard, the rules, the
  templates, the presets and the catalog, `stdIds()` normalises any hyphen citation to the dot
  form, and a test walks the shipped files so the old form cannot return.
- The secret scan and the audit in the gate (roadmap #13): a built-in scanner with no
  dependency (a private key block, a cloud access key id, a provider token, a payment key, a
  chat token, a signed web token, a long literal on a secret-like name; placeholders refused;
  `abatty:allow-secret` on a line, `secrets.allow` by path), one implementation for the
  pre-commit hook (`abatty secrets --staged`, written by `init`), the gate (a built-in step
  over the tree) and CI (the generated pipeline scans the pushed range); the audit as a
  built-in gate step, skipped without a lockfile, deferred loudly when the registry is
  unreachable. The security and CI rules recognise the built-in scan.
- Type declarations generated from the JSDoc (roadmap #12): `npm run types` emits `types/`
  from the sources (buildless stays: `.d.mts` beside the `.mjs`), the package names them
  (`types`, a `types` condition on every export, shipped in `files`), and a test keeps the
  committed folder equal to a fresh emit.
- CI from the gate (roadmap #11, and #26 with it): `abatty ci` generates the pipeline from the
  preset's gate definition for Woodpecker and GitHub Actions - the gate's steps in order, the
  secret scan, the audit, the publish step guarded by the secret, the suites as their own
  pipeline or job - so the gate and CI cannot list different steps; `--check` says when a file
  is behind; `init --ci <provider>` and `ci.providers` write it on day 0; a pull-request
  template with the reviewer's checklist; `--ruleset` prints an organisation ruleset (branch
  names naming a tool refused, a pull request and the checks required), never written. The CI
  rules read both providers' files.
- The dashboard hosted (roadmap #10): `abatty serve`, a self-hosted service with no dependency
  that stores the reports CI posts (`POST /reports`, bearer token, or `--no-auth` for a machine
  nobody else reaches) and serves the dashboard over every repository, an index, one
  repository's readings, a health route and the score as a badge (`/badge/<name>.svg`);
  `abatty publish --to <url>` is the CI step, posting the newest report and measuring first
  when there is none.
- `abatty night-report` (roadmap #9): the learning distillation over a night's evidence - the
  sessions, the Stop gate's receipts and its block log, the guards' denials, the direction
  check, the state file, the decisions, the commits - into proposed lessons in the catalogue's
  shape (a recurring block, a repeated refusal, a crash, a denial storm, a blocked phase, a
  recurring decision, a loosening refused, a failed canary), each with its evidence and the
  check that would catch it; Markdown with front matter, `--json`, `--out`. The Stop gate now
  appends every block to `.claude/night/stop-blocks.jsonl`, since a receipt keeps only the last
  decision and a cured block left no trace by morning.
- The MCP server (roadmap #8): `abatty mcp [dir]`, the Model Context Protocol over stdio,
  hand-written (initialize, ping, tools/list, tools/call; one JSON-RPC message per line), six
  tools scoped to one repository and taking no path - `measure`, `ratchet`, `gate`, `scrub`,
  `report`, `explain` - each returning data, a failing gate or ratchet saying why in its
  result; declared for a night in `.claude/mcp.night.json` and named in `mcpServers` like any
  server; the skill calls the tools when the server is declared.
- The skill in the open agent-skills format (roadmap #7): `templates/skills/adopt-standards/SKILL.md`
  carries name, description, license, compatibility and metadata, and a body that names the
  config, the context file (`CLAUDE.md`, or `AGENTS.md`) and "a skill the agent has" rather
  than one vendor's; every adapter names its skills folder and `init` writes the skill there;
  the harness rule accepts the skill at any adapter's place; a test holds the format's limits.
- The agent adapters (roadmap #6): `src/agents/` describes an agent by its settings folder,
  its context file, its rules folder and format, its hook protocol and the flags of its
  headless mode; three adapters (the harness's own agent, the open `AGENTS.md` convention,
  Cursor with `.mdc` rules); `agents` in the config and `init --agent <id,id>` name a
  repository's adapters, `init` writes `AGENTS.md` (the primary importing it) and the `.mdc`
  rules; `abatty agents` lists the adapters and what a repository loses with the ones it
  named; the runner builds every session's flags from the adapter and refuses a night for a
  repository whose adapters have no hook protocol, naming what is lost; the rules' context
  reads `AGENTS.md` when it is the context file.
- The `astro` preset (roadmap #5), unproven and saying so: pages, layouts, components and
  content under `src/`, `astro check` as the typecheck, the browser suite with axe over the
  built output, no database suite by default; its fixture repository in the tests proves
  detection, init, measure, doctor and the gate's order. Express needs no preset of its own:
  the `node` preset detects it and its fixture already runs on it.
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

- `abatty scrub` scans untracked files too (tracked and untracked-but-not-ignored): a new file
  that names a tool is a finding before it is committed, not after; a test that spelled the
  context file's name with an escaped dot now takes it from the vocabulary's required paths.
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
