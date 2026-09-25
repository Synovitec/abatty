---
title: "Versioning"
description: "What a version number promises while the package is 0.x: what bumps the minor (anything that can turn an adopter's green run red or change what a machine reads), what is a patch, and what is not part of the contract at all. Read it before a release, and before an update."
category: governance
status: living
audience: ["developer", "architect", "agent"]
tags: ["versioning", "semver", "release", "contract"]
related: ["../CHANGELOG.md", "../CONTRIBUTING.md", "../SECURITY.md"]
source_truth:
  ["../src/ratchet/config.mjs", "../schema/abatty.config.schema.json", "../src/cli/exit.mjs"]
scope: synovitec
last_verified: "2026-09-25"
---

# Versioning

SemVer promises nothing below 1.0, so this page does: a tool that runs inside somebody's commit
and push hooks is only adoptable if its maintainers say in advance what an update can do to them.
The model is the one linters that stay at 0.x for years publish: **the minor is the breaking
number, the patch is not.**

## A minor (0.x → 0.x+1) is anything that can turn a green run red, or change what a machine reads

- **A probe that blocks and did not before**: a new probe that is neither opt-in nor on probation,
  a probe promoted out of probation, an opt-in probe that `init` starts enabling.
- **A probe that counts differently**: its `version` rises whenever what it counts changes, scope
  included (a `source_truth` wildcard it now expands, a folder it now reads), so the floor
  written under the old definition reads as redefined instead of as a regression nobody caused.
- **A default that moves adopters' numbers**: the exempt list, a kind budget, a cap.
- **A hook that refuses something it allowed**, or a gate step added to the default gate.
- **The configuration schema** (`abatty.config.json`): a key renamed, removed or made stricter.
- **A machine surface**: the shape of `--json` or `--sarif` output, the MCP tools' inputs and
  outputs, and the exit codes (`src/cli/exit.mjs`: 0 clean, 2 input, 3 findings, 4 error).
- **A harness template that `update` has to merge**, when the merge can conflict.

One breaking axis per minor. Several at once is how a tool's biggest upgrade becomes the one
nobody takes: an adopter who reads one sentence of the notes should learn everything that changed
for them. The migration ships in the same release as the change, never after it: `abatty update`
for the harness and for a redefined probe (whose floor it rewrites under the new definition,
touching no other), the changelog for the rest, and a migration is tested like any other code.
What `update` cannot migrate it says, and exits 3 when it leaves the gate red: a redefined HARD
check that now counts above zero. Every minor also retires the step controls an older one
planted, so a night is refused until `abatty doctor --controls` runs again (a few minutes); `update`
says that too.

## A patch (0.x.y → 0.x.y+1) cannot turn a green run red

- A fix to a false positive that removes findings without redefining the probe. A floor above
  the new count reads as one to lock, which `abatty baseline` does in one command.
- A new probe that is opt-in or on probation.
- Documentation, the standard's text, and a rule's `next` step.
- A fix to a crash, a message or a platform.

## Not part of the contract

The human-readable terminal output (its words, colours, order and layout), the text of a finding's
detail and of a verdict's message, the files under `.abatty/`, and anything not exported from
`src/`. Scripts that parse the terminal break without notice; the `--json` output is the one to
read.

## The contract, as data

The surfaces above are held as one file, `test/contract/surface.json`: the commands, the exit
codes, the config's keys, every probe with its kind and definition version, every rule with its
level and enforcement, the shapes of the JSON report, the ratchet's JSON and SARIF, and the steps
and actions of the pipeline `abatty ci` writes. A test fails when any of them changes, so a change
is made on purpose: rewrite the snapshot (`UPDATE_CONTRACT=1 node --test
test/contract-surface.test.mjs`), name the change under Upgrading in the changelog, and ship it in
a minor. When the snapshot goes a stretch of releases without changing, the contract is ready to be
promised as 1.0.

## Where the version lives

`package.json` holds the package's version. `abatty` in an adopter's `abatty.config.json` is the
version that repository follows, and `abatty update` moves it. The changelog's `[Unreleased]`
section becomes `## [x.y.z] - date` on the release commit, and a release is a tag
(CONTRIBUTING.md).
