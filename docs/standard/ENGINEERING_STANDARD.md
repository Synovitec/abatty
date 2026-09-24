---
title: "Engineering standard - what every Synovitec repository is held to"
description: "Stack-agnostic engineering standard for every repository: the principles, the instrument that makes a rule real (ratchet, gate, CI, agent harness), and the rules by family with IDs (code, boundaries, data, security, delivery, testing, product surface, documentation, agent readability). Distilled from three standards programmes on three stacks in 2026 and from sourced research; nothing here is about one project. Read before starting or transforming a repository; the per-stack HOW lives in that repo's CLAUDE.md, its .claude/rules and CODE_CONVENTIONS.md."
category: governance
status: living
audience: ["architect", "developer", "agent", "reviewer"]
tags: ["standards", "quality-gate", "ratchet", "agent-readability", "conventions", "ci"]
related:
  [
    "./ADOPTION_PLAN.md",
    "./ENFORCEMENT_MAP.md",
    "./LESSONS.md",
    "./BEST_PRACTICES.md",
    "./guides/A11Y.md",
    "./guides/I18N.md",
    "./guides/PWA.md",
    "../README.md",
  ]
scope: synovitec
last_verified: "2026-09-24"
source_truth:
  - "./research/*.md"
  - "./guides/*.md"
  - "../../templates/harness/**"
---

# Engineering standard

This is the constitution for every repository, whatever its stack. It was distilled in 2026
from three standards programmes run on three different stacks (a Next.js + Drizzle app, a
React/Vite + Apollo + Sequelize app, a Next.js + Prisma monorepo) and from sourced research
([`BEST_PRACTICES.md`](./BEST_PRACTICES.md)); about a third of each programme did not survive
translation to the next stack, and what survived three times is what this document keeps.
Nothing here is about one project: a rule that only makes sense for one stack belongs in that
repository's `CODE_CONVENTIONS.md` or in a path-scoped `.claude/rules/*.md`, and a rule that
only makes sense for one product is not a rule.

Each repository carries its own `CLAUDE.md` (the agent's entry point), its `.claude/rules`
(stack and domain conventions, loaded by path) and `docs/CODE_CONVENTIONS.md` (how the rules
are applied to that stack); where a repository's file disagrees with this one, the repository's
file wins for that repository and the disagreement is recorded there as a deviation (§9).
The depth behind the product-surface rules lives in three guides: [`guides/A11Y.md`](./guides/A11Y.md),
[`guides/I18N.md`](./guides/I18N.md), [`guides/PWA.md`](./guides/PWA.md).

Every rule carries an ID so it can be cited in a review, a commit or a ratchet finding. An ID is `FAMILY.N` with a dot (`CODE.6`, `DOC.2`): a namespace of its own, so a repository's rules (`FAMILY-NAME`, `FAMILY-NN`) and its citation checks never collide with the standard's. The hyphen form of the first days is retired. **MUST**
is enforced by a script and blocks; **SHOULD** is the default and needs a written reason to
break. A rule with no script behind it is written down as prose and says so - it is not
claimed as enforced. That distinction is rule zero.

---

## 1. Principles

- **P.1 - A guard nobody has watched fail is not a guard.** Every check, ratchet, invariant
  and test is verified by reintroducing the defect it exists for, watching it go red, and
  restoring. A check that reports nothing is indistinguishable from a check that is switched
  off; `0 findings across 0 files` is a failure, never a pass.
- **P.2 - A number that must go up is a decision.** Debt is measured, recorded in a committed
  baseline and allowed only to fall. Raising a floor is done in the same commit as the reason,
  in a numbers-only log. Silencing a step is never the fix.
- **P.3 - Report honestly.** What works, what is untested, what is assumed, what is known
  broken. "Improved" is not a measurement. A historical figure is left as the record it was;
  a new reading is written beside it, dated.
- **P.4 - Evidence over assertion.** A claim about behaviour cites `file:line`, a test, or a
  reproduction. A comment asserting a protection nobody verified is the same error as a
  missing protection.
- **P.5 - The next reader is an agent that has never seen the repository.** Structure,
  names, boundaries and documents are written so that it can find a thing, tell a contract
  from an implementation detail, trust what it reads, and see the blast radius from the file
  it is editing.
- **P.6 - Encode the property, not the shape of the last defect.** A grep for an explicit
  `select` of a sensitive column reported green for months while the leak came through a bare
  `include`. A guard encodes what it defends and requires the CALL, never a mention.
- **P.7 - Small, reversible, verified before claimed.** Run the gate before saying done. CI
  is the second reader, never the first.
- **P.8 - Never bake one tenant, one country or one language into shared code.** Defaults,
  prompts, samples, columns and fallback chains describe the platform, not the first
  customer. English is the floor of every language fallback; a country is a setting.

---

## 2. The instrument

Rules become real through four mechanisms. A repository that has the rules and not the
instrument has a wish list.

### 2.1 The documents every repository carries

| File                                              | Role                                                                                                                                                                                                                                                                                | Cap                                                               |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `CLAUDE.md`                                       | The agent's first read: non-negotiables, commands, boundary map, known gaps between docs and code, surprising conventions, delivery rules, the autonomy contract. Links to the narrative, never repeats it                                                                          | **200 lines** (the agent's own target; adherence drops beyond it) |
| `.claude/rules/<topic>.md`                        | Domain reasoning and rules that matter only in one part of the tree, with `paths:` front matter so they load only when a matching file is read. This is where a long `CLAUDE.md` goes when it is split: `rules/payments.md` scoped to `lib/payments/**`, not a 1,000-line root file | 200 each                                                          |
| `AGENTS.md` (optional)                            | Only when a repository serves other coding agents too; `CLAUDE.md` then starts with `@AGENTS.md` and adds the the agent-specific lines below                                                                                                                                        | -                                                                 |
| `docs/CODE_CONVENTIONS.md`                        | HOW this stack applies the standard: structure, layering, data access, UI kit, size table, gotchas                                                                                                                                                                                  | 800                                                               |
| `docs/STANDARDS_PROGRESS.md`                      | Numbers-only scoreboard, phase status and a dated log of every deliberate change to a floor                                                                                                                                                                                         | 800                                                               |
| `scripts/ci/standards-baseline.json`              | The committed floor: `measuredAt`, `coverage` (recorded, dated), `metrics`, `debt` per file                                                                                                                                                                                         | -                                                                 |
| `docs/README.md` or `docs/SOMMAIRE.md`            | Index of every document with title, category, status. Regenerated when a doc moves                                                                                                                                                                                                  | -                                                                 |
| `CHANGELOG.md`                                    | Keep-a-Changelog, updated in the same push as any visible or contract change                                                                                                                                                                                                        | -                                                                 |
| `docs/DECISIONS.md` or `docs/decisions/NNNN-*.md` | Structural decisions: problem, choice, consequence. Lightweight is fine; absent is not                                                                                                                                                                                              | -                                                                 |

`CLAUDE.md` is capped because it is read whole on every session, and it is context, not
enforcement: anything that must happen at a fixed point (before a commit, after an edit, before
a stop) is a hook, never a sentence in `CLAUDE.md`. Architecture reasoning per domain goes to a
path-scoped rule or to `docs/` and is linked; `/doctor` proposes the trims. A `CLAUDE.md` over
the cap is an adoption item, not a crime, and it is on the repository's own list
(`ADOPTION_STATUS.md`).

### 2.2 The ratchet (`npm run standards` / `pnpm standards`)

One script measures every mechanical rule the linter cannot state, compares against the
baseline, and fails when a number goes the wrong way. No Docker, no network, no database:
seconds, so it can sit in the pre-push hook without anyone learning to skip it.

Reference implementation: the `scripts/ci/check-standards.ts` and `scripts/ci/standards/*.ts`
of the first repository that built it, with 57 control cases in
`tests/lint/standards-probe.test.ts` (named in `ADOPTION_STATUS.md`); a shared package is the
intended home (`ADOPTION_PLAN.md` §A.1).

- **Two kinds of metric.** HARD must be zero, now and forever; the baseline writer refuses to
  record a non-zero value for one. RATCHET holds today's number and may only fall. A metric is
  promoted to HARD on the day it reaches zero, because a floor of zero and a HARD rule enforce
  the same thing today and differ in what they tell the next person.
- **Every ratchet is held twice: by its total and by a per-file floor** (`debt` in the
  baseline). A scalar total lets debt relocate for free - delete a 400-line component, add
  another, the number never moves. A file may improve, never worsen, and a file not on the
  list may carry none. Proven with the three-step control: clean tree holds; add a violation,
  fails; raise every total to match it, still fails and names the file.
- **A check that scans zero files fails the run.** A moved path or a mistyped glob otherwise
  reports itself green forever. A HARD metric pinned at zero cannot fall, so this is the only
  thing that catches it.
- **Control cases in both directions.** An exemption nothing tests widens quietly. A test that
  feeds the check a synthetic violation at a literal path is what stands between a check and
  an empty scan.
- **A metric measures a proxy and says so.** Icon-without-name, clickable-non-interactive,
  inline style, unbounded list: each is a countable stand-in for a rule review still has to
  apply. The finding names the path, the line and the rule.
- **Excess is measured beside count.** `size.overBudget` counts files over; `size.excessCode`
  says how far. Splitting one file into eight where one child lands over budget improves
  excess by 1,500 and count by exactly one; two such children and the count regresses.
- **Historical numbers in the log are never rewritten.** A new reading goes beside the old
  one, dated.

### 2.3 The gate (`npm run gate`)

One script, two callers: `.githooks/pre-push` and the npm script. A hook that carried its own
list would drift from the script within a month, and the drift shows up as "it passed
locally". Reference: the `scripts/ci/gate.mjs` named in `ADOPTION_STATUS.md`.

- **Always-on set, about two minutes:** format check (`--end-of-line auto`, because a Windows
  worktree is CRLF), lint at `--max-warnings=0`, typecheck, the import graph
  (`dependency-cruiser`, CODE.5) and dead code (`knip`, CODE.6) - both seconds - unit tests,
  the ratchet with the changelog check over the pushed range.
- **Path-aware heavy suites:** the database or ingestion suite and the coverage gate only when
  the schema, the data layer or its tests moved; the browser suite with axe only when the UI
  moved. Selection reads the push AND the working tree, because the suites test the tree.
  The changelog check reads the push alone, because it is a rule about commits. A pushed file
  whose diff is only comments selects no suite: rewording a comment is not a reason to build.
- **Deferral is loud, never silent.** When Docker or the browsers are absent the gate prints
  `DEFERRED to CI: <suite>` with the reason. `--fast` is the deliberate way to defer and says
  so. Running everything on every push costs ten minutes and teaches `--no-verify`; running
  nothing heavy locally is how `main` sat red on `integration` for a day. A suite that needs a
  database runs against one the run owns (`TEST_DATABASE_URL`, or CI's own service) and is
  deferred, loudly, when the only database it can see is the developer's. A suite that builds is
  deferred the same way while the framework's dev server is live on the checkout, read from
  the pid in its lock: a build over a running dev server corrupts what it serves.
- **After a rebase or an amend, `@{u}..HEAD` lies.** Judge the push on the whole branch when
  the upstream is no longer an ancestor of HEAD.

### 2.4 CI

- **One CI that actually runs.** Woodpecker on `ci.synovitec.com` for every repository. A
  workflow that never executes (GitHub Actions since the billing failure) posts red checks
  that mean nothing, and the cost is not noise: people learn to merge on red, and the day a
  gate fails for a real reason it looks like every other day. A dead workflow is reduced to
  `workflow_dispatch` or deleted; it is never left on `pull_request`.
- **The same gates as the hook**, split into pipelines by cost (`checks`, `integration`,
  `e2e`). Three statuses are three statuses: `checks` green says nothing about the other two.
- **A gate change touches every implementation** - the hook script, the CI file, and any
  mirror - in the same commit.
- **Never write a `${…}` placeholder in a Woodpecker file, comments included.** It is
  expanded over the raw file before parsing and the pipeline dies with no steps and no status.
  A secret used inside a `commands:` block is written `$${NAME}` so the shell, not Woodpecker,
  expands it. Ordering is `depends_on` (a DAG, parallel by default), skipping is a `when:`
  filter visible in the UI rather than an `if` buried in a step, side containers are
  `services:`, and Testcontainers needs the repository marked **trusted** by an admin (Docker
  socket). Deploy is the Coolify webhook on the push; never also call the deploy API from
  CI, the two race.

### 2.5 The agent harness

The full design, settings and templates are in `AUTONOMOUS_ADOPTION.md` and
`templates/harness/`. The invariants:

- **Enforcement is a hook, guidance is `CLAUDE.md`.** `.claude/settings.json` (committed,
  because it is the file whose hooks run in headless `-p` sessions) carries a `PreToolUse`
  guard on `Bash|PowerShell` (denies a push to the base branch when the repo is PR-only, by
  any door: behind a redirection or through the forge's API; force push and `--no-verify`,
  with its spelling as configuration (`core.hooksPath` moved or unset), always; at night also any move off the work branch, the merge of a pull request, history
  rewrite, destructive SQL, deploy, publish, dependency change, a shell write to the harness), a
  `PreToolUse` guard on `Edit|Write` (at night denies a write under `.claude/`, to an applied
  migration, to an env file, outside the tree), a `Stop` gate that refuses to end an
  unattended session while the gate is red, something was loosened against the base branch,
  the session left the tree dirty (another session's files are not its own), the newest source
  commit has no changelog entry or the state file is
  stale (exit 2, reason on stderr; the agent itself force-ends after 8 consecutive blocks,
  so the hook's own cap stays below that), a `SessionStart` brief, and an optional
  lint-on-edit. Hooks are Node scripts in exec form; a Bash rule text-match is not a security
  boundary, the hook reads the whole command.
- **A hook guards one tool's shell; the repository needs the same refusal in every shell.** A
  guard that lives in a `PreToolUse` hook is a property of that tool, not of the repository: the
  same force push goes through from a second terminal, a script, a CI step or another assistant.
  The harness therefore also installs a `git` earlier on `PATH` than the real one
  (`.claude/bin/`), refusing exactly the two things the guard always denies, reading argv so a
  quoted flag and a shell variable arrive already expanded, and handing everything else through
  with its exit code, signals and stdio unchanged. It refuses those two and nothing else: a shim
  that second-guesses the rest of git is a shim people uninstall, and an uninstalled layer
  refuses nothing. The deliberate way past it says so on stderr.
- **The harness is read-only to the worker it constrains.** A control the constrained actor
  can rewrite is prose. At night nothing under `.claude/` is writable from any tool, the Stop
  gate reads the root config from the base branch rather than the tree, a direction check
  refuses a floor raised, a threshold lowered, `--max-warnings=0` dropped, a rule switched off
  or an `ignores` entry added without a decision naming it (FLOW.3's written reason, made
  mechanical), and the runner refuses to continue or to push a branch where `.claude/` moved.
  A hook that hits an internal error refuses rather than passes. Before the first phase a
  canary session proves, in a real `-p` run, that a command runs without a prompt and that
  both hooks fire.
- **A hook is insurance only where it runs, and that is itself a thing to check.** Read on
  2026-09-18 against `templates/harness/`: every invariant above was correctly written and
  three of them were not in force. `settings.json` pinned the config at a path `init` does
  not write, so the hooks read their built-in defaults and not the repository's; the git
  hooks were written without the executable bit, so git skipped the pre-push gate with a
  hint; and the guard matched flags and branch names as substrings of the command text, so
  it refused correct work and taught a team to route around it. Each is fixed and each now
  has a control case. The lesson is the standard's own P.1 applied one level up: a guard
  that is wired is not thereby running, and only a test that watches it fail says which.
- **Permission modes are settings the project file cannot set.** `defaultMode: "auto"` and
  the `autoMode` classifier rules live in the user file only, by design, so a checked-in repo
  cannot grant itself trust. Unattended runs pass the mode on the command line
  (`--permission-mode auto --permission-prompts none --max-budget-usd N`). Deny and ask rules
  are evaluated before everything else, in every mode; `ask` under auto mode is a durable
  human checkpoint and under `--permission-prompts none` it is a denial.
- **Skills are protocols, agents are personas.** `/adopt-standards` (one phase per
  invocation), `/verify-change` (drive the real flow), a read-only `standards-reviewer`
  spawned before every phase commit, a `standards-adopter` for daytime territories. A skill
  with side effects sets `disable-model-invocation: true`; a subagent doing mechanical
  multi-file work in parallel sets `isolation: worktree`, which is enforced at tool-call level
  rather than by discipline.
- Agent definitions carry `memory: project`; the memory directory holds one fact per file
  named as a pattern (`patterns_split_hazards_server.md`), not a diary.
- The `CLAUDE.md` §"Known gaps between docs and code" is maintained on purpose: a document an
  agent trusts and that is wrong is worse than no document. `/context` proves a file loaded;
  the `InstructionsLoaded` hook logs which rules loaded and why.

---

## 3. Code rules

- **CODE.1 (MUST) - Every file answers to the budget of its KIND, and 800 lines is the cap
  for anything.** Budgets are in code lines (blank and comment lines excluded), with a
  raw-line budget at 1.5x so a file is not charged for the JSDoc CODE.7 requires. **About
  300 lines is the real threshold**: beyond it an agent stops reading the whole file
  reliably and works from fragments; at 500 a file has more than one responsibility.

  | Kind                                                       | Target  | Hard max              |
  | ---------------------------------------------------------- | ------- | --------------------- |
  | Utility / helper                                           | 20-60   | 100                   |
  | Page / layout (a composition root in `app/`)               | 30-60   | 100                   |
  | Hook                                                       | 40-80   | 150                   |
  | Route handler, middleware, resolvers file, model, SDL file | 50-120  | 200                   |
  | Component, entity form                                     | 80-150  | 250                   |
  | Zod schema module                                          | 50-150  | 250                   |
  | Module, service, queries file, server-actions file         | 100-200 | 300                   |
  | ORM schema declarations                                    | -       | 500, split per domain |
  | Test                                                       | -       | 400                   |
  | `CLAUDE.md`                                                | 60-100  | 200                   |

  A repository that measured its budgets against looser numbers keeps its ratchet and lowers
  it when it can; a new repository starts at these. Exempt from the per-kind budget and the
  function shape, each for a stated reason: generated code, migrations, seeders, vendored UI,
  config files, constant tables (i18n dictionaries, registries), and CLI scripts, hooks and
  tests under `scripts/`, `.claude/hooks/`, `tests/`, `e2e/` - there stdout is the interface
  and a sequential procedure is the point. The 800 cap still applies to all of them. Their
  length is the size of the thing they describe, not the complexity of a procedure. Moving a
  file into a laxer category instead of splitting it is gaming the metric; `size.overRaw`
  counts every file against the nearest budget so that move does not pay.

  Enforced, not hoped for. The day-0 ESLint block for a new repository, under
  `--max-warnings=0` so a warning fails:

  ```js
  rules: {
    "max-lines": ["warn", { max: 300, skipBlankLines: true, skipComments: true }],
    "max-lines-per-function": ["warn", { max: 60, skipBlankLines: true, skipComments: true }],
    "max-params": ["warn", 4],
    "complexity": ["warn", 12],
  }
  ```

  with a per-kind override block for the kinds above, the 800 raw cap as an `error` beside
  it, and the exempt paths in `ignores`. An existing repository holds the same numbers with
  the ratchet until its debt is gone, then switches the rules on.

- **CODE.2 (MUST) - Function shape: 60 lines, complexity 12, 4 parameters.** A component
  file gets 150 lines because `max-lines-per-function` cannot tell JSX from procedure and a
  composition root is element after element with nothing to hold; complexity stays at 12
  everywhere, which is what still guards it - length without branching is composition, length
  with branching is procedure. Above four positional parameters a transposition of two
  adjacent strings is not catchable by review; group the tail into one named object.
  Relocating a long function into a hook or a helper is not shortening it, and a per-file
  floor is what lets the gate say so.
- **CODE.3 (MUST) - Types strict, escapes justified.** `strict`, `noUncheckedIndexedAccess`,
  and `exactOptionalPropertyTypes` wherever "omitted" and "set to undefined" mean different
  things (settings PATCH bodies, DTOs - the exact class of the omission-clears-a-value
  lessons below); `import type` enforced (`consistent-type-imports` or
  `verbatimModuleSyntax`) so a type import cannot drag runtime code across a package boundary;
  identifiers that must never be swapped (a store id, a customer id, a money string) are
  branded types. `any` banned; every `as`, `!`, `@ts-ignore` and `eslint-disable` carries a
  reason on the same line, and the disable is the last line before the code it covers
  (Prettier displaces a `-next-line` when it reflows JSX; a displaced directive silences
  nothing and reports nothing). `tsc --noEmit` is the primary net even where the runtime
  strips types itself. A JavaScript repository runs it over `checkJs` and ratchets the count.
- **CODE.4 (MUST) - Lint and format are the config's opinion, at zero.** ESLint flat config,
  `--max-warnings=0`: a warning is a failure. `jsx-a11y` at error. `no-restricted-imports` for
  the architecture bans (a vendor SDK outside its provider home, a PSP client outside
  `lib/payments/`). Formatting is Prettier and never hand-adjusted. Flat config does not read
  `.gitignore`: a new top-level directory or extension needs its own block or it lints with
  zero globals.
- **CODE.5 (MUST) - One cohesive thing per module.** One exported component per file; more
  than five exported statements means two modules; a barrel `index` only re-exports AND is
  small, leaf-level and side-effect-free - a wide barrel on a hot import path defeats
  tree-shaking and keeps every module live in the bundler, so import from the defining file
  and reserve `optimizePackageImports` for a dependency whose barrel cannot be avoided; no
  `utils.ts` catch-all - name the file after what it does, and keep a helper beside its first
  caller until an unrelated second one appears. Files kebab-case, components PascalCase, hooks
  `use-*`. Names say what, not how. Organisation is by domain or feature with a one-way
  import direction (shared → features → app, features never import each other) held by a
  rule, not by convention. **The import graph is checked, not described**: `dependency-cruiser`
  runs in the gate over the source root with `no-circular`, `no-orphans`, `not-to-unresolvable`,
  `not-to-dev-dep` and one `forbidden` rule per arrow of the boundary map (`CLAUDE.md` §3)
  that must not exist, so a violation names the arrow. An existing repository records today's
  violations once with `--baseline` into `.dependency-cruiser-known-violations.json`, which
  the gate passes with `--ignore-known` and which may only shrink - the tool's own per-finding
  debt, the same principle as the ratchet's `debt`, and a file the direction check refuses to
  see grow at night. `no-restricted-imports` stays for the bans a per-file rule states better
  (a vendor SDK outside its provider home). Template: `templates/tooling/.dependency-cruiser.cjs`.
- **CODE.6 (MUST) - No dead code, no commented-out code.** Git remembers. On every
  JavaScript or TypeScript repository `knip` runs in the gate and in CI - unused files,
  dependencies, devDependencies, exports and types, `--max-issues 0`. An existing repository
  starts from `--max-issues <today>` held by the ratchet as `dead.knipIssues` and drives it to
  zero, then drops the flag; the direction check refuses a raised `--max-issues` and a
  `--no-exit-code` at night. A false positive is an `ignoreFiles` or `ignoreDependencies`
  entry with its reason beside it, never a disabled check. Template: `templates/tooling/knip.jsonc`.
- **CODE.7 (MUST) - Every export a reader could get wrong carries a JSDoc block that says
  WHY.** Enforced at the module boundary (`jsdoc/require-jsdoc` `publicOnly`, or the repo's
  own probe): exported functions in service and library code, custom hooks, permission checks,
  cache invalidation, any schema whose shape encodes a decision. `@param`/`@returns` are not
  required and JSDoc types are banned where TypeScript declares them - a `@param {string}
name` restates the signature and is the first thing to rot. The block names the failure it
  prevents, the refusal, the decision it implements; an `@example` is the one tag worth its
  lines, being executable evidence of the call-site intent. The fixer is disabled: an empty
  `/** */` satisfies the rule and documents nothing. A split raises the JSDoc count because
  private helpers become exports; that is the metric working. **On a TypeScript file the
  plugin preset is `flat/recommended-typescript-flavor`, never the plain `recommended`**,
  which re-imposes typed `@param`/`@returns` and would flag every compliant block; on a
  `checkJs` JavaScript file the plain preset is right, because there the tags ARE the types.
- **CODE.8 (MUST) - A public path is a contract.** A split that moves an entry point other
  directories import leaves a re-export shim at the old path, and says so in the commit.
  Neither lint nor the unit suite sees a moved public path; `check-imports` and the build do.
- **CODE.9 (SHOULD) - Pure core, thin edges.** Business logic in pure functions, I/O injected
  at the boundary, so the core is unit-tested against synthetic fixtures with no database.
- **CODE.10 (MUST) - React the way React 19 is built.** Server Components by default and
  `"use client"` on the smallest leaf that needs it; a Server Component reaches a Client
  Component through `children`, never an import; `server-only` guards a module that holds a
  secret or a database client; a Context provider wraps `{children}`, never the document;
  stateful logic goes into a custom hook that itself calls a Hook (no `useMount`-style
  lifecycle wrappers that hide dependencies); keys are the data's stable id, never the
  array index on a list that can move and never generated during render; and under the
  compiler `useMemo`/`useCallback`/`React.memo` are not the default - only inside a
  `try/catch` the compiler skips, or against a library that depends on referential identity.
- **CODE.11 (MUST) - A mechanical rewrite is a codemod.** The same change in more than ten
  files - an import moved, an env read routed through the env module, a prop or a call
  renamed, a deprecated API replaced - is written once as a transform (`jscodeshift` with the
  `tsx` parser, or `ts-morph`) under `scripts/codemods/<what-it-does>`, dry-run first, applied
  in one commit that touches nothing else, with the number of files it touched in the commit
  message. Behaviour is preserved by construction (an AST transform cannot mistype a string),
  the reviewer reads the transform and samples its output instead of every edit, and a night
  can do it without the budget of three hundred hand edits. Three hundred edits by hand to the
  same shape is the finding. Template: `templates/tooling/codemods/rename-import.cjs`.
- **CODE.12 (SHOULD) - Duplication is measured.** A clone count over the source root, held by
  the ratchet per file like every ratchet: the package's `code.clones` needs no dependency, and
  a repository's own detector read as `dup.clones` and `dup.clonedLines` holds it as well.
  Two copies of a shape are the deletion test failing in advance (CODE.5); the number says
  where. A repository that does not measure it records "not measured" with the reason.

---

## 4. Boundary rules

- **VALID.1 (MUST) - Every boundary parses its input with a schema.** Request body, query,
  route params, webhook payload, form data, Server Action argument. Types are inferred from
  the schema (`z.infer`), never declared beside it. A hand-written `isUuid` beside an `as {
value?: X }` cast is an unparsed boundary: the check and the TYPE have nothing to do with
  each other. Where the schema deliberately accepts more than the obvious pattern (a login
  email that must stay loose because authorisation is the real gate; a vendor's event name
  that is a plain string because the vocabulary is theirs), the carve-out is written in the
  code.
- **VALID.2 (MUST) - One schema serves both sides**, and it carries message KEYS, not
  sentences, so each side translates at its edge. Two definitions of the same rule drift and
  only one is authoritative.
- **VALID.3 (MUST) - The environment is one validated module.** Every variable the app reads
  is named in one file, parsed at boot; no `process.env.X` scattered through the code. The
  file is loaded by the runtime's own mechanism (`node --env-file`, `process.loadEnvFile()`),
  not a dependency that does the same job.
  Tightening a value (`.url()`, `.email()`) moves a failure from USE to BOOT and is a decision
  about how the app should die, not part of a refactor. A read that must stay literal
  (`NEXT_PUBLIC_*`, inlined at build time) is the documented floor of the metric, not a
  shortfall.
- **VALID.4 (MUST) - Fail closed.** A required value that cannot be resolved is a refusal
  with a typed code, never a benign default (`{ cost: 0 }` is free shipping). `=== undefined`
  tells absent from a deliberate zero; a falsy check swallows both. An opt-in that widens
  reach (an `allowX: true` argument) is passed explicitly at the call site so that forgetting
  is the safe direction.
- **VALID.5 (MUST) - A calendar day is derived from the clock it will be compared to.**
  A date is not an instant. An instant is a point on a universal line; a date is a question
  about somebody's calendar, and the answer depends whose. Slicing the day off a UTC timestamp
  answers it for Greenwich and for nobody else, and the error is exactly the machine's offset,
  once a day, in a window whose length is that offset. Every day the repository compares to a
  commit date, to a date a person typed, to a deadline or a `last_verified` line is a LOCAL
  day, so it comes from one function the whole repository calls, never an expression written
  again at each site. A day that must be UTC (a vendor's billing window, a partner's cutoff) is
  named as such at its own boundary and is not the default.
  The test for this is a test that pins a zone whose calendar day differs from UTC's at the hour
  it runs. A suite pinned to one named city agrees with UTC for most of the day and reads green
  against the very defect it exists for: a test that is only sometimes a test is not one. The
  same holds of the pipeline, which runs at UTC unless it is told otherwise.

- **AUTH.1 (MUST) - Deny by default, on the server, per resource.** Every endpoint checks
  authentication AND authorisation scoped to the tenant it targets; "caller has some role" is
  not authorisation for THIS resource, and a URL segment is not authorisation. Identity comes
  from the token, never from an id in the body or the query. Each token type is verified in
  exactly one place. A UI gate is never the only gate.
- **API.1 (MUST) - One envelope, one error shape, money as a decimal string.** Consistent
  `{ data }` / `{ data, meta }` / `{ error, code, details }` - a deliberate, named deviation
  from RFC 9457 `application/problem+json`, kept wherever an existing client base already
  parses it; a new public API may choose 9457 instead, in an ADR. Every monetary amount on the
  wire is an exact two-fraction-digit string beside an ISO 4217 currency. Every list is
  bounded and, on an admin API, followable (keyset cursor with `id` as the final sort key,
  plus an inclusive/exclusive update window). A mutation takes one input object and returns
  a payload, never a bare scalar. Deprecate; never delete a field in the same change. A
  retryable write accepts `Idempotency-Key`: a replay of a completed key returns the stored
  result, an in-flight key answers 409, the same key with a different payload 422, and the
  retention window is published. A write two people can race takes `If-Match`. Versioning
  is a decision per API written in its ADR (URL path is the house default); silence is not
  a strategy.
- **API.2 (MUST) - Nothing is declared that can be derived.** Scopes, roles, refusal codes
  and the published spec come from the handler and the route pattern, never from a per-route
  declaration that will drift. The spec is generated from code and checked both ways: an
  undocumented route fails, and so does a documented route that does not exist. OpenAPI 3.1
  nullability is a `type` array, never `nullable`; every operation has a stable
  `operationId`; `x-` extensions are documented; Spectral or Redocly lint every spec change.
- **API.3 (MUST) - GraphQL, where a repository has it, follows the same shape.** SDL-first;
  every list a bounded, paginated payload (Relay connections where a list can grow or move);
  one `input` object and a dedicated payload type per mutation with business failures in a
  `userErrors` field; nullable by default, non-null only where correctness is guaranteed in
  the error path too; `@deprecated` before removal, and a deprecated field still executes;
  every error carries `extensions.code`; depth AND complexity limits, because depth alone
  does not stop a wide shallow query; a DataLoader per request in the context factory,
  never at module scope; `graphql-ws`, authenticated on `connection_init`; schema linted in
  CI and an unmarked breaking change fails it.

---

## 5. Data, security, delivery

- **DATA.1 (MUST) - Migrations are the source of truth and are never edited once applied.**
  Hand-written where the tool cannot express what the database needs (grants, partial unique
  indexes, CHECKs; RLS policies for Prisma and Sequelize - Drizzle can now declare them as
  schema-as-code, the per-request `SET LOCAL` still cannot be); numbered; two files may
  silently share a number across branches, so the next free number is checked against
  `origin/main`. A partial or expression index the ORM cannot express is guarded from the
  next `migrate dev` DROP by an invariant script. A breaking change is expand / migrate /
  contract across deploys; a new index on a live table is `CREATE INDEX CONCURRENTLY`;
  `migrate deploy`, never `migrate dev` or `push`, outside a laptop.
- **DATA.2 (MUST) - Constraints live in the database.** `NOT NULL`, FK, `UNIQUE`, `CHECK`; an
  index on every FK and every hot `WHERE`/`ORDER BY`. Money is `Decimal` or integer minor
  units, never float; quantities `Int`; timestamps `timestamptz` in UTC. A model must declare
  every column any writer touches, or the column is silently dropped from writes.
- **DATA.3 (MUST) - Tenant scoping is in the service, and it is proven.** Every read and
  write carries the tenant; a tenant-scoped index leads with the tenant column. Where RLS is
  the guarantee it takes all three or it is decoration: `ENABLE` plus `FORCE ROW LEVEL
SECURITY`, an app role that is neither owner nor `BYPASSRLS`, and the GUC set with the
  transaction-local form inside a transaction, never the session form that leaks on a pooled
  connection. On Sequelize, a caller's `where` is combined with the tenant scope through
  `Op.and` AFTER the builder, never by spreading two objects - a duplicate operator key is
  replaced, not ANDed. A negative isolation test (tenant A cannot read tenant B) against a
  real Postgres is part of the suite.
- **DATA.4 (MUST) - Integration tests run against a real Postgres**, in a rolled-back
  transaction, with no ORM mocking. A suite that mocks the model cannot exercise a constraint,
  a transaction or a race, and those are the defects that cost money.
- **DATA.5 (MUST) - Backups are drilled.** A restore is rehearsed and dated; an untested
  backup is not a backup, and an archive command's exit code is not proof of the segment's
  content - the restore is.
- **DATA.6 (MUST) - Every "check a limit, then consume it" is atomic**, and idempotency is a
  unique index on a stable event reference, never a read-then-check. Dedupe on the EVENT,
  never on "does this entity already have one": partial refunds, re-sent invites and repeated
  events are legitimate and multiple. A call to an external system inside the transaction
  carries its own idempotency key; the database cannot protect that half.
- **DATA.7 (MUST) - A background job is a row first.** A Postgres-backed queue claims with
  one `UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED)`, never a read then a guarded
  update; the row is written in the SAME transaction as the business change (transactional
  outbox), so no job exists for a rollback and none is lost after a commit; handlers are
  at-least-once and idempotent; the attempt is counted at claim time so a crash mid-run still
  exhausts the budget; a stale lock is reclaimed on a timeout; a heartbeat makes a dead
  worker visible and every job type has a fallback path or a written reason for not having
  one.
- **SEC.1 (MUST) - No secret in code, docs or logs; no PII in the repository.** Secrets from
  the environment only. A secret scan (gitleaks or the repo's own `scan-secrets`) runs
  staged-only in the pre-commit hook and over full history in CI, from ONE configuration; a
  legacy repository baselines its old findings and fails on NEW ones. `npm audit`/`pnpm
audit` runs in CI on the shipped tree, `npm audit signatures` beside it (a CVE list does
  not see a compromised maintainer), a release-age cooldown (`min-release-age`) refuses a
  version published hours ago, install scripts are off by default. Lockfile committed,
  `npm ci` / `--frozen-lockfile` everywhere, regenerated on Linux, reviewed like code. Updates
  arrive by Renovate on a cadence: a security fix without a major bump auto-merges after a
  green day, everything else batched weekly and reviewed. Fixtures are synthetic; diagnostic
  output masks names; `.env*` never enters a Docker build context. A password, a token or a
  one-time code is drawn from the platform's cryptographic generator, never from `Math.random`.
- **SEC.2 (MUST) - An audit trail is append-only**, enforced by the database role, and an
  actor is recorded as exactly one of a person or an integration.
- **SEC.3 (MUST) - A tenant-supplied URL is hostile.** Resolve DNS, refuse private, loopback,
  link-local, CGNAT and ULA ranges numerically, pin the socket to the address validated; a
  URL the platform will call REPEATEDLY (push endpoints) is allowlisted by origin.
- **SEC.4 (MUST) - Post-commit side effects never fail the response of a route that already
  moved money.** Events, emails and webhooks are fire-and-forget after the commit; a failing
  notification reported as a failed refund is how a refund is issued twice.
- **SEC.5 (MUST) - An outbound webhook is signed and retried on a schedule.** HMAC-SHA256
  over `id.timestamp.payload` in a dedicated header (the Standard Webhooks shape), the
  receiver told to refuse a timestamp outside a tolerance window, several signatures allowed
  in one header for key rotation; only a 2xx is success; exponential backoff with jitter over
  about a day, then a dead-letter state a merchant can replay from. The signing secret is
  stored recoverable (it is a key WE sign with), returned at creation and rotation, rendered
  nowhere else.
- **SEC.6 (MUST) - Privacy by design, and erasure is complete.** Retention windows are a
  setting per tenant, enforced by a scheduled job the app itself schedules, and gated on an
  explicit opt-in because anonymising is irreversible. A record with legal weight (an order,
  an invoice, an audit row) is never deleted: the PERSON is anonymised out of it and every
  figure stands. One `anonymise()` serves the retention job and the Article 17 endpoint, so
  nobody is half-forgotten by one route; it covers every table that can carry the person -
  integration metadata, waiting lists, consent logs - because a person forgotten from the
  customer table whose address survives elsewhere has not been forgotten. The Article 15
  export reads the same list. Production data never enters a lower environment; fixtures are
  synthetic; a diagnostic script masks names because its output ends up in a ticket.
- **SEC.7 (MUST) - A repository an agent reads is hostile input, and the agent's own permissions
  are a control.** An unattended run is a session with no reviewer, and the two directions of
  trust are both open by default. So: the run is sandboxed and the sandbox proves its own
  boundary with a probe that writes where it must not reach; the permission surface is written
  down rather than whatever the tool defaulted to, with the force push, the history rewrite and
  the hook bypass denied; the tree's own text is scanned before a model is pointed at it, because
  text in a file an agent reads is an instruction in exactly the way a prompt is and a repository
  is a place other people can write; the servers a run may reach are named and only those; the
  refusals hold in every shell and not only the agent's, which is a `git` earlier on `PATH` than
  the real one; and a commit that got past the hook is visible afterwards rather than invisible.
  Each of those is a control the constrained actor must not be able to rewrite.
- **CONFIG.1 (MUST) - Config precedence is written down.** A database row that silently
  beats an environment variable is documented in `CLAUDE.md` with the invalidation delay. A
  rate limiter that is in-memory is correct for ONE instance and says so beside the switch
  that moves it to Redis.
- **OBS.1 (MUST) - Structured logs with redaction at the logger, a graceful stop, and a dead
  background worker is visible.** JSON logs, request-scoped; PII and secrets redacted by
  field path in the logger configuration (`password`, `token`, `authorization`, `email`,
  `iban`), never by hand at call sites, and the error tracker receives exactly what the log
  received. On SIGTERM the process fails its health check, stops accepting work, drains what
  is in flight, then exits - never `process.exit(0)` on the signal, never ignoring it. Every
  job type has a fallback path or its absence is documented in the operations runbook. The
  error tracker is configured from the environment, not from the database, because it has to
  work when the database is the broken thing. A caught error is handled, rethrown or reported
  through that logger; a catch whose only act is a console line is a failure nobody sees.
- **FLOW.1 (MUST) - Conventional Commits, no em-dash anywhere** (code, copy, i18n, commit
  messages; the house separator is `·` or a hyphen), **no `authorship` trailer.** The
  message says why, for the reader, not what the diff shows.
- **FLOW.2 (MUST) - The gate runs before the push, and `--no-verify` is not a workflow.**
  Pre-commit holds only what takes seconds on staged files (format, a secret scan, the
  locale-set check); pre-push holds the gate. The hooks manager is `core.hooksPath` for a
  single package and Lefthook for a monorepo (parallel, glob-scoped, no Node dependency);
  either way the list lives in the gate script, not in the hook. Pointing `core.hooksPath`
  elsewhere or unsetting it skips the hooks as the flag does, and is the same bypass. Whether `main` takes direct
  pushes or PRs only is a per-repository decision written in its `CLAUDE.md` and in
  `abatty.config.json` (a client project with a signed IP transfer is PR-only; an internal
  platform may push to `main`). Either way `main` is never red on purpose, and a branch lives
  a day or two, not a month - larger work lands behind a flag.
- **FLOW.3 (MUST) - No lowering a gate to go green.** Fix the code or the test. Changing a
  threshold is its own reviewed change with a written reason. Pin coverage at today's
  measured figure and raise it; never set an aspirational number the tree does not meet, and
  never let a tool raise it for you (`thresholds.autoUpdate` erases the record of who moved
  the floor and why).
- **FLOW.4 (SHOULD) - A structural decision is a MADR entry**: status, date, context,
  options considered, outcome, consequences; superseded by a new entry rather than edited;
  re-read a month later and the outcome recorded. Weight of the template matches the weight
  of the decision.

---

## 5b. Testing rules

- **TEST.1 (MUST) - A unit test is colocated, names one observable behaviour as a sentence,
  and is deterministic by construction.** `x.test.ts` beside `x.ts`; a name that needs "and"
  is two tests; time is `vi.useFakeTimers()` + `vi.setSystemTime()` restored in `afterEach`;
  randomness is seeded or mocked. Read the `Test Files` count, not only `Tests`: a file that
  failed to collect contributes nothing and reads green.
- **TEST.2 (MUST) - Integration runs against a real Postgres.** Testcontainers or the local
  dev container, dynamic port, real migrations (never `push`/`sync`), one rolled-back
  transaction per test, no ORM mocking. A suite that mocks the model cannot see a
  constraint, a transaction or a race.
- **TEST.3 (MUST) - End-to-end is Playwright with `axe`, and it is tiered.** Projects per
  device (a mobile viewport is a project, not a branch in a test); `retries` 0 locally and
  at most 2 in CI; `trace: "on-first-retry"`, screenshots on failure only; sharded when it
  outgrows one runner; zero critical or serious `axe` violations. Unit on every save,
  integration on every push, a smoke E2E on every merge, the full E2E nightly.
- **TEST.4 (MUST) - Coverage is a floor per area, pinned and raised.** Branches and
  functions bind, not lines; per-glob thresholds for money and legal logic (`perFile: true`
  there); `reportOnFailure: true` so a red run still reports; every exclusion listed in the
  config AND in the testing doc, because an unwritten exclusion is indistinguishable from a
  hole. Never a single repository-wide average: it is true of nothing.
- **TEST.5 (MUST) - A guard is proven by breaking it, and the suite is measured by
  mutation.** Every new guard, ratchet and probe: reintroduce the defect, watch it fail,
  restore. Confirm the mutant EXISTS (grep the file) before reading a green as a verdict;
  break both halves of a rule enforced twice; check the assertion can tell the outcomes
  apart. Where the stack allows it, StrykerJS on changed files per PR with `break` at
  today's floor (never aspirational) and the full sweep on a schedule.
- **TEST.6 (MUST) - A flaky test is quarantined, owned and dated, never retried away or
  deleted.** A separate non-blocking lane, an owner and a deadline, back into the blocking
  suite only after the root cause is fixed. Leaving it red intermittently is how a team
  learns to merge on red.
- **TEST.7 (SHOULD) - The published contract is tested against the LIVE response**, not
  only against the route table: a Dredd-style run from the generated OpenAPI, or
  Schemathesis-style fuzzing, so a field's type, required-ness or enum cannot drift from
  what the spec promises.

## 6. Product surface rules

- **I18N.1 (MUST) - No hardcoded user-facing text.** Lint flags literal JSX text; the
  exemption for a single-language surface is an ADR, not neglect. A key is added to every
  locale in the same commit (the pre-commit hook refuses a partial set) and a completeness
  check in CI fails on a key one locale has and another lacks. No markup inside a catalogue
  value - rich text goes through the library's component (`t.rich`, `<Trans>`). Plurals are
  ICU MessageFormat with an `other` case always present, never a `count === 1` ternary: CLDR
  has six categories and English has two; interpolate only runtime values, and write a full
  sentence when the possible values are known. One key per UI instance - identical text is
  not identical meaning - and a governed `common` namespace that stays small. The default
  language is the master and the others derive from it. Dates, numbers and money through
  `Intl`. Depth: [`guides/I18N.md`](./guides/I18N.md).
- **I18N.2 (MUST) - No fallback chain ends on a specific language.** English is the floor;
  the store's or the buyer's language is the first choice, negotiated by best-fit matching
  (`en-GB` resolves to `en`, not to the default); a document's language is snapshotted once,
  where it is issued. A country or a language list is never hardcoded in a form - it comes
  from `Intl.DisplayNames` and ISO tables. A platform that accepts any ISO 639-1 code will
  meet an RTL one: layout uses logical properties (`ms-*`, `pe-*`, `inset-inline-start`)
  and one `dir` on the container, never `left`/`right`. A missing key shows the master
  language, never the raw key.
- **A11Y.1 (MUST) - WCAG 2.2 AA, and the countable part is at zero.** The European
  Accessibility Act has applied since 28 June 2025 to any e-commerce service sold to EU
  consumers wherever the seller is: a storefront is squarely in scope, an admin console is
  not assumed exempt, and a public accessibility statement (target, known gaps, a contact)
  is part of the deliverable. Semantic element before ARIA (a `div` with `onClick` is not a
  control; no ARIA is better than bad ARIA, and a positive `tabindex` is a bug); `lang` and
  `dir` on `<html>`, one `h1`, a `main`, a working skip link, a heading outline with no
  skipped level; six failure kinds are 96 % of what is measured across the web (contrast,
  missing alt, unlabelled fields, empty links, empty buttons, missing language) and none of
  them is allowed here; every icon-only control
  has an accessible name (with `asChild`, on the child that renders); focus ring kept, never
  obscured by a sticky header (2.4.11), focus traps kept, tooltip never the only carrier;
  target size 24x24 CSS px is the legal floor (2.5.8) and 44px is the house rule on phone
  surfaces; contrast 4.5:1 for text and 3:1 for large text and non-text UI (1.4.11), computed
  from the token file for every pair the UI renders, in both themes; `prefers-reduced-motion`
  honoured; a form error named in text beside its field, nothing asked twice in one flow
  (3.3.7), and authentication never a memory test - a TOTP field accepts paste and a password
  manager (3.3.8); a drag has a single-pointer alternative (2.5.7). `axe` in the browser suite
  with zero critical or serious, including after a modal opens. `jsx-a11y` sees a component
  library's markup only when `settings['jsx-a11y']` maps the components AND sets
  `polymorphicPropName` - without both it reports zero on code that fails. What no gate
  covers (focus order, screen-reader output, composited colours) is stated as uncovered, never
  claimed, and a release carries a keyboard-only pass. Depth, the legal frame and the
  numbers: [`guides/A11Y.md`](./guides/A11Y.md).
- **UI.1 (MUST) - Read from the theme, never hardcode.** Tokens as CSS variables (OKLCH,
  `:root` and `.dark`, one `--radius` base), not hex; no inline `style={{}}` unless every
  value is computed at runtime; no `!important`; no ad hoc per-component CSS file - a
  theme-driven `styled()` or a tokenised `sx` on a MUI surface is the framework's own pattern,
  not the defect this rule names; recurring visual decisions in the primitive, the theme's
  `components` block or the token file, never repeated per call site; classes composed with
  `cn()`. MUI: `sx` for a one-off, `styled()` for anything reused, `useFlexGap` on `Stack`,
  no bare system props. Lists paginate on the server, with filtering and sorting server-side
  too. Column definitions outside the render body. `100svh` for a first-paint full-height
  surface, `100dvh` only where resizing with the browser chrome is wanted, never animated.
  Vendored UI files carrying local edits are fingerprinted, and the gate fails on drift.
- **PWA.1 (MUST) - The worker never serves a stale shell.** Installable means HTTPS, a
  valid manifest and a registered worker, and a failure is silent. Navigation network-first;
  only content-hashed assets cached, or nothing at all on a surface that acts on money or
  stock; caches build-keyed and dropped on activation, and purged at logout because a cached
  page rendered for one user is the next user's leak on a shared device; `sw.js` served
  `no-cache` and disabled in development; authentication, payment and mutations network-only;
  APIs, WebSockets and SSE never intercepted; `orientation` never locked (WCAG 1.3.4); in
  standalone mode every screen has a way back and a way to reload, and an offline state is
  announced in a live region; the manifest carries `id`, a 512px and a maskable icon (artwork inside the
  40% safe zone), `start_url` and `display`; every asset a manifest, worker or push payload
  names resolves to a file, and the gate checks it. Installability is verified against
  Chrome's own criteria, not a Lighthouse PWA score, which no longer exists. Web Push:
  `Notification.permission === "granted"` is consent, `PushManager.subscribe()` is the
  subscription, and the flow that stops at the first delivers nothing; the VAPID pair is
  generated once and never rotated, because rotation invalidates every subscription with no
  error anywhere; `pushsubscriptionchange` and a `410` mean re-subscribe, not retry;
  permission is asked in context after an explicit action, never on load, and every
  notification has an in-app equivalent. Serwist as soon as there is a cache; a hand-written
  worker only for push. The rationale lives in a contract test, because a blank-page incident
  is how this rule was learned. Depth and the iOS constraints to tell a client:
  [`guides/PWA.md`](./guides/PWA.md).
- **CACHE.1 (MUST) - A cache key carries every parameter, including the tenant and the
  user, or the read is not cached.** Every write invalidates, including REST routes, webhooks
  and jobs; tag invalidation is a Set of member keys, never a keyspace scan (`KEYS` blocks
  the server, `MATCH` globs are literal: `x:*` and `x:{id}` are disjoint). Every key has a
  TTL set atomically with the value, jittered where many share one. A mutation test that
  mocks the cache absorbs a missing invalidation in silence - assert the call.
- **CACHE.2 (MUST) - Some reads are never cached.** An authorization decision without a
  bounded TTL and an invalidation on every role change; anything that must reflect the
  latest write (a balance, a stock reservation); tenant data on a platform whose isolation is
  RLS, where the honest answer is "we do not cache tenant reads" and it is cheaper to
  guarantee than any invalidation scheme. Where a hot key CAN be cached, one caller
  recomputes it (single-flight `SET NX EX`) while the others wait or serve stale. Next.js
  `"use cache"` scopes carry an explicit `cacheLife`, read `cookies()`/`headers()` outside
  the scope, and know that `updateTag` (read-your-writes) and `revalidateTag` (stale-while-
  revalidate) are not interchangeable.
- **FLAG.1 (MUST) - A feature flag published to a client is enforced where the feature is
  served**, and one enforced is published. A flag that hides a button while the API still
  answers does nothing for a second client or a script.

---

## 7. Documentation and agent readability

- **DOC.1 (MUST) - Everything lives in `docs/`, archived rather than deleted**, with
  `superseded_by` on the archived file.
- **DOC.2 (MUST) - Every document opens with front matter, and CI validates it:**

  ```yaml
  ---
  title: "Human-readable title"
  description: "What this is and when to read it - the agent decides relevance from this line."
  category: governance | architecture | guide | runbook | reference | decision | testing
  status: draft | living | stable | deprecated | archived
  audience: ["architect", "developer", "agent", "reviewer", "ops", "product", "designer"]
  tags: ["..."]
  related: ["./SIBLING.md"] # every link must resolve
  last_verified: "YYYY-MM-DD" # the date the doc was read AGAINST THE CODE
  source_truth: ["src/path/**"] # files whose change makes this doc suspect (optional if the doc cites file:line)
  superseded_by: "./NEW.md" # required when archived
  ---
  ```

- **DOC.3 (MUST) - The index matches the tree**, and each doc's status matches its row.
- **DOC.4 (MUST) - A doc cites the code it describes** (`file.ts:line`, or better the
  SYMBOL, since a line number is the first citation to rot) and never quotes a regex or a
  constant inline - a doc that copies one rots every time it is corrected. A citation that no
  longer resolves is counted; a rule ID or npm script named in prose that does not exist is
  counted.
- **DOC.5 (MUST) - Freshness is measured against the DIFF, never the calendar.** A doc is
  behind when a `source_truth` entry changed in a commit later than the last commit that changed
  the doc itself (a frozen doc is exempt, it is supposed to age). A doc changed in the same commit
  as its source is fresh. A commit that only moves a `last_verified` date counts for neither side:
  bumping the date re-read nothing, and a source document whose date alone moved has not moved.
  A re-read that found nothing to change is put on the record instead, as a `docs-verified:` line
  in a commit message naming the documents read, and it re-reads those alone. The typed date is
  the fallback for a document never committed; a shallow clone is not judged, since its one
  commit reads as the last change of everything. A dangling `source_truth` entry is a hard failure, not a warning: it is
  the doc's update trigger switched off. **Recording a re-read without re-reading the doc against
  the code is the lie the metric exists to prevent** - if you cannot verify it, leave it stale.
- **CHANGE.1 (MUST) - A push that touches source, migrations, tests, CI or scripts touches
  `CHANGELOG.md`**, checked over the pushed range. Entries are written for the reader, not the
  committer.
- **AIR.1 (MUST) - `CLAUDE.md` is kept in sync with reality** and carries the "known gaps"
  section. Five of its numbers had drifted before anyone looked in one repository; nothing
  measures it unless the probe is told to read it.
- **AIR.2 (MUST) - An agent-readability score is printed on every gate run**, computed from
  the ratchet's own metrics in ONE implementation, on six weighted axes: navigability, type
  safety, boundary clarity, naming and consistency, docs freshness, test signal. Each term
  earns full marks at zero and nothing at the count where the property is genuinely lost, so
  the score trends rather than collapses. **Every term is individually ratcheted, so the score
  can only move up; whether the TOTAL blocks is a separate decision**, stated in terms of the
  weak axes rather than a total with a one-point margin. A sharper instrument that lowers the
  score is not a regression, and hiding it by keeping the old metric would be the failure.

---

## 8. The lessons catalogue

The defects behind these rules, one sentence each with the check that now catches them, are
in [`LESSONS.md`](./LESSONS.md), grouped by kind: instruments that were wrong on their first
run, refactors that moved a problem instead of removing it, guards whose tests could not tell
the outcomes apart, configuration that was present and inert, and platform traps. A rule here
that seems arbitrary has its reason there.

---

## 9. What may differ per repository, and what may not

**May differ, and is recorded in that repo's `CLAUDE.md` or `CODE_CONVENTIONS.md`:** the
stack and its layering; the locale set and any single-language surface (by ADR); the icon
policy (text-only, `lucide`, MUI icons); whether `main` takes direct pushes; coverage floors
and whether they are global or per area; which heavy suites the gate selects on which paths;
the JSDoc scope (every export, or the boundary surfaces named); whether doc freshness is
implicit (cited files) or explicit (`source_truth`).

**May not differ:** the instrument (§2) in all four parts; HARD metrics staying HARD; the
per-file floor; scanned-zero as a failure; the front matter; the changelog rule; the no-em-dash
and no-co-author rules; the function-shape numbers; the 800 cap; fail-closed opt-ins; English
as the language floor; a guard verified by reintroducing its defect before it is called a
guard.

A deviation is a dated entry with a reason where the subject lives, and the standard is updated
when the third repository makes the same deviation - that is how this document was written.
