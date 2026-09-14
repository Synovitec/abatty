# abatty

**abatty** (abatty.io) is the Synovitec engineering standard as an installable instrument. The standard itself - the rules,
the enforcement map, the adoption plan, the research - lives in
[`ops-hub/engineering`](https://github.com/Synovitec/ops-hub/tree/main/engineering); this package
is the part you install in a repository: the harness, the gate, the analysis tooling, the
measurement, per stack, kept in step.

```sh
npm i -D github:Synovitec/abatty
npx abatty                       # the repository at a glance: score, families, harness, nights, next steps
npx abatty init --stack next     # the instrument, from the templates and the preset
npx abatty measure               # the gap analysis: score, every check, next steps by phase
npx abatty gate --fast           # the path-aware gate (the pre-push hook and the night run it too)
npx abatty doctor                # the harness self-test and the drift against the package
npx abatty presets               # the stacks, and which repository proved each
npx abatty scrub                 # no trace of the tools: files (--fix), commit messages (--commits), pull requests (--prs)
npx abatty dashboard --open      # one page over the reports of one or many repositories, light and dark
```

Every command prints for a terminal (colour, glyphs, bars, timings) and degrades to plain text
in a pipe or CI; `--json` on `measure` and `report` is the machine-readable form. Each
measurement writes a dated report under `.abatty/reports/` (ignored by git); the dashboard is
built from those and needs no server: `abatty dashboard repoA repoB --open`.

## What `init` writes

| Where          | What                                                                                                                                                                                                                                                                                                      | Kept if it exists                         |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `.claude/`     | `settings.json` (the hooks wired), `adoption.json` (the one config the hooks trust: commands, files, push policy, phases, `mcpServers`), `mcp.night.json` (the only MCP servers a night has), the seven hooks and their self-test, the `adopt-standards` skill, the two agents, the preset's `rules/*.md` | yes; `adoption.json` is merged key by key |
| root           | `.dependency-cruiser.cjs` (the import graph: cycles, orphans, one rule per arrow of the boundary map), `knip.jsonc` (dead code), `.githooks/pre-push`, `CLAUDE.md` (the template, placeholders to fill), `CHANGELOG.md`                                                                                   | yes                                       |
| `package.json` | `gate`, `gate:fast`, `graph`, `dead`, `typecheck`, `lint`, `format:check`, `hooks:install`                                                                                                                                                                                                                | an existing script is never replaced      |
| `docs/`        | `README.md` (the index), `STANDARDS_PROGRESS.md`, `ADOPTION_DECISIONS.md`                                                                                                                                                                                                                                 | yes                                       |

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

## No trace of the tools

A repository built with abatty names no tool, no vendor, no model - not in its files, not in
its commit messages, not in its pull requests or issues. Four layers hold it:

- `abatty scrub` scans the tracked files, a commit range (`--commits`, `--range`) and the
  pull requests (`--prs`); `--fix` rewrites files by the word map; `--history` prints the
  `git filter-repo` command for an existing history and never runs it (a rewrite is a
  deliberate step from a fresh clone, followed by a force-push and the hosting provider's
  purge request, because old commits stay reachable by SHA until then).
- The guard (`.claude/hooks/guard.mjs`) refuses a `git commit`, `git tag -m`, `gh pr create`,
  `gh pr edit` or `gh issue create` whose text names one, day and night: a commit is the one
  thing a night cannot rewrite.
- A `commit-msg` hook for humans (`abatty scrub --message`), and the gate's scan of the files
  before a push.
- The agent's executable is never in the repository: `ABATTY_AGENT` or `agent.command` in
  `~/.abatty/config.json`, on the machine that runs the night.

The words live in `src/core/vocabulary.mjs`, stored reversed so the file does not name them;
the hooks carry a copy. Two names cannot go because the agent itself requires them to read its
settings and its context: the `.claude/` folder and `CLAUDE.md`. A line that mentions only
those is not a finding. A repository allows its own product terms through
`adoption.json` → `scrub.allow` (path substrings), with the reason in its decisions file.

## Roadmap

[`docs/ROADMAP.md`](docs/ROADMAP.md): what changes next, in the order the evidence dictates, each
item with the evidence that put it there.

## What is not here yet

The ratchet itself (`check-standards`, the probes with per-file floors, `standards:baseline`)
is still copied from the reference repository named in ops-hub's `ADOPTION_STATUS.md`; it is
the next slice. Then the night runner in Node (one implementation for Windows and POSIX), the
`update` command (a three-way merge that keeps a repository's own edits), `night-report` (the
learning distillation), and the dashboard over every repository's `standards-report.json`.

## Development

```sh
npm test                 # node:test, temp repositories, the real self-test
npm run typecheck        # checkJs strict, zero findings (the generated gap analysis is the one exception, named in its header)
npm run gate             # format, typecheck, tests, templates in sync with ops-hub
npm run sync-templates   # after a template changed in ops-hub/engineering/templates
node scripts/port-gap-analysis.mjs   # after ops-hub/engineering/tools/gap-analysis.mjs changed
```

The templates and the gap analysis are synced from ops-hub, not edited here; `npm test` is red
when the two differ.
