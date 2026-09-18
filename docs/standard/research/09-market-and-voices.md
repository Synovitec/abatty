---
title: "Research 2026-09-18: the vocabulary, the voices, the numbers a buyer feels, and the rings around us"
description: "The third round: the guides-and-sensors frame the industry standardised on, the named practitioners whose positions are this package's thesis, the measured pain companies are already feeling, the five competitive rings and the one to join rather than fight, and the decision to emit conformance as an in-toto predicate. Findings graded, changes numbered from C31."
category: reference
status: stable
audience: ["architect", "developer", "reviewer"]
tags: ["research", "positioning", "harness", "market", "attestation", "compliance", "adoption"]
related:
  [
    "./07-evidence-base.md",
    "./08-security-compliance-tooling.md",
    "../../COMPETITIVE.md",
    "../../POSITION.md",
  ]
scope: synovitec
last_verified: "2026-09-18"
---

# Research: the vocabulary, the voices, the numbers, and the rings (2026-09-18)

Third and last round of the same day, continuing the finding and change numbering of
`docs/standard/research/07-evidence-base.md` and
`docs/standard/research/08-security-compliance-tooling.md`.

The first round asked whether the mechanisms are right. The second asked whether they are safe and
lawful. This one asks the question that decides whether any of it matters: who else is in this
space, what words do they use, which people does the field listen to, what pain does a buyer
already feel, and what should this package therefore call itself.

The short conclusion, stated before the evidence: the industry named this category in April 2026,
the name is not ours, the people who named it describe the product we are building, and the
adjacent market with budget is not the linter market.

## 0. Scope and method

Sources: the article that gave the category its vocabulary and its follow-ups, the published
positions of practitioners the field actually reads, measured reports on the cost of agent-written
code, the research programme that engineering leaders benchmark against, the product documentation
of the five adjacent categories, and the specifications for supply-chain attestation. Grades as
before: `strong`, `moderate`, `contested`, `reported`.

Two limits. Several of the buyer numbers in section 4 are vendor-measured and are graded
`reported` for that reason; they are useful as orders of magnitude and as the language a buyer
already uses, not as proof. And a competitive landscape is a snapshot: `COMPETITIVE.md` at the
repository root carries the live matrix, this file carries the reasoning behind it.

## 1. Findings in brief

| #   | Finding                                                                                                                 | Grade    | Bears on                                            |
| --- | ----------------------------------------------------------------------------------------------------------------------- | -------- | --------------------------------------------------- |
| F28 | The category has a published vocabulary: guides and sensors, feedforward and feedback, computational and inferential    | strong   | `README.md`, the standard's opening, every command  |
| F29 | A good sensor emits a signal optimised for the model, carrying the instruction for its own correction                   | strong   | The output of `abatty gate`, `src/ui/term.mjs`      |
| F30 | Feedforward without feedback encodes rules that are never verified; feedback without feedforward repeats mistakes       | moderate | The pairing of `init` and `gate`                    |
| F31 | The slowest sensor in the loop sets the pace of the whole loop; latency is a correctness property of the harness        | moderate | `abatty gate --fast`, a budget rule on this package |
| F32 | The practitioners the field reads have converged on verification over review                                            | strong   | Positioning, `docs/POSITION.md`                     |
| F33 | Review capacity, not generation, is the measured bottleneck, and the queue is growing                                   | reported | The wedge                                           |
| F34 | Developers do not trust agent output and mostly do not verify it either                                                 | reported | The wedge                                           |
| F35 | AI amplifies existing engineering habits rather than replacing them; weak pipelines compound debt                       | strong   | The sales argument, and the honest one              |
| F36 | Internal platforms with golden paths and secure defaults are a named capability that decides AI outcomes                | strong   | `abatty init`, the preset story                     |
| F37 | The compliance platforms collect evidence from infrastructure and settings, never from engineering practice in the code | moderate | The commercial wedge, C26 in the second round       |
| F38 | A signed, verifiable statement about a supply-chain step is a solved format with custom predicate types                 | strong   | `abatty attest`, the decision not to invent         |
| F39 | The source-side track of the attestation standard is under development and invites exactly this predicate               | moderate | Timing of the attestation work                      |
| F40 | Adoption follows social exposure and observable signals, and the people with standing are writing about this now        | moderate | Where to publish, and to whom                       |

## 2. The vocabulary (F28, F29, F30, F31)

In April 2026, a Distinguished Engineer at Thoughtworks published an article on Martin Fowler's
site titled _Harness engineering for coding agent users_. It became the canonical vocabulary for
this category within weeks, and was followed by an OpenAI publication using the same term, a
practical follow-up on maintainability sensors, a podcast episode, and a wave of secondary
writing. The model it sets out:

- **Guides**, feedforward controls, anticipate the agent's behaviour and steer it before it acts.
  They raise the probability that the agent gets it right on the first attempt.
- **Sensors**, feedback controls, observe after the agent acts and let it self-correct before a
  human is involved.
- Each is either **computational**, deterministic and fast, run by the processor, or
  **inferential**, semantic and non-deterministic, produced by a model.
- The two are not alternatives. Feedback alone produces an agent that repeats the same mistakes.
  Feedforward alone produces an agent that encodes rules and never finds out whether they worked.
- The human's role is to steer by iterating on the harness itself: when an issue recurs, improve
  the controls rather than supervise more closely.

Read against this package, the mapping is exact and unflattering only in one place. `abatty init`
writes guides. `abatty gate`, `abatty ratchet`, `abatty secrets` and `abatty doctor` are
computational sensors. `abatty night-report` proposing lessons is the steering loop. The package
is a computational harness in a market that mostly ships inferential ones, and it has been
describing itself in a private vocabulary while the public one was being set.

Two sharper points from the same source.

**The definition of a good sensor** is the most actionable sentence found in three rounds of
research: a sensor is particularly powerful when it produces signals optimised for consumption by
the model, for example a custom linter message that includes the instruction for the correction,
described as a positive kind of prompt injection. The output of `abatty gate` today tells a human
what is wrong. It should tell the agent what to do next and how to check that it worked. That is
the difference between a sensor and a report.

**Latency is not a nicety.** The practitioner argument that runs alongside this frame is that the
slowest sensor the agent needs on every iteration sets the pace of the entire loop, and that the
difference between a three-millisecond tool and one that compiles for five seconds and then boots
a database changes the quality of the flow, not only its speed. The sorting that follows is
milliseconds to seconds for the inner loop, seconds to minutes for the gate, and minutes or more
for anything that does not belong in every build. Measured on this repository on 2026-09-18,
status is 120 ms, `abatty measure` is 167 ms and `abatty gate --fast` is 6.7 s. The first two are
inner-loop fast. The third is gate-tier and should stay there by rule rather than by luck.

Consequence: C31, C32, C33.

## 3. The voices (F32)

Positioning is not decided by whoever is loudest, but a category does have people the field
actually reads, and on this question they have converged. Their published positions, in their own
framing:

- The most widely read independent writer on this technology states the core skill as being able
  to instruct an agent confidently and then **verify** that the change was applied correctly. Not
  read, not review, verify. The same writer has argued that no amount of meticulous review, or even
  comprehensive automated tests, demonstrably proves that code does the right thing.
- A prominent framework author published a piece in February 2026 arguing that AI speeds up
  writing code while accountability and review capacity impose the hard limit, and describes what
  happens without guardrails as a loop of accumulating slop.
- Martin Fowler, in March 2026: everyone advises writing a specification before prompting, and
  almost nobody takes the next step of encoding it into automated tests that enforce the contract.
  The specification is the blueprint; the safety net is the suite.
- A widely read engineering writer records a developer describing the review of an agent's pull
  request as being the first human to lay eyes on the code, which is archaeology rather than
  review.
- The harness article's own summary of where checks belong is three words: keep quality left.

Five independent positions, one argument: instructions are not enforcement, review does not scale,
and the check has to move earlier and be mechanical. That argument is this package's reason to
exist, and it was made by other people, which is worth more than making it ourselves.

Consequence: C34.

## 4. The numbers a buyer already feels (F33, F34, F35, F36)

Graded `reported` where the measurement is a vendor's own, and `strong` where it comes from the
research programme engineering leaders benchmark against.

- A workflow-analytics vendor reports that AI-assisted teams produce roughly four times the code
  while delivering about twelve per cent additional value, with review duration up about 440 per
  cent, code churn up about 860 per cent, and defect rates per developer rising from nine to
  fifty-four per cent. `reported`
- Another vendor's analysis of 8.1 million pull requests finds AI-generated code waits about 4.6
  times longer for its first review. `reported`
- A code-quality vendor's 2026 state-of-code report finds 96 per cent of developers do not fully
  trust the functional accuracy of AI-generated code, while only 48 per cent verify it before
  committing. `reported`
- The DORA programme, citing Stanford work, reports 35 to 40 per cent productivity gains on simple
  greenfield tasks and often under ten per cent on complex legacy code, and describes a J-curve in
  which value arrives after an initial dip. An independent measurement recorded a swing from a 19
  per cent slowdown to an 18 per cent speedup over twelve months. `strong`
- DORA's 2025 capabilities model names seven organisational capabilities that decide whether AI
  amplifies effectiveness or problems. Two are directly this package's subject: strong version
  control practices, and quality internal platforms providing golden paths and secure defaults.
  `strong`
- By 2025, 90 per cent of organisations reported using an internal developer platform and 76 per
  cent had a dedicated platform team. `strong`
- The programme's own conclusion is the honest sales argument and the honest warning at once: AI
  amplifies existing habits, so an organisation with slow review and a fragile suite compounds debt
  rather than reducing it, and the pipeline should be fixed before generation is scaled.

What a buyer takes from this: generation got four times cheaper, review did not, the queue is
growing, and most people know they are not verifying. That is a problem with a budget attached,
and it is the language the front page should use instead of the word standard.

Consequence: C34 and C35.

## 5. The rings around this package (F37)

Five adjacent categories. Only one is a genuine competitor, and the most interesting one is not a
competitor at all. The live detail lives in `COMPETITIVE.md`; the reasoning is here.

**Harness installers.** Cross-agent projection of one convention set into each tool's native
format. Overlaps `abatty init` and `abatty doctor`. Being absorbed by the agent vendors, as the
second round recorded. Not where to invest.

**Ratchets and gates.** Committed baselines with bidirectional enforcement, in at least five
mature single-ecosystem tools and three general-purpose implementations. Overlaps `abatty ratchet`
and `abatty baseline`. Table stakes, not a moat.

**Scorecards and internal developer portals.** Standards defined centrally, measured across a
catalogue, reported to leadership. Overlaps `abatty measure` and `abatty serve`. The direction
differs: they observe repositories from outside, this package installs enforcement inside. That
makes a plugin publishing conformance into a portal a distribution channel rather than a rivalry.

**Review bots.** Probabilistic, semantic, after the fact. In the vocabulary of section 2 they are
inferential sensors, and this package is a computational one. Different product, complementary
place in the same harness.

**Compliance automation.** The ring with budget. Published pricing runs from roughly six to twelve
thousand a year for a startup to thirty to eighty thousand for an enterprise deployment; the
platforms are described as automating seventy-five to eighty-five per cent of manual evidence
gathering and saving two to four hundred engineering hours per audit cycle. Their evidence comes
from cloud providers, identity systems, human-resources systems and repository settings. The
deepest engineering example any of them advertises is noticing that a developer bypassed a branch
protection rule.

That is the gap, and it is precise. **No platform in that ring produces evidence about engineering
practice inside the code.** None can state that a repository's architecture boundaries were
mechanically enforced on every commit for a year, that every gate step was proven capable of
failing, or that each exception carries a reason and an owner. That statement is what the
regulation recorded in the second round will require as secure-by-design evidence from December
2027, and it is exactly what this package already computes and then throws away.

Consequence: C36 and C37.

## 6. The ring to join rather than fight (F38, F39)

There is a sixth ring, and the correct move there is to adopt, not compete.

The attestation framework used across the supply-chain ecosystem defines a lightweight signed
statement about the execution of a supply-chain step, with **custom, use-case-specific predicate
types**, and it defines verification workflows over those statements rather than only a file
format. The build-level specification that most people meet it through uses one such predicate for
build provenance, and its maintainers state explicitly that other predicates complement it. A
**source-side track, concerned with the security posture of how source is stored and developed
before it reaches a build, is under development**, and is named as the place where complementary
predicates belong. Signing is a solved problem in the same ecosystem, with ephemeral keys bound to
an identity and recorded in a transparency log, which is the mechanism this package's own release
workflow already uses for publication provenance.

The consequence for the conformance record proposed in the design work: it must not be a bespoke
JSON document. It should be **a custom predicate in the established attestation format, signed
with the established signing ecosystem, aimed at the source track**. The difference is not
cosmetic. A bespoke file needs a reader this package would have to write and a market that would
have to adopt it. A predicate in the standard format is consumable on day one by policy engines,
verification tooling and procurement processes that already exist.

Consequence: C38 and C39.

## 7. Where the early adopters are (F40)

The first round recorded that diffusion follows social exposure, competition and observability, and
that early adopters differ from other developers in social standing and technological openness.
This round locates them. The people writing the canonical articles on this subject are, at this
moment, hand-rolling the thing this package installs. One of them published a practical walkthrough
of using maintainability sensors on her own codebase. That is not a competitor, it is the profile
of the first user, and the article is effectively an open invitation.

The corollary is uncomfortable and worth writing down: the way in is a well-written account of this
repository's own dogfood, framed in their vocabulary, including the negative results. The score
moving from 53 to 71, six real defects found in one day, the context-file evidence that contradicts
half the field's advice, and the measurements that have not been made yet. Honesty is the only
asset a project with no users owns.

Consequence: C40.

## 8. Threats to validity

- **Vendor numbers are vendor numbers.** Section 4's first three bullets are measured by companies
  selling into the problem they measure. They are graded `reported`, they should be cited as such,
  and none of them should appear in this package's marketing without that attribution.
- **A vocabulary can shift.** Section 2 describes a frame that is five months old. It is being used
  by a frontier laboratory and a major consultancy, which makes it likely to persist, but a rule
  should never be written against a word.
- **The compliance gap is an inference.** No platform in that ring advertises code-level practice
  evidence, and none was found to produce it. That is an absence of evidence from public material,
  not a proof of absence; before the claim is made commercially it should be checked against at
  least one platform's actual control catalogue.
- **Positioning is not product.** Everything in this file changes what the package says about
  itself. Only C31, C32, C38 and C39 change what it does.

## 9. Consequent changes

Continuing the numbering of the first two rounds.

| ID  | Change                                                                                                                                                                      | From          | Phase |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ----- |
| C31 | Every finding emitted by the gate carries the correction instruction and a machine-checkable post-condition, so the output is a sensor signal rather than a report          | F29           | 0     |
| C32 | A latency budget per tier, declared and enforced on this package: inner-loop checks in milliseconds, the gate in seconds, everything else out of the loop                   | F31           | 1     |
| C33 | The standard adopts the guides-and-sensors vocabulary: each rule is labelled as a guide or a sensor, computational or inferential, in `src/rules/index.mjs` and the catalog | F28, F30      | 1     |
| C34 | The README opens with the buyer's problem and the practitioners' framing, cited, not with the phrase engineering standard                                                   | F32, F33, F34 | 0     |
| C35 | The measurement story is told as amplification: the gate is what makes an existing pipeline hold under four times the volume, not a promise of speed                        | F35           | 0     |
| C36 | The conformance record is scoped to what the compliance ring cannot produce: enforcement over time, control proofs, exceptions with owners                                  | F37           | 2     |
| C37 | A portal plugin publishes conformance into an existing catalogue rather than competing with it                                                                              | F37           | 3     |
| C38 | `abatty attest` emits a custom predicate in the established attestation format, not a bespoke document                                                                      | F38           | 2     |
| C39 | Signing uses the established ecosystem and the same identity mechanism as the release provenance already configured in `.github/workflows/release.yml`                      | F38, F39      | 2     |
| C40 | One outward artefact before any further feature work: this repository's dogfood in the field's vocabulary, negative results included                                        | F40           | 0     |

C31, C34, C35 and C40 are writing rather than engineering and should land first. C38 and C39 are
the ones that make the attestation work worth doing at all.

## 10. Sources

Vocabulary and frame.

91. Böckeler, B. _Harness engineering for coding agent users._ martinfowler.com, April 2026.
92. Böckeler, B. _Maintainability sensors for coding agents._ martinfowler.com, May 2026.
93. Thoughtworks Technology Podcast. _What is harness engineering?_, June 2026.
94. OpenAI. _Harness Engineering: Leveraging Codex in an Agent-First World_, February 2026, on constraints, observability and feedback loops.
95. Secondary syntheses of the guides-and-sensors matrix, including its use as an analytical lens in agent-framework research, 2026.

Practitioner positions.

96. Willison, S. On verification as the core skill of working with coding agents, 2026; and _Hallucinations in code_, 2025.
97. Ronacher, A. _The Final Bottleneck_, February 2026; and _Agentic Coding Recommendations_ on sensor latency.
98. Fowler, M. _Fragments_, 26 March 2026, on specifications and executable tests; and _Fragments_, 29 April 2026, on the harness-engineering article.
99. Osmani, A. _Agentic Code Review_, 2026.
100.  Fowler, M. Write-up of the Deer Valley retreat; Kim, G. and Yegge, S. _Vibe Coding_, cited in the DORA 2025 report.

Measured pain.

101. Faros AI. Production workflow analysis on output, value, review duration, churn and defect rates, 2026. Vendor-reported.
102. LinearB. Analysis of 8.1 million pull requests on first-review wait time, 2026. Vendor-reported.
103. SonarSource. _State of Code 2026_ on trust in and verification of AI-generated code. Vendor-reported.
104. DORA. _State of AI-assisted Software Development_, 2025, and the AI Capabilities Model.
105. DORA. _The ROI of AI-assisted Software Development_, 2026, including the J-curve and the Stanford figures.
106. DORA. _Capabilities: platform engineering_, on golden paths, cognitive load and platform adoption rates.
107. METR. Measurement of the swing from initial slowdown to speedup, 2025.

Rings.

108. Cortex Scorecards, OpsLevel checks and rubric, Backstage Tech Insights: product documentation, 2026.
109. Comparative guides to AI code review tools, 2026, including vendor-reported accuracy figures.
110. Compliance automation platform comparisons, 2026: pricing bands, evidence-automation share and audit-hour savings. Vendor-reported.
111. Kosli and adjacent tools positioned as engineering-evidence alternatives in that ring.

Attestation.

112. in-toto Attestation Framework: the Statement, predicate types and verification workflows.
113. SLSA specification: the build track, the provenance predicate, and the source track under development.
114. in-toto and SLSA maintainers on complementary predicates, slsa.dev.
115. Sigstore: ephemeral identity-bound signing and the transparency log.
116. npm provenance, as already configured for this package's releases.
