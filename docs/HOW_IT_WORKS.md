---
title: "How abatty works"
description: "What init writes, the gate and its order, the exit codes, the ratchet and how a floor may move, and how every guard is proven able to fail. The reference the README's front page links to."
category: guide
status: living
audience: ["developer", "architect", "reviewer"]
tags: ["gate", "ratchet", "controls", "exit-codes"]
related: ["../README.md", "./COMMANDS.md", "./EXTENDING.md"]
source_truth: ["../src/core/gate.mjs", "../src/ratchet/index.mjs", "../src/core/step-controls.mjs"]
last_verified: "2026-10-04"
---

# How abatty works

## What `init` writes

`init` writes the gate, the git hooks that run it, the ratchet and a CI workflow from the same gate
definition, about ten files on the default **minimal** profile, then lists what is left by hand in
order (the installs, the hooks, today's numbers as the ratchet's floor).

- `--apply` takes the steps a machine safely can and leaves only the ones that need you.
- `--agent <id>` adds the harness that holds a coding agent to the gate.
- `--profile synovitec` adds the full standard, its documents and a changelog line per commit.
- `--stack` names a stack instead of detecting one; `--stage design` is for a repository that has
  no application yet.

## The gate

One definition drives the local command, the git hook and CI, so they cannot disagree about which
steps exist. `gate` is one implementation with three callers: the command, the pre-push hook, and
the unattended run's stop check. It refuses the work rather than describing it.

Steps run in a fixed order and stop at the first failure: format, lint, typecheck, import graph,
dead code, tests, the coverage of the changed lines (a `coverage:changed` or `test:changed`
script, told the range in `ABATTY_RANGE`), the ratchet with the changelog over the pushed range,
the secret scan, the dependency audit.

Heavy suites are selected by path, so a change that touches no database code does not wait for the
database suite, and a push that only changes comments builds nothing. A step whose script the
repository does not have yet is reported as skipped rather than passed, and the verdict leads with
how many steps did not run. Steps the preset requires cannot be skipped: without them the gate
reports that it could not run. On GitHub Actions the gate also writes its verdict and each step to
the run's summary page.

The changelog entry a source change carries can be a line under `## [Unreleased]`, or, where
parallel branches keep colliding on that one hunk, a fragment: set `files.changelogFragments` to a
folder (`changes/unreleased`) and each change adds its own `<slug>.<added|changed|fixed|...>.md`
there, which the commit hook, the gate and the Stop hook accept as the entry.
`abatty changelog --release <version>` folds `[Unreleased]` and every fragment into the dated
section and removes the fragments.

A suite that needs a database never runs against one the run did not create. With
`TEST_DATABASE_URL` set, the suite, and every other step with it, runs with `DATABASE_URL` pointed
at it; in CI the pipeline's own service is trusted. An ambient `DATABASE_URL`, from the shell or
declared in a `.env` file (read for the name only), defers the suite to CI and says how to give it
a database of its own. The rest of what the server under test needs is named before the suite
starts: a variable the example env file declares that neither the shell, a dotenv file nor the
config supplies is listed, and `suiteEnv` in the config gives the suites non-secret values, as a
pipeline's workflow does.

## Exit codes

| Code | Meaning                                      |
| ---- | -------------------------------------------- |
| 0    | Clean                                        |
| 2    | Invalid input, flags or configuration        |
| 3    | Ran correctly and found violations           |
| 4    | Internal error, or a step that could not run |
| 130  | Interrupted                                  |

Three is the one that matters. A gate that found something did not fail; it worked. Four says the
instrument broke, which is a different problem from bad work. `abatty night` reads the same table:
2 it cannot start as configured (no agent), 3 its pre-flight found the repository unfit for a night
(a dirty tree, a red gate, a step that stayed green on its control), 4 the canary or the run itself
aborted.

## The ratchet

`abatty ratchet` measures the mechanical rules a linter cannot state, and refuses any number that
moves the wrong way. `abatty baseline` records today's numbers as the floor.

Metrics come in two kinds. **Hard** must be zero now and forever. **Ratchet** holds today's number
and may only fall, both in total and per file, so debt cannot relocate: a file may improve and
never worsen, and a file absent from the list carries none. A first baseline holds a hard metric
already above zero as a ratchet until it reaches zero, so adopting never starts red.

A metric at zero is promoted to hard. A floor that rises is refused without a reason and an owner,
both recorded against the metric rather than against the write, so one metric's explanation
survives an unrelated rebaseline and disappears when the debt it explained does. A file's floor is
a floor too: one that rises is refused and recorded the same way even when the metric's total
fell, so a fall in one file cannot hide a rise in another. A file git sees as renamed since the
baseline was committed keeps its floor at the new path, so a `git mv` moves no debt. A probe that
scans zero files where the baseline saw some fails the run, so a moved directory never reports
green forever.

A floor left above today's count fails the run too, since it is slack the gate would keep
accepting. When that is the only failure, a run outside CI writes the lowered floor itself and asks
for the baseline to be committed with the change: lowering a floor takes no command and no reason,
and leaving findings in is no longer the easier path. CI never writes; it judges what was pushed.

The owner is a name the raiser typed, and an agent can type one as easily as a person can. So a
raise lands only through a pull request approved at its head by somebody other than its author.
`abatty raises --require-review <number>` reads that review in the pipeline that `abatty ci`
generates. A repository that pushes to its base directly by policy has no pull request to approve,
so there a raise needs a line the pushed range adds to the decisions file naming the metric, and
the command says that is a record, not a second person's approval. It counts as a rise anything
else that loosens a floor: a floor that vanished, a hard metric demoted, a file whose debt grew
while the total held, or the same done through the config (a metric excluded, a path exempted, a
probe switched off, a cap or a budget raised).

A raise whose reason is the probe being wrong is written `--reason "false-positive: <what it
misread>"`, and `abatty report` counts those per probe. That count decides which probe is fixed,
and which stays on probation. It is worth an issue with the case.

When a probe's definition changes, `abatty update` rewrites its floor under the new definition,
measured over the push range: a redefinition, not a raise.

**On a rebase, never merge the baseline by hand.** When `scripts/ci/standards-baseline.json` or
`abatty.config.json` conflicts, take the base branch's copy of both, then run `abatty update` and
`abatty baseline` again: the floor is today's number on the rebased tree.

## Proving the guards

Every probe ships control cases in both directions: a case it must report, and a case it must not.
`abatty ratchet --controls` runs them on throwaway repositories, and the package's own test suite
runs them on every push, so a probe without a failing control case cannot be added.

The gate steps are proven the same way. `doctor --controls` plants a violation per step, runs the
step, removes the file whatever happened, and marks a step that stayed green as absent; `prove`
does the same on a copy of the repository and writes nothing. The plant goes where the step's
script looks: its glob, the runner config or wrapper it hands over, or, behind a task runner
(`turbo run test`), the first workspace that runs the task. Where a script cannot be followed,
`controls` in the config names the folder (`"test:integration": "apps/web/tests/integration"`).
What each run printed is kept, the planted run's and the clean one's, so a verdict can be read
back. A step that is red before anything is planted proves nothing and is reported as not judged.

The agent harness has its own self-test, which drives one hundred and two guard decisions in both
modes and is itself verified by mutation.
