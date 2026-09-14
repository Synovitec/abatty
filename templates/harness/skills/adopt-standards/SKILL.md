---
name: adopt-standards
description: Run one phase of the engineering-standard adoption programme on this repository, unattended-safe. Use with `--phase N` for a phase of ADOPTION_PLAN.md §B, or `--wrap-up` to close a run (version bump, changelog release section, report, push). Works only on an adopt/standards-* branch. Never asks a question in an unattended run - takes the default from CLAUDE.md §9 and records it.
---

# Adopt the standard: one phase per invocation

You are executing the transformation programme in `ADOPTION_PLAN.md` §B (path in
`.claude/adoption.json` → `plan`) against this repository. One invocation is ONE phase, or the
wrap-up. Arguments: `--phase N` or `--wrap-up`. With no argument, take the first phase whose
status is `pending` or `in_progress` in the state file.

If `ADOPTION_RUN=1` is set, nobody is watching and nobody will answer: never call
`AskUserQuestion`, never wait, never stop early to "check with the user". Decide from the
table in `CLAUDE.md` §9, write the decision to the decisions file, continue.

## 0. Orientation (every invocation)

1. Read `.claude/adoption.json`. It names the commands, the files, the standard and the plan.
2. Read the state file (`files.state`). If it does not exist, create it:
   ```json
   { "startedAt": "<ISO>", "baseBranch": "main", "phases": [ { "id": 0, "status": "pending" }, ... ] }
   ```
   one entry per phase in `adoption.json` → `phases`.
3. Read the plan's §B for the phase (exit criterion, traps) and the standard's rules it cites.
4. Read `docs/STANDARDS_PROGRESS.md` (or create it from the standard's template: scoreboard,
   phase table, log) and the decisions file (create with a heading if missing).
5. `git rev-parse --abbrev-ref HEAD` must equal `ADOPTION_BRANCH` when it is set, and must
   start with `branchPrefix` otherwise. On `main`: stop and say so. Never work on `main`.
6. **A dirty tree at the start is the previous session's unfinished step** (the budget or
   the hour cut it). Read `git status` and `git diff`: if the gate passes with it, commit it
   as that step with a changelog line; if not, `git stash` it under a message naming the
   phase and record `decision: step-restored` - never build on top of it unexamined.
7. **Phase 0 only:** the ratchet and the gate do not exist yet, so `commands.gate` in
   `adoption.json` must name the commands the repository has TODAY (typecheck, lint, unit
   tests) - a human sets that before the night. The harness (`.claude/`) is read-only in an
   unattended run and the Stop gate reads `adoption.json` from the base branch, so the last
   step of phase 0 is a bullet `decision: gate-repoint` in the decisions file naming the new
   command (`npm run gate:fast`); the morning edits `adoption.json`. Run the new gate
   yourself in the meantime, and CI runs it on the push.
8. Set the phase to `in_progress` with `updatedAt` now and commit the state file
   (`chore(standards): start phase N`).

## 1. Measure before

Run `commands.standards` (and `commands.typecheck`, and the coverage command if the phase is
2 or 10). Write the relevant numbers into `phases[N].numbersBefore`. If the ratchet script
does not exist yet (phase 0 is what creates it), record `"none"`.

## 2. Work in steps

A step touches at most ten files and ends in a commit. For every step:

- Do the work the phase describes. Split by what a piece is FOR, never by line count: when
  the `mattpocock-skills:codebase-design` skill is available, apply it to find the seam - a
  deep module behind a small interface, the deletion test ("if the complexity reappears
  across N callers it earned its keep"), a seam only where two adapters exist. Keep behaviour
  identical in a refactor: every key, class, attribute, string and export the same before and
  after, and say in the commit how you checked. A new guard or probe is written test-first
  (`mattpocock-skills:tdd` when available): red, then green, at a pre-agreed seam. A
  third-party skill that would ask a question is answered from CLAUDE.md §9 or skipped with
  a decision; it never waits.
- **The same change in more than ten files is a codemod** (CODE-11), not ten steps: write
  `scripts/codemods/<what-it-does>.cjs` (`mattpocock-skills:tdd` applies to it too - a fixture
  in, the expected source out), dry-run it, say the count in the commit message, apply it in
  one commit that touches nothing else, format. Hand-editing the same shape file after file is
  what the reviewer's item 13 names.
- Run `commands.lintFile` on each touched file and the tests that cover them.
- Commit: Conventional Commit, one behaviour, message written for the reader, no em-dash, no
  trailer. Add a line under `## [Unreleased]` in the changelog in the same commit when the
  step touches source, tests, scripts, CI or docs.
- If a step cannot land without a ratchet number rising: do not raise it. Undo the step,
  record `decision: seam-unclear` or `decision: behaviour-risk`, choose another step.
- **Nothing is loosened silently.** The Stop gate compares the tree with the base branch and
  refuses a baseline number that rose, a coverage threshold that fell, `--max-warnings=0`
  dropped, a strict flag turned off, a rule switched off, a path added to `ignores`, a CI step
  made non-blocking, a hook or gate file deleted. The first three are never allowed at night.
  The others are allowed exactly as FLOW-3 says - with a written reason: a bullet in the
  decisions file that names the rule, the path or the flag (`no-await-in-loop` switched off
  under `server/`, ordered DDL). Write the bullet in the same step as the change, or the
  stop is refused until you do.
- **The harness is not yours tonight.** Nothing under `.claude/` is edited, from any tool;
  a hook, a setting or `adoption.json` that needs a change is a bullet
  `decision: harness-change` with the exact edit, applied by the morning. If the direction
  check names `.claude/` (a formatter touched it), restore it:
  `git checkout <base> -- .claude/` and commit.

Traps the plan names for the phase are not optional reading; re-read them before the first
step of that phase.

## 3. Self-review before the phase commit

Spawn the `standards-reviewer` agent with:
`Review git diff <merge-base main HEAD>..HEAD for phase N. Return findings only.`
When `mattpocock-skills:code-review` is available AND `docs/agents/issue-tracker.md` exists
(`/setup-matt-pocock-skills` writes it by day; without it the skill stops to ask, so skip it
and record `decision: second-reader-skipped`), run it too, with everything it would otherwise
ask for given in the call: the fixed point `$(git merge-base <base> HEAD)`, the Standards
source set to the engineering standard, the Spec set to the phase's exit criterion in the
plan. Its two axes run in parallel and are never merged, which is a second reader our reviewer
does not replace. Fix every `must` finding, consider every `should`, re-run the gate
(`commands.gate`). Do not argue with a `must`; if it is wrong, say why in the decisions file
and fix it anyway if the fix is cheap.

## 4. Flip the switch and prove it

The phase is done only when its exit criterion in the plan is met AND its enforcement is on:
the eslint rule at `error`, the metric promoted to HARD, the CI step made blocking, the
threshold pinned. Then **mutation-test it**: reintroduce one violation on a scratch file, run
the gate, confirm it is red, restore, run again, confirm green. The completion criterion is
one command you can name (the gate, or the one check inside it) that you have already run
twice - once red on the reintroduced violation, once green after the restore - and that is
deterministic (the same verdict every run), fast (seconds, not the full suite when one check
suffices) and agent-runnable (no human in the loop). Write that command and its two results in
the progress log entry. A switch nobody watched fail is not flipped, and "the gate is on" with
no red run behind it is not a result.

## 5. Close the phase

1. Measure after; write `numbersAfter`.
2. Add a dated entry at the top of the progress log: numbers before → after, what moved, what
   was caught, what was deliberately left. Numbers only; never "improved".
3. State file: `status: done` (or `blocked` with `reason` when the exit criterion cannot be
   met for a reason in the decision table), `updatedAt` now.
4. Commit `chore(standards): phase N - <what closed>`.

If the run's end time (`ADOPTION_UNTIL`) is within 20 minutes, finish the current step or
revert it, close the phase as `in_progress` with `numbersAfter` so far, commit, and stop.

## 6. Wrap-up (`--wrap-up`)

1. Gate must be green on the branch (`commands.gateFull` if Docker is up, else `commands.gate`
   and record the deferral).
2. Version: bump `files.version` - minor if any phase reached `done` in this run, patch
   otherwise. Move `[Unreleased]` into `## [x.y.z] - YYYY-MM-DD`.
3. Run `npx abatty measure --quiet` so `docs/GAP_ANALYSIS_<date>.md` is fresh, and cite its
   score. A rule the repository set aside is in `adoption.json` → `rules.waived` with its
   reason; never add one there yourself (record `gate-deferred` instead).
4. Write `docs/ADOPTION_REPORT_<date>.md` with front matter: the scoreboard before/after, the
   gap-analysis score before and after the run, each phase's status and reason, every decision
   taken, what to review first in the morning, the commits (`git log --oneline main..HEAD`).
5. Register every document you created under `docs/` (the report, the gap analysis, the state
   and decisions files if new) in the repository's docs index in the SAME commit - DOC-3, and
   a ratchet that counts documents missing from the index turns the wrap-up red otherwise.
   Find the index by reading how `docs/README.md`, `docs/INDEX.md` or `SOMMAIRE.md` lists its
   neighbours, and follow that format; if the repository has no index, say so in the report.
6. Commit `chore(standards): wrap up run <date>`; `git push -u origin <branch>`.

## Never

Push to `main`. Merge. Open a PR (the morning does that after reading the report). Lower a
threshold. Add an `eslint-disable` to pass a limit. Raise a baseline number. Switch a rule
off or widen `ignores` without a decision naming it. Edit anything under `.claude/`. Bump a
doc's `last_verified` without reading it against the code. Install or upgrade a dependency.
Edit an applied migration. Read or move an `.env` file. Rewrite a historical number in the
log.
