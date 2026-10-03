# abatty

[![npm](https://img.shields.io/npm/v/abatty.svg)](https://www.npmjs.com/package/abatty)
[![checks](https://github.com/Synovitec/abatty/actions/workflows/checks.yml/badge.svg)](https://github.com/Synovitec/abatty/actions/workflows/checks.yml)
[![node](https://img.shields.io/node/v/abatty.svg)](package.json)
[![license](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

**Find the CI checks that can't fail.**

Turn your engineering rules into enforceable controls, prevent new debt, and verify that each
control can still fail.

```console
$ npx abatty prove

  ✗ unit tests (TEST.1)  stayed GREEN on a test that throws: the check is absent
  ✓ secret scan (SEC.1)  went red on a cloud access key, green without it
  (the steps this repository has no script for, left out here)

✗ 0 of 1 of your check(s) went red on a planted violation and green again without it
  · 1 stayed green, so it does not check what its name says: unit tests (TEST.1)
```

The test script there is `node --test || true`: the tests run, and CI stays green whatever they
say. `prove` copies the repository, plants one violation per check, runs the check, and tells you
which ones never go red. Nothing is written in your repository and nothing needs setting up.

## What it is

Most repositories have a lint step, tests and a CI pipeline. Few can show that each of those checks
would stop a bad change today, or that the debt they carry is not growing. `abatty` is the policy
and enforcement layer above the tools you already use (eslint, your test runner, tsc, a scanner,
your CI): it does not replace them, it decides what a change must pass, holds the line on debt,
and checks that every guard still bites. The same rules hold whoever writes the change, a person
or a coding agent.

|             | What `abatty` does                                                                                                                                                        | Commands                     |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| **Define**  | The rules a repository follows, as data: a built-in catalog, your own rules and probes, waivers with a reason and an expiry date                                          | `rules`, `explain`           |
| **Enforce** | One gate run by the pre-push hook, by CI and by an agent's stop check, so the three cannot disagree; a ratchet that blocks new debt and never makes you fix the old first | `gate`, `ratchet`            |
| **Verify**  | Plants a violation in each gate step and probe, and reports any check that stays green as **absent**, on a copy, nothing written                                          | `prove`, `doctor --controls` |
| **Improve** | Where the repository stands, what to fix first, and floors that only ever fall                                                                                            | `status`, `measure`, `fix`   |

No runtime dependencies, Node 20 and later, Linux and Windows covered by CI on every push against
npm and pnpm. A new repository starts on the **minimal** profile: 13 rules any stack agrees to,
all 13 held by a machine. The full catalog of 80 is one team's standard (`synovitec`), a profile
you add when you want it: 48 of its rules are held by a check that fails, 7 by a ratchet, 13 by a
review and 12 are prose only, and `abatty rules` says which is which. The engine depends on
neither, and a waiver sets any rule aside with its reason on record. Profiles compose: a company
standard can be a file or an npm package that many repositories name beside the built-in ones,
each repository adding its own rules (`abatty.rules.mjs`) on top.

What a control shows is exact and narrow: the check went red on one known violation and green again
without it. That a check can fail is shown; that it catches every violation of its kind, that the
rule is the right one, or that a repository whose checks all went red is safe, is not. A check
that stayed green on its planted violation, though, is shown not to be checking what its name
says.

## Quick start

```sh
npx abatty prove             # which of your checks can fail: on a copy, nothing written, no setup
npm i -D abatty              # then install it (pnpm, yarn and bun work the same way)
npx abatty init --apply      # detect the stack, write the gate, the hooks, the ratchet and CI
npm run gate                 # the gate, which the pre-push hook also runs
npx abatty                   # where the repository stands, and what to do next
```

`init` writes about ten files on the minimal profile and ends on a first gate run: `--apply` installs
the tools it names, sets the hooks and records today's numbers as the floor, so old debt never
blocks a push and new debt always does. The package reads no credential and installs nothing you
did not ask for. [How it works](docs/HOW_IT_WORKS.md) has what each file is for, the gate's order,
the ratchet's rules and how every guard is proven.

## Already built in

Reviewers of the release candidates asked for each of these as missing. Each is one command or one
key away:

| You need                                            | Where it is                                        | What it does                                                                                                                                          |
| --------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Adopt on an existing codebase without stopping work | `abatty baseline`                                  | Records today's numbers as the floor; the ratchet refuses only a rise, so old debt never blocks a push and new debt always does                       |
| An exception with a reason and an expiry            | `rules.waived` in `abatty.config.json`             | `{ "CODE-SIZE-300": { "reason": "...", "until": "2026-12-31" } }`; an expired waiver stops applying, and `abatty rules` prints the waiver rate        |
| A dependency advisory accepted for now              | `security.audit.allow`                             | Package or advisory id, a reason and an `until` date; it stops allowing when the date passes                                                          |
| Server-side enforcement, not only a local hook      | `abatty ci`                                        | Generates the pipeline from the same gate definition, so a skipped hook meets the same steps in CI                                                    |
| Findings on the pull request                        | the generated GitHub workflow                      | Uploads SARIF, so findings appear on the changed lines; the gate writes its verdict and each step to the run's summary page                           |
| Machine-readable output                             | `--json` on `measure`, `ratchet`, `rules`, `check` | Exit codes are a contract: 0 clean, 2 bad input, 3 violations found, 4 the instrument broke                                                           |
| A dashboard over time                               | `abatty serve`, `abatty publish`                   | The readings of one or many repositories                                                                                                              |
| Coding agents held to the same rules                | `abatty mcp`, the harness hooks                    | Serves the measurement, the ratchet, the gate and the rule explanations to an MCP client; an unattended agent run cannot stop until the gate is green |
| Your own rules and metrics                          | `abatty.rules.mjs`, `abatty.probes.mjs`            | Pure functions of the repository, with control cases; a profile packages them for many repositories ([Extending](docs/EXTENDING.md))                  |
| Proof that a check can fail                         | `abatty prove`                                     | Plants a violation in each gate step of a copy of the repository and reports a step that stays green as absent; nothing written, no setup             |

Every command is in [Commands](docs/COMMANDS.md); `abatty help` lists each one's flags.

## Words used here

| Word        | Means                                                                                  |
| ----------- | -------------------------------------------------------------------------------------- |
| **gate**    | The ordered checks a change must pass, the same locally, in the hook and in CI         |
| **ratchet** | Numbers that may only fall; **floor** is today's number for a metric or a file         |
| **probe**   | One measured metric (a count of oversized files, of clones, of raw env reads)          |
| **control** | A planted violation that proves a gate step or a probe can go red                      |
| **rule**    | One requirement of the catalog, with how it is insured: hard, ratchet, review or prose |
| **harness** | The hooks and settings that hold a coding agent to the gate                            |
| **night**   | An unattended agent run on a branch, gated before it may stop                          |

## Why

Most teams already agree on how they want to build. The agreement lives in a document, and the
document loses. The file that should have been split, the test that should have gone red first,
the doc that should have moved with the code: each is a decision that quietly became a queue
nobody reads.

The usual response is another report. Reports are where good analysis goes to die. The same
finding, at the same precision, reaches a near-zero fix rate when it arrives as a report and
roughly seventy per cent when it arrives on the change under review. Placement beats precision;
the sources are in
[`docs/standard/research/07-evidence-base.md`](docs/standard/research/07-evidence-base.md).

So `abatty` is not a report. It installs a gate your repository has to pass, then plants a
violation in each step of that gate and reports any step that stays green as **absent**. A guard
nobody has watched fail is not a guard.

## Presets

A preset describes what a stack's repository looks like: its paths, scripts, gate steps, suites
and rule files. The standard says what must hold; the preset says where to find it. A preset is
real when a named repository has run it, and the tool says so plainly rather than implying
coverage it does not have.

| Preset       | Status                                     |
| ------------ | ------------------------------------------ |
| `next`       | Proven by paycore_dms, 2026-09-14          |
| `vite-react` | Proven by Paycore-Task-Manager, 2026-09-13 |
| `node`       | Proven by abatty, 2026-09-18               |
| `astro`      | Not yet proven by a repository             |
| `python`     | Not yet proven by a repository             |
| `docs`       | Not yet proven by a repository             |

Monorepos compose. Workspaces are read from the root manifest, a pnpm workspace file, or the
conventional `apps/*`, `packages/*` and `services/*` directories. Each workspace is gated with its
own preset in its own directory, while the shared steps and the ratchet run once at the root.

## What it does not claim

It does not make anybody faster, and it is not sold as though it did. What a written and enforced
standard does is amplify whatever discipline is already present. A team that agrees on how it
builds gets a reviewer who can read a diff instead of policing one. A team that has not agreed
gets the same disagreements, produced faster. The instrument enforces a decision; it does not make
one.

The reading it produces is a way to compare a repository against itself over time. It is not a
grade, not a percentage of conformity, and not a number to put in front of anybody as either.

Measurements come with their limits attached. The secret scan currently scores 100 per cent
precision and 100 per cent recall, over a corpus this repository assembled rather than a
third-party benchmark, and the page carrying the number says so. What running the tool on its own
repository produced, negative results included, is in [`docs/DOGFOOD.md`](docs/DOGFOOD.md).

## Documentation

| Document                                                                         | Contents                                                       |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| [`docs/HOW_IT_WORKS.md`](docs/HOW_IT_WORKS.md)                                   | What `init` writes, the gate, the exit codes, the ratchet      |
| [`docs/COMMANDS.md`](docs/COMMANDS.md)                                           | Every command, the output flags, the configuration file        |
| [`docs/EXTENDING.md`](docs/EXTENDING.md)                                         | Your own rules and probes, opt-in probes, probation, profiles  |
| [`docs/standard/ENGINEERING_STANDARD.md`](docs/standard/ENGINEERING_STANDARD.md) | The rules themselves, by family                                |
| [`docs/standard/ENFORCEMENT_MAP.md`](docs/standard/ENFORCEMENT_MAP.md)           | What checks, measures and refuses each rule                    |
| [`docs/standard/ADOPTION_PLAN.md`](docs/standard/ADOPTION_PLAN.md)               | Day 0 for a new repository, and the phases for an existing one |
| [`docs/standard/AUTONOMOUS_ADOPTION.md`](docs/standard/AUTONOMOUS_ADOPTION.md)   | The harness, the hooks and the unattended run                  |
| [`docs/CATALOG.md`](docs/CATALOG.md)                                             | The whole catalog as data, kept equal to the code by a test    |
| [`docs/DOGFOOD.md`](docs/DOGFOOD.md)                                             | The tool measured against its own repository                   |
| [`docs/PLAN.md`](docs/PLAN.md)                                                   | What changes next, and the evidence that put it there          |

## Development

```sh
npm test           # node:test over temporary repositories and the real self-test
npm run typecheck  # checkJs, strict, zero findings
npm run types      # the declarations under types/, generated from the JSDoc and committed
npm run gate       # the full gate
npm run standards  # this package against its own baseline
```

A change to a rule regenerates the catalog document in the same push, which the gate enforces.
Every commit that touches source, tests, scripts or docs adds a changelog entry in the same
commit, which the commit hook enforces.

## Contributing

Contributions are welcome under a Developer Certificate of Origin. See
[`CONTRIBUTING.md`](CONTRIBUTING.md) for the workflow, and [`SECURITY.md`](SECURITY.md) for
coordinated disclosure.

## License

Apache-2.0. See [`LICENSE`](LICENSE).
