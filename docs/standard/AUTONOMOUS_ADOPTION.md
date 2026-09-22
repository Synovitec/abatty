---
title: "Autonomous adoption - settings, CLAUDE.md, skills, agents and the night run"
description: "How an agent adopts the engineering standard on a repository without a human answering anything: the agent settings that stop the prompts (user, project and night profiles), the sections CLAUDE.md must carry (changelog on every change, versioning, skills, agents, the autonomy contract), the adopt-standards skill and the two agents, the hooks that make the gate mandatory before any stop and the harness read-only to the worker (no write under .claude/, the config read from the base branch, nothing loosened without a decision naming it), the runner's pre-flight and canary session, and the loop that drives one phase per session on a separate branch until morning. Verified against the agent 2.1.270 and the official settings schema on 2026-09-13; the tamper controls and the canary added 2026-09-14."
category: guide
status: living
audience: ["architect", "developer", "agent"]
tags: ["agent-code", "settings", "hooks", "skills", "agents", "autonomy", "ratchet"]
related: ["./ENGINEERING_STANDARD.md", "./ADOPTION_PLAN.md", "../../templates/harness/README.md"]
scope: synovitec
last_verified: "2026-09-22"
source_truth:
  - "../../templates/harness/**"
---

# Autonomous adoption

Three things stop an agent from working a whole night on its own: a permission prompt nobody
answers, a question nobody answers, and a "done" nobody checks. This document removes all
three. The mechanisms are the agent's own (permission modes, hooks, skills, agents) and every
file referenced is a template under [`templates/harness/`](../../templates/harness/README.md), ready
to copy into a repository.

The design in one paragraph: the run happens on a branch `adopt/standards-<date>`, never on
`main`. Each phase of `ADOPTION_PLAN.md` §B is one `the agent's headless mode` session in **auto mode with
prompts disabled**, so the classifier reviews actions and nothing waits for a human. Two
**PreToolUse hooks** refuse what must never happen unattended: the shell guard (push to
`main`, force push, hard reset, `--no-verify`, destructive SQL, deploys, a shell write to the
harness) and the file guard (an Edit or Write under `.claude/`, to an applied migration, to
an env file, outside the tree); under both, a **sandbox** (bubblewrap, `sandbox-exec` or a
container, built by the runner and proven by a probe before the first session) holds the same
boundary at the OS level, so a command the guard's text match misses still cannot write the
harness, the root config, a protected path or the machine outside the tree. A **Stop hook** refuses to let the session end while the gate
is red, something was loosened against the base branch (a floor raised, a threshold lowered, a
rule switched off without a decision naming it, the harness edited), the tree is dirty, or the
newest source commit has no changelog entry - so "done" means the gate said so, not the model,
and the gate it ran is the one committed on the base branch, not one the model rewrote.
Before every phase commit the session spawns a **read-only reviewer agent** over the diff and
fixes what it finds. Every decision the agent would otherwise have asked about is answered in
advance by a **decision table** in `CLAUDE.md`, and each decision taken is written to
`docs/ADOPTION_DECISIONS.md` for the morning. The runner proves the harness, the gate and a
real session (the canary) before the first phase, stops at the hour or the budget you gave it,
bumps the version, pushes the branch only if nothing was loosened, and leaves a report.

---

## 1. Settings: stop the prompts

> Since 2026-09-15 the per-repository config the hooks trust is `abatty.config.json` at the
> repository root (a tool-neutral name, validated against the package's schema); `adoption.json`
> below names the same keys at their older place, `.claude/adoption.json`, which is still read.

Facts that decide the shape (the agent 2.1.270, official schema):

- `permissions.defaultMode: "auto"` **takes effect only from user or managed settings**, never
  from a project file. That is why the user file carries it and the project file does not.
- In a `-p` run, hooks from `~/.claude/settings.json` **do not run**; hooks from the project's
  `.claude/settings.json` do. So the night hooks live in the project file, committed.
- `--permission-prompts none` (v2.1.259+) denies anything that would prompt **and removes
  `AskUserQuestion`** from the tool set. `dontAsk` mode does the same by denying; `auto` mode
  with the flag is the better night profile because the classifier still approves ordinary
  work instead of denying everything not on an allowlist.
- `attribution.commit: ""` hides the `authorship` trailer (`includeCoAuthoredBy` is
  deprecated). `askUserQuestionTimeout` accepts `"60s" | "5m" | "10m" | "never"`, user file
  only.
- The PowerShell tool is a separate tool with its own rules (`PowerShell(git pull *)`); a
  `Bash(...)` allow rule does not cover it, and PowerShell prompts do not offer "switch to
  auto". On Windows that gap is most of the "stupid questions".

### 1.1 `~/.claude/settings.json` - yours, every project

Merge [`templates/harness/settings.user.json`](../../templates/harness/settings.user.json). What
changes against the file you have today:

| Key                          | Today               | Set to                                                                                     | Why                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------- | ------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `permissions.defaultMode`    | `"default"`         | `"auto"`                                                                                   | The classifier reviews instead of you. Interactive sessions stop prompting for routine work; auto mode also nudges the agent not to stop for clarifying questions                                                                                                                                                                                                                      |
| `permissions.allow`          | `Bash(...)` only    | + the same commands as `PowerShell(...)` rules                                             | The PowerShell tool is what runs on Windows                                                                                                                                                                                                                                                                                                                                            |
| `permissions.deny`           | none                | `Read(./.env)`, `Read(./.env.*)`, `Read(~/.ssh/**)`, force-push and `--no-verify` patterns | A deny is checked before anything else, in every mode, and applies even before workspace trust. A Bash rule is a text match, not a boundary: the guard hook reads the whole command                                                                                                                                                                                                    |
| `permissions.ask`            | none                | `git reset --hard`, `git clean`                                                            | The two destructive shapes that are sometimes right by day. At night an ask is a denial, which is the intent. Push-to-`main` is NOT here: it is a per-repository policy (`adoption.json` → `directPushToBase`) enforced by the guard hook, because an internal platform that pushes to `main` after the gate by design would otherwise meet the very prompt this file exists to remove |
| `attribution.commit` / `.pr` | absent (trailer on) | `""`                                                                                       | No `authorship`, no session line                                                                                                                                                                                                                                                                                                                                                       |
| `askUserQuestionTimeout`     | absent              | `"5m"`                                                                                     | A question you did not see auto-continues with the default option instead of holding the session                                                                                                                                                                                                                                                                                       |
| `outputStyle`                | absent              | `"Proactive"`                                                                              | Stronger keep-working bias in modes that still prompt                                                                                                                                                                                                                                                                                                                                  |
| `effortLevel`                | `"xhigh"`           | keep                                                                                       | -                                                                                                                                                                                                                                                                                                                                                                                      |

Keep `autoMode.allow` / `soft_deny` / `environment` as you have them; add the adoption
branch pattern and the CI host to `environment` so the classifier knows a push to `adopt/*`
is routine.

### 1.2 `.claude/settings.json` - the project's, committed

[`templates/harness/settings.project.json`](../../templates/harness/settings.project.json):

- **Hooks** (§3): `PreToolUse` guard on `Bash|PowerShell`, `Stop` gate, `SessionStart`
  briefing, optional `PostToolUse` lint-on-edit.
- **Allow rules** for the repository's own commands (`npm run *`, `pnpm *`, `node scripts/*`,
  `git *` minus the denied shapes) in both `Bash(...)` and `PowerShell(...)` forms, so a
  teammate on Manual mode is not prompted for the gate either.
- **Deny rules** that are true for everyone on the project: the env files, `git push --force`,
  `git commit --no-verify`, `npm publish`, the deploy scripts.
- No `env` block. Pinning `ADOPTION_CONFIG` was in this file until 2026-09-18 and was a
  defect: `init` writes `abatty.config.json` at the root and the pin named the older place,
  which `init` does not create, so every hook fell back to its built-in defaults and the
  repository's own scrub setting, coupled pairs and protected paths went unread. The hooks
  resolve the config themselves (`configPath()` in `lib.mjs`: the root file when it exists,
  else the older place), and the self-test refuses a settings file that pins a path that is
  not there.

Allow rules from a project file apply after the folder is trusted; the repositories you work
in daily already are. Deny and ask rules apply regardless.

### 1.3 The night profile - flags, not a file

The runner passes what a project file cannot set:

```
the agent's headless mode "/adopt-standards --phase 7" \
  --permission-mode auto --permission-prompts none \
  --output-format json --max-budget-usd 25 \
  --effort high --model opus -n "adopt-phase-7"
```

with `ADOPTION_RUN=1`, `ADOPTION_BRANCH`, `ADOPTION_UNTIL` in the environment. `ADOPTION_RUN`
is what switches the hooks from advisory (daytime) to blocking (night). If auto mode is
unavailable to the session (org setting, unsupported model), the fallback is
`--permission-mode dontAsk --allowedTools "<the allow list>"`, which denies instead of asking;
the runner prints which profile it used.

`--max-budget-usd` is the cost ceiling per session and the runner sums `total_cost_usd` from
the JSON result against the night's total. There is no turn cap in this build; the budget and
the hour are the two limits.

---

## 2. `CLAUDE.md`: what it must carry

The standard caps `CLAUDE.md` at 200 lines (the agent's own target) and says what goes in it;
anything that matters in one part of the tree only is a `.claude/rules/<topic>.md` with
`paths:` front matter, loaded when a matching file is read. `CLAUDE.md` is context, never
enforcement - the hooks in §3 are what enforce. For autonomy, four sections are load-bearing
and [`templates/harness/CLAUDE.md.template`](../../templates/harness/CLAUDE.md.template) carries all
of them:

**§7 Delivery rules - every change is recorded.** Every commit that touches source, tests,
scripts, CI or docs adds a line under `## [Unreleased]` in `CHANGELOG.md` in the same commit,
written for the reader. The Stop hook enforces it over the branch range. A run that closes a
phase bumps the version (`package.json`, or `docs/version.json` where the repo keeps it) and
moves `[Unreleased]` into `## [x.y.z] - YYYY-MM-DD`: minor when a phase closed, patch
otherwise. Conventional Commits; no em-dash; no `authorship`.

**§8 Skills and agents.** A table: `/adopt-standards` (the programme, one phase per
invocation), `/verify-change` (drive the real flow), `/code-review` (the plugin, used by the
reviewer), `standards-reviewer` (read-only, the self-review before a phase commit),
`<project>-architect` (design questions, read-only). Each row says when to use it and what it
must not do. An agent that is not in the table is not to be invented mid-run.

**§9 Autonomy contract.** The decision table (§4 below) plus the two sentences that make a
night run possible: _"In an unattended run (`ADOPTION_RUN=1`) you never ask. You take the
default in the table, record it in `docs/ADOPTION_DECISIONS.md`, and continue."_ and _"A
phase that is blocked twice is marked `blocked` in `docs/ADOPTION_STATE.json` with the reason
and the next phase starts."_

**§10 Known gaps** between docs and code, maintained as a register.

The rest of the file is the skeleton from `ADOPTION_PLAN.md` §A.2: non-negotiables, commands,
boundary map, surprising conventions, secrets and configuration.

---

## 3. Hooks: the gate is mandatory, not advisory

All hooks are Node scripts in exec form (`"command": "node", "args": [".claude/hooks/x.mjs"]`),
because a `.cmd` shim does not work in exec form on Windows and `jq` is not on every machine.
They read the event JSON from stdin.

| Event                                     | Script                | Daytime (`ADOPTION_RUN` unset)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Night (`ADOPTION_RUN=1`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PreToolUse` on `Bash\|PowerShell`        | `guard.mjs`           | Warns on force-push, hard reset, `-D`, `--no-verify`, destructive SQL; **denies** a push whose TARGET is the base branch, force push and `--no-verify` outright. The flag checks read the command with heredoc bodies removed, so a document that writes the flags down is not an attempt to use them. The push target is the last positional argument before any redirection, or the destination side of a refspec: `fix/merge-to-main-1` is not a push to `main`, and `git push origin main 2>&1` still is. The forge's API is the same door: `gh api` writing the base's ref or the merges endpoint is a push to the base | Additionally **denies**: any checkout/switch off the adoption branch (`git checkout <base> -- <path>` restores and passes), merging a pull request (`gh pr merge`, or the API's merge endpoint: the morning reads the branch), `reset --hard`, `clean -f`, `branch -D`, `rm -rf` outside the tree, `DROP/TRUNCATE/DELETE` without `WHERE`, deploy and publish commands, dependency changes, and any shell WRITE to `.claude/` or a protected path (a write verb, a redirection, a scripted `writeFileSync`; running or reading a hook passes). Every denial is appended to `.claude/night/guard-denials.jsonl`                                                                                                                                                                  |
| `PreToolUse` on `Edit\|Write`             | `protect.mjs`         | Exits 0                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | **Denies** an edit or write under `.claude/` (hooks, settings, `adoption.json`, the stop counters), to a `protectedPaths` entry (applied migrations, env files), or outside the repository, with the instruction to record `harness-change` instead                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `Stop`                                    | `stop-gate.mjs`       | Exits 0                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Reads `adoption.json` **from the base branch** (`ADOPTION_BASE`), never the tree. Runs its gate command; if red, **blocks the stop** (exit 2) with the tail of the output as the reason. If green, runs `check-direction.mjs` and blocks on anything loosened against the base (next row). Then blocks on a dirty tree, on a source-touching commit newer than the last `CHANGELOG.md` touch (named by sha), or on `docs/ADOPTION_STATE.json` not updated this session. Every invocation writes `.claude/night/stop-gate-<session>.json` (checks, decision, reason, which config copy). Fails closed: an internal error is a refusal. After `maxStopBlocks` blocks in one session it lets the session end and says so, so a defect the agent cannot fix does not burn the night |
| called by the Stop hook and the runner    | `check-direction.mjs` | `node .claude/hooks/check-direction.mjs --base main` by hand                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Tree against base: `.claude/` identical; no baseline number risen, no metric vanished; no coverage threshold fallen, no `autoUpdate`; `--max-warnings=0` kept; strict `tsconfig` flags kept; no rule switched off, no `ignores` entry added; no `failure: ignore` added in CI; gate, pre-push hook, baseline present. A rule, an ignore, a flag or a CI file loosened is **recorded instead of refused** when the decisions file names it (FLOW.3's written reason, made mechanical); a floor, a threshold, `--max-warnings=0` and the harness are refused regardless                                                                                                                                                                                                           |
| `SessionStart`                            | `session-brief.mjs`   | Prints the gate commands                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Prints the state file, the phase being run, the branch, the hour the run ends and the decisions taken so far, so a fresh session starts oriented                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `PostToolUse` on `Edit\|Write` (optional) | `lint-on-edit.mjs`    | Off                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Lints the edited file with `--max-warnings=0` and returns the output as `additionalContext`, so a violation is seen at the edit rather than at the stop                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

The Stop hook is the load-bearing one. Exit code 2 blocks the stop regardless of JSON, and the
stderr text becomes the reason the agent reads, so the reason is the gate's own output. The
blocks counter is per session id, so a new phase session starts at zero, and its cap (6) sits
under the agent's own limit of 8 consecutive Stop-hook blocks, after which the turn is
force-ended - the hook decides to let go before the harness does, and says why.

### 3.1 The harness is read-only to the worker

The worker is the actor these hooks constrain, and until 2026-09-14 it could rewrite them: the
Stop gate ran `commands.gate` from the working-tree `adoption.json`, the guard watched Bash
only, and an Edit to `adoption.json`, to `stop-gate.mjs` or to the block counter was
unguarded. A model that "fixes" a red gate by pointing the command at `echo ok`, or raises a
baseline number, got a green stop - contained to the branch, invisible until the morning read
it. That is the one way a night could succeed while lying, and it is the failure mode agents
are known for: gaming the metric. Three layers close it, each proven by the self-test and by a
stub night that tampers (`STUB_TAMPER=1`): no write reaches `.claude/` from any tool; the
Stop gate reads its config from the base branch; the runner refuses to continue or to push
when `.claude/` differs from the base. The direction check extends the same principle from
the harness to every switch the phases flip: a floor, a threshold, a rule, an ignore, a flag,
a CI step can only move the way the standard moves, or with a decision naming it.

The guard denies a daytime push to the base branch only when the root config says the repo
is PR-only (`directPushToBase: false`), and it reads the push for what it targets: a
redirection behind it does not hide the branch, and the forge's API moving the base's ref or
merging into it is the same act by another door. Force push and `--no-verify` are denied
everywhere; at night every push goes to the adoption branch or nowhere, and no pull request is
merged: landing one is the morning's act, after reading the branch.

### 5.1 The layer outside the agent

Everything above is a `PreToolUse` hook, which means it holds in one tool's shell and nowhere
else. The same force push goes through from a second terminal, a script, a CI step or another
assistant, which makes the refusal a property of that tool rather than of the repository.

`init` therefore also writes `.claude/bin/`: a `git` that a shell finds before the real one,
refusing exactly the two things the guard always denies. It reads argv rather than a command
string, so a quoted flag, a shell variable and an alias arrive already expanded - the one thing
a hook reading a command line cannot see. Everything else is handed straight through with its
exit code, its signals and its stdio unchanged, because a layer that alters ordinary work is one
people take back out, and an uninstalled layer refuses nothing. `ABATTY_SHIM=off` is the
deliberate way past it and says so on stderr: a silent escape hatch is indistinguishable from a
broken one.

The runner puts that directory on the night's `PATH`, so every subprocess a session starts meets
the same refusal. A container sandbox keeps the image's `PATH`, which is why `PATH` is the one
variable the runner does not forward by name.

---

## 4. The decision table

Every question the agent would have asked during the three real programmes, answered in
advance. It lives in `CLAUDE.md` §9 and the skill reads it.

| Situation                                                                                                                       | Default, taken without asking                                                                                                                                                                                                         | Recorded as                                           |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| A ratchet number must rise to land a step                                                                                       | Refuse the step. Split differently. Never raise a floor at night                                                                                                                                                                      | -                                                     |
| A file must be split and the seam is unclear                                                                                    | Split by what a piece is FOR (the section comments, the prop doc, the conditional branch); never by line count. If no seam is visible, leave the file, record it                                                                      | `decision: seam-unclear`                              |
| A test would be needed on a presentational component to move coverage                                                           | Do not write it; the standard exempts them                                                                                                                                                                                            | `decision: presentational-skipped`                    |
| A refactor changes behaviour the tests do not cover                                                                             | Stop that refactor, restore the original, record it                                                                                                                                                                                   | `decision: behaviour-risk`                            |
| A migration is involved                                                                                                         | Never edit an applied one; write the next number after checking `origin/main`; never run one against a non-local database                                                                                                             | -                                                     |
| A lint rule would be switched on with pre-existing violations                                                                   | Generate the exemption from the baseline's `debt`, switch the rule on, never hand-list files                                                                                                                                          | -                                                     |
| A doc is behind the code it cites                                                                                               | Re-read the section against the code and fix it; bump the date only after reading. If the doc is too large to read in the step, leave it stale and record it                                                                          | `decision: doc-left-stale`                            |
| A phase's exit criterion cannot be met (a product decision, a trap with no route)                                               | Mark the phase `blocked` with the reason, move to the next                                                                                                                                                                            | `state: blocked`                                      |
| Coverage needs a scope decision (target vs exemption)                                                                           | Take the exemption the standard already grants, record the alternative                                                                                                                                                                | `decision: coverage-scope`                            |
| A dependency would be added or upgraded                                                                                         | Do not, at night. Record the need                                                                                                                                                                                                     | `decision: dependency-deferred`                       |
| A lint rule must be switched off or scoped, a path added to `ignores`, a strict flag relaxed, a CI step made non-blocking       | Only with a bullet in the decisions file that names the rule, path, flag or file and the reason; the Stop gate refuses the loosening otherwise. A baseline number, a coverage floor and `--max-warnings=0` are never relaxed at night | the bullet, naming it                                 |
| The harness (`.claude/`, `adoption.json`, a hook) needs a change - phase 0 repointing the gate included                         | Not at night: `.claude/` is read-only and the Stop gate reads `adoption.json` from the base branch. Record the exact edit; the morning applies it                                                                                     | `decision: harness-change` / `decision: gate-repoint` |
| Something looks like a secret or PII                                                                                            | Do not read it, do not move it, record the path                                                                                                                                                                                       | `decision: sensitive-path`                            |
| The gate is red for a reason outside the change (Docker down, network)                                                          | Use `gate:fast`, record the deferral; never `--no-verify`                                                                                                                                                                             | `decision: gate-deferred`                             |
| The auto-mode classifier denies an action for an infrastructure reason (an unnamed host, bucket or remote), not a policy reason | Do not retry it and do not work around it; record the exact action so the morning adds the entry to `autoMode.environment`                                                                                                            | `decision: environment-gap`                           |
| An MCP tool would help (a connector, a code server `adoption.json` → `mcpServers` does not name)                                | It does not exist at night (`--strict-mcp-config`) or the hook denies it; do not look for another route; record the tool and what it was for                                                                                          | `decision: environment-gap`                           |
| Time or budget is nearly out mid-step                                                                                           | Finish or revert to the last commit; never leave a half-step                                                                                                                                                                          | -                                                     |

---

## 5. The skill: `/adopt-standards`

[`templates/skills/adopt-standards/SKILL.md`](../../templates/skills/adopt-standards/SKILL.md).
One invocation is one phase (`--phase N`) or the wrap-up (`--wrap-up`). The steps, which the
skill spells out in the imperative:

1. Read `.claude/adoption.json`, `docs/ADOPTION_STATE.json`, the standard's `ADOPTION_PLAN.md` §B
   for the phase, and the repository's `STANDARDS_PROGRESS.md`. Confirm the branch matches
   `ADOPTION_BRANCH`; refuse to work on `main`.
2. Measure before: run the ratchet, write the numbers into the state file.
3. Work in steps of at most ten files. After each step: lint the touched files, run the tests
   that cover them, commit with a Conventional Commit message and a `CHANGELOG.md` line.
4. Before the phase commit: spawn `standards-reviewer` with the branch diff; fix every finding
   it marks `must`; re-run the gate.
5. Flip the switch the phase defines (rule to error, metric to HARD, CI step blocking).
   **Mutation-test it**: reintroduce one violation, run the gate, confirm red, restore.
6. Write the numbers before and after, dated, to `STANDARDS_PROGRESS.md`; update the state
   file; commit `chore(standards): phase N - <what closed>`.
7. Wrap-up (`--wrap-up`): version bump, changelog release section, `docs/ADOPTION_REPORT_<date>.md`
   (numbers, decisions, blocked phases, what to review first), push the branch.

Never in the skill: push to `main`, merge, open a PR (the morning does that after reading the
report), lower a threshold, disable a rule, bump a doc date without reading, install a
dependency.

---

### 5.1 Third-party skills the run may lean on

`mattpocock/skills` (MIT; `agent plugin install mattpocock-skills@agent-plugins-official` at
user scope - it is in the official marketplace, installs all 25 skills for about 1.6k
always-on tokens, and a plugin cannot be installed by the skill - then
`/mattpocock-skills:setup-matt-pocock-skills` once per repository, by day, since it asks) is
the "how the agent thinks" layer under this protocol. It carries no gate, hook or metric, so
it changes no row of `ENFORCEMENT_MAP.md`; it makes the agent's work land inside the gate more
often. Its skills are addressed by their namespaced name (`mattpocock-skills:code-review`): the
bare `code-review` also names the official plugin's and the built-in skill. Its own
composition rule - a user-invoked skill may call model-invoked ones, never another
user-invoked one - fits: `/adopt-standards` calls `codebase-design` (the seam of a split, the
deletion test), `tdd` (a new guard red before green), `code-review` (a second reader with a
Standards axis pointed at the engineering standard and a Spec axis at the phase's exit
criterion, called with its fixed point and spec given so it has nothing to ask; skipped with a
decision when `docs/agents/issue-tracker.md` is absent) and, by day, `writing-for-agents` (the
`CLAUDE.md` to `.claude/rules/` split), `research` (the next best-practices pass),
`resolving-merge-conflicts` (the morning merge), `diagnosing-bugs` (a blocked phase), `wizard`
(a human-only runbook step), `improve-codebase-architecture` (the morning after a
`seam-unclear` night). Two of its disciplines are folded into ours rather than called: the
reviewer's item 12 is its Fowler smell baseline, as `should` findings the repository's rules
override; the skill's §4 completion criterion (one command, run red then green, deterministic,
fast, agent-runnable) is `diagnosing-bugs`' "tight loop" applied to the switch. Its
tracker-bound orchestrators (`/implement`, `/to-spec`, `/triage`, `/wayfinder`) are not part of
the run.

## 6. The agents

[`standards-reviewer.md`](../../templates/harness/agents/standards-reviewer.md) - read-only tools
(`Read`, `Grep`, `Glob`, `Bash(git diff *)`, `Bash(git log *)`). Given the diff range, it
returns findings with `file:line`, severity `must | should`, and the standard rule ID. Its
checklist is the standard's: behaviour preserved in a refactor (every key, class, attribute and
`s.*` string identical before and after), gate green, JSDoc says why, no literal user text, no
`eslint-disable` without a reason, tests exist and would fail if the guard were removed,
changelog line present, no em-dash, no date bumped without a read, no relocation dressed as a
fix - and, as `should` only, the twelve Fowler smells in the new shape, where a documented rule
overrides the smell. "No findings" is allowed only after it lists what it checked.

[`standards-adopter.md`](../../templates/harness/agents/standards-adopter.md) - the worker persona
for interactive daytime use (`Use the standards-adopter agent to run phase 8 on
src/components`), with `memory: project`. The night runner does not need it: the `-p` session
is the worker and the skill is the protocol.

---

## 7. The runner

`abatty night`, one implementation in Node for Windows and POSIX (`src/night/` of the
package; the two shell runners of the first week are gone, and every bug they had - a BOM, a
locale's decimal comma, a shell rewriting the `/adopt-standards` prompt into a path, a crash
counted as a session - cannot recur, because the runner reads and writes JSON and calls the
agent's executable directly):

```
npx abatty night . --until 07:00 --max-cost 80 --phases "0 1 2 3 4 7 8 11"
npx abatty night . --canary-only                       # the pre-flight on the current branch, then stop
ABATTY_AGENT=<path>/stub-agent.sh npx abatty night . --until +10min --max-cost 10 --no-push   # a dry night with the stub
```

The agent's executable comes from `--agent`, else `ABATTY_AGENT`, else `agent.command` in
`~/.abatty/config.json`; never from the repository. `--mode auto|dontAsk`, `--model`,
`--effort` are the session flags; `--skip-canary` for a repository the canary passed on today.

1. Refuses a dirty tree (and lists it). Fetches. Creates or reuses `adopt/standards-<date>`
   from the LOCAL base branch when it exists (it is what carries a harness committed but not
   pushed yet), else from `origin/<base>`. Checks the harness files are on that branch, runs
   `hooks/self-test.mjs` there, and checks `.claude/` is identical to the base; red means no
   night.
2. **Pre-flight.** Runs the gate once on the branch as it starts (a red gate now is not the
   phase's doing and would read as a blocked phase in the morning). Then the **canary**: a real
   `the agent's headless mode` under the night flags, two dollars, asked to run `git rev-parse --short HEAD`,
   to attempt `git commit --allow-empty --no-verify -m canary`, and to answer with the hash
   followed by the names of its own `mcp__` tools (or `none`). The runner checks the answer
   starts with the hash (a command ran through auto mode without a prompt), the commit did not
   land and the guard logged the refusal (the PreToolUse hook fires in `-p`), the Stop hook's
   receipt exists with `decision: allow` and `configSource: base` (the Stop hook fires and
   reads the base), and the MCP servers the session reports are exactly the ones
   `.claude/mcp.night.json` declares (`--strict-mcp-config` took; a declared server started).
   `--canary-only` runs the pre-flight on the current branch and stops; `--skip-canary` skips
   it for a repository it passed on today.
3. Writes `docs/ADOPTION_STATE.json` if absent (every phase `pending`), without a BOM, reads
   it back the way the hooks will (`phases` a non-empty array), and commits it.
4. Loop while the hour and the budget allow: `.claude/` still identical to the base → next
   `pending` or `in_progress` phase → one `the agent's headless mode "/adopt-standards --phase N"` session
   with the night flags (`--strict-mcp-config` on `.claude/mcp.night.json` among them: a
   session has no MCP server the repository did not declare, whatever the user settings carry)
   and env (`ADOPTION_RUN`, `ADOPTION_BRANCH`, `ADOPTION_BASE`,
   `ADOPTION_PHASE`, `ADOPTION_UNTIL`) → parse the JSON result (cost, error, denials) → a
   session that made no commit and recorded no decision is named a **no-op session** → re-read
   the state; a phase still not `done` after two sessions is marked `blocked` with that reason
   (and the no-op count).
5. Final session `--wrap-up`. Then `check-direction.mjs` against the base: the branch is
   pushed (`git push -u origin <branch>`, unless `-NoPush`) only if `.claude/` is identical
   to the base and nothing was loosened without a decision naming it; otherwise it stays local
   and the summary says why. Transcript, receipts and summary in `.claude/night/`.

Four things end the night early, each with a named reason, and none of them marks a phase:
a CLI that exits non-zero without a result twice in a row (a bad flag, no login, a crash on
start - not a session, so not counted as one); one session reporting 15 or more permission
denials (auto mode did not take in `-p`, and the run would "succeed" doing nothing); `.claude/`
found different from the base between sessions (a session reached the Stop cap with the
harness edited; the next would be judged by its edit); a state file the runner itself cannot
read back.

Auto mode in a `-p` run never falls back to a prompt: repeated classifier blocks leave the
action unrun and the agent continues. The Stop hook is what turns "continued past a block" into a
red gate rather than a silent gap.

**Proven, and how.** The hooks are proven by `self-test.mjs` (seventy-one guard decisions in
both modes, twenty-three file-guard decisions, twenty-four direction cases and the stop-gate's
own, mutation-tested twelve ways; the count and the mutations are in the
[templates README](../../templates/harness/README.md)). The runner loop is proven with [`templates/harness/testing/stub-agent.mjs`](../../templates/harness/testing/stub-agent.mjs)
standing in for `the agent's headless mode`: on a real repository the real Stop hook ran the real repository
gate, blocked on the dirty tree, let go after the commit, and both runners finished with a
`done` phase, a wrap-up and a clean tree; on 2026-09-14 both runners ran every abort path on a
synthetic repository (a tampering session, the three canary failures, two crashes, twenty
denials, a red gate at the start), each ending with its named reason and the branch local. The
procedure and the defects that only this run could find are in the
[templates README](../../templates/harness/README.md#a-dry-night-with-the-stub-before-a-paid-one).
What the stub cannot prove - that a real `the agent's headless mode` under these flags runs a command without
a prompt and fires both hooks - is what the canary proves, and `-CanaryOnly` is the first thing
to run on a repository. It ran for real on `paycore_dms` on 2026-09-14 (3 turns, 24 s,
0.41 USD): the command ran with no prompt, the guard refused `--no-verify` and the refusal was
counted in `permission_denials`, the Stop hook ran the real gate and left its receipt reading
the base copy (`ADOPTION_STATUS.md`). The first paid night after it should still be short
(`-Until` twenty minutes away, `-MaxCostUsd 10`, one phase, `-NoPush`) and read in full before
a long one.

To run it while you sleep without starting it by hand, a Windows Task Scheduler entry at
22:00 calling the script is enough; the cloud `schedule` routines are not the right vehicle
here because the gate needs the local Docker Postgres.

---

## 8. Morning

Read, in this order: `docs/ADOPTION_REPORT_<date>.md`, `docs/ADOPTION_DECISIONS.md`, the
blocked phases in `docs/ADOPTION_STATE.json`, then `git log --oneline main..adopt/standards-<date>`.
Run the full gate once yourself (`npm run gate`, with Docker). Then merge, or open the PR, or
send the branch back for another night with the decisions taken. Nothing the run did is on
`main` until you do that.

## 9. The threat model, published rather than implied

A sandbox nobody can describe is a claim. This section says what the boundary holds, what it does
not, and what is left to the layers above and below it, so a reader can decide whether it is
enough for their repository rather than trusting the word "sandbox".

### 9.1 What is being defended against

Three things, in the order they are likely:

1. **The model doing something wrong by accident.** A command that was right for another
   repository, a path that resolved somewhere unexpected, a script with an argument in the wrong
   place. This is the common case and the cheapest to contain.
2. **The repository telling the model to do something wrong.** Text in a file an agent reads is an
   instruction in exactly the way a prompt is, and a repository is a place other people can write:
   a dependency's README, a generated file, a pull request's description pulled into the tree. The
   pre-flight scans for this and refuses the night rather than filtering it.
3. **A command reaching outside the work.** Whatever the command was called, in whatever shell,
   through whatever script: the guard is a text match and text matching is defeated by a rename.

### 9.2 What the boundary is

Per night, built before the first session and then proven:

| Region                                         | Access     | Why                                                        |
| ---------------------------------------------- | ---------- | ---------------------------------------------------------- |
| The repository tree                            | read-write | It is the work.                                            |
| `.claude/` and the root config                 | read-only  | The harness may not rewrite the rules it runs under.       |
| The protected paths the config names           | read-only  | What the repository says is not the agent's to change.     |
| `.claude/night/` (denials, receipts, counters) | read-write | The record of the night has to be writable to be a record. |
| The agent's own folder in the home directory   | read-write | Its session state.                                         |
| Everything else on the machine                 | no write   | Outside the work.                                          |

Drivers: `bwrap` on Linux, `sandbox-exec` on macOS, a container where an image is named. `auto`
takes what the machine has and says loudly when it finds nothing; `required` refuses the night
without one; `off` is a deliberate statement, recorded as such.

### 9.3 How the boundary is proven

A Node process inside it tries, and the night refuses unless every answer is the expected one:
write into the tree (must succeed), write into the night's log folder (must succeed), write beside
the runtime outside the work (must fail), write into each read-only path (must fail). A read-only
file is opened for append and closed, which changes nothing when it is refused and proves the hole
when it is not.

**A sandbox that is present but does not hold refuses the night**, because a night that claims a
boundary it lacks is worse than one that says it has none.

### 9.4 What it does not contain

Stated plainly, because these are the reasons to decide it is not enough:

- **The network.** The agent reaches whatever the machine reaches. A model that can read the tree
  and make a request can move the tree's content off the machine, and no filesystem boundary
  stops it. Run the night on a machine whose egress you are willing to give it.
- **Credentials the environment already holds.** A token in the environment, a configured
  credential helper, an ssh agent: inside the boundary, all of it is in scope.
- **What the gate allows.** The gate is the stop, and a change that passes every check is a change
  the night may push. The boundary is about reach, not about judgement.
- **The model's own behaviour.** Nothing here makes the model correct. It makes the consequences
  of it being wrong recoverable and visible.
- **A driver that is absent.** In `auto` with no driver on the machine, there is no OS boundary at
  all: the guard's text matching is what remains, and the night says so in its first lines rather
  than implying more.

### 9.5 What is left to the layers around it

- **Above:** the guard (a dangerous command refused before it runs), the Stop gate (done only when
  the gate says so), the pre-flight's trust scan, and the controls, which must have been watched
  going red before a night starts at all.
- **Below:** the machine. Run a night on a machine you would be willing to hand to the repository
  it is working on, because for the length of the night that is what you have done.
