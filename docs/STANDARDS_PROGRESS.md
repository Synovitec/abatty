---
title: "Standards progress - abatty"
description: "This package measured against the standard it ships: typecheck strict over checkJs at zero with one named exception, tests over temp repositories, format checked, templates proven in sync with ops-hub. The dated log of every deliberate change of a floor."
category: governance
status: living
audience: ["developer", "agent"]
tags: ["standards", "scoreboard"]
related: ["./README.md", "../README.md"]
---

# Standards progress

## Scoreboard

| Metric                                                             | Day 0 (2026-09-14)                                                                          | Now       | Target | Held by                                                             | Rule   |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | --------- | ------ | ------------------------------------------------------------------- | ------ |
| `tsc --noEmit` over `checkJs` strict                               | 0                                                                                           | **0**     | 0      | `npm run typecheck` in the gate                                     | CODE 3 |
| Files under `// @ts-nocheck`                                       | 1 (`src/core/gap-analysis.mjs`, generated from an untyped script; 48 findings)              | **0**     | 0      | the checks moved into `src/rules/`, typed, on 2026-09-14            | CODE 3 |
| Tests                                                              | 13                                                                                          | **32**    | -      | `npm test` in the gate                                              | TEST 1 |
| Templates in sync with ops-hub                                     | yes                                                                                         | **yes**   | yes    | `test/templates.test.mjs`, `doctor --templates-only` in the gate    | -      |
| Prettier                                                           | clean                                                                                       | **clean** | clean  | `format:check` in the gate                                          | CODE 4 |
| Lines naming a tool, a vendor or a model (`abatty scrub`)          | 341 (day 0, before the scrub)                                                               | **0**     | 0      | `abatty scrub .` in the gate, the commit-msg hook, the guard        | -      |
| Enforced share (`abatty measure`: present rules held by a machine) | 83% of 23 (2026-09-15)                                                                      | **83%**   | 100%   | the catalog's enforcement level per rule; a night moves one rule up | P 1    |
| Ratchet metrics above zero (`npm run standards`)                   | 4 of 13 (2026-09-15: size.overBudget 1, size.excessCode 9, types.escapes 7, valid.rawEnv 7) | **4**     | 0      | `scripts/ci/standards-baseline.json`, the ratchet in the gate       | P 2    |

## Log

### 2026-09-14 - Day 0

The first slice: `init`, `measure`, `gate`, `doctor`, three presets, the templates and the gap
analysis synced from ops-hub. Proven on paycore_dms (measure 80/100 as the ops-hub tool; the
gate green in seven steps; doctor in step). One named debt: the generated gap analysis is
untyped until its checks move into the package for good.

### 2026-09-14 - The catalog

The checks moved into the package as the rule catalog (`src/rules/`, 65 rules in 13 families,
typed): the `@ts-nocheck` file and the port script are gone, 0 files under the escape. Tests
21 -> 32. The scores of the reference repositories are unchanged by the port (paycore_dms
80/100 over 63, abatty 29/100 over 51), which is the proof the checks are the same.

### 2026-09-15 - The ratchet

The ratchet moved into the package (`abatty ratchet`, `abatty baseline`, thirteen probes with
their controls). This package baselined itself the same day: nine metrics at zero and
promoted to HARD; four ratchets with their debt on the list - `size.overBudget` 1 and
`size.excessCode` 9 (`src/rules/families/code.mjs`, 9 code lines over the module budget),
`types.escapes` 7 (the escape patterns quoted in the probe's and a rule's own source),
`valid.rawEnv` 7 (the terminal layer's colour switches, the same quoted patterns). The hook
and stub templates are exempt from the kind budget through `abatty.config.json` (they are
sequential procedures where stdout is the interface), still under the 800 cap. Tests 32 -> 53.

### 2026-09-15 - The standard in the open

`LICENSE` (Apache-2.0), `CONTRIBUTING.md` (DCO). The standard's fifteen documents moved into
`docs/standard/` and pass this repository's own instrument: front matter and the index at
zero, citations exempt for the standard's documents because they cite the paths of a
repository that adopts it (`ratchet.citationsExempt`), and the two research notes that quote
the vendor's own documentation allowed through `scrub.allow` with the reason in
`abatty.config.json` - a rewritten citation would be a false one.

### 2026-09-15 - Provenance by default

The scrub became opt-in for every repository; this one keeps it on (`abatty.config.json` →
`scrub.enabled`), the decision of its first day. A repository that does not opt in keeps the
agent's trailer as its audit trail and may ask for a disclosure trailer of its own
(`provenance.trailer`), which the guard holds on unattended commits.

### 2026-09-15 - The runner in Node

`abatty night` replaces the two shell runners; `test/night.test.mjs` drives it with the stub
through the happy path, canary only, six abort paths and three refusals, on every push. The
same slice fixed a self-test defect the first week never saw because it ran on Windows: the
no-op gate `node -e process.exit(0)` is a syntax error to a POSIX shell, so `doctor` was red on
Linux and macOS for a reason that was not the harness. Tests 55 -> 62.

### 2026-09-15 - update

`abatty update` merges the package's harness with a repository's own edits; the reference
repository's harness was synced by hand three times in one day before it. Tests 62 -> 70.

### 2026-09-15 - The root config

`abatty.config.json` at the root, validated against the schema the package ships, read first
by every hook and every command; this repository's own config carries the `$schema` line and
validates. Tests 70 -> 74.

### 2026-09-15 - Fixtures per preset

The `astro` preset and its fixture; four presets, four fixtures, two of them also proven by a
repository. Tests 74 -> 75.

### 2026-09-15 - Agent adapters

Three adapters; the primary's id derived from its folder so this package names no tool; the
night refused without hooks. Tests 75 -> 80.

### 2026-09-15 - The skill in the open format

The protocol of a night is no longer agent-shaped: the open front matter, a neutral body,
one file placed by every adapter. Tests 80 -> 82.

### 2026-09-15 - The MCP server

A typed call instead of a parsed shell; no runtime dependency added. Tests 82 -> 86.

### 2026-09-15 - night-report

The learning box is files plus a human; the distillation step exists now, and proposes, never
decides. Tests 86 -> 89.

### 2026-09-15 - The dashboard hosted

One place over every repository, and the badge the outside reviews asked for, from the same
renderer the local page uses. Tests 89 -> 92.

### 2026-09-15 - CI from the gate

The gate and CI are one list now, because one is generated from the other. Tests 92 -> 96.

### 2026-09-15 - The declarations

`types/` from the JSDoc, 58 files, equal to a fresh emit by a test. Tests 96 -> 98.

### 2026-09-15 - The secret scan and the audit

Built into the gate, shared with the pre-commit hook and CI; this repository's own gate runs
both, and its pre-commit hook scans the staged files. Tests 98 -> 102.

### 2026-09-15 - Rule-ID namespacing

Every standard ID is `FAMILY.N` with a dot; the hyphen form is retired everywhere the package
ships, and a test walks those files. Tests 102 -> 104.

### 2026-09-15 - Sandboxed nights

The boundary under the guard, proven before it is trusted; the package's own night test runs
under bubblewrap where one is found. Tests 104 -> 111.

### 2026-09-15 - The allowance

Sessions or tokens as the cap where dollars are a proxy; the spend written after every session
and a night resumable. Tests 111 -> 113.

### 2026-09-15 - Publishable

The tarball a third party installs is proven by a test that packs it, installs it in a clean
project and runs `init` from it. Tests 113 -> 114.

### 2026-09-15 - Profiles

The rules, phases and presets as one package, the built-in one named; a client project can
carry its own. Tests 114 -> 116.

### 2026-09-15 - Where a rule applies

A documents-only repository reads on the rules that concern it; a service without a database
is not scored on migrations. Tests 116 -> 119.

### 2026-09-15 - The stage

Design, build, run: a rule of another stage is n/a with the stage named; the plan per stage.
Tests 119 -> 122.

### 2026-09-15 - Workspaces

A monorepo composes presets, each gated in its own folder; documents alone have a preset.
Tests 122 -> 126.

### 2026-09-15 - Coupled paths

One mechanism for "when this changes, that changes in the same push"; this repository couples
the rule families to the catalog. Tests 126 -> 130.

### 2026-09-15 - Controls for the gate steps

A step that never went red may be checking nothing; the doctor plants the violation and says
which step stayed green. Tests 130 -> 132.

### 2026-09-15 - Language packs

The rules read the tools per pack; Python is the first pack beyond JavaScript. Tests 132 -> 135.

### 2026-09-15 - Distribution

The version pinned in the config, the two-minute README. Tests 135 -> 136.

### 2026-09-19 - The cold start becomes a number

`startup.eagerModules` counts the modules the entry point parses before it knows which command
was asked for. It lands at **3** (`src/cli/exit.mjs`, `src/core/repo.mjs`, `src/ui/term.mjs`),
which is the floor from today; it was 89 before the commands were split, and the three that are
left are each needed before the dispatch.

The metric is the graph rather than the milliseconds on purpose. A timing belongs to the machine
that ran it - a busy laptop and a cold runner disagree by a factor of three - and a ratchet on a
number that moves on its own is a ratchet nobody trusts. The count of modules is the cause, it is
identical on every machine, and it only moves when somebody adds an import.

The suite went from 225 s to 81 s in the same change, by splitting the one file that was 151 s of
it into three that run at once. The number to watch is the longest file, now 70 s.

### 2026-09-19 - The shim's three raw environment reads, exempted rather than counted

`valid.rawEnv` went 7 -> 10 when the git shim landed, and the floor may only fall. Two of the
three are in `templates/harness/bin/shim.mjs`, which runs inside whatever repository installed it
and cannot import this package's env module - the same reason `templates/harness/hooks/` and the
stub agent have been exempt since the metric existed. The exempt list gains
`templates/harness/bin/` and the installed `.claude/bin/`, and the third read, in
`src/core/shim.mjs`, moved into `src/core/env.mjs` as `pathFromEnv()` where it belongs. Back to 7,
which is the floor it was.

The distinction worth keeping: exempting a path because the rule cannot apply there is not the
same as raising a floor, and it is written down here so the next reader can disagree with it.

### 2026-09-19 - The secret corpus is text about code, not code

`valid.rawEnv` went 7 -> 9 when the published secret corpus landed, because two of its NEGATIVE
cases are the correct pattern written out as a string: `const apiKey = process.env.API_KEY;` is in
the corpus precisely so the scan can be measured on not flagging it. A probe that reads text finds
those two the way the secret scan finds the corpus's positives, which is why the same file is
already named in `secrets.allow`.

The corpus is exempted from the metric rather than the floor being raised, and it is exempted by
its exact path rather than by a pattern, so nothing else slips in behind it. Back to 7, which is
the floor it was.

A related decision, forced by the platform rather than chosen: the hosting platform's own push
protection refuses a file containing a contiguous credential-shaped string, however documented
and however synthetic the value is, so the first push of this corpus was rejected on five of its
cases. The values are therefore assembled from named parts, split at the vendor's DOCUMENTED
PREFIX (`"sk_live_" + "4eC3..."`), and the corpus is built at load, so the scan is still measured
on the complete value and the numbers are unaffected.

That is not the trick `src/core/vocabulary.mjs` uses. Reversing a string hides it from a reader
as effectively as from a scan; a split at the prefix makes the shape MORE legible on the page,
because the line now says which vendor's format it is before it says the body. A corpus nobody
can read is a corpus nobody can argue with, and being arguable is the whole reason it is
published.

### 2026-09-20 - A fourteenth hard metric, and the first one the pipeline could not have caught

`valid.utcDay` joins the hard metrics at zero, and the score moved 75 -> 76 over 55 applicable
checks because `VALID-LOCAL-DAY` is a present rule the repository already holds. A number that
rises is a decision, so here is the decision: the timezone defect was fixed the day before by
routing every date through one `localToday()`, which closed every site that existed and no site
written after it. That is a rule held by memory, and this package's whole argument is that a rule
held by memory is a rule held by nobody.

What is worth writing down is why the metric alone was not enough. The probe runs in the gate, and
the gate runs in CI, and CI runs at UTC - the single clock on which a day sliced off a UTC instant
is the right answer. A pipeline that only ever ran there would have gone green through the
original bug and through every repeat of it. So the guard is two things, not one: the metric,
which refuses the expression, and a second job that runs the whole suite on a clock whose calendar
day is never the UTC one, which catches the forms the regex does not know about. The zone is
picked at job start from the UTC hour, because a fixed named city agrees with UTC for most of the
day and a test that is only sometimes a test is not one.

The probe is spliced at the seam it forbids - an instant on one side, the day taken off it on the
other - so its own source and its own fixtures pass the scan it defines. That is the same device
as the reversed vocabulary, for the same reason, and it is preferred here to an exemption by path:
an exemption would have taken this file out of every other probe as well.

The division of labour between the two is worth stating, because neither covers the other's
ground. The probe reads `src/` and not `test/`, which is exempt from every metric, so the four
UTC-derived dates that were in the tests themselves would not be caught by it if they came back -
they would be caught by the skewed clock, because a test that derives the expected day in UTC
fails there. And the skewed clock only sees what a test exercises, so a UTC day in a code path
with no test is the probe's to find. Two guards, two blind spots, and the blind spots do not
overlap.

The form neither closes: a day taken off an instant in two statements, through a variable, in
code no test runs. It is written here rather than implied, because a guard whose limits are
undocumented gets trusted past them.

### 2026-09-20 - The controls mechanism was right and nobody was listening

Proving the new date metric meant running `abatty doctor --controls`, and it said what it had been
saying all along: typecheck and unit tests **stayed GREEN on a planted violation: the check is
absent**. Two of this repository's own gate steps had never once been watched going red, in the
package whose first non-negotiable is that a guard nobody has watched fail is not a guard.

Both causes are the same mistake, made by the planter rather than by the steps. The typecheck
control wrote its planted file into src with a .ts extension; this tsconfig includes
`src/**/*.mjs` and nothing else, so the compiler never opened it. The test control wrote a
.test.ts file into src; the test script globs `test/*.test.mjs`, so the runner never found it. A control planted where the
step does not look is indistinguishable from a step that checks nothing, and the runner reported
the second because it cannot tell them apart.

A third one turned up while writing the regression test, and it is the worst of the three: the
planted step inherited `NODE_TEST_CONTEXT` from whatever spawned it, and `node --test` that sees
that variable reports upward and exits 0 on a test that threw. So the control could watch a
failing test and call the step green. It only bites when a control runs inside another runner,
which is exactly what a regression test for a control is.

The fix is to derive rather than assume: the extension the repository's own tsconfig covers (with
the type error written as JSDoc where that is JavaScript, because a colon annotation in a `.mjs`
file is a syntax error the compiler never reaches), the folder and name its own test script globs,
and a child environment with the runner's context removed.

What this cost and what it did not. The mechanism was never silent: it printed ABSENT on every
run and exited 3. What was missing is that nothing downstream acts on it, because CI runs the
self-test skipped (§10) and the two machine-setup failures make a red `doctor` the expected
result on any machine not set up for a night. A permanent red is a red nobody reads. That is the
open item this leaves behind, and it is a harness change rather than a code one.

### 2026-09-23 - Two opt-in probes enabled here, two new floors

The package now ships opt-in probes (`ratchet.enable`): readings of one stack's conventions that
would turn every adopter red on update if they ran by default. Two of them apply to this
repository and are enabled: `fn.shapeExemptions` reads 0 and is promoted to hard, and
`valid.wholeEnv` reads 8 and is a new ratchet floor. No existing floor moved. The eight are the
environment handed whole to a child process (the controls, the night's session and pre-flight,
the MCP server) and two default parameters in `src/core/which.mjs`. Each is a take by the probe's
definition, and whether a child should get a narrowed environment instead is the open question
the floor now keeps visible. The readability score in the baseline fell from 98 to 92 because the
new metric counts against boundary clarity: the same code, measured further.

### 2026-09-23 - Duplication measured here, with no dependency

CODE-DUP was open because the only detector the package knew was a dependency. The package now
ships `code.clones`, a line-level reading with no dependency, and this repository enables it
together with `change.refactorTests`. `code.clones` reads 27 and is a new ratchet floor:
the preset tables repeat each other's blocks, the installed graph config repeats its template,
and the probes repeat their own scaffolding. `change.refactorTests` reads 0 and is hard. No
existing floor moved; the baseline's readability score falls from 92 to 91, because the clone
count now counts against navigability.

### 2026-09-23 - valid.wholeEnv 8 → 6, the branch's own two takes removed

Review pointed out that two of the eight takes the new floor recorded were this same change's own
code: `process.env` as a default parameter in `src/core/which.mjs`. They now read the search path
through `searchFromEnv()` in the env module, the one place the package reads its environment, and
the floor is locked at 6. The readability score in the baseline returns from 91 to 93.

### 2026-09-24 - Floors since 0.5.2: probes that counted themselves, four new metrics, one exempt widened

`types.escapes` 7 → 3 and `valid.rawEnv` 7 → 4: four escapes and three raw reads were the probes'
own pattern and control fixtures in `src/ratchet/probes/code.mjs`, found when a test began running
every built-in probe over this tree. The spellings are assembled from parts, and the test holds
every probe to zero findings in its own source. `code.clones` 26 → 25 from the same range's
splits. Four metrics join at zero, all on probation and so never promoted to hard:
`docs.frontMatterSyntax`, `docs.supersededChain`, `obs.catchOnlyLogs` and `sec.weakRandom`. The
exempt list's test pattern widens from a root `tests/` to a test folder at any depth; `abatty
raises` reads that as a loosening, and it is one by the letter. The reason is that the standard
exempts tests from the kind budgets and a monorepo's `apps/<app>/tests/` was held to them while
the same folder at the root was not. No number here moved because of it: this repository keeps its
tests at the root. The readability score in the baseline moves from 93 to 94.
