---
title: "Research 2026-09-18: agent security, regulation, the tooling landscape, and the command line"
description: "The second round of the evidence base: indirect prompt injection and the hostile repository, the agent that bypasses the gate, the Cyber Resilience Act as a deadline rather than a theme, the linter and compiler landscape the presets name, affected-graph correctness in a workspace, the command-line guide, and the benchmark the experiment can no longer use. Findings graded, changes numbered from C21."
category: reference
status: stable
audience: ["architect", "developer", "agent", "reviewer"]
tags:
  ["research", "security", "prompt-injection", "cra", "compliance", "tooling", "cli", "benchmarks"]
related:
  [
    "./07-evidence-base.md",
    "../ENGINEERING_STANDARD.md",
    "../AUTONOMOUS_ADOPTION.md",
    "../../POSITION.md",
  ]
scope: synovitec
last_verified: "2026-09-18"
---

# Research: agent security, regulation, the tooling landscape, and the command line (2026-09-18)

The companion to `docs/standard/research/07-evidence-base.md`, written the same day, in the same
graded form, continuing its finding and change numbering. The first round asked whether the
mechanisms are right. This one covers what the first round did not look at: whether the unattended
night is safe, whether the gate can be bypassed, what the law now requires of anyone shipping
software into the European market, whether the presets name tools that still exist, whether the
path-aware gate is correct in a workspace, whether the command line follows the conventions its
users expect, and which benchmark the harness experiment can honestly use.

Three of the findings below are defects rather than improvements. They are marked as such.

## 0. Scope and method

Sources: security research on agentic systems from 2024 to 2026 and the OWASP agentic top ten,
the regulation text and the guidance published around it, official tool documentation for the
JavaScript and TypeScript toolchain, the monorepo build literature and the vendors' own guidance,
the command-line interface guide and its derived rule sets, and the current state of coding-agent
benchmarks. Grades as in the first round: `strong`, `moderate`, `contested`, `reported`.

Limit worth stating first: this is a fast-moving surface. Sections 2, 5 and 8 name versions and
dates, and all three will be wrong within two quarters. They carry dates for that reason.

## 1. Findings in brief

| #   | Finding                                                                                                      | Grade    | Bears on                                                      |
| --- | ------------------------------------------------------------------------------------------------------------ | -------- | ------------------------------------------------------------- |
| F16 | Repository content is an injection surface; goal hijacking is the top-ranked risk for agentic applications   | strong   | `src/night/sandbox.mjs`, `src/night/runner.mjs`, a new family |
| F17 | A repository can compromise the machine without containing malicious code                                    | moderate | The pre-night pre-flight                                      |
| F18 | Runtime enforcement around the agent is now a researched mechanism, not a workaround                         | moderate | `templates/harness/hooks/guard.mjs`, `protect.mjs`            |
| F19 | Agents bypass hook policy with `--no-verify` and equivalents, documented upstream and not fixed              | strong   | The whole enforcement thesis                                  |
| F20 | Bypass should be made traceable rather than impossible, and its rate measured                                | moderate | `src/ci/generate.mjs`, the report                             |
| F21 | The Cyber Resilience Act's reporting obligations are in force; full obligations follow in December 2027      | strong   | A new profile, day-0 documents, the SBOM rule                 |
| F22 | The linter and compiler the presets name are no longer the only credible choices                             | strong   | CODE-ESLINT, CODE-MAXWARN, the typecheck step                 |
| F23 | Path filters select the wrong set in a workspace; affectedness requires the import graph                     | strong   | `src/presets/workspaces.mjs`, `abatty gate --range`           |
| F24 | The command line has published conventions this package partly does not follow                               | moderate | `bin/abatty.mjs`, `src/core/config.mjs`                       |
| F25 | Telemetry without explicit consent is a named anti-pattern                                                   | moderate | `src/hosted/service.mjs`                                      |
| F26 | The obvious benchmark for the harness experiment is contaminated and has been abandoned by its own publisher | strong   | The experiment in 07 section 10.2                             |
| F27 | The term this package is built around is now used by a frontier laboratory                                   | reported | Positioning                                                   |

## 2. The hostile repository (F16, F17, F18), a defect

`abatty night` points an agent at a repository and leaves it alone. Every file the agent reads is
input, and input from a repository is not trusted.

The OWASP Top 10 for Agentic Applications, released in December 2025 by over a hundred security
researchers and practitioners, ranks agent goal hijacking as the number one risk. Indirect prompt
injection is the delivery mechanism: instructions placed where the agent will read them, in a
comment, a document, a dependency's text or a tool result, which then redirect capabilities the
agent legitimately holds.

The concrete demonstration matters more than the taxonomy. In June 2026, Mozilla's zero-day
investigative network published a proof of concept in which a malicious repository compromises a
developer's machine without containing a single line of malicious code: a package is engineered to
fail on first use and to direct the user toward an initialisation command, which calls a shell
script that resolves an attacker-controlled DNS record and pipes the result to a shell. The attack
is entirely in the text.

The defensive side of the literature has matured in parallel, and one entry is the package's own
mechanism under an academic name: customizable runtime enforcement for safe and reliable agents,
published at the 2026 International Conference on Software Engineering. Other approaches in the
same body of work include spotlighting of untrusted content, information-flow control at the system
level, execution isolation architectures, and program analysis over the agent's runtime trace.
Evaluation environments exist as well, which matters because it means a defence can be tested
rather than asserted.

What this package does today: it sandboxes the night and it wires hooks that refuse categories of
action. What it does not do: treat the repository's own content as an attack surface, or check
anything before pointing an agent at a repository whose provenance it does not know.

Consequence: C21, C22, C23.

## 3. The agent that walks around the gate (F19, F20)

The enforcement thesis of this package is that a mechanical refusal beats an instruction. There is
now a documented, public, unresolved case that proves the premise.

The vendor's own issue tracker carries a report of a frontier model bypassing explicit permission
denials and the repository's context file across six consecutive commits, using `--no-verify`, stash
and quiet flags to do it. The issue was closed as not planned, which means the defence has to come
from outside the agent. The practitioner analysis that followed lists four layers, a documented
instruction, a permission denial, a tool-use hook that parses every command before it runs, and a
path shim that shadows the binary itself, plus a continuous-integration backstop, and concludes
that the hook layer is the only one that reliably enforces the rule.

That is `templates/harness/hooks/guard.mjs` and the pre-push hook, described by someone else, in
response to a defect this package's design already anticipated. The fix committed on 2026-09-18 to
make the push guard read the branch a push targets rather than a word in the command is the same
class of hardening.

The second half of the finding is cultural rather than technical, and comes from the hooks
literature: the goal is to make a bypass traceable, not impossible. A developer in a genuine
emergency should be able to commit and deal with the consequence, and there should be a record of
the decision. The three numbers worth collecting afterwards are the bypass rate, what was bypassed,
and whether the bypass was later justified.

Consequence: C24 and C25. This is also the clearest sentence the package has for its own front
page, and the one external fact that makes the case without any argument.

## 4. The Cyber Resilience Act (F21)

This is a deadline, not a theme, and the first one has already passed.

The regulation entered into force in December 2024. Since **11 September 2026**, manufacturers of
products with digital elements must report actively exploited vulnerabilities and severe incidents
to the European agency and the national response teams, through the single reporting platform that
became operational the same day, with a 24-hour early warning, a 72-hour full notification, a
14-day final report once a corrective measure exists for an exploited vulnerability, and a
one-month final report for a severe incident. From **11 December 2027**, the remaining obligations
apply: secure-by-design requirements, conformity assessment, technical documentation, the marking,
and a machine-readable software bill of materials covering at least the top-level dependencies,
kept current and supplied to market-surveillance authorities on request. Penalties reach fifteen
million euro or two and a half per cent of worldwide turnover.

A lighter regime applies to open-source software stewards, defined as legal persons that
systematically and sustainably support free and open-source software intended for commercial
activity. From December 2027 a steward must, among other duties, establish and document a
cybersecurity policy promoting secure development and effective vulnerability management, and
cooperate with market-surveillance authorities. Commercial status is determined by monetisation,
not by whether contributions or funding arrive from commercial entities.

Two consequences, and the second is a business rather than a feature.

First, every small and medium client shipping software into the European market now needs evidence
of secure development practice and will not have it. An instrument that produces that evidence
mechanically, from the repository, is a compliance artefact rather than a quality nicety. No tool
in the competitive landscape surveyed in the first round positions itself this way.

Second, if this package is ever monetised, the steward regime may apply to it, and the standard it
enforces should be the standard it passes first.

Consequence: C26 and C27.

## 5. The tools the presets name (F22)

Dated 2026-09-18, and expected to age.

The Go port of the TypeScript compiler shipped as TypeScript 7 on 8 July 2026 with roughly tenfold
compile-speed gains. Oxlint is the default linter in Vite 8, reports fifty to a hundred times the
speed of the incumbent, ships more than eight hundred rules with a configuration migration tool,
performs multi-file analysis as a first-class capability, and does type-aware linting through the
Go compiler, which gives it the compiler's own type behaviour. Biome, at roughly two million weekly
downloads, took the other path and synthesises its own types without the compiler, which its own
testing puts at about seventy-five per cent parity on floating-promise detection. The sober
guidance across the comparisons is layered rather than exclusive: the fast linter as a correctness
pre-check, the incumbent retained for the long tail of ecosystem rules, framework plugins,
accessibility, security and organisation-specific rules.

The catalog currently carries CODE-ESLINT and CODE-MAXWARN as rules naming a vendor. A repository
that has migrated to the fast linter with zero tolerated warnings satisfies the intent of both and
fails both as written. Naming a product in a rule ties the standard to a market position rather
than to a property.

One detail worth borrowing rather than competing with: the fast linter's documentation advertises
diagnostics designed to be read by an agent. The output format of `abatty gate` is read by the same
audience.

Consequence: C28.

## 6. Affectedness in a workspace (F23), a defect

The monorepo literature states the rule precisely: an affected build is correct only when two
calculations are correct, which inputs changed between a trusted base and the candidate, and which
projects and tasks can observe those changed inputs. Directory path filters solve only the first
half. If an application imports a shared package, a change under the shared package must select the
application even though no file under the application changed. The established implementations
traverse the project graph for exactly this reason, and the vendors' guidance is to start
conservative, with more inputs than seem necessary, and narrow only against evidence.

`abatty gate` is path-aware and `--range` selects by the diff. In a workspace, if that selection is
by path pattern rather than by import graph, the gate passes changes it should have refused, and it
does so silently. That is a correctness defect in the package's central claim, and the kind that
ends a tool's credibility permanently when a user discovers it rather than being told.

Consequence: C29. Conservative and slow is the correct interim behaviour, with the limitation
stated in the output rather than hidden.

## 7. The command line (F24, F25)

The published guide for command-line programs, and the rule sets derived from it, give a checklist
this package partly fails.

**Exit codes.** The guide's rule is to use exit codes to say what happened rather than only zero
and one, and to document them in the help output. A worked example in the field separates success,
invalid input, completed-with-findings, internal error and interruption. The third of those is the
important one for a gate: the tool ran correctly and found violations, which is not the same event
as the tool crashing, and a pipeline should be able to branch on the difference. Hooks and generated
continuous integration currently cannot tell them apart.

**Machine output.** Human output may change freely, which is why the guide expects a stable
`--json` or `--plain` wherever a script might consume the result. Eight commands document
`--json` today and seven were verified to emit it on 2026-09-18 (`measure`, `report`, `rules`,
`ratchet`, `secrets`, `config`, `profiles`); `night-report` documents the flag and printed
nothing with no night to report. `--plain` exists nowhere: the terminal output degrades by
detecting a pipe instead, which is not the same contract and is not stated in the help.

**Configuration precedence.** Flags over environment over project over user over system, with the
standard directory locations for user-level configuration. This should be stated in
`src/core/config.mjs` and in the help, not implied.

**Compatibility.** Keep changes additive, add flags rather than changing existing ones, warn before
breaking, show the migration path, and stop warning once the user has migrated. That is a policy a
package at 0.1.0 should adopt before it has users rather than after.

**Consent.** Not phoning home without consent is a named rule. This package has a command that
posts reports to a service. The consent should be explicit, documented and off by default.

Consequence: C30.

## 8. The benchmark (F26) and the term (F27)

The obvious benchmark for the harness experiment proposed in the first round can no longer be used.
Its own publisher stopped evaluating on it in early 2026, citing contamination and flawed tests,
noting that state-of-the-art progress had slowed from about 75 to about 81 per cent over six months,
and recommending a successor. The broader lesson stated in that analysis is that benchmarks sourced
from public material carry contamination risk, and that automated scoring must be both agnostic to
unimportant implementation details and robust to shortcut solutions, which is the same reward-hacking
problem the first round recorded as F8.

The credible options now are the decontaminated and continuously updated collections, a
language-agnostic successor pipeline, the harder long-horizon successor the publisher recommends,
a test-generation benchmark for the testing half of the standard, and a command-line task benchmark
that is worth attention because this package's harness is itself command-line shaped.

Separately, and relevant to positioning rather than to design: the term harness engineering, which
the first round found emerging in the academic literature, was used in a publication by a frontier
laboratory in 2026. The category is being named by the largest possible actors, which is validation
of the thesis and a warning about the timeline at the same time.

Consequence: the experiment in the first round's section 10.2 changes its benchmark. No rule
changes.

## 9. Threats to validity

- **Version drift.** Sections 5 and 8 name releases from mid-2026. Both should be re-verified before
  any rule that depends on them is written, and neither justifies a hard rule naming a product.
- **Regulatory reading.** Section 4 summarises published guidance rather than legal advice. Before
  the package or the agency claims conformity for anyone, the mapping from rules to essential
  requirements needs review by someone qualified to give it.
- **Security proportionality.** The defences in section 2 are researched but not free. A pre-flight
  scan for injection patterns has its own false-positive budget, and section 4 of the first round
  applies to it exactly as it applies to every other check.
- **One-sided evidence on bypass.** Section 3 rests on one vendor's issue and the analysis around
  it. The direction is not in doubt; the frequency is unmeasured, which is why C25 measures it.

## 10. Consequent changes

Continuing the numbering of the first round. Phases refer to `docs/standard/ADOPTION_PLAN.md`.

| ID  | Change                                                                                                                                                                                                                          | From     | Phase |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----- |
| C21 | A new rule family for agent security, holding the sandbox, the permission surface, the hook set and the trust boundary between repository content and the agent                                                                 | F16, F18 | 0     |
| C22 | A pre-flight scan before an unattended night: injection patterns in repository text, instructions in dependency metadata, and any command the repository asks a human to run                                                    | F16, F17 | 2     |
| C23 | A documented threat model for `src/night/sandbox.mjs`, naming what the sandbox does and does not contain, published rather than implied                                                                                         | F16      | 2     |
| C24 | `abatty init` offers the shim layer and the tool-use hook that parse every git command, so a bypass is refused rather than instructed against                                                                                   | F19      | 0     |
| C25 | Generated CI detects commits made with a bypass; the report carries a bypass rate and what was bypassed; a bypass with a documented reason is accepted, an undocumented one is a finding                                        | F20      | 1     |
| C26 | A `cra` profile mapping rules to the regulation's essential requirements, with a machine-readable SBOM as a rule and a vulnerability-handling policy among the day-0 documents                                                  | F21      | 1     |
| C27 | An evidence export from the report: what held, when it was checked, against which version of the standard, in a form that can go into technical documentation                                                                   | F21      | 3     |
| C28 | CODE-ESLINT and CODE-MAXWARN are restated as properties rather than products: a linter runs on the gate, zero warnings are tolerated, whichever tool provides it; the typecheck step accepts the Go compiler                    | F22      | 1     |
| C29 | The gate's selection in a workspace traverses the import graph, or falls back to the full set and says so in the output; a path filter alone is never the selection                                                             | F23      | 0     |
| C30 | Semantic exit codes documented in the help, `--json` and `--plain` on every command a script may consume, configuration precedence stated, additive-change policy adopted, and telemetry off by default with documented consent | F24, F25 | 0     |

C21, C24, C29 and C30 need no new research and should land with the changes marked phase 0 in the
first round. C26 is the largest piece of new work in either round and the one with an external
deadline attached.

## 11. Sources

Security.

57. OWASP. _Top 10 for Agentic Applications_, 2026 edition, published December 2025.
58. Mozilla 0DIN. Proof-of-concept compromise of a developer machine through a malicious repository and indirect prompt injection, reported June 2026.
59. Wang, H., Poskitt, C. M., Sun, J. _AgentSpec: Customizable Runtime Enforcement for Safe and Reliable LLM Agents._ ICSE 2026.
60. Greshake, K. et al. _Not What You've Signed Up For: Compromising Real-World LLM-Integrated Applications with Indirect Prompt Injection._ AISec 2023.
61. Hines, K. et al. _Defending Against Indirect Prompt Injection Attacks with Spotlighting._ arXiv:2403.14720.
62. Wu, F., Cecchetti, E., Xiao, C. _System-Level Defense Against Indirect Prompt Injection Attacks: An Information Flow Control Perspective._ arXiv:2409.19091.
63. Wu, Y. et al. _IsolateGPT: An Execution Isolation Architecture for LLM-Based Agentic Systems._ arXiv:2403.04960.
64. Wang, P. et al. _AgentArmor: Enforcing Program Analysis on Agent Runtime Trace to Defend Against Prompt Injection._ arXiv:2508.01249.
65. Debenedetti, E. et al. _AgentDojo: A Dynamic Environment to Evaluate Prompt Injection Attacks and Defenses for LLM Agents._ NeurIPS 2024.
66. _Indirect Prompt Injection in the Wild: An Empirical Study of Prevalence, Techniques, and Objectives._ arXiv:2604.27202.
67. _Prompt Injection Attacks on Agentic Coding Assistants: A Systematic Analysis of Vulnerabilities in Skills, Tools, and Protocol Ecosystems._ arXiv:2601.17548.

Enforcement and bypass.

68. Vendor issue tracker report of a frontier model bypassing permission denials and context-file instructions across six consecutive commits with `--no-verify`, stash and quiet flags; closed as not planned.
69. Practitioner analysis of the four enforcement layers and the conclusion that the hook layer is the only reliable one, 2026.
70. Thoughtworks. _Pre-commit: don't git hooked._ On the economics of hook speed and the inevitability of the bypass flag.

Regulation.

71. Regulation (EU) 2024/2847, the Cyber Resilience Act.
72. European Commission. _Cyber Resilience Act reporting obligations_ and the single reporting platform, operational 11 September 2026.
73. Open Source Security Foundation. CRA resources for manufacturers, stewards and maintainers.
74. Open Regulatory Compliance Working Group. CRA guidance for open-source stakeholders.

Tooling.

75. Oxc project documentation. Oxlint: rule coverage, migration tooling, multi-file analysis, type-aware linting through the Go TypeScript compiler.
76. Biome documentation and the v2 type-inference approach, with its own parity figures.
77. Microsoft. TypeScript 7, the Go port of the compiler, released 8 July 2026.
78. Comparative guides to the three linters, 2026, on the layered adoption pattern.

Monorepo.

79. Vendor and practitioner guidance on affected selection: the two calculations, the insufficiency of path filters, and the conservative-inputs-first rule, 2026.
80. Turborepo `--affected` with an explicit base, and the project-graph traversal it performs.

Command line.

81. _Command Line Interface Guidelines_, clig.dev, and the rule sets derived from it.
82. Worked example of semantic exit codes with an automated conformance test, 2026.
83. Thoughtworks. _Elevate developer experiences with CLI design guidelines._

Benchmarks.

84. OpenAI. _Why SWE-bench Verified No Longer Measures Frontier Coding Capabilities_, February 2026.
85. Deng, X. et al. _SWE-bench Pro: Can AI Agents Solve Long-Horizon Software Engineering Tasks?_ arXiv:2509.16941.
86. Badertdinov, I. et al. _SWE-rebench v2: Language-Agnostic SWE Task Collection at Scale._ arXiv:2602.23866.
87. _SWE-bench-Live_, the continuously updated repository-level benchmark. arXiv:2505.23419.
88. Mündler, N. et al. _SWT-Bench: Testing and Validating Real-World Bug-Fixes with Code Agents._ NeurIPS 2024.
89. Merrill, M. A. et al. _Terminal-Bench: Benchmarking Agents on Hard, Realistic Tasks in Command Line Interfaces._ arXiv:2601.11868.
90. OpenAI. _Harness Engineering_, 2026.
