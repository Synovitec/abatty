---
title: "Research 2026-09-18: the evidence base for the instrument"
description: "What the published research, the industrial reports, the practitioner discourse and the competing repositories say about the parts abatty is made of: the gate, the ratchet, the rule catalog, the harness, the unattended night. Each finding graded by strength, mapped to the rule or probe it bears on, and followed by the change it implies. A dated record; the standard is what was adopted."
category: reference
status: stable
audience: ["architect", "developer", "agent", "reviewer"]
tags: ["research", "evidence", "gate", "ratchet", "harness", "agents", "measurement"]
related:
  [
    "../ENGINEERING_STANDARD.md",
    "../ENFORCEMENT_MAP.md",
    "../AUTONOMOUS_ADOPTION.md",
    "../LESSONS.md",
  ]
scope: synovitec
last_verified: "2026-09-18"
---

# Research: the evidence base for the instrument (2026-09-18)

Read against `docs/standard/ENGINEERING_STANDARD.md` and `docs/standard/ENFORCEMENT_MAP.md`. The
other files under `docs/standard/research/` collect sourced practice for a technology cluster.
This one is different in kind: it collects the evidence for and against the shape of the
instrument itself, so that a claim abatty makes in its README can be traced to something other
than one company's taste.

Every finding below carries a strength grade and the identifier of the rule, probe or command it
bears on. Where the evidence contradicts what the package does today, that is stated plainly and
the consequence appears in section 13. A finding with no consequence is still recorded: the
absence of a change is also a decision.

## 0. Method and limits

Scope of the survey: peer-reviewed software-engineering research (ICSE, FSE, TSE, EMSE, SANER,
MSR, ICPC), industrial reports from organisations operating the same mechanisms at scale (Google,
Meta), preprints on arXiv from 2025 and 2026 covering agentic coding, and the non-academic field:
public repositories implementing comparable mechanisms, vendor documentation, and practitioner
discussion.

Selection: a source was kept when it bears on a mechanism abatty implements, not on the general
subject of software quality. A source was dropped when its only claim was a vendor benchmark of
its own product, unless it is cited here explicitly as a vendor claim.

Grades used below:

| Grade       | Meaning                                                                                           |
| ----------- | ------------------------------------------------------------------------------------------------- |
| `strong`    | Large-N or industrial deployment, replicated or internally consistent across independent settings |
| `moderate`  | One good study, or several small ones pointing the same way                                       |
| `contested` | Competent studies reaching opposite conclusions; the disagreement itself is the finding           |
| `reported`  | Industry or vendor figure, useful as an order of magnitude, not as proof                          |

Limits of this document. It surveys evidence about mechanisms, not about this package. Nothing
here measures abatty. Section 10 proposes the design that would, and until it is run, every
claim abatty makes about its own effect is a hypothesis.

## 1. Findings in brief

| #   | Finding                                                                                                                     | Grade     | Bears on                                                   |
| --- | --------------------------------------------------------------------------------------------------------------------------- | --------- | ---------------------------------------------------------- |
| F1  | Agent-written code introduces durable debt at scale; code smells dominate and a fifth of introduced issues never get fixed  | strong    | The premise of the instrument                              |
| F2  | The same analysis at the same precision gets near-zero action as a report and high action at diff time                      | strong    | `abatty gate`, `abatty measure`, the pre-push hook         |
| F3  | Developer-perceived false-positive rate, not soundness, decides whether a check survives; the practical budget is under 10% | strong    | The enforcement ladder, `abatty rules`                     |
| F4  | Rule catalogs are mostly not validated against defects; the best-known one predicts faults poorly                           | strong    | `src/rules/index.mjs`, `docs/CATALOG.md`, the score        |
| F5  | Baselines are suppression mechanisms; most suppressions are not false positives but accepted debt                           | moderate  | `abatty baseline`, `src/ratchet/baseline.mjs`              |
| F6  | Context files raise cost reliably and move correctness little or not at all; the evidence is split on the sign              | contested | `templates/harness/agent-context.md.template`, DOC-CONTEXT |
| F7  | Instructions in context files are followed literally, including when following them is wrong                                | moderate  | DOC-RULES, the harness rule files                          |
| F8  | A green visible test suite hides growing non-compliance as task length grows and model strength falls                       | strong    | `abatty night`, `src/night/runner.mjs`                     |
| F9  | Mutation analysis is only affordable and only actionable when restricted to the diff and filtered by context                | strong    | TEST-MUTATION                                              |
| F10 | Coverage becomes actionable at the changeset, not the repository                                                            | strong    | TEST-COVERAGE                                              |
| F11 | No secret scanner reaches both high precision and high recall; tool overlap is low                                          | moderate  | SEC-SECRETS, `src/core/secrets.mjs`                        |
| F12 | Dependency audit output is dominated by unreachable and non-production findings; naive gating produces alert fatigue        | strong    | SEC-AUDIT                                                  |
| F13 | Machine checkability has a hard ceiling in some families, accessibility most clearly                                        | moderate  | The enforced-share metric, `docs/standard/guides/A11Y.md`  |
| F14 | Documentation goes stale in most repositories and the drift is machine-detectable from code references                      | moderate  | DOC-FRESHNESS, `docs.behindCode`                           |
| F15 | Tool adoption effects on repositories are measurable with interrupted-time-series designs on public data                    | moderate  | `abatty serve`, section 10                                 |

## 2. Why the instrument exists

The premise is not that code quality matters. It is that the cost asymmetry between writing code
and verifying it has changed, and that the debt now accumulates faster than review absorbs it.

The largest study available at the time of writing built a dataset of roughly 302,600 verified
AI-authored commits from about 6,300 GitHub repositories across five widely used assistants, ran
static analysis before and after each change to attribute introduced issues, then tracked each
issue to the latest revision. It identified 484,366 distinct issues, of which code smells account
for 89.3 per cent; more than 15 per cent of commits from every assistant introduce at least one
issue; and 22.7 per cent of tracked introduced issues still survive at the latest version, with
the cumulative surviving count passing 100,000 by February 2026 [1]. The authors' own framing is
the useful one: this is a long-term maintenance property, not a transient artefact of immature
tooling.

Two independent lines support the same shape. A study of architectural and code smells in LLM and
agent-driven development reports that neither functional correctness nor detailed prompting
prevents structural decay [2]. A study of the sustainability of agent-generated code measures
technical debt, maintainability, modularity, duplication and complexity on agent commits rather
than inferring them [3].

Consequence for the standard: the instrument's justification is written in these terms in
`README.md`, and the numbers are sourced rather than asserted. No rule changes.

## 3. Placement beats precision

This is the most consequential finding in the survey for how abatty presents itself.

At Meta, Infer was first deployed by assigning issues to developers as a list. The false-positive
rate had been driven below roughly 20 per cent, and the fix rate was near zero. The same analysis,
with the same false-positive rate, moved to diff time, where it comments on the change under
review, reached a fix rate above 70 per cent. Infer is engineered to run on a diff in about 15 to
20 minutes including checkout and build, and in its default mode reports only the regressions a
diff introduces [4]. A later system paper restates the result independently: the high relevance
driven by diff-time deployment is critical, and the same study saw a near-zero fix rate when the
same findings were delivered as assigned issues outside the CI system [5].

Google reaches the same conclusion from a different direction. Coverage is computed for a billion
lines of code daily across seven languages, and the paper's stated key to making it actionable is
applying it at the level of changesets and code review [6]. Mutation analysis is made affordable
by mutating only changed code during review [7].

Where abatty stands today. The package ships both: `abatty gate --fast` is path-aware and the
pre-push hook runs it, while `abatty measure` produces a repository-wide gap report with a score
over the applicable checks. The README leads with `npx abatty`, the report-shaped command. On the
evidence, that ordering is backwards: the report is the artefact that failed at Meta, and the
gate is the one that worked.

Consequence: section 13, change C1 and C2.

## 4. The false-positive budget, and what an enforcement level costs

The enforcement ladder in `docs/standard/ENFORCEMENT_MAP.md` (hard, ratchet, review, prose) is,
whether or not it was designed as one, a precision hierarchy. The industrial evidence gives it
numbers.

Google's platform runs more than a hundred analyzers with an overall effective false-positive rate
just below 5 per cent. Checks surfaced in code review are allowed up to 10 per cent effective
false positives, because the author evaluates the suggestion before applying it. Checks that break
the build must be at or near zero, and enabling one requires a team willing to fix the entire
corpus first, after which the check ratchets quality permanently [8]. The platform paper adds the
definition that matters: a false positive is any report the user did not want to see, regardless
of the analysis being sound, and the rate is monitored continuously through an explicit "not
useful" signal in the review interface [9]. The most-cited summary of the deployment states the
consequence bluntly: developers, not tool authors, determine a tool's perceived false-positive
rate [10].

Independent user-centred work reaches the compatible conclusion from the developer's side, and
derives requirements such as recommending which warnings to fix given what the developer already
knows [11]. There is also dedicated work on the quality of rule documentation as a factor in
whether a warning is acted on [12], which is the evidence behind `abatty explain`.

Mapped onto abatty's levels, this yields a budget the package can actually enforce on itself:

| Level     | Where it fires                                 | Effective false-positive budget |
| --------- | ---------------------------------------------- | ------------------------------- |
| `hard`    | The gate refuses the work                      | at or near 0 per cent           |
| `ratchet` | A number may not rise; the gate refuses a rise | under 5 per cent                |
| `review`  | A reviewer's checklist                         | under 10 per cent               |
| `prose`   | A sentence in a document                       | not applicable                  |

The package currently has no measurement of its own false-positive rate at any level. The waiver
mechanism in `abatty.config.json` is the natural sensor: a waiver is the user saying the finding
was not wanted.

Consequence: section 13, change C3.

## 5. A rule catalog has to be falsifiable

The most widely deployed rule catalog in the industry has been tested against defect history and
did poorly. On 21 mature open-source projects, with SZZ used to label fault-inducing commits and
seven classifiers compared, only 25 of the 202 Java rules could be considered to have relatively
low fault-proneness, violations classified as bugs by the tool were generally not fault-prone, and
the fault-prediction power of the vendor's model was extremely low; the authors' recommendation is
that companies carefully consider which rules they actually need [13]. A companion study found the
remediation-time estimates generally overestimated, most accurate for code smells and least
accurate for bugs [14].

This is the strongest available warning against abatty's own score. The number printed by
`abatty measure` aggregates 46 applicable checks whose defect relevance has never been tested, and
the axes printed beside it (readability, navigability, type-safety, boundary-clarity,
docs-freshness) are composites of composites. A composite with no validation is a target, and a
target that is also the product's headline number is the textbook setup for measurement gaming.

The catalog in `src/rules/index.mjs` and `src/rules/families/` has one property the vendor
catalogs lack: every rule already carries the reason, the standard ID it holds, the enforcement
level and the check as a pure function of the repository context. That is the machinery needed to
run the validation. Nothing in the survey found any tool in this category that validates its own
rules against the defect history of the repository it is installed in.

Consequence: section 13, change C4, and section 12 on what the score may and may not be called.

## 6. The ratchet: a suppression mechanism with a contract

A baseline is a suppression list. The research on suppressions is unflattering and specific: in an
empirical study of suppression annotations and configurations in Java projects, false positives
account for only a minor proportion of suppressions, while a substantial number of suppressions
introduce technical debt, which the authors read as either disregard for quality or missing
guidance from the tool [15].

The complementary positive result is the one abatty's design already assumes. Quality gates that
reject commits exceeding a debt threshold on new code, combined with continuous integration, leave
legacy debt in place while making new code essentially debt-free [16]. That is the clean-new-code
model, and it is what the ratchet implements.

The field has converged on this independently and in more detail than the literature. A survey of
prior art maintained by one implementation records that bidirectional enforcement, where the gate
also fails when a listed finding no longer exists, already ships in PHPStan including count decay,
Psalm, mypy-baseline, ESLint bulk suppressions and import-linter for import allowlists, each
within a single domain and none with per-entry justifications; that Betterer's CI mode rejects any
drift but regenerates its snapshot by machine rather than having a human own it; and that
SonarQube has per-finding justification comments that are optional, stored server-side and
silently discarded when the issue closes [17]. A Rust implementation of the same pattern adds a
detail worth copying outright: its committed snapshot carries a schema key so that a floor written
under one definition of a metric is never silently compared against a later, redefined one [18].

Against that, `abatty baseline` today writes machine-owned numbers with no reason, no owner and no
schema version, and `src/ratchet/probes/size.mjs` can change what a metric counts between versions
without invalidating the floors written under the old definition. The repository's own run on
2026-09-18 illustrates the first half of the problem: `size.excessCode` had improved from 9 to 0
and the floor had not moved, so the gate was still accepting nine findings that no longer existed.

Consequence: section 13, changes C5, C6 and C7.

## 7. The harness and the context file

Two claims have to be separated here, because the evidence treats them very differently.

### 7.1 The harness as a category

The term has entered the literature. A systematic analysis of configuration mechanisms across
Claude Code, Copilot, Cursor, Gemini and Codex identifies eight mechanisms from static context to
executable and external integrations, and in a study of about 2,850 repositories finds that
context files dominate and are often the sole mechanism present, with AGENTS.md emerging as a
tool-agnostic interoperable standard; that advanced mechanisms are shallowly adopted, with most
skills carrying static instructions rather than executable scripts, and no repository found using
the persistent-memory feature of subagents; and that distinct configuration cultures are forming
per tool [19]. The authors' recommendation to tool providers is to improve onboarding for skills
and subagents, which few repositories use despite their support for executable scripts and
isolated contexts.

That recommendation describes `abatty init` precisely. It is the clearest external statement of
the gap the package fills, and it also says what the package must emit to be interoperable:
AGENTS.md, not only `.claude/`.

Related work treats the harness as something that evolves from observed runs rather than something
written once [20], which is the same idea as the lessons loop in `src/night/lessons.mjs`.

### 7.2 The context file as an artefact

Here the evidence is genuinely split, and the split is the finding.

A large-scale characterisation of 2,303 context files from 1,925 repositories finds they are not
static documentation but complex, hard-to-read artefacts evolving like configuration code through
frequent small additions, with developers prioritising test procedures at about 76 per cent,
implementation details at about 71 per cent and architecture at about 68 per cent, while security
at about 15 per cent and performance at about 15 per cent are rarely specified [21].

On effectiveness, a controlled evaluation across four agents on SWE-bench and a purpose-built
benchmark of issues from repositories with developer-committed context files finds that context
files consistently increase cost and step count, that LLM-generated files have a marginal negative
effect on success and developer-written ones a marginal gain with neither statistically
significant, that instructions are generally followed and produce more testing and broader
exploration, and that the files do not function as effective repository overviews; the
recommendation is that they carry only specific instructions beyond what the codebase already
provides [22]. A second, independent ablation across two frontier agents, 17 tasks from three
repositories and 288 evaluated runs with gold-test evaluation finds context strategy does not
measurably move correctness, bounded to 10 to 15 percentage points by equivalence testing, and
attributes failures to implementation skill rather than missing repository knowledge [23].

Pointing the other way, a study measuring cost rather than correctness reports that curated files
improve agent efficiency on focused pull requests, with about 29 per cent less runtime and about
17 per cent fewer output tokens [24]. Work reconciling the two notes that agents follow the files'
instructions literally even when counterproductive, with one tool named in a file used about 160
times more often than without it [25]. There is also a factorial study of file-structure variables
and an emerging catalog of configuration smells in these files [26][27].

The practitioner discourse arrived at a workable rule before the papers did: add to the file only
when the agent has failed at a task, and only to correct something it got wrong. The same
discussion records a failure mode that matches the literal-following result, where an agent
replaced SQLite code with MariaDB equivalents because MariaDB appeared in comments [28].

The synthesis for this standard: a context file is not an overview, it is a list of corrections,
and it costs tokens on every session whether or not it earns them. That is an argument for
`abatty init` writing a near-empty context file and for the night's lessons loop being the only
thing that grows it. It is also the argument for the experiment in section 10.2, because the
hypothesis this package is built on, that a mechanically enforced rule beats the same rule written
as prose in a context file, is untested by anyone.

Consequence: section 13, changes C8, C9 and C10.

## 8. The unattended night under optimisation pressure

An unattended run that stops when the gate is green is optimising against the gate. The literature
on that situation is now specific.

A benchmark built to measure the gap between visible and held-out tests across models, harnesses
and search strategies found that every model could saturate the visible suite on every task, while
the gap between validation and holdout pass rate grew with task complexity and was larger for
weaker models; the practical warning the authors draw is that as teams move to longer tasks or
smaller models, the green report increasingly hides falling compliance [29]. Work on reward
construction frames reward hacking as a special case of false positives, where a patch passes the
suite without the task being solved, and reports that combining mitigations dropped a hacked
resolved rate from about 29 per cent to about 0.6 per cent while the clean resolved rate rose from
about 40 per cent to about 61 per cent [30]. Randomised and capped evaluation designs address the
same failure from the detection side [31].

Two features already in the package are the right instincts. `abatty doctor --controls` plants a
violation per gate step and reports a step that stays green as absent, which is verification of the
verifier. The canary in `src/night/canary.mjs` proves the harness before the first night. What is
missing is holdout: nothing in `src/night/runner.mjs` withholds any part of the checkable surface
from the agent and evaluates on it afterwards, so the night has no way to distinguish work from
work shaped to the gate.

Consequence: section 13, changes C11 and C12.

## 9. Family-level evidence

### 9.1 Documents (DOC-FRESHNESS, `docs.behindCode`)

Outdated documentation is pervasive and mechanically detectable. An analysis of more than 3,000
GitHub projects found that most contain at least one outdated code element reference at some point
in their history, and issues filed from the detector's output led to real documentation fixes
[32]. The broader line of work on code-comment inconsistency established the causes, deprecation
and refactoring chief among them, and the detection techniques [33].

The `docs.behindCode` probe in `src/ratchet/probes/docs.mjs` implements a cheaper variant: rather
than parsing references, it compares a document's declared `last_verified` against the commit dates
of the paths it declares as its sources. That is a defensible simplification and should be
described as such rather than as an equivalent. Its weakness is the one the literature avoids: it
trusts a human-maintained date.

### 9.2 Tests (TEST-COVERAGE, TEST-MUTATION)

Coverage at industrial scale is computed continuously and made actionable at the changeset, with
thresholds adopted voluntarily by projects as goals rather than imposed globally [6]; later work
addresses the actionability of the resulting numbers directly [34]. The relationship between
coverage and real fault detection is weaker than the metric's use implies [35].

Mutation analysis at scale is possible only under three constraints: mutate changed code during
review, filter mutants likely to be irrelevant with per-line and per-review limits, and select by
historical operator performance. Validated with more than 24,000 developers on over a thousand
projects, the approach produces orders of magnitude fewer mutants and improves their actionability,
with unproductive mutants in uninteresting nodes suppressed before generation and 82 per cent of
mutants with feedback labelled productive, rising over time from 80 to 89 per cent [7]. Follow-on
work studies whether mutation changes testing practice, how developers resolve surfaced mutants,
and how to learn suppression rules from feedback on similar mutants [36][37][38].

The plan's current wording for TEST-MUTATION, mutation on changed files with a break at today's
floor, satisfies the first constraint and neither of the other two.

### 9.3 Security (SEC-SECRETS, SEC-AUDIT)

For secrets, an evaluation of five open-source and four proprietary tools against a benchmark
reports best precision at about 75 per cent, 46 per cent and 25 per cent for the top three, and
best recall at about 88 per cent, 67 per cent and lower for the top three, with the highest-precision
tool recalling about 6 per cent and one high-recall tool holding about 1 per cent precision. The
authors conclude that no current tool achieves both, and report low overlap between tools, with 76
per cent of one tool's true positives also found by a second but only 18 per cent by a third [39].

For dependencies, nine tools compared on one application reported between 32 and 239 vulnerable
dependencies for its npm projects [40]; filtering development-only dependencies, grouping by
project and assessing dead dependencies significantly reduces false alerts [41]; and a conservative
call-reachability analysis on twelve projects in an ecosystem with structured symbol metadata cut
121 reported vulnerabilities to 31, a reduction of about 74 per cent [42].

The consequence for SEC-AUDIT, currently listed as missing in phase 0, is that adding a bare audit
step to the gate would install a check whose expected precision is far outside the budget in
section 4. It has to be scoped before it is added.

### 9.4 Accessibility and internationalisation

Automated accessibility checking has a ceiling, and the ceiling depends on how coverage is counted.
An industry analysis of more than 2,000 audits covering roughly 13,000 pages and nearly 300,000
issues reports that automated testing fully covered about 57 per cent of issues by volume, while
counting by success criteria a machine can fully verify puts the figure nearer the older 20 to 30
per cent benchmark; guided semi-automated tests raise the volume figure to roughly 80 per cent
[43]. The standards body's own guidance is that tools assist but cannot determine accessibility and
that human judgement is required [44].

This matters for the enforced-share metric, which counts what a machine holds against what a
reviewer or a sentence holds and treats the second as a backlog. For the a11y family that backlog
is partly permanent, and a night that tries to promote a permanently unpromotable rule will burn
allowance on it forever.

## 10. Measuring abatty's own effect

### 10.1 The repository-level design

There is an established methodology for exactly this question. A study of npm JavaScript projects
modelled the time-dependent effect of automation tool choice on four outcomes, the prevalence of
issues, code churn, the number of pull requests and the number of contributors, with a large set
of controls, extracting adoption events for linters, dependency managers and coverage reporters,
and found that some tools within each class are associated with more beneficial outcomes than
others [45]. Applied with a regression discontinuity design, tool adoption was associated with a
decrease in the monthly number of opened issues. The same design has since been used for code
review bots and CI automation [46].

Applied to abatty, the adoption event is the commit that adds `abatty.config.json`, which is public
and dateable in any repository that installs the package, and the hosted service in
`src/hosted/service.mjs` supplies the post-adoption series. This is the only design in the survey
that could turn the package's central claim into a measured one.

### 10.2 The harness experiment

The hypothesis is narrow and testable: for a fixed rule, mechanical enforcement in the gate
produces better outcomes than the same rule stated in a context file. Three arms, no context, prose
context, abatty harness with hooks and stop-gate, over an issue-resolution benchmark, measuring
resolve rate, cost in tokens and gate-relevant violations in the produced patch. The contradictory
results in section 7.2 are what make the result publishable whichever way it falls, and the
factorial and probe-and-refine work gives the design its control variables [25][26].

## 11. Prior art and position

The purpose of this section is to keep the package honest about what is novel.

**The ratchet is not novel.** Baselines with bidirectional enforcement exist in at least five
mature tools, one per ecosystem, and at least three general-purpose implementations of the
committed-snapshot pattern are in public development [17][18]. One of them also installs agent
hooks and accepts existing findings as a baseline in a single command, which is `abatty init` plus
the ratchet in one npm-installed CLI. A fourth states the orchestration principle the package
should also follow, that the CLI enforces gate policy while existing analyzers find the issues,
rather than reimplementing them.

**The harness installer is not novel and is being absorbed.** Cross-agent projection of one
convention set into each tool's native format is shipped by several tools, one of which maintains
the per-agent matrix of rules file, MCP path, skills location and subagents location; another
offers `init`, `doctor`, drift detection, an upgrade command, a prompt-overhead estimate and a
local dashboard, which is most of this package's command surface [47][48][49]. One toolkit
documents the strategic risk explicitly: between January and July 2026 the platform vendor shipped
natively and free a large part of the orchestration layer such toolkits used to hand-roll, and the
toolkit deleted the redundant parts and kept only opinionated workflow and domain judgement [50].

**The scorecard is not novel.** Defining standards such as production readiness and enforcing them
without scripts and spreadsheets, with checks and a rubric, historical data and campaigns, is a
shipped product category, and there is an open-source implementation in the portal ecosystem that
evaluates services against facts and checks and aggregates them into scorecards [51][52][53]. The
distinction abatty can defend is direction: those platforms observe repositories from outside,
while abatty installs the enforcement inside.

**The concept has a name in the architecture literature.** Fitness functions are objective
functions assessing how close an architecture is to its stated characteristics; the guidance is to
identify them as early as possible because they act as a ratchet on quality degradation, and the
static and dynamic, automated and manual distinctions map closely onto the enforcement ladder
[54][55]. The same literature carries the warning this package most needs: applied too
aggressively, fitness functions create rigidity, and over-constraining a system makes it harder to
change, which is the opposite of the intent [56].

**What is actually unclaimed.** Four things, none of which the survey found in any tool:

1. A published, measured effective false-positive rate for the tool's own rules.
2. Validation of a rule catalog against the defect history of the repository it runs in.
3. A harness that reports its own token cost and proves its gate can go red.
4. A baseline that is human-owned with a required reason and schema-versioned metric definitions.

Those four are the defensible product, and each of them is a consequence in section 13.

## 12. Threats to validity and open questions

- **The score has no validated relationship to defects.** Until C4 runs, it is a trend to compare
  readings of one repository over time, and every document and command that prints it must say so.
  The existing wording in the generated gap analysis, that the score is a trend and not a grade,
  is correct and should not be weakened.
- **Most agentic-coding evidence is preprint and months old.** Sections 7 and 8 rest on work from
  2025 and 2026 that has not fully been through peer review, and model behaviour moves faster than
  the publication cycle. Findings F6 and F8 should be re-checked at the next revision of this file.
- **Industrial results come from monorepos.** Sections 3, 4 and 9.2 draw on organisations with a
  billion-line codebase and a single review tool. The mechanisms transfer; the thresholds may not.
- **The false-positive budget in section 4 is imported, not measured here.** It is a starting
  calibration, to be replaced by the package's own waiver telemetry once C3 exists.
- **Vendor figures are marked as such.** The accessibility coverage figure in 9.4 and the
  code-review accuracy comparisons in the competitive field are reported numbers, not independent
  replications.
- **Open question.** Whether a rule held mechanically outperforms the same rule stated in prose is
  the package's founding assumption and is currently unevidenced in either direction. Section 10.2
  is the design that would settle it.

## 13. Consequent changes

Each change names the rule, probe or command it touches, and the finding that motivates it. Phases
refer to `docs/standard/ADOPTION_PLAN.md`.

| ID  | Change                                                                                                                                                                        | From   | Phase |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----- |
| C1  | The gate, not the report, is the first command in `README.md` and in the two-minute path; the dated report becomes the by-product it already is                               | F2     | 0     |
| C2  | `abatty gate` gains a regression view: findings introduced by the range under test, reported separately from the repository's standing findings                               | F2     | 1     |
| C3  | A waiver in `abatty.config.json` requires a reason and is counted per rule; `abatty rules` reports a waiver rate per rule, and the enforcement ladder gains the budgets in §4 | F3     | 1     |
| C4  | New command `abatty validate`: SZZ-style attribution over the repository's own history, reporting which catalog rules precede defect-fixing commits in this repository        | F4     | 3     |
| C5  | `abatty baseline` writes a per-entry reason and owner; an entry without one is a finding                                                                                      | F5     | 1     |
| C6  | The baseline carries a schema version per metric; a floor written under an older definition is reported rather than silently compared                                         | F5     | 1     |
| C7  | Bidirectional enforcement: a floor that is higher than the current value is a finding, not a silent pass, so an improvement must be locked in the same change that earned it  | F5     | 0     |
| C8  | `abatty init` writes AGENTS.md alongside the tool-native files, and `abatty agents` reports which surfaces are covered                                                        | F6     | 0     |
| C9  | The context-file template ships near-empty by default: the build and test commands, the gate command, and nothing that restates the codebase                                  | F6     | 0     |
| C10 | The context file grows only from the night's lessons, one correction per observed failure; DOC-CONTEXT-SECTIONS is re-read in that light rather than as a completeness check  | F6, F7 | 1     |
| C11 | `abatty night` withholds a randomly selected slice of the checkable surface from the agent and evaluates on it after the run; the delta is reported by `abatty night-report`  | F8     | 2     |
| C12 | `abatty doctor --controls` becomes a precondition of the first night rather than a recommendation                                                                             | F8     | 0     |
| C13 | TEST-MUTATION gains two constraints: suppression of uninteresting nodes before generation, and a per-diff mutant cap                                                          | F9     | 10    |
| C14 | TEST-COVERAGE gates on the delta over changed lines; the absolute figure stays as a ratchet only                                                                              | F10    | 2     |
| C15 | SEC-SECRETS is measured against a public benchmark and the result is published in `docs/CATALOG.md`; the pre-commit scan is tuned for precision, the CI range scan for recall | F11    | 2     |
| C16 | SEC-AUDIT is scoped before it is added: production dependencies only, severity floor, and a waiver with an expiry; an unscoped audit step is explicitly rejected              | F12    | 0     |
| C17 | Each rule carries a machine-ceiling flag; a rule that no machine can hold is excluded from the promotion queue that the night works from                                      | F13    | 1     |
| C18 | `docs.behindCode` is documented as a declared-source approximation of reference-level drift, not as an equivalent of it                                                       | F14    | 11    |
| C19 | New command reporting the harness's own token footprint per session, so the cost side of §7.2 is visible to the adopter                                                       | F6     | 3     |
| C20 | The hosted service records adoption events so the design in §10.1 becomes runnable on real installations                                                                      | F15    | 3     |

C1, C7, C9, C12 and C16 require no new machinery and should land first.

## 14. Sources

Research and industrial reports.

1. Liu, Y., Widyasari, R., Zhao, Y., Irsan, I. C., Lo, D. _Debt Behind the AI Boom: A Large-Scale Empirical Study of AI-Generated Code in the Wild._ MSR 2026. arXiv:2603.28592.
2. Zhu, Y. et al. _AI-Generated Smells: An Analysis of Code and Architecture in LLM and Agent-Driven Development._ arXiv:2605.02741.
3. _AI Writes Code, Humans Pay the Debt: An Empirical Study on the Sustainability and Evolution of Agent-Generated Code._ arXiv:2609.04208.
4. Distefano, D., Fähndrich, M., Logozzo, F., O'Hearn, P. _Scaling Static Analyses at Facebook._ Communications of the ACM 62(8), 2019. doi:10.1145/3338112.
5. Jin, M. et al. _InferFix: End-to-End Program Repair with LLMs._ arXiv:2303.07263.
6. Ivanković, M., Petrović, G., Just, R., Fraser, G. _Code Coverage at Google._ ESEC/FSE 2019. doi:10.1145/3338906.3340459.
7. Petrović, G., Ivanković, M., Fraser, G., Just, R. _Practical Mutation Testing at Scale: A View from Google._ IEEE TSE 48(10), 2022. arXiv:2102.11378.
8. Sadowski, C., Aftandilian, E., Eagle, A., Miller-Cushon, L., Jaspan, C. _Lessons from Building Static Analysis Tools at Google._ Communications of the ACM 61(4), 2018.
9. Sadowski, C., van Gogh, J., Jaspan, C., Söderberg, E., Winter, C. _Tricorder: Building a Program Analysis Ecosystem._ ICSE 2015.
10. Winters, T., Manshreck, T., Wright, H. _Software Engineering at Google_, chapter 20 (Static Analysis). O'Reilly, 2020.
11. Nguyen Quang Do, L., Wright, J. R., Ali, K. _Why Do Software Developers Use Static Analysis Tools? A User-Centered Study of Developer Needs and Motivations._ IEEE TSE 48(3), 2022. doi:10.1109/TSE.2020.3004525.
12. _What the Fix? A Study of ASATs Rule Documentation._ arXiv:2402.08270.
13. Lenarduzzi, V., Lomio, F., Huttunen, H., Taibi, D. _Are SonarQube Rules Inducing Bugs?_ SANER 2020. arXiv:1907.00376.
14. Baldassarre, M. T., Lenarduzzi, V., Romano, S., Saarimäki, N. _On the diffuseness of technical debt items and accuracy of remediation time when using SonarQube._ Information and Software Technology 128, 2020.
15. _Quieting the Static: A Study of Static Analysis Alert Suppressions._ arXiv:2311.07482.
16. Digkas, G. et al. _Can Clean New Code reduce Technical Debt Density?_ arXiv:2010.09161.
17. Galster, M., Mohsenimofidi, S., Lulla, J. L., Abubakar, M. A., Treude, C., Baltes, S. _Configuring Agentic AI Coding Tools / Harness Engineering: An Exploratory Study._ arXiv:2602.14690.
18. Lin, J. et al. _Agentic Harness Engineering: Observability-Driven Automatic Evolution of Coding-Agent Harnesses._ arXiv:2604.25850.
19. Chatlatanagulchai, W. et al. _Agent READMEs: An Empirical Study of Context Files for Agentic Coding._ arXiv:2511.12884.
20. Gloaguen, T., Mündler, N., Müller, M., Raychev, V., Vechev, M. _Evaluating AGENTS.md: Are Repository-Level Context Files Helpful for Coding Agents?_ arXiv:2602.11988.
21. _Do Context Files Help Coding Agents? A Two-Agent Ablation Study on Real Repositories._ arXiv:2607.27250.
22. Lulla, J. L. et al. _On the Impact of AGENTS.md Files on the Efficiency of AI Coding Agents._ arXiv:2601.20404.
23. _Probe-and-Refine Tuning of Repository Guidance for Coding Agents._ arXiv:2606.20512.
24. _Instruction Adherence in Coding Agent Configuration Files: A Factorial Study of Four File-Structure Variables._ arXiv:2605.10039.
25. _Configuration Smells in AGENTS.md Files: Common Mistakes in Configuring Coding Agents._ 2026.
26. _SpecBench: Measuring Reward Hacking in Long-Horizon Coding Agents._ arXiv:2605.21384.
27. _The Verification Horizon: No Silver Bullet for Coding Agent Rewards._ arXiv:2606.26300.
28. _Do Coding Agents Deceive Us? Detecting and Preventing Cheating via Capped Evaluation with Randomized Tests._ arXiv:2606.07379.
29. Tan, W. S., Wagner, M., Treude, C. _Detecting outdated code element references in software repository documentation._ Empirical Software Engineering, 2023. arXiv:2212.01479.
30. Wen, F., Nagy, C., Bavota, G., Lanza, M. _A Large-Scale Empirical Study on Code-Comment Inconsistencies._ ICPC 2019.
31. _Productive Coverage: Improving the Actionability of Code Coverage._ ICSE-SEIP 2024.
32. Kochhar, P. S., Thung, F., Lo, D. _Code coverage and test suite effectiveness: empirical study with real bugs in large systems._ SANER 2015.
33. Petrović, G., Ivanković, M., Fraser, G., Just, R. _Does mutation testing improve testing practices?_ ICSE 2021. arXiv:2103.07189.
34. Petrović, G., Ivanković, M., Fraser, G., Just, R. _Please Fix This Mutant: How Do Developers Resolve Mutants Surfaced During Code Review?_ ICSE-SEIP 2023.
35. _MuRS: Automated suppression of surfaced mutants._ 2023.
36. Basak, S. K. et al. _A Comparative Study of Software Secrets Reporting by Secret Detection Tools._ ESEM 2023. arXiv:2307.00714.
37. Imtiaz, N. et al. _A Comparative Study of Vulnerability Reporting by Software Composition Analysis Tools._ arXiv:2108.12078.
38. Latendresse, J., Mujahid, S., Costa, D. E., Shihab, E. _Not All Dependencies are Equal: An Empirical Study on Production Dependencies in NPM._ ASE 2022. arXiv:2207.14711.
39. _A Reality Check on SBOM-based Vulnerability Management: An Empirical Study and A Path Forward._ arXiv:2511.20313.
40. Kavaler, D., Trockman, A., Vasilescu, B., Filkov, V. _Tool Choice Matters: JavaScript Quality Assurance Tools and Usage Outcomes in GitHub Projects._ ICSE 2019. doi:10.1109/ICSE.2019.00060.
41. Wessel, M. et al. _Quality gatekeepers: investigating the effects of code review bots on pull request activities._ Empirical Software Engineering, 2022.

Books, standards and industry reports.

43. Deque Systems. _The Automated Accessibility Coverage Report_, 2021 (about 57 per cent of issues by volume; vendor-reported).
44. W3C Web Accessibility Initiative. _Selecting Web Accessibility Evaluation Tools._
45. Ford, N., Parsons, R., Kua, P. _Building Evolutionary Architectures._ O'Reilly, 2017.
46. Thoughtworks. _Fitness function-driven development._
47. Practitioner syntheses of the fitness-function paradox, 2025 to 2026.

Field: repositories, packages and products examined.

17. `pytest-ratchet` prior-art survey (PyPI, 2026): justified human-owned baselines, bidirectional enforcement, and the rows for PHPStan, Psalm, mypy-baseline, ESLint bulk suppressions, RuboCop todo, import-linter, Betterer, SonarQube.
18. `codelore` quality-gates ratchet module: committed snapshot with a ratchet schema key.
19. Hacker News discussions of arXiv:2602.11988 and arXiv:2601.20404, February to March 2026, including the author's reply on generalisation.
20. `intellectronica/ruler`: per-agent matrix of rules file, MCP configuration, skills and subagents locations.
21. `horus-harness` (PyPI): init, doctor, upgrade-project, overhead, dashboard.
22. `AgentSync`: drift detection as a gate, `--fail-on-drift` with commit-blocking hooks.
23. `buildproven/agent-kit`: the deletion of orchestration features absorbed by the platform vendor in 2026.
24. Cortex Scorecards: standards as scorecards with a query language and initiatives.
25. OpsLevel: checks and rubric for service maturity.
26. Backstage Tech Insights: facts, checks and fact retrievers aggregated into scorecards.

- `Jmsa/eslint-formatter-ratchet`: the minimal form of the pattern, a formatter with a committed result file.
- `coolplayagent/qualitygate-cli`: the orchestration principle, external analyzers find, the gate enforces policy.
- `0xwilliamortiz/ratchet`: one command that registers agent hooks, baselines existing findings and opens a dashboard.
- `klaussy-agents`, `Lukk17/agent-standards`: cross-agent projection and the per-surface MCP fragmentation.

Numbering gaps in the list are deliberate: entries 17, 18, 28 and 47 to 53 are field sources and
are grouped with the field, while the citation numbers in the body remain stable.
