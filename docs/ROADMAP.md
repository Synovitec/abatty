---
title: "Roadmap"
description: "Superseded by the plan. What this file tracked is now one queue in docs/PLAN.md, checked against the code rather than against the research that asked for it; the one item it still held that the plan does not is recorded here with where it went."
category: governance
status: archived
superseded_by: "./PLAN.md"
audience: ["developer", "architect"]
tags: ["roadmap", "archived"]
related: ["./PLAN.md", "./DESIGN.md", "./POSITION.md"]
scope: synovitec
last_verified: "2026-09-19"
---

# Roadmap

**Superseded on 2026-09-19 by [`PLAN.md`](./PLAN.md).**

This file carried the order of the work from the package's first days. It has been folded into
one queue, because three rounds of research and a design pass produced forty-nine changes that
were spread across five documents, and an order that lives in more than one place is not an
order.

Where the work now lives:

| What this file held                       | Where it is now                                          |
| ----------------------------------------- | -------------------------------------------------------- |
| The ordered queue and its tiers           | [`PLAN.md`](./PLAN.md), six waves with acceptance checks |
| The shape each change should take         | [`DESIGN.md`](./DESIGN.md)                               |
| What finished looks like from the outside | [`POSITION.md`](./POSITION.md)                           |
| Done items                                | `CHANGELOG.md`, as before                                |

## The one item that was still open here

**A repository outside the company**, with its reading published beside the internal ones, the
scrub as a separate package once such a repository asks for it, and the `python` and `docs`
presets proven by a named repository.

It split in two. The presets are wave 5 of the plan (C49), which proves them across the
portfolio without needing a stranger. The outside repository is `POSITION.md`'s subject, and the
current decision is that the tool is finished on its own terms first.

## The analysis this file carried, and why it is not moved

The section written on 2026-09-15 on what stopped a stranger's repository from a meaningful score
named four blockers: a config under the agent's folder pointing into a sibling checkout, a root
detected from the nearest `.git` or `package.json`, rules with a check but no predicate for
whether they apply, and one preset per repository. Three of the four are closed: the config is
`abatty.config.json` at the root against a schema, every rule carries `applies` with a reason for
its `n/a`, and a monorepo composes a preset per workspace. The analysis is left here rather than
carried forward because it describes a repository that no longer exists.
