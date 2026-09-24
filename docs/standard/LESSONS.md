---
title: "Lessons catalogue - what each defect cost, and the check that now catches it"
description: "The generic lessons behind the engineering standard, grouped by kind (instruments, refactoring, testing guards, inert configuration, platforms): one sentence each, the repository that paid for it in parentheses as provenance, never as a rule about that repository. A new lesson is added here when a defect recurs or when a guard caught it; the standard's rules cite this file rather than repeating it."
category: reference
status: living
audience: ["architect", "developer", "agent", "reviewer"]
tags: ["lessons", "defects", "guards", "standards"]
related: ["./ENGINEERING_STANDARD.md", "./ENFORCEMENT_MAP.md"]
scope: synovitec
last_verified: "2026-09-24"
---

# Lessons catalogue

Each of these cost real time in at least one repository. They are generic; the repository
that paid is named in parentheses so the detail can be found in its own `STANDARDS_PROGRESS.md`
or `CLAUDE.md`. Read them as the reasons behind the standard's rules, not as rules about the
repository named.

**On instruments**

- A line-scoped check reported 20 of 21 correctly labelled icon buttons because the attribute
  list spans lines. Parse the whole opening tag. (dms)
- A CRLF worktree makes every `$`-anchored regex match nothing; normalise line endings at the
  reader, and keep a CRLF control case. (dms, ecomm)
- An `ignores` glob reads a Next.js segment `[companyId]` as a character class. Escape it and
  pin three controls: on for a clean file, off for the bracketed path, on for a clean sibling.
  (dms)
- A probe reads the tree it ships in, so its own pattern, prose and control fixtures are findings
  against itself: 4 of 7 type escapes and 3 of 7 raw environment reads were the probes' own text,
  and an opt-in probe nobody enabled counted eight of its own lines unseen. Assemble the spellings
  from parts, and run every shipped probe, enabled or not, over the package's own tree. (abatty)
- A guard written against a setting refused the command that installs it: refusing every write of
  `core.hooksPath` refused `git config core.hooksPath .githooks`, which the package's own install
  runs. Judge the value a write sets, not that a write happened. (abatty)
- A formatter wraps a long `[...]` list onto the line below its key, and a front-matter reader
  that took the key's line alone read it as empty: `source_truth` gone, the freshness check off
  for that document, without a word. Read what the formatter writes. (abatty)
- A placeholder guard `\bNN\b` never matched `00NN_name`; a `\b` at a path boundary matched a
  path's own suffix. Boundaries are `(?<![\w/])`, tested against a foreign path and a web
  path. (dms)
- `JSON.stringify` on a Sequelize where clause serialises `Op` symbols to `{}`, so the
  assertion compared against an empty object. (Task-Manager)
- A test file that fails to COLLECT reports `Tests N passed, Test Files 1 failed`. Read the
  file count. (Task-Manager)
- A dependency can enforce a control this repository never mentions (Better Auth's TOTP
  lockout). Grep finds nothing; check the dependency's resolved defaults, write a test that
  fails if an upgrade changes them, and record it. (ecomm)
- Do not measure while the tree is moving. A coverage run that overlapped files being written
  describes a tree that never existed; commit without the figure rather than with a wrong
  one. (Task-Manager)
- Two copies of one rule set drift (a fn-shape config for the ratchet and another for the
  editor; one regex listing rule families for citations and another for definitions). Feed
  both readers from one list. (dms)
- A guard that greps for the shape of the last defect reports green through the next one.
  (ecomm, `costPrice: true` versus a bare `include`)
- A comment asserting a protection nobody verified ("covered by `claimKey`" - it never called
  it). (ecomm)
- The mirror of scanned-zero: a walker that skipped `.claude` made every check reading
  `.claude/rules` or `.claude/hooks` report "missing" on every repository, forever, with the
  right words. Prove a check in BOTH directions on a throwaway tree where the answer is
  known, not only on the repository that lacks the thing. (gap analysis, Task-Manager)
- A generated `.d.ts` ends in `.ts`: one such file made a 4,000-file JavaScript repository
  read as TypeScript, judged on strict flags it had declined by decision and charged 3,504
  `any` from its own declarations. Decide the language by non-declaration counts, and read
  the flag a repository chose (`checkJs`) before the flags it did not. (gap analysis,
  Task-Manager)
- A mass-format commit changes no truth a document describes, and a freshness check that dates
  a doc's sources by `git log` marks fifty docs stale at once; the only way to clear them would
  be bumping `last_verified` on each, a verification nobody did. Let the check step over the
  revisions in `.git-blame-ignore-revs`, the file git keeps for exactly this, and prove it both
  ways (0 stale with the line, 52 without). (Task-Manager)
- ESLint flat config keeps only the last block's options for a rule: three per-vendor
  `no-restricted-imports` blocks left only the last vendor's in force, silently. Build the rule
  once per file from a table, and read the resolved config for one file (`--print-config`)
  before trusting a rule with more than one block. (Task-Manager)
- A four-second green over 600 files is not a verdict until a planted violation is refused;
  neither is a mutation test whose mutant was never planted (grep the file first). Both were
  green for the wrong reason once on the same day. (Task-Manager)
- Retiring a barrel moves every test that mocked it: a `vi.mock` of the index silently stops
  applying once the importer reads the defining file, and the real module runs. Rewrite the
  mocks to the defining files in the same change, one per module, comments moved with them.
  (Task-Manager, 13 files)
- A coverage floor pinned to the hundredth flaps: one area read 90.20 and 90.13 on consecutive
  runs of the same tree. Pin to a tenth, and read a second full run before trusting a floor
  that sits on the measured figure. (Task-Manager)
- A replacement that reads context (quotes as neighbours) needs its shapes named before it runs:
  a quoted lone dash is a placeholder and keeps no spaces, a quoted spaced one is a separator;
  the first pass turned 17 placeholders into `' - '` and only the tests said so. (Task-Manager)
- The per-file floor catches what the total forgives on the day it lands: a template's
  self-test copied into `.claude/` was 25 lines over a utility budget and named in the first
  run. A harness is not the repository's source; exempt it, and keep the floor. (Task-Manager)

**On refactoring**

- Relocating a long function is not shortening it; the per-file floor is what lets the gate
  say so. Three relocations dressed as fixes in one day. (dms)
- Splitting for function shape adds signatures and returns, and pushed three files over their
  file budget while every function passed. Split the FILES too. (dms)
- The seams are usually already in the file: section comments (`// ---- print ----`), a prop
  doc that says "owns STATE and CHROME", a `{mobile ? … : …}` branch. Split by what a piece
  is FOR, never where a line count fell. (dms)
- A refactor reconstructed a string from memory (`s.searchPlaceholder`) that did not exist;
  the compiler caught it. Restore verbatim from git and diff every key, class and attribute
  before and after. (dms)
- A template refactor is verified by OUTPUT: render every email before and after into two
  directories and `diff -r`. (dms)
- A tidy-up that guards on a DERIVED value instead of the COLUMN silently starts filing a row
  the taxonomy never gave a home. Read the original against the replacement. (dms)
- A hook extracted from a component must keep hook order stable. (Task-Manager)
- Read the test before choosing a refactor's shape: a suite mocking a library BARREL breaks
  when a child switches to a deep import; `f(a, cond ? x : undefined)` fails
  `toHaveBeenCalledWith(a)` because `undefined` is not nothing. (Task-Manager)
- A source-reading test pins a decision that is easy to undo; when the code moves, the test
  follows it and reads only the file that owns the decision. (dms)

**On testing guards**

- A mutation must EXIST before a green suite means anything: grep the file for the change.
  Three "working guards" in one day were mutations that failed to apply. (Task-Manager)
- A rule enforced twice survives every single-line mutation. Break both halves. (Task-Manager)
- A guard can be real while its test is inert: check the assertion can tell the two outcomes
  apart. (Task-Manager)
- A contract two handlers cannot tell apart from its violation is not a contract (both
  branches called `markClassified` and returned `true` for the caller to call it again; the
  `AND status = 'quarantined'` guard hid it from 19 tests). (dms)

**On configuration that is present, correct-looking and inert**

- 25+ instances in one repository: a middleware imported and never mounted, a login-attempt
  service never called, a plugin that reports zero because a setting is missing. Grep for the
  CALL, not the import, and mutation-test it. (Task-Manager)
- A migration tool that restarts numbering would create the tenant tables without RLS; the
  script is disabled with a message that explains why. (dms)
- A CRON route present in the repository and wired to no scheduler is work that does not
  happen; the app schedules its own periodic jobs now. (ecomm)
- A `.default({})` on a settings section the form never sends re-zeroes it on every save;
  omission is how a form clears a value, so a partial section is a data-loss trap. (ecomm)

**On platforms**

- A Windows-generated lockfile drops the `@esbuild/*` platform entries and `npm ci` fails in
  Docker. Regenerate on Linux. (Task-Manager)
- Python's `/tmp` is not bash's on this machine; an intermediate file written from one is
  invisible to the other. (ecomm)
- `.env.development.local` wins over `.env.local` in `next dev` only; build, start, E2E and
  production never read it. (dms)
- A segment `loading.tsx` blocks same-route Server Actions from refreshing the page in
  production builds only. (dms)
- A DataLoader cached across requests serves one user's rows to another. (Task-Manager)
- A PSP token cache keyed by nothing handed the first store's sandbox token to every live
  store for nine hours. Key a cache by the credentials that minted it. (ecomm)
- A Prisma `Decimal` does not pad its scale when stringified: `7.00` reached the wire as
  `"7"` and `25.20` as `"25.2"`, contradicting the published two-fraction-digit promise on 28
  field/route pairs. Serialise money through one `money()` at the envelope. (ecomm)
- Spreading two Sequelize `where` objects to combine a tenant scope with a caller's filter
  REPLACES a duplicate `Op.and`/`Op.or` key instead of ANDing it; the scope is applied with
  `Op.and` after the builder. (Task-Manager)
- A `${…}` anywhere in a Woodpecker file, comments included, is expanded before parsing and
  kills the pipeline with no steps and no status; a secret in `commands:` is `$${NAME}`.
  (Task-Manager, ecomm)

**On driving an agent unattended from Windows** (found by the stub night on dms, 2026-09-13;
each one made the harness "succeed" while doing nothing, or blame the wrong thing)

- Windows PowerShell 5.1 `Out-File -Encoding utf8` writes a BOM, and `JSON.parse` refuses
  it: every state file the runner wrote blocked every stop as "unreadable". Write with
  `[IO.File]::WriteAllText(..., UTF8Encoding($false))`, and tolerate a BOM at the reader.
- A PowerShell pipeline with ONE element unwraps: `$phases | ForEach-Object { @{...} }` is a
  bare hashtable and serialises as `"phases": {...}`, not an array. Wrap in `@(...)` and read
  the file back with the consumer's parser before trusting it.
- `"{0:0.00}" -f` and `.ToString("0.00")` follow the user's locale: a French machine passed
  `--max-budget-usd 10,00`. Format anything a CLI parses with the invariant culture.
- Under `$ErrorActionPreference = "Stop"`, ANY stderr line from a native command (`git
checkout` saying "Already on") is a terminating error. Use "Continue" and judge exit codes.
- `$args` is PowerShell's automatic argument array; assigning to it silently breaks the call.
- Git Bash rewrites an argument that starts with `/` into a Windows path, so the prompt
  `/adopt-standards --phase 1` reached the CLI as `C:/Program Files/Git/adopt-standards` and
  the skill was never invoked. `MSYS2_ARG_CONV_EXCL="/adopt-standards"` excludes that prefix;
  `MSYS_NO_PATHCONV=1` is too broad (it breaks POSIX paths handed to node.exe).
- A CLI that exits non-zero without a result is not a session. Counted as one, two crashes
  marked the phase "blocked after 2 sessions" and hid a startup error under a reason about
  the phase. Detect "no result", retry once, then abort with the stderr tail.
- `spawnSync('npx', ...)` without a shell finds nothing on Windows (`npx` is `npx.cmd`), and an
  error path that writes `result.stdout` then crashes on `undefined` instead of saying so; a
  byte comparison of generated files fails against a CRLF checkout; an absolute path handed to
  `import()` is read as the protocol `c:`; the command line is 8 KB, so a hook that passes
  thousands of staged paths batches them by size (`xargs -s`). A suite that runs only in CI has
  never been proven on a developer machine: 18 tests failed here on a green branch (timezone,
  locale, CRLF, a `.env` read at import). Pin `TZ=UTC` in the runner and stub `dotenv` where a
  module reads it. (Task-Manager, first full run on Windows)
- A stub that plays the agent's part against the REAL Stop hook and the REAL gate finds
  what the hook self-test cannot: every defect above passed 41 green checks.

**On controls the constrained actor can rewrite** (found by reading the harness against its
own enforcement map, 2026-09-14, before a paid night)

- The Stop gate ran the gate command from a file the worker could edit, the guard watched
  Bash while most edits go through the Edit tool, and the block counter sat in a folder the
  worker could write. Every check was proven and every check was the worker's to rewrite: a
  control the constrained actor can change is prose with extra steps. The harness is
  read-only at night from every tool, the Stop gate reads its config from the base branch,
  and the runner refuses to continue or push when `.claude/` moved.
- A hook that crashes exits 1, and the agent treats that as non-blocking: a corrupt
  `adoption.json` in the tree would have crashed the Stop gate and let the session end. A
  guard fails closed - an internal error at night is a refusal, not a pass.
- "Changelog touched over the branch range" meant one line at the start of the branch covered
  twenty later commits without one. Judge the newest source-touching commit, and keep the cure
  monotone (a new commit with the entries), because amending is denied at night.
- `git checkout <base> -- <path>` was denied as "leaving the branch" because the regex saw the
  base name; the one command that restores a tampered harness was the one the guard refused.
  A restore is a checkout WITH `--`; test the exception beside the rule.
- A phase that legitimately switches a rule off (`no-await-in-loop` per directory, phase 1)
  and a worker that switches one off to go green produce the same diff. What tells them apart
  is the written reason FLOW.3 already requires - so the check reads the decisions file for the
  rule's name and records the loosening instead of refusing it. A floor, a threshold and
  `--max-warnings=0` have no legitimate night-time loosening and are refused regardless.
- A session that ends with no commit and no decision is indistinguishable, in the state file,
  from one that never ran. The runner names it (no-op), counts it, and says so in the blocked
  reason, so "blocked after 2 sessions" can be read as "did nothing twice".
- The stub proves the runner and the self-test proves the hooks; neither proves that a real
  `-p` session under these flags runs a command without a prompt and fires the hooks. A canary
  session with a known answer and a command the guard must refuse proves it for a dollar,
  and the runner refuses the night without it.
- The hooks watched Edit, Write, Bash and PowerShell; a `-p` session also loads every MCP server
  of the user settings, and on this machine that was Gmail, Slack, Drive, Calendar and
  Microsoft 365 with send, create and delete tools no hook saw (120+ tools, proven by asking a
  headless session to list them). Found by asking where a code server's edits would go through
  the harness, before a night spent it. The runner now passes `--strict-mcp-config` on
  `.claude/mcp.night.json`, `protect.mjs` denies every server `adoption.json` does not name,
  and the canary asks the session for its own `mcp__` tool list.

---
