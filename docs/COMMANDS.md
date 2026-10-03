---
title: "Commands"
description: "Every abatty command with what it does, and the flags every command shares for logs, colour and machine output. `abatty help` gives the full flag list of each."
category: reference
status: living
audience: ["developer", "agent"]
tags: ["cli", "commands", "reference"]
related: ["../README.md", "./HOW_IT_WORKS.md"]
source_truth: ["../bin/abatty.mjs"]
last_verified: "2026-10-04"
---

# Commands

| Command               | What it does                                                                                                                             |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `abatty`              | Where the repository stands: the phase, the score, the trend                                                                             |
| `abatty status`       | The same reading, by name                                                                                                                |
| `abatty prove`        | Which of the repository's checks can fail: each gate step planted with a violation, on a copy; nothing written, no setup needed          |
| `abatty init`         | Install the instrument for the detected or named stack                                                                                   |
| `abatty gate`         | The gate. `--fast` omits the heavy suites; `--preflight` says what each step needs, runs none                                            |
| `abatty ratchet`      | Every probe against the committed baseline. `--controls` runs the control cases                                                          |
| `abatty baseline`     | Record today's numbers as the floor                                                                                                      |
| `abatty raises`       | The floors loosened against the base, and the review that can land them                                                                  |
| `abatty mutate`       | One mutant per changed line of product code, run on the repository's runner against the nearest tests; a survivor exits 3                |
| `abatty doctor`       | The harness self-test and drift against the package. `--controls` proves the gate steps                                                  |
| `abatty measure`      | The gap analysis: every check, with next steps by phase; the reading before names this one                                               |
| `abatty report`       | The newest reading as JSON (`.abatty/reports/`)                                                                                          |
| `abatty rules`        | The rule catalog. Filter by family, level or phase; `--md` regenerates the catalog document                                              |
| `abatty explain <ID>` | One rule, its reason, and its finding here                                                                                               |
| `abatty check <ID>`   | One rule as an exit code, for a script                                                                                                   |
| `abatty fix`          | What a phase asks for that a machine can write. Prints a plan unless `--write`                                                           |
| `abatty secrets`      | The secret scan over the tree, the staged files or a range. `--benchmark` measures it                                                    |
| `abatty ci`           | Generate CI from the gate; one you keep is judged, never overwritten. `--ruleset` prints a ruleset                                       |
| `abatty publish`      | Post the newest report to a hosted dashboard (the CI step)                                                                               |
| `abatty update`       | Bring the harness to the package's version, keeping your edits                                                                           |
| `abatty hooks`        | Point git at `.githooks` and make the hooks executable (what `hooks:install` runs)                                                       |
| `abatty changelog`    | The changelog rule at commit time: staged source carries its line, or the message says why. `--release` folds the entries into a version |
| `abatty config`       | The configuration file, its problems against the schema, and `--migrate`                                                                 |
| `abatty presets`      | The stacks, and which repository proved each                                                                                             |
| `abatty profiles`     | The standards this repository follows                                                                                                    |
| `abatty agents`       | The coding-agent adapters: what each gives, and what this repository loses without one                                                   |
| `abatty mcp`          | The MCP server over stdio: measure, ratchet, gate, scrub, report and explain as tools                                                    |
| `abatty attest`       | The conformance statement, ready to sign                                                                                                 |
| `abatty evidence`     | The regulatory requirement mapping, for a person to read                                                                                 |
| `abatty validate`     | Whether the files a rule reports are the files somebody later had to fix, here                                                           |
| `abatty dashboard`    | One HTML page over the reports of one or many repositories                                                                               |
| `abatty serve`        | Host that dashboard, so CI can post each report to it                                                                                    |
| `abatty portal`       | The conformance as a developer-portal catalogue entity                                                                                   |
| `abatty night`        | The unattended run, with its pre-flight and canary session                                                                               |
| `abatty night-report` | A night's facts, and the lessons they propose                                                                                            |
| `abatty scrub`        | Opt-in: remove tool, vendor and model names from files, commits and pull requests                                                        |
| `abatty help`         | Every command with its flags                                                                                                             |

Run `abatty help` for the full flag list of each.

## Output

Every command accepts `--plain` for ASCII markers and no colour, which is what a log parser wants.
It reaches the commands abatty starts in turn (the gate's steps) through `ABATTY_PLAIN=1`, which a
pipeline can also set itself. Colour is off automatically outside a terminal and in CI. `measure`,
`ratchet`, `rules`, `check`, `prove` and `report` take `--json`.

On a classic Windows console (PowerShell 5.1, cmd), which shows UTF-8 garbled, abatty's symbols
are written in ASCII (`·` as `-`, `✓` as `ok`); `ABATTY_ASCII=1` asks for that anywhere and
`ABATTY_ASCII=0` turns it off.

## Configuration

`abatty.config.json` at the repository root is the single configuration file, validated against
the schema the package ships. It carries the commands, the file locations, the push policy, the
phases, the profiles, the ratchet settings, waived rules with their reasons, and the optional
scrub. `abatty config` reports where it is and what is wrong with it. `abatty update` adds keys
that the template gained and never replaces a value you set.
