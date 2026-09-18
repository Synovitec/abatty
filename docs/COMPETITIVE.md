---
title: "Competitive landscape"
description: "The five rings around abatty, what each ring does and does not do, the named tools in each, the four things nobody claims, and the distribution channels that follow. A living file: the research behind it is dated, this is not."
category: governance
status: living
audience: ["architect", "reviewer"]
tags: ["competition", "positioning", "market"]
related:
  [
    "./POSITION.md",
    "./standard/research/09-market-and-voices.md",
    "./standard/research/07-evidence-base.md",
  ]
scope: synovitec
last_verified: "2026-09-18"
---

# Competitive landscape

The reasoning behind this file is in `docs/standard/research/09-market-and-voices.md`, which is
dated and does not change. This file is the current picture and is expected to change. Rule for
maintaining it: a tool enters the matrix when it overlaps a command this package ships, and its row
states what it does **and** what it does not do. A row without the second half is marketing.

## The one-line position

abatty installs the computational half of a coding-agent harness, proves its sensors can fail, and
signs the record.

In the vocabulary the field settled on in 2026: guides are feedforward controls that steer an agent
before it acts, sensors are feedback controls that let it self-correct after, and each is either
computational, deterministic and fast, or inferential, semantic and probabilistic. Most of the
market ships inferential sensors. This package ships computational ones, plus the guides that
install them, plus the proof that they work.

## The five rings

### Ring 1: harness installers

**What they do.** Project one set of conventions into every agent's native format: the context
file, the rules directory, the skills folder, the subagent definitions, the tool-server
configuration, per tool and per surface.

**Named.** ruler (the per-agent path matrix), klaussy-agents, horus-harness (init, doctor, upgrade,
overhead, dashboard), AgentSync (drift as a gate), agent-standards, agent-kit.

**What they do not do.** None of them measures the repository, none enforces a standard, and none
survives contact with the agent vendors, who absorbed a large part of this layer during 2026.

**Overlap.** `abatty init`, `abatty update`, `abatty doctor`, `abatty agents`.

**Position.** Do not invest here beyond emitting the interoperable context file. This is the part
of the package with the shortest expected life.

### Ring 2: ratchets and gates

**What they do.** Commit a baseline of current findings, refuse an increase, and in the better ones
refuse a stale entry too.

**Named.** Betterer (machine-regenerated snapshot), pytest-ratchet (human-owned entries with a
required reason), codelore (snapshot with a schema key per metric), qualitygate-cli (the CLI
enforces policy, external analyzers find the issues), eslint-formatter-ratchet (the minimal form),
and the single-ecosystem baselines in PHPStan, Psalm, mypy, ESLint bulk suppressions, RuboCop and
import-linter.

**What they do not do.** None carries a rule catalog with reasons and enforcement levels, none
validates its rules against anything, and only one installs an agent harness alongside.

**Overlap.** `abatty ratchet`, `abatty baseline`.

**Position.** Table stakes. Adopt the two good ideas from this ring, human-owned justified entries
and schema-versioned metric definitions, and stop treating the ratchet as the differentiator.

### Ring 3: scorecards and internal developer portals

**What they do.** Define standards centrally, evaluate every service against them, aggregate into
scorecards, assign owners and due dates, and report to leadership.

**Named.** Cortex Scorecards, OpsLevel checks and rubric, Backstage Tech Insights.

**What they do not do.** They observe from outside the repository. They can record that a standard
is unmet; they cannot refuse the commit that breaks it, and they do not install anything in the
repository that would.

**Overlap.** `abatty measure`, `abatty serve`, `abatty dashboard`.

**Position.** Not a rivalry, a channel. A plugin that publishes conformance into an existing
catalogue puts this package in front of platform teams who already bought the portal.

### Ring 4: review bots

**What they do.** Read a diff, or the whole repository, and comment semantically on a pull request.

**Named.** CodeRabbit, Greptile, Qodo, DeepSource, Cursor's reviewer, and the agent vendors' own
multi-agent review, shipped in March 2026.

**What they do not do.** They are probabilistic and after the fact. They advise a human; they do
not constrain the agent that wrote the code, and their published accuracy comparisons are
vendor-reported and not comparable to each other.

**Overlap.** None, properly understood. They are inferential sensors; this package is a
computational one. They belong in the same harness at a different tier.

**Position.** Never claim to replace them. The honest line is that the bots review and the gate
refuses.

### Ring 5: compliance automation

**What they do.** Collect evidence continuously from cloud providers, identity systems, human
resources systems and repository settings, map it to framework controls, and present it to an
auditor.

**Named.** Vanta, Drata, Secureframe, Sprinto, Kosli and the wider list of alternatives.

**Numbers.** Published pricing bands run from roughly six to twelve thousand a year for an
early-stage team to thirty to eighty thousand for an enterprise deployment. The category describes
itself as automating seventy-five to eighty-five per cent of manual evidence gathering and saving
two to four hundred engineering hours per audit cycle. All vendor-reported.

**What they do not do.** None of them produces evidence about engineering practice inside the code.
The deepest engineering signal any of them advertises is noticing that a branch protection rule was
bypassed. No control in that ring states that architecture boundaries were mechanically enforced on
every commit for a year, that every gate step was proven capable of failing, or that each exception
carries a reason and an owner.

**Overlap.** None today. That is the point.

**Position.** This is the ring with budget, a deadline in December 2027, and a gap that matches
what this package already computes and currently discards.

## The sixth ring, which is not a competitor

Supply-chain attestation: a signed statement about the execution of a step, with custom predicate
types and defined verification workflows, a build-level specification most people meet it through,
a source-side track under development, and a signing ecosystem with identity-bound ephemeral keys
and a transparency log.

The correct move is to emit conformance as a custom predicate in that format, signed with that
ecosystem, aimed at the source track. A bespoke record would need a reader and a market. A
predicate is consumable by tooling that already exists.

## What nobody in any ring claims

Four things, each a consequence in the research files rather than an aspiration:

1. A published, measured effective false-positive rate for the tool's own rules.
2. A rule catalog validated against the defect history of the repository it runs in.
3. A harness that reports its own token cost and proves every gate step can go red.
4. A baseline that is human-owned, with a required reason per entry and schema-versioned metric
   definitions.

## Distribution, in the order the diffusion evidence supports

1. An account of this repository's own dogfood in the field's vocabulary, negative results
   included.
2. The interoperable context file emitted by `abatty init`, so the package is visible in
   repositories that use other agents.
3. A continuous-integration action, because a workflow file is readable by everyone who reads the
   repository.
4. A portal plugin for ring 3, which reaches platform teams that already bought a catalogue.
5. The conformance predicate for ring 5, which reaches a buyer with a deadline.

## What would change this file

- An agent vendor shipping a rule catalog with enforcement levels would collapse rings 1 and 2 into
  the platform.
- A compliance platform shipping repository-level practice evidence would close the ring 5 gap and
  remove the commercial wedge.
- A portal shipping an enforcement agent that runs inside the repository would turn ring 3 from a
  channel into a rival.

Each of the three is worth a quarterly check.
