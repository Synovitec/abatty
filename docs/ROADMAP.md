---
title: "Roadmap"
description: "What abatty changes next and why, in the order the evidence of its first days dictates: the ratchet in the package, one runner, update, a root config, fixture repositories, then agent adapters, open-format skills, an MCP surface, the report and the learning distillation, the dashboard hosted, CI templates; later the hardening and the reach. Each item carries the evidence that put it there."
category: governance
status: living
audience: ["developer", "architect"]
tags: ["roadmap", "plan"]
related: ["./README.md", "../README.md", "./STANDARDS_PROGRESS.md"]
---

# Roadmap

Grounded in what the first days showed, not in what a framework usually has. Done items move
to the changelog; the order here is the order of the evidence.

## Now - the gaps that hurt every day

| #   | Change                                                                                                                                                                                                            | Evidence                                                                                                                                                                            | Size       |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 1   | **The ratchet in the package** (`abatty ratchet`, `abatty baseline`): probes as modules `{ metric, scan, controls }`, per-file floors, the scanned-zero guard, the score; a preset contributes its stack's probes | Still copied from the reference repository by hand; it is the heart of "a rule becomes a check"                                                                                     | 2-3 days   |
| 2   | **One runner in Node** replacing the two shell runners                                                                                                                                                            | Two implementations to keep equal; every runner bug of the first week (a BOM, a locale's decimal comma, a shell's path conversion) was runner-side; the stub night becomes its test | 1 day      |
| 3   | **`abatty update`**: a three-way merge of the harness against the installed version, the version recorded in the repository's config                                                                              | The harness was synced into the reference repository by hand three times in one day; `doctor` sees drift but can only overwrite                                                     | 1 day      |
| 4   | **`abatty.config.json` at the root** as the one config, with a JSON Schema                                                                                                                                        | Today the config lives under the agent's own folder; a tool-neutral name at the root reduces the required-path exceptions and lets other agents read it                             | half a day |
| 5   | **Fixture repositories per preset** in the tests (`next`, `vite-react`, `node`, `astro`)                                                                                                                          | "A preset is real when a repository proved it" - one repository proves one preset; fixtures prove the others without a client                                                       | 1 day each |

## Next - the shape of a framework

| #   | Change                                                                                                                                  | Evidence                                                                                                                                               | Size       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| 6   | **Agent adapters**: the harness talks to an agent through an adapter (hook protocol, settings folder, headless flags, permission modes) | Welded to one agent's hook protocol and folder name; an adapter is also the last step of "no trace of the tools", and what makes other agents drivable | 2 days     |
| 7   | **Skills in the open agent-skills format** and a rules layout the adapter maps                                                          | The skill is the protocol; it should not be agent-shaped                                                                                               | half a day |
| 8   | **An MCP server** exposing `measure`, `gate`, `scrub`, `report` as tools                                                                | An agent then verifies through a typed call rather than by parsing a shell; declared in the night's MCP config like any server                         | 1 day      |
| 9   | **`night-report`**: the learning distillation over the night's receipts, decisions and denials into proposed lessons                    | The learning box is files plus a human; the distillation step is missing                                                                               | 1-2 days   |
| 10  | **The dashboard hosted**: a small self-hosted service that CI posts each report to, serving the same page over every repository         | The local page exists (`abatty dashboard`); monitoring across repositories needs one place                                                             | 1-2 days   |
| 11  | **CI templates per preset**, a pull-request template, an organisation ruleset that blocks tool-named branches and requires the gate     | The night's controls stop at the push; CI is hand-written per repository; branch names were a trace                                                    | 1 day      |

## Later - hardening and reach

| #   | Change                                                                                                 | Evidence                                                               | Size       |
| --- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- | ---------- |
| 12  | Type declarations generated from the JSDoc; the generated gap analysis typed once its checks live here | Buildless stays; the one `@ts-nocheck` goes                            | half a day |
| 13  | Secret scan and audit in the gate, shared with the pre-commit hook                                     | The standard requires them; the package does not wire them             | half a day |
| 14  | Rule-ID namespacing in the standard itself                                                             | The collision the first night found is structural                      | half a day |
| 15  | Sandboxed nights under the guard                                                                       | The guard is a text match on commands; a sandbox is the layer below it | 1 day      |
| 16  | Budget by allowance, a resumable runner state                                                          | A subscription makes the money cap a proxy                             | half a day |
| 17  | Publish to the registry once the ratchet is in and the API is stable                                   | The git-URL install works; a registry is for third parties             | half a day |

## Done

- 2026-09-14 · v0.1.0: `init`, `measure`, `gate`, `doctor`, three presets; proven on the
  reference repository.
- 2026-09-14 · no trace of the tools: `scrub`, the vocabulary, the guard rule, the agent's
  executable out of the repository; the history rewritten to a single clean commit.
- 2026-09-14 · the terminal: colour, glyphs, bars, tables, timings; `abatty` alone is the
  repository at a glance. The report (`.abatty/reports/`) and the dashboard (`abatty dashboard
--open`), light and dark, over one or many repositories.
