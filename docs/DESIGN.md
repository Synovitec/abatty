---
title: "The design of the instrument"
description: "What the tool has to become to be finished on its own terms, before anyone else uses it: one finding model behind four surfaces, a core that is correct rather than merely green, a latency tier that holds, and a first run that needs no configuration. Each item carries the measurement or the finding that put it there, and the order they land in."
category: governance
status: living
audience: ["architect", "developer"]
tags: ["design", "output", "sarif", "sensors", "performance", "roadmap"]
related:
  [
    "./ROADMAP.md",
    "./POSITION.md",
    "./standard/research/07-evidence-base.md",
    "./standard/research/08-security-compliance-tooling.md",
    "./standard/research/09-market-and-voices.md",
  ]
scope: synovitec
last_verified: "2026-09-19"
---

# The design of the instrument

`ROADMAP.md` says what changes next. `POSITION.md` says where the package stands against the
evidence about adoption. This file answers a third question, and it is the one that governs the
work now: **what does this tool have to become to be finished on its own terms**, judged by its
core and its output rather than by how many people install it.

Measured on `e043e66`, 2026-09-19. Every claim below is either a number taken from the repository
itself or a finding from `docs/standard/research/`, and is marked as such.

## 0. The bar, when it is not users

A tool with no users has no feedback, so the bar has to come from somewhere else. Three sources
replace it, and all three are available today:

1. **The portfolio.** Six real repositories across the stacks this package claims: a Next
   application, a Vite and React application, a Node service, a Python one, an e-commerce
   platform and a documents-only repository. The presets name six stacks and two of them have
   ever been proven. Running the instrument across all six, on stacks it did not grow up in, is
   a harder test than a handful of strangers and it needs nobody's permission.
2. **The controls.** The package already falsifies its own checks: a probe carries at least one
   case it must report and one it must not, and `abatty doctor --controls` plants a violation per
   gate step and reports a step that stays green as absent. That mechanism is the internal
   substitute for a user saying "this never fires".
3. **The evidence.** Three research rounds, forty numbered changes, and an external vocabulary
   that already describes what this tool is. Where the research contradicts the design, the
   research wins until something measured says otherwise.

What none of the three replace: the effective false-positive rate, which only real repositories
other than ours can produce. Every claim this file makes about precision is therefore a design
intention, not a measurement.

## 1. The core has to be correct before it is beautiful

Four defects. Not polish, not features: the tool is currently wrong or blind in these four
places, and no amount of output design compensates for any of them.

### 1.1 Selection in a workspace is not affectedness

`abatty gate --range` selects the work to check by path. The monorepo literature states the rule
in two halves: which inputs changed between a trusted base and the candidate, and which projects
can observe those changed inputs. A path filter answers only the first. When an application
imports a shared package, a change under the package must select the application even though no
file under the application changed.

The consequence is not a missing feature, it is a silent pass: the gate lets through work it was
installed to refuse, and says nothing. That is the worst failure a gate can have, because it is
invisible until someone else finds it.

**The design.** `src/presets/workspaces.mjs` gains a dependency graph read from the workspace
manifests, and the range selection walks it: a changed workspace selects itself and every
workspace that depends on it, transitively. Where the graph cannot be built, the gate runs the
full set and **says so in its output**, because conservative and slow is a correct gate and fast
and silent is not. Research: `08-security-compliance-tooling.md` F23, C29.

### 1.2 The gate cannot say "I could not run"

`GateEvent.outcome` is `ok | failed | skipped | deferred`. There is no outcome for a step whose
tool crashed. A dead-code analyser that fails to allocate memory and a dead-code analyser that
found dead code produce the same `✗ ... failed. The gate stops here.`

A gate whose verdict conflates "your work is bad" with "my instrument broke" is not trustworthy,
and trustworthiness is the entire claim of this package.

**The design.** A fifth outcome, `errored`, with its own line in the summary and its own exit
code. A step that errors stops the gate exactly as a failure does, because an unproven step is
not a passed step, but it is reported as an instrument fault and it names the tool and the
message. Paired with §4.2's exit codes, a pipeline can then branch on the difference. Research:
`08` F24, C30.

### 1.3 The repository is not trusted input

`abatty night` points an agent at a tree and lets it read everything in it: source, documents,
dependency metadata, tool output. The sandbox below that is good, and unusually so, because it
proves its own boundary with a probe and refuses the night when the boundary is present but does
not hold. What is missing is one level up: nothing examines what the repository **says** before
an agent reads it.

**The design.** A pre-flight stage before the first session, in `src/night/preflight.mjs`:
instruction-shaped text in repository documents and comments, instructions in dependency
metadata, and any command the repository asks a human to run. A finding stops an unattended
night and is reported; it never silently filters the content, because a filter that fails
quietly is the same class of problem as §1.2. The threat model itself is published rather than
implied, in `docs/standard/AUTONOMOUS_ADOPTION.md`. Research: `08` F16, F17, C21, C22, C23.

### 1.4 Eleven shells that are not needed

`spawnSync` is called with `shell: true` in eleven places across six files, each of which already
passes a command and an argument array. Two of the six are hook templates, so they ship into every
repository that installs the package. The shell adds an interpretation layer, changes quoting on Windows, and
sits exactly where a repository's own scripts execute during a night. Remove it everywhere it is
not load-bearing, and where it is, say why in a comment.

## 2. One finding, four surfaces

This is the largest design change in this file and the one that most changes what the tool is.

Today there is one finding model and roughly one and a half renderers: a terminal view and a
partial JSON. A finding should be produced once and rendered for four audiences that want
genuinely different things.

### 2.1 The terminal, for a person

Already the strongest surface: colour, bars, timings, degradation to plain text in a pipe, and
`abatty explain` reads well. What it lacks is completeness of contract rather than beauty:
`--plain` and `--json` on every command a script might consume, not two of them.

### 2.2 The agent, for self-correction

The published definition of a sensor, from the article that named this category, is a signal
optimised for consumption by the model, carrying the instruction for its own correction. Measured
against it, this package emits reports, not sensor signals: `Verdict.next` is a sentence for a
human ("Add `--max-warnings=0` to the lint script").

**The design.** A finding, when rendered for an agent, carries four things:

| Field    | What it is                                                                |
| -------- | ------------------------------------------------------------------------- |
| `where`  | file and range, not a file name alone                                     |
| `what`   | the minimal edit, stated as an edit rather than as a goal                 |
| `verify` | a command whose exit code proves the edit worked                          |
| `why`    | the rule's reason, unchanged, because an agent that knows why generalises |

`verify` is the field that makes the loop close, and it is the one nothing in the field ships.
With it, the sequence is mechanical: the rule breaks, the gate refuses with an instruction, the
agent edits, the agent runs `verify`, and no human is involved until something does not converge.
This surface is served through `src/mcp/server.mjs`, which is why that server exists. Research:
`09-market-and-voices.md` F29, C31.

### 2.3 SARIF, for the pull request

The static-analysis interchange format is an OASIS standard that the major forges ingest
directly: findings uploaded as SARIF appear inline on the diff of a pull request, on the lines
they concern.

That is the single most valuable thing this package does not do, because it is how the strongest
finding in the whole evidence base gets delivered without building anything. The same analysis,
at the same precision, reached a near-zero fix rate delivered as a report and above seventy per
cent delivered on the change under review. This package currently produces the report. A SARIF
emitter plus an upload step in the CI that `abatty ci` already generates produces the second,
and the work is a renderer rather than a product.

**The design.** `abatty measure --sarif` and `abatty ratchet --sarif` write SARIF 2.1.0. The
mapping is close to mechanical, which is the point:

| abatty                       | SARIF                                                                                    |
| ---------------------------- | ---------------------------------------------------------------------------------------- |
| `Finding.id`                 | `result.ruleId`                                                                          |
| the rule's `title`/`why`     | `tool.driver.rules[].shortDescription`/`fullDescription`                                 |
| `enforcement`                | `result.level` (hard → error, ratchet → error on a rise, review → warning, prose → note) |
| probe finding `path`/`line`  | `result.locations[].physicalLocation.region`                                             |
| `Verdict.evidence`           | `result.message.text`                                                                    |
| the agent's `what`           | `result.fixes[].artifactChanges`                                                         |
| `phase`, `standard`, `level` | `result.properties`                                                                      |

One detail is worth taking rather than reinventing: SARIF's `partialFingerprints` exists to match
findings across runs when line numbers move. That is the problem the baseline solves by hand
today, solved by a standard, and adopting it makes the ratchet's identity of a finding portable
to every tool that reads SARIF. Research: `07-evidence-base.md` F2; `09` C34.

### 2.4 The record, for an auditor

The signed conformance statement: what held, when, at which commit, under which version of the
standard, with the waivers and their owners, and the proof that every gate step was shown capable
of failing.

It is not a bespoke document. It is a custom predicate in the established attestation format,
signed through the established signing ecosystem, aimed at the source-side track of the
supply-chain specification. A bespoke file would need a reader this package writes and a market it
convinces; a predicate is consumable on day one. Research: `09` F38, F39, C38, C39; `08` F21,
C26, C27.

### 2.5 What this implies structurally

Findings are produced once and rendered four times, so the renderers move out of the code that
computes. `src/ui/` holds the terminal renderer today; it gains siblings, and nothing that
computes a finding knows which surface will show it.

## 3. Modern, measured rather than asserted

### 3.1 Latency is a correctness property

The established sorting for a coding-agent harness is milliseconds to seconds for the inner loop,
seconds to minutes for the gate, and minutes or more for what does not belong in every run. The
slowest sensor the agent needs on every iteration sets the pace of the whole loop.

Measured here on 2026-09-19:

| Command              | Now    | Tier        | Target  |
| -------------------- | ------ | ----------- | ------- |
| `abatty version`     | 45 ms  | inner loop  | < 30 ms |
| `abatty` (status)    | 78 ms  | inner loop  | < 60 ms |
| `abatty measure`     | 165 ms | inner loop  | holds   |
| `abatty gate --fast` | 207 s  | gate        | < 3 s   |
| `npm test`           | 225 s  | out of loop | < 60 s  |

The fast tier does not exist here, which the table hides: `--fast` skips the database suite and
the coverage run, and this repository has neither, so the 3 min 18 s unit suite runs in it
unchanged. A tier that only exists for other people's repositories is the same honesty problem as
a preset nobody has proven.

The floor under every one of these was the module graph: 89 modules and 12,845 lines were
statically reachable from `bin/abatty.mjs`, and printing a version string parsed the night
runner, the sandbox drivers, the hosted service, the MCP server and the CI generator. Each
command now loads only what it uses, and the entry point holds six static imports.

What is left is not ours: **`node -e ""` alone is 31 ms on this machine**, so `version` at 45 ms
spends about 14 ms in this package and the rest in the runtime. The target of 30 ms is below the
floor the runtime sets and cannot be met by any amount of import discipline; what a budget can
hold is the share above it.

**The design.** Each `case` in the entry point becomes an `await import()` of a module under
`src/cli/`, where seven of them already live. That single refactor also resolves the tool's own
rule violation: `abatty explain CODE-SIZE-300` names `bin/abatty.mjs` at 646 code lines, against
a rule whose stated reason is that three hundred is where an agent starts reading a file in
pieces and editing what it did not read. The largest file in the repository is the one an agent
edits most, and it fails the rule the repository ships.

A budget follows the refactor: the tiers above become a probe, so a regression in cold start is a
finding rather than a surprise. Research: `09` F31, C32.

### 3.2 Nothing runs in parallel

182 `*Sync(` call sites and 23 `await` expressions in the whole of `src/`. For a CLI that is a
defensible simplicity, and it is not the problem. The problem is that independent work is
serialised: the format check, the typecheck, the secret scan and the ratchet do not depend on one
another and run one after another.

The suite is not the problem it looks like. It takes 225 s, and the runner already runs files in
parallel: measured here on four cores, `test/night.test.mjs` alone is 185 s of that 225 s and
`test/ratchet.test.mjs` is 13 s. Raising the concurrency cannot beat the longest file, so this is
one slow file rather than a serialisation fault.

**The design.** The gate's always-on steps declare their dependencies, and independent steps run
together with their output buffered per step so the log stays readable. The suite's cost is
attacked where it is, in `test/night.test.mjs`, whose tests spawn real runs to prove what a driver
could prove, and the number the budget watches is the longest file rather than the total.

### 3.3 Measurement is not incremental

Every `measure` reads the whole tree and runs the whole catalog. Nothing is cached, so the second
run costs the same as the first even when nothing changed.

**The design.** A cache keyed on the git tree object of the paths a rule reads, kept under
`.abatty/`, invalidated by the standard's version and by the rule's own source. The design
constraint is that a cache must never be able to turn a finding into a pass: on any doubt it
misses. This is what makes the inner-loop tier real rather than aspirational.

### 3.4 Standards instead of our own shapes

Three places where an existing standard replaces something bespoke: SARIF for findings, the
attestation predicate for the record, and the established bill-of-materials format for
dependencies. Each one trades a format nobody reads for a format tooling already consumes, and
each one removes a future argument about adoption.

## 4. Easy, which is what finished feels like

### 4.1 The first run needs nothing

`npx abatty` in a repository with no configuration, no `--stack` and no profile must produce
something useful. Every tool that became ordinary did this; the current path asks for a stack on
the second command.

### 4.2 The command line keeps its contract

From the published guidelines for command-line programs: exit codes that say what happened rather
than only zero and one, documented in the help; a stable machine output wherever a script might
consume one; configuration precedence stated rather than implied; changes kept additive.

| Code | Meaning                                      |
| ---- | -------------------------------------------- |
| 0    | clean                                        |
| 2    | invalid input, flags or configuration        |
| 3    | ran correctly, found violations              |
| 4    | internal error, or a step that could not run |
| 130  | interrupted                                  |

Three is the one that matters: a gate that found something did not fail, it worked. Research:
`08` F24, C30.

### 4.3 The tool fixes what it can

A tool that only refuses is half a tool. Most of what the adoption plan's first phase asks for is
mechanical: front matter, an index row, a changelog section, the hooks, the CI file, the
interoperable context file. `abatty fix --phase 0` writes them, shows a diff and asks before
writing. The established practice in this field is that the preferred report carries a suggested
fix the engineer can apply, and the agent surface in §2.2 needs the same edit to be stated
anyway.

### 4.4 Every error names its fix

An error message that describes a state without naming the command that resolves it is an
unfinished error message. This is a pass over the whole tree, not a feature.

## 5. Order

The sequenced queue, with the state of every item checked against the code and what done means,
is `docs/PLAN.md`. This file says what each change is and why; that one says what to do next.

## 6. What this file does not claim

- **That any of this is validated.** The catalog's rules have not been tested against defect
  history, and the effective false-positive rate is unmeasured at every enforcement level. Both
  need repositories that are not ours. Until then the score remains what the tool already prints
  it as: a trend, not a grade.
- **That perfection is the goal.** The goal is a tool that is correct in its core, honest in its
  output, fast enough not to be worked around, and usable without reading a manual. Everything
  past that is taste, and taste is cheaper to change than a core.
- **That the order is fixed.** It is fixed until the portfolio run in item 9 contradicts it,
  which is the point of running it.
