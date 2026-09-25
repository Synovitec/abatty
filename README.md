# abatty

[![npm](https://img.shields.io/npm/v/abatty.svg)](https://www.npmjs.com/package/abatty)
[![checks](https://github.com/Synovitec/abatty/actions/workflows/checks.yml/badge.svg)](https://github.com/Synovitec/abatty/actions/workflows/checks.yml)
[![node](https://img.shields.io/node/v/abatty.svg)](package.json)
[![license](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

An engineering standard you install rather than circulate. `abatty` puts a gate in front of your
main branch, measures the debt behind it, and proves that every step of the gate is capable of
failing.

It has no runtime dependencies and runs on Node 20 and later. Linux and Windows are covered by CI
on every push, against both npm and pnpm.

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

## Install

```sh
npm i -D abatty
```

`pnpm`, `yarn` and `bun` work the same way. The package reads no credential and installs nothing
on your behalf: when a stack needs a tool, the tool is named and you decide.

## Quick start

```sh
npx abatty init              # detects the stack and installs the instrument
npm run gate                 # the gate, which the pre-push hook also runs
npx abatty doctor --controls # proves each gate step can fail
npx abatty                   # where the repository stands
```

1. **`init`** writes the gate, the pre-push hook that runs it, the ratchet with today's numbers
   as its floor, CI generated from the same gate definition, and the day-0 documents. Pass
   `--stack` to name a stack instead of detecting one, or `--stage design` for a repository that
   has no application yet.
2. **`gate`** is one implementation with three callers: this command, the pre-push hook, and the
   unattended run's stop check. It refuses the work rather than describing it.
3. **`doctor --controls`** plants a violation per step, runs the step, removes the file whatever
   happened, and marks a step that stayed green as absent. The plant goes where the step's
   script looks: its glob, the runner config or wrapper it hands over, or, behind a task runner
   (`turbo run test`), the first workspace that runs the task. Where a script cannot be followed,
   `controls` in the config names the folder (`"test:integration": "apps/web/tests/integration"`).
4. **`abatty`** prints the reading. The reading is what the gate leaves behind, not the point of
   it.

## How it works

### The gate

One definition drives the local command, the git hook and CI, so they cannot disagree about which
steps exist. Steps run in a fixed order and stop at the first failure: format, lint, typecheck,
import graph, dead code, tests, the coverage of the changed lines (a `coverage:changed` or
`test:changed` script, told the range in `ABATTY_RANGE`), the ratchet with the changelog over the
pushed range, the secret scan, the dependency audit.

Heavy suites are selected by path, so a change that touches no database code does not wait for the
database suite, and a push that only changes comments builds nothing. A step whose script the repository does not have yet is reported as skipped rather
than passed, and the verdict leads with how many steps did not run. Steps the preset requires
cannot be skipped: without them the gate reports that it could not run.

The changelog entry a source change carries can be a line under `## [Unreleased]`, or, where
parallel branches keep colliding on that one hunk, a fragment: set `files.changelogFragments` to
a folder (`changes/unreleased`) and each change adds its own `<slug>.<added|changed|fixed|...>.md`
there, which the commit hook, the gate and the Stop hook accept as the entry.
`abatty changelog --release <version>` folds `[Unreleased]` and every fragment into the dated
section and removes the fragments.

A suite that needs a database never runs against one the run did not create. With
`TEST_DATABASE_URL` set, the suite, and every other step with it, runs with `DATABASE_URL`
pointed at it; in CI the pipeline's
own service is trusted. An ambient `DATABASE_URL`, from the shell or declared in a `.env` file
(read for the name only), defers the suite to CI and says how to give it a database of its own.
The rest of what the server under test needs is named before the suite starts: a variable the
example env file declares that neither the shell, a dotenv file nor the config supplies is listed,
and `suiteEnv` in the config gives the suites non-secret values, as a pipeline's workflow does.

Exit codes are a contract:

| Code | Meaning                                      |
| ---- | -------------------------------------------- |
| 0    | Clean                                        |
| 2    | Invalid input, flags or configuration        |
| 3    | Ran correctly and found violations           |
| 4    | Internal error, or a step that could not run |
| 130  | Interrupted                                  |

Three is the one that matters. A gate that found something did not fail; it worked. Four says the
instrument broke, which is a different problem from bad work. `abatty night` reads the same
table: 2 it cannot start as configured (no agent), 3 its pre-flight found the repository unfit for
a night (a dirty tree, a red gate, a step that stayed green on its control), 4 the canary or the
run itself aborted.

### The ratchet

`abatty ratchet` measures the mechanical rules a linter cannot state, and refuses any number that
moves the wrong way. `abatty baseline` records today's numbers as the floor.

Metrics come in two kinds. **Hard** must be zero now and forever. **Ratchet** holds today's number
and may only fall, both in total and per file, so debt cannot relocate: a file may improve and
never worsen, and a file absent from the list carries none.

A metric at zero is promoted to hard. A floor that rises is refused without a reason and an owner,
both recorded against the metric rather than against the write, so one metric's explanation
survives an unrelated rebaseline and disappears when the debt it explained does. A file's floor is
a floor too: one that rises is refused and recorded the same way even when the metric's total
fell, so a fall in one file cannot hide a rise in another. A file git sees as renamed since the
baseline was committed keeps its floor at the new path, so a `git mv` moves no debt. A probe that
scans zero files where the baseline saw some fails the run, so a moved directory never reports
green forever.

A floor left above today's count fails the run too, since it is slack the gate would keep
accepting. When that is the only failure, a run outside CI writes the lowered floor itself and
asks for the baseline to be committed with the change: lowering a floor takes no command and no
reason, and leaving findings in is no longer the easier path. CI never writes; it judges what was
pushed.

The owner is a name the raiser typed, and an agent can type one as easily as a person can. So a
raise lands only through a pull request approved at its head by somebody other than its author.
`abatty raises --require-review <number>` reads that review in the pipeline that `abatty ci`
generates. A repository that pushes to its base directly by policy has no pull request to approve,
so there a raise needs a line the pushed range adds to the decisions file naming the metric, and
the command says that is a record, not a second person's approval. It counts as a rise anything else that loosens a floor: a floor that vanished, a hard
metric demoted, a file whose debt grew while the total held, or the same done through the config
(a metric excluded, a path exempted, a probe switched off, a cap or a budget raised).

A raise whose reason is the probe being wrong is written `--reason "false-positive: <what it
misread>"`, and `abatty report` counts those per probe. That count is the one the package needs:
it decides which probe is fixed, and which stays on probation. It is worth an issue with the case.

### Proving the guards

Every probe ships control cases in both directions: a case it must report, and a case it must not.
`abatty ratchet --controls` runs them on throwaway repositories, and the package's own test suite
runs them on every push, so a probe without a failing control case cannot be added.

The same principle covers the gate steps, where the check is `doctor --controls`, and the agent
harness, where a self-test drives one hundred and two guard decisions in both modes and is itself verified
by mutation.

## Commands

| Command               | What it does                                                                                              |
| --------------------- | --------------------------------------------------------------------------------------------------------- |
| `abatty`              | Where the repository stands: the phase, the score, the trend                                              |
| `abatty init`         | Install the instrument for the detected or named stack                                                    |
| `abatty gate`         | The gate. `--fast` omits the heavy suites; `--preflight` says what each step needs, runs none             |
| `abatty ratchet`      | Every probe against the committed baseline. `--controls` runs the control cases                           |
| `abatty baseline`     | Record today's numbers as the floor                                                                       |
| `abatty raises`       | The floors loosened against the base, and the review that can land them                                   |
| `abatty mutate`       | One mutant per line the push changed, run against the nearest tests on the import graph; survivors listed |
| `abatty doctor`       | The harness self-test and drift against the package. `--controls` proves the gate steps                   |
| `abatty measure`      | The gap analysis: every check, with next steps by phase; the reading before names this one                |
| `abatty rules`        | The rule catalog. Filter by family, level or phase; `--md` regenerates the catalog document               |
| `abatty explain <ID>` | One rule, its reason, and its finding here                                                                |
| `abatty check <ID>`   | One rule as an exit code, for a script                                                                    |
| `abatty fix`          | What a phase asks for that a machine can write. Prints a plan unless `--write`                            |
| `abatty secrets`      | The secret scan over the tree, the staged files or a range. `--benchmark` measures it                     |
| `abatty ci`           | Generate CI from the gate. `--ruleset` prints a branch ruleset to import                                  |
| `abatty update`       | Bring the harness to the package's version, keeping your edits                                            |
| `abatty config`       | The configuration file, its problems against the schema, and `--migrate`                                  |
| `abatty presets`      | The stacks, and which repository proved each                                                              |
| `abatty profiles`     | The standards this repository follows                                                                     |
| `abatty attest`       | The conformance statement, ready to sign                                                                  |
| `abatty evidence`     | The regulatory requirement mapping, for a person to read                                                  |
| `abatty validate`     | Whether the files a rule reports are the files somebody later had to fix, here                            |
| `abatty dashboard`    | One HTML page over the reports of one or many repositories                                                |
| `abatty serve`        | Host that dashboard, so CI can post each report to it                                                     |
| `abatty night`        | The unattended run, with its pre-flight and canary session                                                |
| `abatty scrub`        | Opt-in: remove tool, vendor and model names from files, commits and pull requests                         |

Every command accepts `--plain` for ASCII markers and no colour, which is what a log parser wants.
Colour is off automatically outside a terminal and in CI. `measure` and `report` take `--json`.

Run `abatty help` for the full flag list of each.

## Configuration

`abatty.config.json` at the repository root is the single configuration file, validated against
the schema the package ships. It carries the commands, the file locations, the push policy, the
phases, the ratchet settings, waived rules with their reasons, and the optional scrub.

`abatty config` reports where it is and what is wrong with it. `abatty update` adds keys that the
template gained and never replaces a value you set.

## Presets

A preset describes what a stack's repository looks like: its paths, scripts, gate steps, suites
and rule files. The standard says what must hold; the preset says where to find it.

A preset is real when a named repository has run it, and the tool says so plainly rather than
implying coverage it does not have.

| Preset       | Status                                     |
| ------------ | ------------------------------------------ |
| `next`       | Proven by paycore_dms, 2026-09-14          |
| `vite-react` | Proven by Paycore-Task-Manager, 2026-09-13 |
| `node`       | Proven by abatty, 2026-09-18               |
| `astro`      | Not yet proven by a repository             |
| `python`     | Not yet proven by a repository             |
| `docs`       | Not yet proven by a repository             |

Monorepos compose. Workspaces are read from the root manifest, a pnpm workspace file, or the
conventional `apps/*`, `packages/*` and `services/*` directories. Each workspace is detected from
its own dependencies and gated with its own preset in its own directory, while the shared steps
and the ratchet run once at the root. A workspace without a preset is listed and not gated.

## Extending

The catalog holds 80 rules across 15 families. Each rule is data: an identifier, the statement,
whether it is a **must** or a **should**, what insures it once present, the phase that installs it,
the reason, and a check that is a pure function of the repository's facts. Nothing in the
repository is executed.

Insurance is the number worth watching. Of the rules in the built-in catalog, 47 are held by a
machine, 7 by a ratchet, 13 by a reviewer's checklist and 12 by nothing but prose. `abatty rules
--enforcement prose` lists what to move up next.

Add your own rules in `abatty.rules.mjs` at the root:

```js
export const rules = [
  {
    id: "OWN-OWNERS",
    family: "Ownership",
    title: "An OWNERS file names the team",
    level: "must",
    enforcement: "prose",
    phase: "0",
    why: "A repository without an owner is a repository nobody answers for.",
    next: "Add OWNERS at the root",
    check: (c) => ({
      status: c.exists("OWNERS") ? "present" : "missing",
      evidence: c.exists("OWNERS") ? "OWNERS" : "none",
    }),
  },
];
```

Add your own probes in `abatty.probes.mjs`, in the same shape. Control cases are required and a
built-in metric name is refused.

A control case proves a probe can go red; the harder property is that it stays green on correct
code. So a false positive reported against a shipped probe, rule or guard is fixed together with a
case built from the reporter's own situation that must stay green, in the same commit, and a test
runs every shipped probe over this repository and fails on any finding in the probe's own source.

Some built-in probes are **opt-in**, because each reads one stack's conventions and would be
noise, or a surprise red after an update, anywhere else. A repository switches them on in
`ratchet.enable`, and `init` enables the ones that suit the preset. `abatty doctor` names each one a
repository has left off, with what it would read there today, so leaving one off is a decision
taken knowing the number:

| Probe                      | Counts                                                                                             | Configured by  |
| -------------------------- | -------------------------------------------------------------------------------------------------- | -------------- |
| `valid.unparsedBoundary`   | Route handlers, server actions and credentials callbacks reading input no schema parses            |                |
| `valid.wholeEnv`           | The environment object taken whole outside the env module                                          |                |
| `auth.unguardedPage`       | Protected pages whose first statement is not the guard                                             | `pageGuards`   |
| `api.unboundedList`        | List reads in a route handler without a bound                                                      | `boundedBy`    |
| `api.rowReturn`            | Server actions returning the ORM's row, or a select carrying a secret column                       | `secretFields` |
| `api.floatMoney`           | Money made a number on the wire, or stored as a Float column                                       | `moneyFields`  |
| `cache.serverCacheUse`     | Server-side caches of a read, for a repository that decided to have none                           |                |
| `fn.shapeExemptions`       | Shape rules switched off inline, in any linter's spelling, or by a list                            | `shapeList`    |
| `change.refactorTests`     | Refactors in the push that removed a test case, or edited a test without a `tests-changed:` reason |                |
| `code.clones`              | Blocks of six or more meaningful lines that appear in two places, without a dependency             |                |
| `test.coverageExclusions`  | Code taken out of the coverage count, by an exclude list or an inline ignore                       |                |
| `types.nonNull`            | Non-null assertions (`!`) in TypeScript, the escape `types.escapes` does not count                 |                |
| `valid.sqlCurrentDate`     | Calendar days SQL takes in the session's time zone (`CURRENT_DATE`, `now()::date`), unconverted    |                |
| `docs.supersededChain`     | Readings of a chained dated series, or archived documents, that name no successor that exists      |                |
| `obs.catchOnlyLogs`        | Caught errors, `catch` blocks or `.catch()` handlers, whose only act is a `console.*` line         |                |
| `sec.weakRandom`           | `Math.random` where the names around it say a password, a token, a secret or a one-time code       |                |
| `code.undocumentedExports` | Exported declarations with no doc comment above them (presence only, not whether it says why)      |                |
| `test.unvisitedRoutes`     | Page routes (Next `app/` and `pages/`) that no path the browser suite names would open             |                |

A new or heuristic probe ships **on probation**: it is measured and its findings are listed under
a yellow `PROBATION`, and a verdict that would fail says which one it would have been, but the run
stays green. A blocking check lives on its false positives, so a probe leaves probation only once
a named repository has run it clean, the rule the presets follow. Three run everywhere on
probation: `docs.frontMatterSyntax`, front matter a YAML reader refuses; `docs.danglingRefs`, a
name a document cites in backticks that the code had when the document last changed and has
nowhere now; and `change.testTamper`, a commit in the push that made its tests easier to pass (a
case removed or skipped, a snapshot rewritten with no `tests-changed:` line, a checker silenced,
a threshold lowered), which `abatty night-report` also lists for every commit of a night. The opt-in probes above added in the same release are on probation too.

A probe that is not enabled does not reserve its name, so a repository that wrote its own version
keeps it until it enables the package's. `abatty ratchet --controls` proves every shipped probe,
enabled or not. A multi-tenant repository whose tenant column is not `tenant_id` names it in
`tenantKeys` so DATA-TENANT can see it.

Rules can also arrive as a **profile**: a standard packaged as a unit of rules, adoption phases,
presets and harness files. The built-in profile is one company's standard. A repository that names
only its own carries only its own, with the same instrument underneath.

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
third-party benchmark, and the page carrying the number says so. `abatty validate` prints churn
beside every correlation, because a rule that merely tracks how often a file changes will
otherwise look excellent.

What running the tool on its own repository produced, negative results included, is in
[`docs/DOGFOOD.md`](docs/DOGFOOD.md).

## Documentation

The standard ships with the package and is versioned alongside it.

| Document                                                                         | Contents                                                       |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------- |
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
[`CONTRIBUTING.md`](CONTRIBUTING.md) for the workflow, and
[`SECURITY.md`](SECURITY.md) for coordinated disclosure.

## License

Apache-2.0. See [`LICENSE`](LICENSE).
