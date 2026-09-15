# abatty

**abatty** (abatty.io) is an engineering standard as an installable instrument, open source under
Apache-2.0. The standard itself - the rules, the enforcement map, the adoption plan, the lessons,
the research - ships with the package under [`docs/standard/`](docs/standard/README.md), versioned
with it; the package is the part you install in a repository: the harness, the gate, the ratchet,
the analysis tooling, the measurement, per stack, kept in step. Contributions under a DCO:
[`CONTRIBUTING.md`](CONTRIBUTING.md).

```sh
npm i -D abatty                  # the registry, from the first tagged release; github:Synovitec/abatty for the branch
npx abatty                       # the repository at a glance: score, families, harness, nights, next steps
npx abatty init --stack next     # the instrument, from the templates and the preset
npx abatty measure               # the gap analysis: score, every check, next steps by phase
npx abatty gate --fast           # the path-aware gate (the pre-push hook and the night run it too)
npx abatty ratchet --range auto  # the ratchet: every probe against the committed baseline, per total and per file
npx abatty baseline              # today's numbers as the floor; zeros promoted to HARD
npx abatty night --canary-only   # the unattended night (one implementation, Windows and POSIX); the pre-flight alone here
npx abatty agents                # the agent adapters: what each gives, what this repository loses with the ones it named
npx abatty mcp                   # the MCP server over stdio: measure, ratchet, gate, scrub, report, explain as typed tools
npx abatty night-report          # the morning after: the night's facts and the lessons they propose
npx abatty secrets --staged      # the secret scan: the tree, the staged files (the pre-commit hook), a range (CI); one implementation
npx abatty ci --provider github  # CI generated from the gate (Woodpecker, GitHub Actions); the PR template; --ruleset prints the org ruleset
npx abatty serve --token <t>     # the dashboard hosted: CI posts each report, one page over every repository, a badge
npx abatty publish --to <url>    # the CI step: post this repository's newest report to a service
npx abatty doctor                # the harness self-test and the drift against the package
npx abatty update                # the harness to the package's version, your edits kept (a three-way merge per file)
npx abatty config                # the one config (abatty.config.json at the root): its files, its problems against the schema; --migrate
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

| Where          | What                                                                                                                                                                                                                                                                                                                      | Kept if it exists                        |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| root           | `abatty.config.json`: the one config, the hooks' and the package's (commands, files, push policy, phases, `mcpServers`, `rules.waived`, `ratchet`, `scrub`, `provenance`), with its `$schema` line; validated by `abatty config` and `doctor` against the schema the package ships (`schema/`)                            | yes; merged key by key, your values kept |
| `.claude/`     | `settings.json` (the hooks wired), `mcp.night.json` (the only MCP servers a night has), the seven hooks and their self-test, the `adopt-standards` skill, the two agents, the preset's `rules/*.md`, `harness.lock.json` (the package version and the hash of every shipped file as installed, what `update` merges from) | yes                                      |
| per adapter    | `AGENTS.md` for the open convention and Cursor (the primary's context file then imports it), `.cursor/rules/*.mdc` for Cursor (the preset's rules, the paths as globs)                                                                                                                                                    | yes                                      |
| root           | `.dependency-cruiser.cjs` (the import graph: cycles, orphans, one rule per arrow of the boundary map), `knip.jsonc` (dead code), `.githooks/pre-push`, `CLAUDE.md` (the template, placeholders to fill), `CHANGELOG.md`                                                                                                   | yes                                      |
| `package.json` | `gate`, `gate:fast`, `graph`, `dead`, `typecheck`, `lint`, `format:check`, `hooks:install`                                                                                                                                                                                                                                | an existing script is never replaced     |
| `docs/`        | `README.md` (the index), `STANDARDS_PROGRESS.md`, `ADOPTION_DECISIONS.md`                                                                                                                                                                                                                                                 | yes                                      |

Dependencies are named, never installed (`npm i -D dependency-cruiser knip ...` is printed): a
dependency change is a decision. Then by hand: fill `CLAUDE.md`, write the boundary-map rules
in `.dependency-cruiser.cjs`, on an existing repository `depcruise --baseline` once and knip at
today's count, `npm run hooks:install`, `abatty doctor`, `abatty measure`, `npm run gate`.

## Agents

The harness talks to an agent through an **adapter**: its settings folder, its context file,
where its path-scoped rules go and in what shape, whether it has a hook protocol, the flags
of its headless mode. `abatty agents` lists them; `agents` in the config (or `init --agent
<id,id>`) names the ones a repository writes for. Three today: the harness's own agent (its id
is derived from its folder, so this package names no tool), the open `AGENTS.md` convention
any agent reads, and Cursor (`AGENTS.md`, the rules as `.cursor/rules/*.mdc` with the paths as
globs). With more than one, the context file is `AGENTS.md` and the primary's file imports
it, so there is one source. The `adopt-standards` skill is in the open agent-skills format
(`templates/skills/adopt-standards/SKILL.md`: name, description, license, compatibility,
metadata, an agent-neutral body) and `init` writes it to every configured adapter's skills
folder.

What an adapter cannot give is said plainly, because the enforcement of a night is the hooks:
an agent without a hook protocol gets the context, the rules, the gate and CI, and loses the
guard, the file guard, the Stop gate, the canary and the night itself. `abatty night` refuses
a repository whose adapters have no hooks and names what is lost. The runner builds every
session's flags from the adapter, never from a hard-coded list.

## CI from the gate

`abatty ci [--provider woodpecker,github] [--check]` generates the pipeline from the preset's
gate definition: the same steps in the same order (format, lint, typecheck, the import graph,
dead code, unit tests, the ratchet with the changelog over `origin/<base>..HEAD`), then the
secret scan, the audit, and the publish step to the hosted dashboard, guarded by the secret;
the suites follow as their own pipeline or job, the database one on a real Postgres, the
browser one with the browsers installed. Because it is generated, the gate and CI cannot list
different steps, and `--check` says when a pipeline file is behind the gate; `init --ci
<provider>` (or `ci.providers` in the config) writes it on day 0. GitHub also gets a
pull-request template with the reviewer's checklist. `abatty ci --ruleset` prints a ruleset
for the organisation (branch names naming a tool refused, a pull request required, the checks
required); it is printed for import, never written into a repository, because it carries the
vocabulary in the open.

## The dashboard, hosted

`abatty serve [--port 8787] [--data <dir>] [--token <t>|--no-auth]` is a small self-hosted
service with no dependency: CI posts each repository's report to it and it serves the same
dashboard page over every repository. `POST /reports` takes the report `abatty measure` writes
(a bearer token; the service refuses to start without one unless `--no-auth`, for a machine
nobody else reaches); `GET /` is the page; `GET /api/reports` the index of repositories with
their newest score and enforced share; `GET /api/reports/<name>` one repository's readings;
`GET /badge/<name>.svg` the score as a badge for a README; `GET /healthz`. Reports are files
under the data folder, one per repository and day. `abatty publish --to <url> [--token <t>]`
(or `ABATTY_DASHBOARD` and `ABATTY_TOKEN`) is the CI step: it posts the newest report, measuring
first when there is none.

## The MCP server

`abatty mcp [dir]` speaks the Model Context Protocol over stdio and exposes the package as
typed tools scoped to one repository: `measure`, `ratchet`, `gate`, `scrub`, `report`,
`explain`. An agent then verifies through a call whose result is data (the score, the
verdicts, the findings, the gate's outcome) instead of parsing a terminal, and no tool takes
a path, so nothing outside the repository is reachable through it. Declared for a night in
`.claude/mcp.night.json` and named in the config's `mcpServers` like any server:

```json
{ "mcpServers": { "abatty": { "command": "npx", "args": ["abatty", "mcp"] } } }
```

Hand-written, because the package has no runtime dependency and a tool server needs a small
subset of the protocol: `initialize`, `ping`, `tools/list`, `tools/call`, one JSON-RPC message
per line.

## Configuration

One file, `abatty.config.json` at the repository root: a tool-neutral name any agent can read,
the file the hooks trust and the package reads, validated against the JSON Schema the package
ships (`schema/abatty.config.schema.json`, `$schema: https://abatty.io/schema/abatty.config.json`).
`abatty config` lists the files that carry it, the resolved values and every problem against
the schema; `doctor` refuses a config the schema refuses. The older place, `.claude/adoption.json`,
is still read, the root file winning key by key, and `abatty config --migrate` moves it. At
night the root config is read-only to the worker exactly as the agent folder is: the guard and
the file guard refuse a write to it, the direction check and the runner refuse a night where it
moved, the Stop gate reads it from the base branch.

## Update

`abatty update` brings the harness to the package's version without losing the repository's
own edits: a three-way merge per file between the copy the package installed (kept under
`.abatty/harness/<version>/`, ignored by git), the repository's copy and the package's copy
now. A file untouched since the install takes the new version; a file edited here while the
package did not change it is kept; a file both changed is merged with `git merge-file`, and
when the edits meet on the same lines the new version is written beside yours as
`<file>.abatty-new` and nothing of yours is touched. `adoption.json` gains the keys the template
gained and keeps every value set here; the scripts absent are added; `--dry-run` says what
would change, `--force` takes the package's version of everything. `doctor` names the version
the harness was installed by when it is not the package's.

## The gate

One implementation, three callers: `npm run gate`, `.githooks/pre-push`, the night's Stop hook.
Always on, in this order - format (Prettier with `--end-of-line auto`), lint at zero warnings,
typecheck, the import graph, dead code, unit tests, the abatty ratchet with the changelog
check over the pushed range, the secret scan and the audit - then the preset's heavy suites
only when the push or the working tree touches their paths, deferred loudly to CI when Docker
is absent. The secret scan is built into the gate (no dependency: a private key block, a cloud
access key, a provider token, a payment key, a chat token, a signed web token, a long literal on
a secret-like name; a false positive is marked on its line with `abatty:allow-secret` or by path
in `secrets.allow`), and it is ONE implementation for the pre-commit hook (`abatty secrets
--staged`, written by `init`), the gate (the tree) and CI (the pushed range). The audit runs
`npm audit --audit-level=high` where a lockfile exists and is deferred loudly when the registry
is unreachable, never red and never silently green. A step whose script the
repository does not have yet is reported as skipped, so a fresh repository can run the gate
before everything exists; the gap analysis names what is missing.

## The night

`abatty night [dir] --until HH:MM|+Nmin --max-cost <usd> [--phases "0 1"] [--mode auto|dontAsk] [--no-push] [--skip-canary] [--canary-only] [--agent <cmd>] [--sandbox auto|required|off] [--max-sessions N] [--max-tokens N] [--resume]`
drives the adoption programme unattended: one headless session per phase on
`adopt/standards-<date>`, until the hour or the allowance. Before the first phase, four things or
no night: the harness self-test green, `.claude/` identical to the base branch, the gate green
on the branch as it starts, and the canary (a real session that proves a command runs without
a prompt, the guard fires, the Stop hook fires and reads the base, and no MCP server but the
declared ones reached it). A crash is retried once and a second in a row aborts; fifteen
denials abort (auto mode did not take); the harness is checked before every session; the
branch is pushed only when nothing was loosened against the base without a decision naming
it. The agent's executable comes from `--agent`, `ABATTY_AGENT` or `~/.abatty/config.json`,
never from the repository. `templates/harness/testing/stub-agent.*` stands in for the agent;
the package's test runs the whole runner with it, every abort path included.

**The sandbox under the guard.** The guard is a text match on commands; the sandbox is the
layer below it, an OS boundary that holds whatever a command was called, in whatever shell,
through whatever script: the working tree writable; the harness folder, the root config and the
protected paths read-only at the OS level; the rest of the machine read-only (the temp folder
aside); the hooks' log folder and the agent's own state writable. Drivers: bubblewrap on Linux
(no daemon, no root), `sandbox-exec` on macOS, or a container image (`sandbox.image`, docker or
podman) anywhere. `sandbox.mode` is `auto` (a driver found on the machine, else the guard alone,
said loudly in the log and in `run.json`), `required` (no driver, no night) or `off`;
`--sandbox` overrides it for one night. Before the first session the runner **proves** the
boundary with a probe (a Node inside it tries the tree, the log folder, the harness, the root
config, the protected paths and its own runtime folder): a sandbox that is present but does not
hold refuses the night, because a night claiming a boundary it lacks is worse than one saying
it has none. The network is not cut (the model is on it): pushes, deploys and publishing stay
the guard's to refuse. The package's test runs a night under bubblewrap where the stub tampers
with the config and the filesystem refuses it.

**The allowance, and a night resumed.** What a night may spend is in the unit the account is
billed in: dollars for metered access (`--max-cost`, 60 by default); under a subscription the
dollar figure is a proxy, so the cap is sessions or tokens (`--max-sessions`, `--max-tokens`,
or `allowance` in the config), with the hour as the outer bound either way. Any cap reached
ends the night, said, and the wrap-up is not run on a spent allowance. The runner writes its
spend to `.claude/night/run.json` after every session; a night interrupted (a laptop closed, a
process killed) continues with `--resume`: it counts what was spent, keeps the canary of that
night, and starts from the phase the state file says. Without `--resume` an interrupted run is
only mentioned and the night starts afresh.

**The morning after**, `abatty night-report [--date] [--json] [--out docs/NIGHT_REPORT_<date>.md]`
reads what the night left (the sessions' results, the Stop gate's receipts and its log of
every block, the guards' denial log, the direction check's findings, the state file, the
decisions, the commits) and proposes **lessons** in the lessons catalogue's shape: a block
recurring on the same check, a command the guard refused more than once, a crash, a denial
storm, a phase blocked, a decision recorded twice, a loosening refused, a failed canary. Each
proposal carries its evidence and the check that would catch it next time. A proposal is a
human's to accept into `docs/standard/LESSONS.md`; a quiet night proposes nothing.

## Presets

A preset says what a stack's repository looks like (paths, scripts, gate steps and suites, the
rules files); the standard says what must hold. A preset is real when a repository has run it:

| Preset       | Proven by                                                                                                            |
| ------------ | -------------------------------------------------------------------------------------------------------------------- |
| `next`       | paycore_dms, 2026-09-14: instrument, harness, graph and dead code in the gate, first unattended night closed a phase |
| `vite-react` | Paycore-Task-Manager, 2026-09-13: instrument and harness; graph and dead code pending                                |
| `astro`      | nobody yet - `init` says so; the fixture in the tests proves init, measure, doctor and the gate's order on the shape |
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
never reports green forever. The changelog check over the pushed range (CHANGE.1) is one probe
among the others; the gate passes it the range.

The built-in probes: `size.overBudget`, `size.excessCode`, `size.overRaw` (CODE.1, the budgets
by kind of file and the 800 cap), `context.overCap` (AIR.1), `types.escapes` (CODE.3),
`valid.rawEnv` (VALID.3), `code.barrels` (CODE.5), `docs.frontMatter`, `docs.indexDrift`,
`docs.citations`, `docs.behindCode`, `docs.danglingSource` (DOC.2..5), `change.changelogMissing`
(CHANGE.1). A readability score over the same numbers is printed as a trend, never a gate.

Every probe carries its **control cases in both directions**, and `abatty ratchet --controls`
runs them on throwaway repositories; the package's own test runs them on every push, so a probe
with no failing control case cannot be added. A repository adds its own probes in
`abatty.probes.mjs` at its root, the same shape, controls required, a built-in name refused;
it configures the ratchet under `ratchet` in its adoption config or in `abatty.config.json` at
its root (`kinds` and their budgets, `exempt` paths, `cap`, `contextMax`, `barrelMax`,
`envModule`, `include`/`exclude` of metrics, `hard`/`ratchet` overrides, `mustScan`) and names
the baseline through `files.baseline` (default `scripts/ci/standards-baseline.json`).

## What is not here yet

The `update` command (a three-way merge that keeps a repository's own edits), `night-report`
(the learning distillation), and the dashboard over every repository's report. The function-shape probe
(CODE.2) is not here: ESLint holds it (`CODE-SHAPE`).

## Development

```sh
npm test                 # node:test, temp repositories, the real self-test
npm run typecheck        # checkJs strict, zero findings, no file under ts-nocheck
npm run types            # the declarations under types/, generated from the JSDoc; committed, a test keeps them equal
npm run gate             # format, typecheck, tests, the ratchet, no trace of the tools
npm run standards        # this package against its own baseline (scripts/ci/standards-baseline.json)
node bin/abatty.mjs rules --md > docs/CATALOG.md   # after a rule changed; the test is red until it is run
```

The templates and the rules are owned here (`templates/`, `src/rules/`); a change to a rule
appends its ID to the list in `test/rules.test.mjs`, which is red for a rename or a loss.
