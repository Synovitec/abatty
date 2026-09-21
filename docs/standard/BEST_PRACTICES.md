---
title: "Best practices digest - what the 2026-09-13 and 2026-09-14 research found and where it went"
description: "One page per topic the standard covers (Node, Next.js, TypeScript, lint, JSDoc, PostgreSQL, ORMs, Redis, GraphQL, OpenAPI, jobs, webhooks, React, file organisation, shadcn, MUI, WCAG 2.2 and the EAA, i18n, PWA, testing, CI, hooks, supply chain, delivery, the agent, agent readability, docs): the practices that were adopted into the standard with their rule IDs, the ones deliberately not adopted with the reason, and the pointer to the sourced research record. Read this to see WHY a rule of the standard says what it says; read the standard to know what to do."
category: reference
status: living
audience: ["architect", "developer", "agent"]
tags: ["best-practices", "research", "standards", "sources"]
related:
  [
    "./ENGINEERING_STANDARD.md",
    "./research/01-runtime-framework-tooling.md",
    "./research/02-data-api-caching.md",
    "./research/03-ui-a11y-i18n-pwa.md",
    "./research/04-testing-ci-delivery-supply-chain.md",
    "./research/05-agents-readability-docs.md",
    "./research/06-analysis-pipeline-and-agent-skills.md",
  ]
scope: synovitec
last_verified: "2026-09-21"
source_truth:
  - "./research/*.md"
  - "./ENGINEERING_STANDARD.md"
---

# Best practices digest

Five research passes on 2026-09-13, each against official documentation and recognised
sources, each read against the standard as it stood that morning. A sixth pass covers the
analysis pipeline and agent skills. A seventh, [`research/07-evidence-base.md`](./research/07-evidence-base.md)
on 2026-09-18, is different in kind and is deliberately NOT digested here: it collects the
evidence for and against the shape of the instrument rather than sourced practice for a
technology cluster, and its twenty consequent changes are carried in
[`../ROADMAP.md`](../ROADMAP.md), not in this digest. The full sourced reports are
under [`research/`](./research/); every line there carries its URL. This digest records the
outcome: what was absorbed into the standard (by rule ID), what was refused and why, and the
three places where the research corrected the standard.

**Three corrections the research forced.** `CLAUDE.md` is capped at **200** lines, not 300
(the agent's own guidance, adherence measurably drops beyond it); the WCAG 2.2 target-size
floor is **24x24 CSS px** (2.5.8), with 44px kept as the house rule on phone surfaces rather
than claimed as the legal number; and a barrel file is a **bundler hazard even when it only
re-exports** (Turbopack and Vite keep every re-exported module live), so CODE.5 now limits
barrels to small, leaf-level groups.

**What no external source has.** The research looked for a published equivalent of three
things the standard carries and found none: the six-axis agent-readability score computed from the
ratchet's own metrics (AIR.2); "a guard nobody has watched fail is not a guard" as a
verification-of-the-verifier principle (P.1, P.6); and a doc-freshness measure tied to the
diff of cited files rather than the calendar (DOC.5). These are house-original and are
stated as such.

---

## Runtime, framework, tooling → [research/01](./research/01-runtime-framework-tooling.md)

| Adopted                                                                                                                                     | Where   |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `exactOptionalPropertyTypes` beside `noUncheckedIndexedAccess`; `import type` enforced; branded identifiers                                 | CODE.3  |
| `tsc --noEmit` stays the net even where the runtime strips types                                                                            | CODE.3  |
| `eslint-plugin-jsdoc` preset: `-typescript-flavor` on TS, plain `recommended` only on checkJs JS; `@example` as the one tag worth its lines | CODE.7  |
| Env loaded by the runtime (`--env-file`, `loadEnvFile()`), not a dependency                                                                 | VALID.3 |
| A calendar day comes from the clock it is compared to (one `localToday()`), never sliced off a UTC instant; the suite pins a zone off UTC   | VALID.5 |
| Graceful SIGTERM: fail health, stop accepting, drain, exit; redaction by field path at the logger                                           | OBS.1   |
| `npm audit signatures`, release-age cooldown, install scripts off                                                                           | SEC.1   |
| Next.js 16: `"use cache"` needs a `cacheLife`; `cookies()`/`headers()` outside the scope; `updateTag` vs `revalidateTag`                    | CACHE.2 |
| Server Components default, smallest client leaf, `server-only`, provider wraps `{children}`                                                 | CODE.10 |

Not adopted: `node:test` for new suites (Vitest is load-bearing in all three repos, and one
runner per repo beats two); `eslint-plugin-unicorn` (budget; revisit when the a11y and
architecture rules have been at zero for a quarter). Already covered: CODE.1, CODE.2, CODE.4,
VALID.1, AUTH.1, A11Y.1's `polymorphicPropName` nuance.

## Data, API, caching → [research/02](./research/02-data-api-caching.md)

| Adopted                                                                                                                                                               | Where           |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| RLS is `ENABLE` + `FORCE` + a non-owner, non-`BYPASSRLS` role + `SET LOCAL`, or it is decoration; a negative isolation test; tenant column leads the index            | DATA.3          |
| Sequelize scope merge: `Op.and` after the builder, never a spread                                                                                                     | DATA.3, lessons |
| Drizzle can declare policies as schema-as-code now; the `SET LOCAL` binding still cannot be                                                                           | DATA.1          |
| Expand / migrate / contract; `CREATE INDEX CONCURRENTLY`; `migrate deploy` only outside a laptop                                                                      | DATA.1          |
| A restore proves a backup; an archive exit code does not                                                                                                              | DATA.5          |
| An external call inside a transaction carries its own idempotency key                                                                                                 | DATA.6          |
| Atomic `FOR UPDATE SKIP LOCKED` claim, transactional outbox, attempts at claim time, stale-lock reclaim                                                               | DATA.7 (new)    |
| Outbound webhook: Standard Webhooks signature, timestamp tolerance, multi-signature rotation, backoff with jitter, dead-letter                                        | SEC.5 (new)     |
| `Idempotency-Key` semantics (stored result / 409 / 422 / published retention), `If-Match`, versioning as a written decision, RFC 9457 named as a deliberate deviation | API.1           |
| OpenAPI 3.1 `type` arrays, stable `operationId`, documented `x-`, Spectral/Redocly                                                                                    | API.2           |
| GraphQL family: SDL-first, Relay connections, `input` + payload + `userErrors`, nullable by default, depth AND complexity, DataLoader per request, `graphql-ws`       | API.3 (new)     |
| Redis: TTL atomic with the value, jittered; tag Sets not keyspace scans; `KEYS` never                                                                                 | CACHE.1         |
| Never cache an authz decision unbounded, never latest-write money or stock, single-flight recompute                                                                   | CACHE.2 (new)   |
| In-memory rate limiting is a one-instance statement, written beside the switch                                                                                        | CONFIG.1        |
| Prisma `Decimal` trailing zeros                                                                                                                                       | lessons         |

Not adopted: switching an existing REST error envelope to RFC 9457 (where clients and an
SDK already parse `{ error, code, details }`; a NEW public API may choose 9457 in its ADR); Postgres's
own `money` type (the standard already says `numeric`/integer); Sequelize CLS (all-or-nothing
per process, a repo-level choice).

## UI, accessibility, i18n, PWA → [research/03](./research/03-ui-a11y-i18n-pwa.md)

| Adopted                                                                                                                                                                                                                                                                                    | Where         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- |
| React 19 compiler: no default memoisation; hooks that call Hooks; stable keys never index; `server-only`; slot pattern                                                                                                                                                                     | CODE.10 (new) |
| Feature-first organisation with a lint-held import direction; helpers stay beside the first caller; barrels only leaf-level                                                                                                                                                                | CODE.5        |
| WCAG 2.2 named criteria: 2.4.11, 2.5.7, 2.5.8 (24px floor, 44px house), 3.3.7, 3.3.8 (TOTP accepts paste and a password manager); contrast 4.5:1 text and 3:1 non-text; `prefers-reduced-motion`; landmarks and heading outline; axe after a modal opens; a keyboard-only pass per release | A11Y.1        |
| European Accessibility Act in force since 2025-06-28; storefront in scope, console not assumed exempt                                                                                                                                                                                      | A11Y.1        |
| Tokens as OKLCH CSS variables with `.dark`, one `--radius`, `cn()`; MUI `sx` vs `styled()` vs theme `components`, `useFlexGap`, no bare system props; `100svh`/`100dvh`                                                                                                                    | UI.1          |
| Per-component stylesheet ban narrowed: a theme-driven `styled()` is MUI's own pattern, not the defect                                                                                                                                                                                      | UI.1          |
| ICU plurals with `other`, rich text through the library component, completeness check in CI                                                                                                                                                                                                | I18N.1        |
| Best-fit locale matching; RTL readiness through logical properties and one `dir`                                                                                                                                                                                                           | I18N.2        |
| Manifest `id`, maskable icon safe zone; Lighthouse PWA score no longer exists; permission is not subscription; VAPID never rotated; `410` means re-subscribe                                                                                                                               | PWA.1         |

Not adopted: Workbox as mandatory (a PWA that acts on money or stock caches nothing by design,
and a hand-written worker under a contract test is smaller than the library; Serwist is the
choice as soon as there IS a cache, see `guides/PWA.md`); next-intl over
react-i18next as a rule (the choice is per stack, §9).

## Testing, CI, delivery, supply chain → [research/04](./research/04-testing-ci-delivery-supply-chain.md)

| Adopted                                                                                                                                                                                                                                                                                                                                                                         | Where           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| A TEST family the standard did not have: colocated single-behaviour deterministic units; real-Postgres integration; tiered Playwright with `axe`, retries CI-only, trace on first retry; per-area floors with `reportOnFailure` and no `autoUpdate`; guard-breaking and Stryker at today's floor; quarantine with an owner and a date; contract tests against the live response | TEST.1..7 (new) |
| Woodpecker: `$${SECRET}` in `commands:`, `depends_on` DAG, `when:` filters, `services:`, trusted repo for the Docker socket, webhook-only deploy                                                                                                                                                                                                                                | §2.4            |
| Pre-commit holds seconds, pre-push holds the gate; `core.hooksPath` for one package, Lefthook for a monorepo; the list lives in the gate script                                                                                                                                                                                                                                 | FLOW.2          |
| Branches live a day or two; larger work behind a flag                                                                                                                                                                                                                                                                                                                           | FLOW.2          |
| `thresholds.autoUpdate` never                                                                                                                                                                                                                                                                                                                                                   | FLOW.3          |
| MADR entries, superseded not edited, re-read after a month                                                                                                                                                                                                                                                                                                                      | FLOW.4 (new)    |
| Gitleaks staged in the hook and full-history in CI from one config, baselined on a legacy repo; lockfile reviewed like code; Renovate cadence with security auto-merge after a green day; `.env*` out of the Docker context                                                                                                                                                     | SEC.1           |

Not adopted: a CycloneDX SBOM as a rule (inventory without provenance proves nothing;
`npm audit signatures` is the control that was adopted, an SBOM can follow when a client
asks for one); Conventional Commits' note that only `feat`/`fix` are spec-defined (the house
type list is already written in FLOW.1).

## Agents, agent readability, documentation → [research/05](./research/05-agents-readability-docs.md)

| Adopted                                                                                                                                                                                                                                                                               | Where                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `CLAUDE.md` under 200 lines; `.claude/rules/*.md` with `paths:` for domain reasoning; `@AGENTS.md` import where other agents read the repo; `/doctor` for trims; `/context` proves a file loaded                                                                                      | §2.1                      |
| Enforcement is a hook, guidance is `CLAUDE.md`                                                                                                                                                                                                                                        | §2.1, §2.5                |
| `defaultMode` and `autoMode` are user-file only by design; night flags on the command line; deny/ask before everything, `ask` is a denial under `--permission-prompts none`; exit-2 events; the agent's own 8-block Stop cap; a Bash rule is a text match, the hook reads the command | §2.5, AUTONOMOUS_ADOPTION |
| `disable-model-invocation` on a skill with side effects; `isolation: worktree` on a mechanical parallel subagent                                                                                                                                                                      | §2.5                      |
| A classifier denial for an infrastructure reason is its own decision (`environment-gap`)                                                                                                                                                                                              | AUTONOMOUS_ADOPTION §4    |
| Keep a Changelog groups and ISO dates; MADR shape                                                                                                                                                                                                                                     | CHANGE.1, FLOW.4          |

Not adopted: `--bare` for the night runner (it skips exactly the project hooks and skill the
run depends on; revisit if the runner ever passes them explicitly); `llms.txt` (a website
convention, no private repository here is a website); agent teams (subagents are cheaper
where no inter-agent discussion is needed, and the night run is one session at a time by
design).

---

## Analysis pipeline, code intelligence, the skill layer → [research/06](./research/06-analysis-pipeline-and-agent-skills.md)

Eleven repositories and two pipeline diagrams read on 2026-09-14. What the diagrams call the
verification box had two empty rows here (architecture, dead code) and one missing tool class
(codemods); the rest of the pipeline already existed under other names.

| Adopted                                                                                                                                                                                                                      | Where                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| The import graph checked, not described: dependency-cruiser with one rule per arrow of the boundary map, a known-violations baseline that only shrinks, in the gate                                                          | CODE.5, `templates/tooling/.dependency-cruiser.cjs`, `check-direction.mjs`, plan phase 12, gap-analysis `CODE-ARCH-GRAPH` |
| Dead code as a gate on every JS/TS repository, `--max-issues 0`, `dead.knipIssues` during the descent                                                                                                                        | CODE.6, `templates/tooling/knip.jsonc`, `check-direction.mjs`, gap-analysis `CODE-DEADCODE`                               |
| A mechanical rewrite over ten files is a codemod, dry-run first, one commit, reviewed as a transform                                                                                                                         | CODE.11, `templates/tooling/codemods/`, skill §2, reviewer item 13, `CLAUDE.md` §9, plan B.1 rule 8                       |
| Duplication measured (jscpd) as a ratchet metric                                                                                                                                                                             | CODE.12 (SHOULD), gap-analysis `CODE-DUP`                                                                                 |
| No MCP server at night but the declared ones; the hooks see `mcp__*`; the canary lists its tools                                                                                                                             | `templates/agent` (runner, `protect.mjs`, `mcp.night.json`, self-test), ENFORCEMENT_MAP harness rows, LESSONS             |
| mattpocock-skills installed and addressed by resolved name; `code-review` as the night's second reader with its inputs given; the Fowler smells as reviewer item 12; the tight-loop completion criterion on a flipped switch | AUTONOMOUS_ADOPTION §5.1, `CLAUDE.md` §8, skill §3-§4, `standards-reviewer.md`                                            |

Not adopted: madge (subsumed by dependency-cruiser); code-health as a tool (a Bun wrapper
around the same tools; its report is `npm run standards`); Cline (an agent); an agent-compiled
booklet (no sources); cl-agent as software (its idea is the planned `night-report.mjs`).
Deferred behind a measurement: Serena, then codedeep-mcp, as an A/B on one phase with the cost
per session from the runner's JSON, after the conditions research/06 §4 lists.

---

## Maintaining this digest

A research pass is a dated record and is never edited after the fact; a new pass is a new
file under `research/` and a new row here. A rule that the standard drops or changes updates the
row that adopted it, so the trail from source to rule to repository stays walkable in both
directions. Re-run a cluster when its main dependency crosses a major version (Next, React,
the agent, Postgres) or when a third repository deviates from a rule the same way.
