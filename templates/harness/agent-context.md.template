# CLAUDE.md - <project name>

<Two sentences: what the product is, who the client is, who builds it.>

This file is the agent's entry point and stays under 200 lines; what matters in one part of
the tree only lives in `.claude/rules/<topic>.md` with `paths:` front matter. The rules are
the standard (`node_modules/abatty/docs/standard/ENGINEERING_STANDARD.md`); how they apply to this stack is
`docs/CODE_CONVENTIONS.md`; the narrative is indexed in `docs/README.md`. Where this file and
the standard disagree, this file wins for this repository and §10 records why. Nothing here is
enforcement: what must happen at a fixed point is a hook in `.claude/settings.json`.

## 1. The non-negotiables

Violating one of these is an incident, not a bug.

1. <e.g. Never a real customer record, secret or PII in the repository.>
2. <e.g. Every tenant read and write is scoped in the service; the URL is not authorisation.>
3. <e.g. Money on the wire is a decimal string; money in the database is Decimal.>
4. <e.g. An issued document is never edited; it is superseded.>
5. **The gate runs before a push, never bypassed.** `--no-verify` is not a workflow.

## 2. Commands

The four that matter, and whatever else this repository runs. `abatty init` wrote the ones the
preset names into `package.json`; delete the lines that are not true here.

```bash
npm run gate               # THE pre-push gate; the hook and CI run this same one
npm run gate:fast          # the same without the heavy suites (they still run in CI)
npm test                   # the unit suite
npm run standards          # the ratchet alone, against the committed floor
```

## 3. Boundary map

| Module | Responsibility | Read first |
|---|---|---|
| `src/<domain>/` | ... | `docs/<DOMAIN>.md` |
| `src/db/` | pools, tenant context, migrations | `docs/DATABASE.md` |
| `src/app/api/` | HTTP concerns only: auth, parse, call a module, respond | `docs/API.md` |

<Two or three sentences on the security frontiers and why they never converge.>

## 4. Conventions that surprise

- <What a competent newcomer would get wrong: the env file precedence, the disabled script,
  the field whose name lies, the tag that must be exact.>

## 5. Secrets and configuration

<Where each credential comes from, what beats what (a database row over an env var), and how
long a change takes to be live.>

## 6. Size, shape and quality limits

The numbers are in `.claude/rules/size-limits.md` and the per-kind table in
`docs/CODE_CONVENTIONS.md`; `npm run standards` measures them. Written here they would be a
second copy that drifts. A number that must go up is a decision written in
`docs/STANDARDS_PROGRESS.md` in the same commit.

## 7. Delivery rules - every change is recorded

- **Every commit that touches source, tests, scripts, CI, migrations or docs adds a line
  under `## [Unreleased]` in `CHANGELOG.md`, in the same commit**, written for the reader
  ("Invoices now render NL correctly"), not the committer. The Stop hook and the gate check
  this over the pushed range; a push without it fails.
- **Versioning.** SemVer in `<package.json | docs/version.json>`. A run or a PR that closes a
  standards phase or ships a feature bumps minor; a fix bumps patch; a contract break bumps
  major and is written up in `docs/API_CHANGELOG.md` <if the repo has a public API>. On a
  bump, `[Unreleased]` becomes `## [x.y.z] - YYYY-MM-DD`.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`,
  `chore:`), one behaviour per commit, the message says why. **No em-dash anywhere** (code,
  copy, i18n, commits; the separator is `·` or a hyphen). **No `Co-Authored-By` trailer.**
- **Branches:** `<type>/<short-description>`; `adopt/standards-<date>` for unattended
  adoption runs. `main` <takes direct pushes after the gate | is PR-only>. Never red on
  purpose.
- **Docs move with the code.** A doc whose `source_truth` or cited file changed is re-read
  against the code and its `last_verified` bumped in the same change - or left stale, never
  bumped blind.

## 8. Skills and agents

| Name | Use it when | It must not |
|---|---|---|
| `/adopt-standards --phase N` | Running one phase of the adoption programme (unattended-safe) | Push to `main`, merge, raise a floor, install a dependency |
| `/verify-change` | After any non-trivial change to source: runs the gate and drives the real flow | Replace the gate |
| `/code-review` | Reviewing a diff or a PR for correctness | - |
| `standards-reviewer` (agent) | Before every phase commit and any refactor claiming to preserve behaviour; read-only | Edit anything |
| `standards-adopter` (agent) | Daytime: one territory (directory, phase, metric) of the programme | Work outside its territory |
| `<project>-architect` (agent) | Design questions, schema and API shape; read-only | Write code |
| `mattpocock-skills:codebase-design` (model-invoked) | Choosing a seam before a split: deep module, small interface, the deletion test | Justify a split by line count |
| `mattpocock-skills:tdd` | Any new guard, probe or behaviour: red before green, at a pre-agreed seam | Write production code before the failing test |
| `mattpocock-skills:writing-for-agents` | Editing this file, a `.claude/rules/*.md`, a skill or an agent | Grow this file past 200 lines |
| `mattpocock-skills:code-review` | A second reader on a diff, called with its fixed point and spec given: Standards axis = the engineering standard, Spec axis = the ticket or the phase exit criterion | Merge or rerank its two axes; ask for what the caller can pass |
| `mattpocock-skills:research` | A best-practices pass: primary sources, cited Markdown into the standard's `research/` | Cite a secondary source as primary |
| `mattpocock-skills:resolving-merge-conflicts` / `:diagnosing-bugs` / `:wizard` | The morning merge of an adoption branch; a `behaviour-risk` or blocked phase; a human-only runbook step (restore drill, key generation) | - |
| `/mattpocock-skills:improve-codebase-architecture`, `/mattpocock-skills:grill-with-docs` (day, user-invoked) | The morning after a night that recorded `seam-unclear`: the deletion-test scan over those files, the report, the grilling; before phase 0 of a repository (the `adoption.json` choices) or a feature spec. The ADRs they write go where the repository keeps decisions, with the house front matter, or the docs gate is red | Run unattended |

An agent or skill not in this table is not to be invented mid-task. Agent memory lives in
`.claude/agent-memory/<agent>/`, one pattern per file. The `mattpocock-skills:` rows apply
once `claude plugin install mattpocock-skills@claude-plugins-official` (user scope; the
plugin carries all 25 skills, this table says which ones a run uses) and
`/mattpocock-skills:setup-matt-pocock-skills` (by day, it asks) have been run for this
repository; a user-invoked skill of ours may call their model-invoked ones, never their
user-invoked ones (`/implement`, `/triage`, `/to-spec`, `/wayfinder`, `/ask-matt`, `/grill-me`: interactive or tracker-bound, harmless by hand by day, never in a night). The bare name
`code-review` is ambiguous here (the official plugin and the built-in skill carry it too):
always the namespaced one.

## 9. Autonomy contract

**In an unattended run (`ADOPTION_RUN=1`) you never ask.** You take the default below, write
one bullet to `docs/ADOPTION_DECISIONS.md` (date, phase, situation, default taken, the
alternative), and continue. A phase blocked twice is marked `blocked` with the reason in
`docs/ADOPTION_STATE.json` and the next phase starts. In an interactive session you may ask
only when two readings of the request lead to materially different work; a routine judgment
call is yours.

| Situation | Default |
|---|---|
| A ratchet number must rise to land a step | Refuse the step; split differently; never raise a floor at night |
| The seam of a split is unclear | Split by what a piece is FOR; if no seam is visible, leave the file and record `seam-unclear` |
| The same change would touch more than ten files | A codemod under `scripts/codemods/`, dry-run first, one commit, the count in the message (CODE.11); never file by file |
| A test would be needed on a presentational component | Do not write it; the standard exempts them; record `presentational-skipped` |
| A refactor would change behaviour the tests do not cover | Stop it, restore the original, record `behaviour-risk` |
| A migration is involved | Never edit an applied one; take the next number after checking `origin/main`; never run against a non-local database |
| A rule would be switched on with pre-existing violations | Generate the exemption from the baseline's `debt`; never hand-list files |
| A doc is behind the code it cites | Re-read and fix, then bump the date; if too large for the step, leave it stale and record `doc-left-stale` |
| A phase's exit criterion needs a product decision | Mark `blocked` with the question, move on |
| Coverage needs a scope decision | Take the exemption the standard grants; record `coverage-scope` |
| A dependency would be added or upgraded | Not at night; record `dependency-deferred` |
| A lint rule must be switched off or scoped, a path added to `ignores`, a strict flag relaxed, a CI step made non-blocking | Only with a bullet here naming the rule, path or flag and the reason (`no-await-in-loop` off under `server/`: ordered DDL); the Stop gate refuses it otherwise. A baseline number, a coverage floor, `--max-warnings=0`: never |
| The harness (`.claude/`, `adoption.json`, a hook) needs a change | Not at night: `.claude/` is read-only and the Stop gate reads `adoption.json` from the base branch. Record `harness-change` with the exact edit; the morning applies it |
| An MCP tool would help (a connector, a code server not named in `adoption.json` → `mcpServers`) | It does not exist at night or the hook denies it; no other route; record `environment-gap` with the tool and what it was for |
| Something looks like a secret or PII | Do not read or move it; record `sensitive-path` |
| The gate is red for a reason outside the change (Docker, network) | Use `gate:fast`, record `gate-deferred`; never `--no-verify` |
| The classifier denies an action for an infrastructure reason (unnamed host or remote) | Do not retry or work around it; record the exact action as `environment-gap` |
| Time or budget is nearly out mid-step | Finish or revert to the last commit; never leave a half-step |

## 10. Known gaps between docs and code, and deviations from the standard

- <A register. Empty is a valid state; delete this line when the first entry arrives.>
