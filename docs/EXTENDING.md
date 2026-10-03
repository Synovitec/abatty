---
title: "Extending abatty"
description: "Your own rules and probes, the opt-in probes and what each counts, probation, and profiles that compose a company standard across repositories. The lists of opt-in and probation probes are held equal to the code by a test."
category: guide
status: living
audience: ["developer", "architect"]
tags: ["rules", "probes", "profiles", "probation"]
related: ["../README.md", "./HOW_IT_WORKS.md", "./CATALOG.md"]
source_truth: ["../src/ratchet/index.mjs", "../src/profiles/index.mjs", "../src/rules/index.mjs"]
last_verified: "2026-10-04"
---

# Extending abatty

## Rules

The built-in catalog holds 80 rules across 15 families (`docs/CATALOG.md`). Each rule is data: an
identifier, the statement, whether it is a **must** or a **should**, what insures it once present,
the phase that installs it, the reason, and a check that is a pure function of the repository's
facts. Nothing in the repository is executed.

Insurance is the number worth watching: hard (a check that fails), ratchet (a number that may
only fall), review (a checklist item) or prose. `abatty rules --enforcement prose` lists what to
move up next.

Add your own rules in `abatty.rules.mjs` at the root:

```js
export const rules = [
  {
    id: "OWN-OWNERS",
    family: "Ownership",
    title: "An OWNERS file names the team",
    level: "must",
    enforcement: "prose",
    phase: "0",
    why: "A repository without an owner is a repository nobody answers for.",
    next: "Add OWNERS at the root",
    check: (c) => ({
      status: c.exists("OWNERS") ? "present" : "missing",
      evidence: c.exists("OWNERS") ? "OWNERS" : "none",
    }),
  },
];
```

## Probes

Add your own probes in `abatty.probes.mjs`, in the same shape. Control cases are required and a
built-in metric name is refused.

A control case proves a probe can go red; the harder property is that it stays green on correct
code. So a false positive reported against a shipped probe, rule or guard is fixed together with a
case built from the reporter's own situation that must stay green, in the same commit, and a test
runs every shipped probe over this repository and fails on any finding in the probe's own source.

A probe that is not enabled does not reserve its name, so a repository that wrote its own version
keeps it until it enables the package's. `abatty ratchet --controls` proves every shipped probe,
enabled or not. A multi-tenant repository whose tenant column is not `tenant_id` names it in
`tenantKeys` so DATA-TENANT can see it.

## Opt-in probes

Some built-in probes are **opt-in**, because each reads one stack's conventions and would be noise,
or a surprise red after an update, anywhere else. A repository switches them on in
`ratchet.enable`, and `init` enables the ones that suit the preset. `abatty doctor` names each one a
repository has left off, with what it would read there today, so leaving one off is a decision
taken knowing the number.

| Probe                      | Counts                                                                                                                                       | Configured by  |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `valid.unparsedBoundary`   | Route handlers, server actions and credentials callbacks reading input no schema parses                                                      |                |
| `valid.wholeEnv`           | The environment object taken whole outside the env module                                                                                    |                |
| `auth.unguardedPage`       | Protected pages whose first statement is not the guard                                                                                       | `pageGuards`   |
| `auth.unguardedAction`     | Server actions (`'use server'` exports) that never establish who is calling                                                                  | `authCalls`    |
| `api.unboundedList`        | List reads in a route handler without a bound                                                                                                | `boundedBy`    |
| `api.rowReturn`            | Server actions returning the ORM's row, or a select carrying a secret column                                                                 | `secretFields` |
| `api.floatMoney`           | Money made a number on the wire, or stored as a Float column                                                                                 | `moneyFields`  |
| `cache.serverCacheUse`     | Server-side caches of a read, for a repository that decided to have none                                                                     |                |
| `fn.shapeExemptions`       | Shape rules switched off inline, in any linter's spelling, or by a list                                                                      | `shapeList`    |
| `change.refactorTests`     | Refactors in the push that removed a test case, or edited a test without a `tests-changed:` reason                                           |                |
| `change.testTamper`        | Commits in the push that made their tests easier to pass: a case removed or skipped, a snapshot rewritten, a checker silenced, a bar lowered |                |
| `code.clones`              | Blocks of six or more meaningful lines that appear in two places, without a dependency                                                       |                |
| `test.coverageExclusions`  | Code taken out of the coverage count, by an exclude list or an inline ignore                                                                 |                |
| `types.nonNull`            | Non-null assertions (`!`) in TypeScript, the escape `types.escapes` does not count                                                           |                |
| `valid.sqlCurrentDate`     | Calendar days SQL takes in the session's time zone (`CURRENT_DATE`, `now()::date`), unconverted                                              |                |
| `docs.supersededChain`     | Readings of a chained dated series, or archived documents, that name no successor that exists                                                |                |
| `obs.catchOnlyLogs`        | Caught errors, `catch` blocks or `.catch()` handlers, whose only act is a `console.*` line                                                   |                |
| `sec.weakRandom`           | `Math.random` where the names around it say a password, a token, a secret or a one-time code                                                 |                |
| `code.undocumentedExports` | Exported declarations with no doc comment above them (presence only, not whether it says why)                                                |                |
| `test.unvisitedRoutes`     | Page routes (Next `app/` and `pages/`) that no path the browser suite names would open                                                       |                |

## Probation

A new or heuristic probe ships **on probation**: it is measured and its findings are listed under
a yellow `PROBATION`, and a verdict that would fail says which one it would have been, but the run
stays green. A blocking check lives on its false positives, so a probe leaves probation only once a
named repository has run it clean, the rule the presets follow.

On probation today: `auth.unguardedAction`, `code.undocumentedExports`, `docs.supersededChain`,
`obs.catchOnlyLogs`, `sec.weakRandom`, `test.unvisitedRoutes`, `valid.sqlCurrentDate`.

## Profiles

Rules can also arrive as a **profile**: a standard packaged as a unit of rules, adoption phases,
presets and harness files. Three are built in:

- `minimal`, the profile of a new repository and of a repository with no config;
- `synovitec`, one company's full standard, and the profile of a config that names none, so an
  upgrade moves nobody;
- `cra`, a lens that maps another profile onto a regulation's requirements.

Profiles compose (`"profiles": ["minimal", "acme"]`). A company standard can be a file in the
repository or an npm package that many repositories name beside the built-in ones, and a
repository that names only its own carries only its own, with the same instrument underneath.
