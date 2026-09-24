# Changelog

Keep a Changelog, SemVer. Every commit that touches source, tests, scripts or docs adds a line
under Unreleased in the same commit.

## [Unreleased]

### Added

- **`TEST-E2E-ERRORS`: a browser test fails when its page throws or does not hydrate.** The
  browser runner passes a page that threw an uncaught error or logged a hydration mismatch unless
  a test listens. An adopter shipped a hydration mismatch through sixty-two green browser tests,
  twice. The new rule wants a listener for `pageerror` and for hydration console errors, and it
  names every spec that takes `test` straight from `@playwright/test` and so skips it. `abatty fix
  --phase 3 --write` writes the shared fixture (`e2e/fixtures.ts`), which fails the test on either.
  The catalog now holds 80 rules.
- **Each incident a night records becomes a proposal the morning can act on.** `abatty
  night-report` used to propose a lesson only when a decision code recurred, and cited a count.
  Now each of tonight's `ADOPTION_DECISIONS.md` entries of an incident kind proposes what would
  have caught it, and quotes the entry:
  - `behaviour-risk` proposes a test;
  - `seam-unclear` proposes a boundary-map line;
  - `harness-change` proposes a config value;
  - `sensitive-path` proposes a protected path;
  - `doc-left-stale` proposes a split document;
  - `step-restored` proposes a smaller phase step.

  Ordinary defaults (a dependency deferred, the gate deferred) propose nothing. Earlier nights'
  entries are left to their own mornings.
- **By day, the guard asks before a migration and names the database it would reach.** Nothing
  stood between a migration and a shared database by day. An adopter applied an unmerged
  branch's migration to a shared database from a shell whose `DATABASE_URL` nobody had looked
  at. `prisma migrate deploy|dev|reset`, `prisma db push`, `drizzle-kit migrate|push`, a
  `db:migrate` script and their kin now get a prompt naming the host, port and database: from
  the command, the shell, or `.env.local`/`.env`, and never the user or the password. `abatty
  update` installs it; the self-test proves both directions.
- **A night does not start work already open, and does not push more than one review reads.**
  The pre-flight refuses while an earlier night branch, here or on origin, that the base has not
  taken worked a phase this night would run. It names the branch and the phases: merge it or
  delete it first. Before the push, a branch that changes more than `maxDiffLines` lines against
  the base (a new config key, 2000 by default) stays local, and the summary says how many.
- **`change.testTamper`, on probation, flags a commit that made its tests easier to pass.** An
  agent that cannot make a test pass has cheaper ways out than the fix, and most measured
  cheating was done to the tests. `change.refactorTests` reads refactors only. This probe reads
  every commit in the push and names each way out:
  - a test case removed (one moved to another file in the same commit is not);
  - a case skipped or focused;
  - a snapshot rewritten with no `tests-changed:` line;
  - a checker suppression added;
  - a coverage or quality threshold lowered.

  `abatty night-report` lists the same for every commit of a night, under "Tests and checks the
  night changed", and proposes a lesson when there is any. Probation means shown, never failing.
- **`abatty mutate` asks whether your tests would notice the lines this change wrote.** A green
  suite says the tests passed, not that they hold the new code. For each changed line of shipped
  code, the command makes one small change in the code itself, never in a string or a comment: a
  comparison flipped, a boundary moved, an `&&` made `||`, a result inverted. It then runs the
  tests nearest that module on the import graph and puts the file back whatever happened. A
  mutant no test noticed is reported with its line and what changed. `--strict` makes one fail
  the run, `--max` bounds the count, and `mutation.command` in the config names the runner. It
  needs no dependency, and `TEST-MUTATION` credits a script that runs it: it is bounded to the
  change and ignores strings and comments by construction. Its first run on this repository read
  three mutants as survived because it had picked tests by a word; a probe is reached through
  the registry that lists it, so it now follows the imports.
- **`docs.danglingRefs`, on probation: a name a document cites that the code no longer has.**
  `docs.citations` checks the paths a document cites; a function or a constant named in
  backticks rots as quietly, and a study of popular repositories found such a reference in more
  than a quarter of them. The new probe counts a backticked name shaped like code (an inner
  capital, an underscore, or written as a call) that the code had at the document's last commit
  and has nowhere now, reading the same files on both sides; a concept never in the code, a plain
  word, a fenced block and an archived or superseded record are not read.
- **A false positive recorded is counted per probe.** A raise already needs a reason; one written
  `false-positive: <what it misread>` is now a dispute of that probe, marked on the raise and
  counted per metric by `abatty report` (and its `--json`). It is the count a blocking check lives
  by: which probe to fix, and which to keep on probation.
- **`code.undocumentedExports`, CODE-JSDOC without a dependency.** The rule was held only by a
  linter plugin, so a repository that would not add one, this package included, could not hold
  it. The new opt-in probe, on probation, counts exported functions, constants, classes, types,
  interfaces and enums with no `/** */` block directly above them (a `@typedef` block does not
  count), and CODE-JSDOC now reads a floor for it as present. It checks presence only: whether a
  block says why is a reviewer's reading. Its first reading here found 30 undocumented exports;
  each now says why it exists, and the metric holds at zero.
- **`docs/VERSIONING.md` says what a version promises at 0.x.** SemVer promises nothing below 1.0,
  and a tool that runs in an adopter's hooks needs to say in advance what an update can do: a
  minor is anything that can turn a green run red or change what a machine reads (a probe that
  blocks or counts differently, a default that moves numbers, a hook that refuses more, the
  config schema, `--json`, `--sarif`, MCP and exit codes); a patch cannot; the terminal's words
  are not part of the contract. One breaking axis per minor, with its migration in the same
  release.
- **A probe can be on probation: counted and shown, never failing a run.** A blocking check lives
  on its false positives, and one wrong red is a reason to reach for the bypass. A new or
  heuristic probe now ships marked `probation`: its findings are listed under a yellow
  `PROBATION`, a verdict that would have failed says which one it would have been, and the run
  stays green. A probe leaves probation in a release once a named repository has run it clean,
  the rule presets already follow. A probe on probation is never promoted to HARD, so its findings
  cannot refuse `abatty baseline`, SARIF reports them as notes, and the MCP ratchet tool names the
  verdict. The five probes added in this release start there.
- **`docs.frontMatterSyntax`, on probation, counts front matter a YAML reader refuses.** The
  probes read front matter by hand, and that reading forgave what a site generator or a content
  schema does not: an adopter's documents passed every docs probe with a block a YAML parser
  rejects. The new metric counts a document with a duplicate key, a key or a list item indented
  under a scalar, a tab in the indentation, a quote, list or map left open, a `: ` inside an
  unquoted value, or a reserved first character, each on its line. No dependency: the reading was
  checked against a YAML parser, and every shape it refuses or accepts is a test case whose verdict
  the parser gave; a list or a quote continued on indented lines, and keys like `og:image`, are
  read as YAML reads them. An unquoted date is not counted, since a reader accepts it.
  `docs.frontMatter` keeps its definition.
- **`obs.catchOnlyLogs` and `sec.weakRandom`, two opt-in probes for bugs no metric counted.**
  Documentation written by an adopter's sessions found a "cryptographic" temporary password drawn
  from `Math.random` and forms whose failed save was caught, written to the console and dropped,
  so the user saw a saved form. `obs.catchOnlyLogs` counts a `catch` block or a `.catch()`
  handler whose every statement is a `console.*` call; `sec.weakRandom` counts a `Math.random`
  call when a name on its line, or the function around it, says password, token, secret, salt,
  nonce, credential, API key or a one-time code, read by its words and outside strings, so an id,
  a shuffle, a DOM id's text or `plotPoints` is left alone. Both read
  JavaScript and TypeScript outside test folders at any depth, and `init` enables them on every
  preset. SEC.1 and OBS.1 in the standard say what each one holds.
- **`measure` names each new reading in the one before it, and `docs.supersededChain` counts a
  broken chain.** `abatty measure` wrote `GAP_ANALYSIS_<date>.md` on every run and left the
  previous reading naming nothing, so an adopter's older reading was quoted as the current score
  and no docs probe said so. `measure` now writes `superseded_by` into the earlier readings of its
  series that name no successor, leaving a link already written alone. The new opt-in probe,
  enabled by `init` on every preset, counts a reading of a chained dated series that names no
  successor, an archived document without `superseded_by`, and a `superseded_by` that names
  nothing. A series nobody chained, such as nightly reports, is a record and is not read.
- **`valid.sqlCurrentDate`, an opt-in probe for the day a query takes.** `valid.utcDay` reads the
  code, so an adopter's read 0 while 196 `CURRENT_DATE` sat in its SQL, each one the session's
  day, UTC unless the connection says otherwise, and yesterday for the length of the offset every
  night east of Greenwich. The probe counts `CURRENT_DATE`, `now()::date`, `current_timestamp::date`,
  `date(now())` and `date_trunc('day', now())` in `.sql` files and in the strings of JavaScript and
  TypeScript, comments left out; a timestamp converted with `AT TIME ZONE` before its day is taken
  is not counted. Enable it in `ratchet.enable`.

### Fixed

- **A narrowed secret-read deny is caught, by what it matches rather than by its words.** An
  adopter narrowed the template's `Read(./.env.*)` to eight named files so an allow for
  `.env.example` could work. Every daytime check stayed green while `.env.staging`, `.env.prod`
  and any backup became readable by the agent.
  - `SEC-AGENT-PERMISSIONS` now plants those names and asks whether the deny rules refuse each
    one. It is partial, and names the readable files, when any is not refused.
  - `abatty doctor` fails on an env file the settings no longer refuse. It names any deny rule
    the template ships that the settings dropped, and any allow rule they added, instead of
    reporting generic drift.
  - The harness README recommends `env.example`, which the wildcard does not match.
- **Doctor no longer calls a gate step's script absent when the gate runs it under its other
  name.** A repository with `test:changed` was told `coverage:changed` was missing, while the gate
  was running `test:changed` for that very step.
- **A reformat or a reworded comment no longer makes a document behind.** `docs.behindCode` read
  any commit to a cited file as a move, so a formatting pass or a comment edit flagged every
  document that cited the file, and the only way out was a re-read that found nothing. A commit
  whose change to a cited file is whitespace, or comment lines in the file's own spelling, now
  counts as no move. A JavaScript private field's `#` is code, not a comment.
- **An escape or an env read quoted in a string is text, not code.** `types.escapes` read the raw
  file, so a message warning against `as any` counted as one, and `valid.rawEnv` counted a
  `process.env` quoted in a rule's advice or a comment. Escapes are now read with strings blanked
  and comments kept, where the ignore directives live, and env reads with both blanked; the
  TYPES-ESCAPES rule reads code the same way. A count can only fall from this, and a local run
  locks the lower floor itself.
- **TEST-COVERAGE credits the gate's own `coverage:changed` step.** The rule looked for a gate on
  the changed lines in a coverage tool's spelling only, so a repository that wrote the
  `coverage:changed` script the gate itself runs was told it had no gate on the change. Its next
  step now also names the dependency-free route: a `coverage:changed` script fed by Node's own
  `--experimental-test-coverage`. This repository runs one: `npm test` measures coverage as it
  runs (about five per cent of its time), and the step judges the lines the push changed at 80%,
  counting a new file no test loads and nothing imports as untested.
- **A front-matter list the formatter wrapped is read.** Prettier wraps a `[...]` list that passes
  its print width onto the line below the key, and the docs probes read that as an empty list: a
  wrapped `source_truth` switched `docs.behindCode` and `docs.danglingSource` off for its document
  without a word, and seven of this repository's own documents had lost their `related` list this
  way. A list opened under an empty key, or on the key's line and closed lines later, is read now.
- **The git shim refuses the hooks pointed away too.** The shim on `PATH` refuses the force push
  and the bypass flag in every shell the guard never sees; it now refuses `core.hooksPath` pointed
  elsewhere or unset in the same shells, by argument (`-c`, `--config-env`, a `git config` write)
  or by the environment it is called in, which it reads directly rather than from the command's
  text. Reading the key, a message that names it, and pointing it at a hooks folder (`.githooks`,
  `.husky`, `.husky/_`), which is how `abatty hooks` and husky install them, pass.
- **The guard refuses switching the hooks off by configuration.** Git runs its hooks from
  `core.hooksPath`, so pointing it elsewhere or unsetting it skips the gate exactly as the bypass
  flag does, and an adopter replayed five such spellings against the last release: every one
  passed, from the base branch too. The guard now refuses the key unset, or set by `git -c`,
  `git config` or a wrapper's text to anything but a hooks folder, and `GIT_CONFIG_KEY_n` or
  `GIT_CONFIG_PARAMETERS` naming it; reading the setting, pointing it at `.githooks`, `.husky` or
  `.husky/_` (the install), and a search or an edit that only mentions it stay allowed.
  At night, `.githooks/` and `.husky/` are harness, so a shell delete or edit of a hook is
  refused as a write to `.claude/` is. The self-test proves the new family on every machine.
- **No probe counts its own source, and every shipped probe is held to it.** A probe reads the
  tree it ships in, so its pattern, its prose and its control fixtures were findings against
  itself: `sec.weakRandom` failed this repository's ratchet on its own controls, and
  `valid.sqlCurrentDate`, opt-in and not enabled here, counted eight lines of its own file unseen.
  Older probes did the same: 4 of this repository's 7 type escapes and 3 of its 7 raw environment
  reads were the probes' own text, so its numbers overstated its debt. The spellings are now
  assembled from parts, and a test runs every built-in probe, enabled or not, over this tree,
  untracked files included, and fails on any finding in the file that defines it.
- **`test.coverageExclusions` reads Node's own ignore comments.** The probe knew istanbul, c8 and
  v8 spellings only, so a `node --test` suite could take code out of its coverage with
  `/* node:coverage ignore next */` or a `disable` region and no count saw it: a practice read
  through one tool's spelling. `node:coverage ignore next` and `node:coverage disable` now count,
  and `enable`, which only closes a region, does not.
- **A file over its floor lists every finding it carries, and the two ways out.** The ratchet
  printed at most twelve lines, so a file that worsened by one showed a few of its findings and
  read as "these are the ones you introduced", which a count cannot know. Each file over its
  floor now lists all of its findings for that metric, and the verdict ends with the two ways
  out: fix findings until the count is back at the floor, or record the rise with
  `abatty baseline --reason --owner`.
- **A renamed file keeps its floor.** Per-file floors are keyed by path, so a `git mv` of a file
  carrying debt read as a new file rising from zero: the ratchet failed a change that moved no
  debt, and `abatty baseline`, now that a file's rise needs a reason, would have refused it
  without one. Git's rename detection, run from the commit that wrote the baseline, now carries
  each file's floor and its recorded exception to the new path, and `abatty raises` carries the
  base's floors the same way. A moved file whose debt rose is still a rise against its own floor,
  and debt in a file git does not see as a move still counts from zero.
- **A file's floor that rises is refused and recorded, even when the metric's total fell.** An
  adopter's baseline write took `size.excessCode` from 30109 to 30072 while ten files' floors rose,
  and the tool's record said nothing: a fall anywhere could hide a rise anywhere else, although the
  standard holds every number to "only falls, by its total and per file". `abatty baseline` now
  refuses a per-file rise, a file newly carrying debt included, without `--reason` and `--owner`,
  records it under `metric file` in the baseline's entries, and drops the entry when that file's
  debt falls back. The report lists each such raise with its file. The write that records a
  redefined metric under its new definition is not a rise, since the old floor counted another thing.
- **A raise in a repository that pushes to its base directly has a way to be recorded.** A raise
  lands through a pull request approved by somebody other than its author, and a repository that
  delivers straight to `main` by policy never opens one, so an adopter's raise could be written
  down and never recorded as anything. There, `abatty raises` now reads a line the pushed range
  adds to the decisions file naming each loosened metric, and says plainly that this is the
  decision on record, not a second person's approval. A repository that takes pull requests still
  needs the approval. The base branch's config decides which one applies: a range can switch
  direct pushes off, never on, so it cannot approve its own raise with a line it wrote.
- **The gate names an inherited `NODE_ENV`.** An adopter built for production and pushed in the
  same shell: the gate ran under `NODE_ENV=production`, thirteen unit tests went red and the
  database scripts loaded the production env file, and it read as broken infrastructure. A
  `NODE_ENV` other than `test` or `development` is now named in the gate's header, before the
  first step. It is said rather than overridden, since a repository may set it on purpose.

### Changed

- **The harness self-test runs its guard cases a few at a time: doctor takes about a third less
  time.** Its two hundred guard and file-guard cases each start a process, which costs about a
  tenth of a second on Windows. Run one after another they were most of doctor's time (27.6 s
  here). They now run as many at once as the machine has cores, and are reported in the order
  they are written: 18.6 s here. `abatty update` installs it.
- **`abatty ci --check` names a pipeline that judges a new branch by its last commit.** A push
  that opens a branch carries no `before`. A hand-written fallback to `HEAD~1` then judges one
  commit of however many the branch holds. A pipeline that reads the push's `before` and falls
  back to the last commit is now listed with its line, and the check exits 3. `--range auto` (the
  fork from the base) judges the branch. A `HEAD~1` in a pipeline that never reads `before` is
  left alone.
- **The gate says when a range given by hand is narrower than the branch.** A CI run on a new
  branch has no `before` to diff from, and a hand-written fallback to `HEAD~1` judged one commit
  of four and printed green. On a branch other than the base, `--range` now prints how many of the
  branch's commits it holds, and the range from the fork that holds them all. It is a notice, not
  a refusal: a narrower range may be what was meant.
- **A floor a change lowered is written for it.** A floor left above today's count fails the run,
  and locking it took a separate `abatty baseline`, which made leaving findings in easier than
  removing them. When every failure of a run is such a floor, a run outside CI now writes the
  lowered floors itself and says to commit the baseline with the change; the run still fails
  until it is committed, since a hook cannot add a commit to the push it judges. CI never writes,
  and a run with anything else failing writes nothing.
- **The context-file template asks for what helps an agent, and a wrapped placeholder is still
  named.** Studies of context files found descriptive overviews the one kind of content that does
  not help, workflow hints the one that measurably shortens a run, and security and performance
  the sections few files carry. The template's opening is now one sentence, and it gains slots for
  workflow hints (what is slow, what to run first), security frontiers and performance budgets.
  DOC-CONTEXT read placeholders one line at a time, so a placeholder that wrapped onto a second
  line, as several of the template's longer ones do, was never named and could stay unanswered
  while the rule said present; one that opens like a question now counts across lines.
- **The standard says what the size budgets are not, and the plan carries three adopters' lessons.**
  CODE.1 now says its budgets are readability budgets and a floor that may only fall, not a defect
  predictor: no study validates the exact numbers. The adoption plan adds independent branches
  over stacked pull requests where the base requires an up-to-date branch, landing a repository-
  wide format change alone with its floor recorded, and the burn-down cycle (fix, watch the
  number fall, lock it in the same commit).
- **The package's own release path holds no secret, and its checks say when they break.** With no
  runtime dependency, a compromised release is the one way this package could hurt an adopter,
  since it runs inside their hooks. Publishing moves to trusted publishing: the registry names
  this repository's release workflow as the one publisher and refuses tokens, and the stored
  `NPM_TOKEN` is gone. Every action in the workflows is pinned to a commit, a Scorecard workflow
  measures the repository weekly, and a test refuses an unpinned action, a stored publish token,
  a runtime dependency or an install script. The SARIF and conformance steps no longer end in
  `|| true`: findings (exit 3) still produce their file, and a crash now fails the step.
  SECURITY.md describes the publish path.
- **The size rules say where a generated file goes.** An adopter took a generated OpenAPI client
  off its size count by moving it under `src/generated/`, which the budgets exempt, and nothing had
  told them that was the answer rather than a split. CODE-SIZE-800 and CODE-SIZE-300 now say so in
  their next step.
- **Test folders are exempt from the kind budgets at any depth.** The default exempt list skipped a
  root `tests/` or `e2e/` only, so a monorepo's `apps/<app>/tests/` was held to the test budget,
  and read by every probe of what ships, while the same folder at the root was exempt, as the
  standard says tests are. The default now matches `tests/`, `test/`, `__tests__/` and `e2e/` at
  any depth; the 800-line cap still applies. A repository that sets its own `ratchet.exempt`
  keeps its list. In a monorepo that uses the default, a count may fall once: the ratchet reads it
  as a floor to lock, and `abatty baseline` records it.
- **Every false positive an adopter reported is locked by a case that must stay green.** An audit
  of eighteen reported false positives found three whose fix no case held: variable reads, call
  results and test data in the secret scan, a commit message that mentions the bypass flag, and a
  CI step with its own `working-directory:`. Each now has the reporter's own situation as a case,
  the secret corpus grows to 52 (32 look-alikes), and the README states the rule: a false
  positive is fixed together with the case that keeps it fixed.
- **`docs.behindCode` is judged by commits, not by the typed date.** A doc is behind when a
  source it names changed in a later commit than the last one that changed the doc itself. A doc
  changed in the same commit as its source is fresh, whatever its date says: an adopter's decision
  log, updated in the very commit as its config, was flagged because its date lagged a day. A
  commit that only moves `last_verified` counts for neither side: bumping the date re-read
  nothing, so the rule no longer trains date-bump commits, and a source document whose date alone
  moved no longer cascades to the documents that cite it. A re-read that found nothing to change
  is recorded as a `docs-verified: <paths>` line in a commit message naming the documents read,
  and re-reads those documents only. A date line is ignored in documents alone: a config whose
  `updated:` changed has moved. A document never committed falls back to its typed date, and a
  shallow clone, whose one commit adds every file, is not judged at all and says so. The
  probe's definition is now 2, so an existing floor reads as redefined, with how to re-read and
  record it, rather than as a regression nobody caused. This repository's own `DOGFOOD.md` is the
  first case: it had called a bug fixed in 0.5.0 "not fixed" for two releases, behind a date that
  had been bumped.

## [0.5.2] - 2026-09-24

### Added

- **`types.nonNull`, an opt-in probe that counts non-null assertions.** To pass a coverage gate an
  adopter's agent replaced two `?? 0` fallbacks with `!`: the uncovered branches disappeared, and
  `types.escapes`, which counts `any` and the `@ts-` comments, did not count what replaced them, so
  both numbers went green while the debt moved into the one form nothing measured. The probe
  counts a postfix `!` in TypeScript (not `!=`, not a negation, not text in a string, a comment or
  JSX), so the count can only fall. `init` enables it on every code preset; an existing repository
  enables it in `ratchet.enable`, and today's count becomes its floor.
- **The gate runs the coverage of the changed lines, so a green local gate is CI's green too.** An
  adopter's push passed the full local gate and went red in CI on two untested branches, because
  that check (TEST.4) was a separate CI step the gate never ran, and the session had already
  reported the push green. Every code preset now carries a gate step that runs a
  `coverage:changed` or `test:changed` script, told the range the gate judges in `ABATTY_RANGE`,
  and reports the step as not run when the repository has neither. `doctor --controls` proves it
  with a new source file carrying a branch no test covers.
- **Changelog fragments, so parallel branches stop colliding on the changelog.** With the entry
  written as a line under `## [Unreleased]`, every pair of parallel branches edits the same hunk:
  an adopter merging eight pull requests in a day resolved four conflicts, all in the changelog,
  none in code. Set `files.changelogFragments` to a folder and a change may instead add its own
  `<slug>.<section>.md` there; the commit hook, the gate's changelog range and the Stop hook all
  accept it as the entry. `abatty changelog --release <version>` folds `[Unreleased]` and every
  fragment into the dated section, grouped by section, and removes the fragments. Off by default:
  the line under `[Unreleased]` works as before.
- **`doctor` and `update` name a stale patch of abatty.** An adopter patched 0.4.0 in
  `node_modules` to get past a defect 0.5.0 fixed; on the upgrade such a patch fails to apply, or
  applies to code it was never written for. A patch of an abatty version other than the one
  running, declared in `patchedDependencies` (bun, npm), `pnpm.patchedDependencies` or as a file
  under `patches/`, is now named with where it is declared.

### Fixed

- **`types.nonNull` and the stale-patch notice read more of what they are for.** The probe now
  counts an assertion before a call, a cast, a closing brace and a spaced comparison, and no
  longer counts a class field's definite assignment (`name!: string`) or a `!` ending a line of
  JSX text. The stale-patch notice also names a patch declared with no version or with a range,
  which applies to every version, and patch-package's numbered file names.
- **The review's fixes to this release's new pieces.** A source folder that shares the fragments
  folder's name (`src/features/changes/`) no longer counts as a changelog entry.
  `changelog --release` refuses a version already released and a changelog without
  `[Unreleased]`, as bad input rather than a crash, and keeps a CRLF file CRLF. A range the gate
  could not trust is not handed to the changed-lines step, which was told an empty one and passed
  green over nothing. The integration-test plant reads the workspace's tsconfig as the unit plant
  does, and the changed-lines plant is typed, so a coverage command that also typechecks goes red
  on coverage.
- **An outdated controls run is not proof anywhere.** Only the reading of a finding ignored a
  controls run an older abatty had planted; the night's precondition, the attestation and
  INST-CONTROLS still accepted it, so a night could be cleared by a proof the changelog above calls
  no longer evidence. All four now read it the same way, and each says the run is outdated and to
  run `abatty doctor --controls` again.
- **Setting a hook's executable bit stages the mode alone.** `abatty hooks` and `init`/`update`
  used `git update-index --chmod=+x`, which also stages the file's working-tree content, so an
  edit in progress to a hook went into the index with the bit. The mode is now set on the entry
  git already holds, and `abatty hooks` says so, or fails, rather than reporting a change it did
  not make. Only files git runs as hooks are checked: a README or a sourced helper under
  `.githooks/` is not failed for its mode, and INST-GATE reads the mode only where git runs the
  hook itself, not a husky hook or a lefthook config, which are 100644 by design. `update` treats
  a hook whose comments are the repository's own as edited, and puts its version beside it.
- **The guard reads every destination of a push, and more of the shapes a push hides in.** A
  review of this release found the worktree fix had narrowed the night's rule: a push naming
  several refspecs was judged by the last, so `git push origin main adopt/x` passed a night that
  0.5.1 refused. Every refspec is now a destination, and `--all` or `--mirror` writes the base. Also
  closed: a push behind git's own options (`--attr-source`, `--namespace`, `--config-env`) or inside
  a wrapper (`sh -c "git -C . push ..."`); a `cd` inside a group, a condition, `env -C` or a wrapper,
  which now makes the folder unknown rather than guessed; a destination the shell computes
  (`$(...)`). Two false refusals the first cut introduced are gone: an ordinary command that only
  quotes the words "git push" after a `cd`, and a PowerShell path, whose backslashes were read as
  escapes. Where the repository takes direct pushes to its base, a push to an unknown branch is no
  longer refused by day.
- **A red cross means the run failed.** The ratchet listed every finding in a file the push
  touched with ✗, the debt the file already carried within its floor included, and an adopter's
  session read a push that had gone through as refused and had to ask the remote. A finding whose
  metric holds its floor is now listed with a neutral mark, the heading says how many of them are
  within the floor and not failing, and ✗ stays for a metric that fails.
- **Every gate step runs with the run's own database, not only the suites.** With
  `TEST_DATABASE_URL` set, only the database and browser suites were pointed at it; an adopter who
  unset their own `DATABASE_URL`, as the deferral message implied, then saw the dead-code step go
  red for nothing, because its tool loads the ORM's config and that reads `DATABASE_URL`. Every
  step now gets `TEST_DATABASE_URL` as `DATABASE_URL` when one is named, and the deferral message
  says to keep `DATABASE_URL` for the tools that read it.
- **`update` no longer reports a conflict on a file whose template did not change.** A file `init`
  kept (the repository's own `.claude/settings.json`) has no ancestor, so every upgrade asked for
  a merge base that lives under the gitignored `.abatty/` and so is on no other clone, and wrote
  an `.abatty-new` conflict beside a file whose template was byte for byte the same. The lock,
  which is committed, now records the template each kept file was offered, by hash; when the
  package offers the same one again, the file is kept without a word. A changed template is still
  put beside yours.
- **`update` refreshes the git hooks, and `doctor` reads them.** Only `init` wrote
  `.githooks/pre-push`, `pre-commit` and `commit-msg`, so an adopter who upgraded with `update`
  kept a pre-push hook from before `--refs` (the gate judging the checkout rather than the push)
  and `npm run` on a pnpm repository, while `doctor` reported no drift. `update` now rewrites a
  hook it last wrote, or one that is exactly a form an earlier `init` wrote, in the repository's
  own manager; a hook the repository edited is kept, with the new version beside it as
  `.abatty-new`. A repository without a `.githooks` folder is left alone. `doctor` lists the git
  hooks in its drift.
- **A hook committed as not executable is named.** git skips a hook recorded as 100644 on every
  machine but the one that wrote it, and an adopter's three hooks were committed that way with
  nothing saying so. `doctor` fails on one, reading the mode git records rather than the disk, and
  points to `abatty hooks` (what `hooks:install` runs), which now stages the bit for a hook git
  tracks without it; INST-GATE reads the pre-push hook the same way.
- **A monorepo's gate steps are proven where they look.** `doctor --controls` planted every
  violation in a root `src/`, which no workspace of a monorepo scans, so its lint, typecheck and
  test steps stayed green on the plant and `measure` dropped three findings to partial, on steps
  the adopter had watched fail by hand. The plants now go in `src/` where there is one, and
  otherwise in the source folder of the first workspace, in the language its own tsconfig checks.
  The controls run also records the abatty version that planted it, and `measure` no longer reads
  a run from an older minor version as proof either way: its steps read unproven until the
  controls run again. A planted file is marked as about to be committed while its step runs, so
  the ratchet, which reads the tracked tree, sees it.
- **`measure --out` writes the measurement there, and only there.** With `--json` or `--sarif`
  the output went to the screen and no file was written, and every run replaced the
  repository's latest report under `.abatty/reports/`, which the dashboard and the MCP server
  read as the truth. A run with `--out` now writes that file alone.
- **Three rules read a bun monorepo right after 0.5.1's verification on it.** A pipeline step
  that runs a file (`bun run scripts/check.ts`) is no longer reported as naming a script called
  `scripts` (INST-CI). A root `test` script that hands the run to the workspaces (`turbo run
  test`) now reads the runner from the workspaces' own test scripts before an installed package
  (TEST-UNIT). The health endpoint named is a route file before a shorter helper path, and never
  a test or a mock (OBS-HEALTH).
- **The ratchet reads what git tracks.** An adopter's docs tooling wrote a dated report under
  `docs/` on every run, never committed and never ignored, and the ratchet counted each one as a
  document without front matter: every push regressed a floor with no human change, until the
  folder was ignored. A ratchet that regresses on its own teaches people to raise floors. The
  ratchet (`abatty ratchet`, the gate's step, the baseline, the MCP server) now measures the
  tracked tree, a staged file included; the rules and `measure` still read the working tree.
- **The guard judges a push by the branch where it runs.** It asked for the current branch once,
  in the folder the hook starts in, so `cd <worktree> && git push` was judged by another
  checkout's branch. That refused a push to a feature branch while the main checkout stood on
  main, and allowed a push from a worktree on main while the checkout stood on a feature branch.
  The guard now follows `cd`, `pushd` and a subshell to the folder each git command runs in, and
  reads git's own `-C`, `--git-dir` and `--work-tree`. A bare or HEAD push from a folder it
  cannot follow (a variable, `cd -`) is refused, with the fix named: name the branch. Four
  neighbouring holes closed with it:
  - a force push spelled with `-C <dir>` was not seen as a push at all: the folder was read as
    the subcommand;
  - `-C <dir> push origin` read "origin" as the target branch;
  - a push inside a subshell read its target with the closing parenthesis attached;
  - at night, a push spelled with `-C` skipped the adoption-branch-only rule.

## [0.5.1] - 2026-09-23

### Added

- **`test.coverageExclusions`, an opt-in probe that counts what a coverage floor stopped
  watching.** Splitting a file and then excluding the untested half keeps a coverage total green
  over code no test reaches; an adopter watched it happen in a week. The probe counts the entries
  of the coverage exclude lists (vitest, jest, nyc, c8, coverage.py) and each inline ignore
  comment, so they may only shrink. `init` enables it with the other opt-in probes on every
  preset but docs.

### Fixed

- **`init --force` never writes over the repository's own context file.** On a repository
  that wrote its own CLAUDE.md, `--force` turned it into an import of an AGENTS.md that pointed
  back at it, and the context was gone. The repository's file and an AGENTS.md it already has are
  kept; the import line init writes itself is still refreshed.
- **The gate no longer builds for a comment, or over a running dev server.** A pushed file whose
  diff is only comments or blank lines selects no suite, so rewording a comment in a page no
  longer runs the build and the browser suite. While `next dev` is live on the checkout (the
  pid in `.next/dev/lock` is alive), the build suite is deferred to CI with the pid and port
  named, because a production build over a running dev server emptied an adopter's
  node_modules three times in a day. A lock left by a crash defers nothing.
- **The hooks fall back to the repository's own package manager.** When the config names no
  gate or lint command, the Stop hook, the lint-on-edit hook and the session brief used npm everywhere, so a
  bun-only repository's gate ran through a manager it did not have. They now read the lockfile
  (bun, pnpm, yarn, else npm), and a command the config names still wins. The defaults for
  `commands` also apply again: a config naming one command lost the fallback for the other.
- **A monorepo's pipeline is credited for its workspaces' scripts.** A step that runs
  `bun run typecheck` in `apps/web`, or `pnpm --filter web run lint`, was reported as naming a
  script the package does not have, because only the root's `package.json` was read and a flag
  before `run` hid the name. INST-CI and INST-CI-STEPS now read every workspace's scripts.
- **A `source_truth` entry with a star inside a file name is no longer read as dangling.**
  `src/core/secret*.mjs` was cut at the star into `src/core/secret`, a path that never exists;
  the probe now keeps the folder that holds the pattern.
- **Twelve rules stop misreading a repository that is not shaped like this one.** An adopter's
  bun monorepo reported findings that were not true. Now: bun's lockfile counts
  (SEC-LOCKFILE). A GitHub-only repository is no longer told its pipeline is a stray beside
  a Woodpecker it does not have (INST-DEAD-CI). A test named `rls`, `isolation` or `tenant`
  proves isolation wherever it sits (DATA-TENANT). The runner is read from the `test` script
  before an installed package (TEST-UNIT). A logger module is found at any depth
  (OBS-REDACTION, OBS-CONSOLE). The health endpoint named is the shortest path (OBS-HEALTH).
  Angle brackets inside code are not read as template blanks (DOC-CONTEXT). Every wired hook
  event is listed (HARNESS-HOOKS). `.abatty/` must be ignored as well as the night's folder
  (HARNESS-GITIGNORE). The git shim counts only where the night or an `.envrc` puts it on PATH
  (SEC-AGENT-SHIM). Commits that carry the authorship trailer by policy read as a practised
  policy rather than n/a (FLOW-TRAILER). The em dash rule stays a must, and a repository whose
  typography uses the dash, as French does, says `style.emDash: "allowed"` in its config
  (FLOW-EMDASH).
- **The secret scan stops reporting variable reads and fixture samples.** On an adopter's repository
  it reported twenty-six findings and none was a secret, which trains people to add allow
  comments until the real one is waved through too. In source code the unquoted shape is no
  longer read: a literal there is quoted, so `accessToken: settings.token` is a variable read,
  the correct pattern. In a fixture, a test or a fake, a match on a secret-like name counts only
  only when its value reads as generated, so a readable sample like `mp_access_xyz789` is left
  alone. Readable means a lowercase word and low entropy, both: entropy alone would have let
  every hex key through. A provider's own key format is still reported wherever it appears. The corpus
  gained four cases, a hex key in a test among them, each case can now name the file it sits in, and the scan still
  scores 100% precision and recall.

- **The pre-push gate judges the push, not whatever is checked out.** git hands a pre-push hook
  the refs being pushed; the hook `init` writes ignored them. So a push deleting three branches
  ran the whole gate, build and browser suite included, on the branch the developer happened to
  be on, and pushing another branch was judged by the checkout's tree. An adopter's sessions
  began deleting branches through the forge's API to get round it. The hook now passes the refs
  to `abatty gate --refs`, which reads each line:
  - a deletion runs no gate, and says so;
  - the commit checked out is judged over the range the push adds, and when several refs name
    it, over the range the furthest-behind of them adds;
  - a tag is judged as the commit it names, since a tag push is what starts a release;
  - a push of any other commit is refused, loudly, since the tree here is not the one being
    pushed.
  With nothing on stdin (the hook run by hand), the gate reads the push itself, as before. This
  repository's own pre-push hook passes the refs too.

- **A monorepo is read as one.** The database suite's paths matched only at the root, so a
  migration under `packages/db/migrations/` never selected it, and in the adopter that reported
  it that was the suite that mattered most. It now matches the folder at any depth, never a name
  that merely contains the word. `init` points the import graph at the folders a repository's
  sources are in (`src`, or `apps packages` and the like) rather than a `src/` it does not have.
  Where the repository already has its own `CLAUDE.md`, `init` writes `AGENTS.md` as a pointer
  to it. It used to write an unfilled template there, which read as a second context file.

- **The files abatty writes pass the repository's format check as they are.** `baseline`,
  `update`, `init` and the night runner wrote JSON with every array item on its own line, where
  the formatter puts a short array on one line, so a repository that checks formatting went red
  the next time abatty wrote the baseline. An adopter had to put it in its format-ignore file.
  JSON is now written in the formatter's shape, at the print width the repository's formatter
  config sets (80 when it sets none). A test compares the output with the formatter's own, on
  sample values and on this repository's baseline, config and lock.

- **The harness self-test passes on a repository that allows direct pushes to its base.** Ten
  guard cases assumed a PR-only base and read the repository's own config, so a repository with
  `directPushToBase: true` failed its self-test on its own, legitimate policy. The cases now run
  against the repository's config with that one key set as they assume, and two new cases prove
  the other setting: allowed by day, still refused at night. The Stop hook's timeout check also
  reads a hook written as one `command` line (`cd` into the project folder `&& node ...`), which
  it failed before, and not only the `command` plus `args` form.

- **A night session is judged on the files it changed, not on its neighbours'.** The Stop hook
  refused to end a session while anything in the worktree was uncommitted, and told the agent to
  commit it or restore it. In a worktree several sessions share, that was an instruction to take
  or delete another session's work. The SessionStart hook now records what was already
  uncommitted (each file with a hash of its content). The Stop hook judges only what is new or
  changed since, and names the others as left alone.

- **`init` speaks the repository's package manager.** The three git hooks, the commands it writes
  into the config and its "by hand" steps said `npx` and `npm run` whatever the repository
  used; a bun-only repository that forbids npm had to rewrite all of them before it could trust
  them. They now use the manager the repository committed (bun's `bunx`/`bun run`, pnpm's,
  yarn's), and npm where nothing names one.
- **`init` stages nothing.** It staged the hooks it wrote, to carry their executable bit into
  the first commit from a filesystem without modes, and in a repository several sessions share,
  the next commit of any of them swept those files in. The new `abatty hooks`, which the
  presets' `hooks:install` now runs, sets `core.hooksPath` and the executable bit on every
  machine that installs the hooks, so a hook committed without the bit still runs. Where the bit
  cannot be read from disk, `init` says how to commit the file with it.

## [0.5.0] - 2026-09-23

### Added

- **Duplication is measured without a dependency.** The new opt-in probe `code.clones` reduces
  each source to its meaningful lines (comments removed, whitespace collapsed, brackets,
  imports and lone keywords dropped), hashes every run of six, and counts a run that appears in
  two places as one clone, charged once, to the smaller of the two paths. It reads this
  repository's 134 files in under a tenth of a second. CODE-DUP now reads the practice rather
  than one tool: any clone count with a floor holds it, the package's or a repository's own
  detector. Every code preset enables the probe.
- **A refactor may not rewrite the tests it is judged by.** A refactor claims the behaviour did
  not change, and the tests are the only statement of the behaviour a machine can check. The
  new opt-in probe `change.refactorTests` reads the pushed range. A `refactor:` commit that
  removes a test case is counted, always. One that edits a test is counted unless its message
  says why on a `tests-changed: <reason>` line: a renamed function is a reason, since the tests
  that call it move with it. A test added, or moved with its cases intact, is not counted. It
  reads JS, Python and Go test layouts. Every code preset enables it, and so does this
  repository.
- **`abatty report` prints the day's table.** Today's reading sits beside the newest one before
  it, with the score, the phase, the counts by status, the share held by a machine, proven and
  contradicted checks, harness drift, bypassed commits and raised floors. Each row says whether
  it got better, worse or stayed the same. Below the table it names every check whose status
  moved, the ones that got worse first, since a flat score can hide one check fixed and another
  broken. The outside trial's reviewer assembled this table by hand from two reports and the
  commit log for two days.
- **Eight opt-in probes, and `ratchet.enable` to switch them on.** They grew out of one
  outside repository's own probes, written during its trial, and are generalised here: what
  was particular to that product is now configuration. `valid.unparsedBoundary` counts route
  handlers, server actions and credentials callbacks that read input no schema parses.
  `valid.wholeEnv` counts the environment object taken whole outside the env module.
  `auth.unguardedPage` counts protected pages that do not await their guard first
  (`pageGuards`). `api.unboundedList` counts list reads in a route handler without a bound
  (`boundedBy`). `api.rowReturn` counts server actions that return the ORM's row, or a select
  with a secret column (`secretFields`). `api.floatMoney` counts money made a number on the wire
  or stored in a Float column (`moneyFields`). `cache.serverCacheUse` counts server-side caches,
  for a repository that decided to have none. `fn.shapeExemptions` counts shape rules switched
  off inline, in the eslint, oxlint, biome, ruff and pylint spellings, or by a list
  (`shapeList`). They are opt-in because each reads one stack's conventions: on by default,
  every adopter would have gone red after an update on a metric it never asked for. `init`
  enables the ones that suit the preset, so a new Next.js repository starts with the boundary
  and API probes. An opt-in probe that is not enabled does not reserve its name, so a repository
  that wrote its own version keeps it until it switches to the package's. `abatty ratchet
  --controls` proves every shipped probe, enabled or not.
- **`valid.wholeEnv` here falls from 8 to 6.** Two of the eight were this change's own default
  parameters; they read the search path through the env module now, and the floor is locked.
- **This repository measures its duplication: `code.clones` reads 27 and is a new floor.** The
  preset tables repeat each other's blocks, the installed graph config repeats its template, and
  the probes repeat their own scaffolding. CODE-DUP leaves the list of open gaps in the context
  file. No existing floor moved; the baseline's readability score falls from 92 to 91.
- **This repository enables `change.refactorTests` too, and its catalog pair is anchored to the
  root.** The coupled pair `src/rules/families/` also matched the generated
  `types/src/rules/families/`, because a prefix matches under any folder (on purpose, for
  workspaces), so a regenerated declaration asked for a catalog change nothing had caused. The
  pair is now the glob `src/rules/families/**`, which matches from the root.
- **This repository runs the two opt-in probes that apply to it.** `fn.shapeExemptions` reads
  0 and is now hard. `valid.wholeEnv` reads 8, each one the environment handed whole to a child
  process or a default parameter, and is a new ratchet floor. No existing floor moved. The
  readability score in the baseline falls from 98 to 92, because the new metric counts against
  boundary clarity. The decision is logged in `docs/STANDARDS_PROGRESS.md`.
- **The gate audits yarn repositories, yarn 1 and yarn berry both.** Each was run against a
  package with a known advisory before it was wired, as npm, pnpm and bun were. yarn 1's exit
  code turned out to be a bitmask of every severity found, and it ignores `--level`: it reads 12
  (moderate and high) even at `--level critical`. So yarn 1 is judged from its JSON report alone,
  and the pipeline `abatty ci` writes fails only on a code of 8 or more (high or critical). yarn
  berry's code honours `--severity`, and its line-per-advisory report is read for the
  allowances. Until now a yarn repository's audit was deferred to CI, where yarn 1's raw
  command would have failed on moderate advisories below the floor.
- **CI watches the audit of npm, pnpm and yarn on a real install, on Linux and on Windows.** A
  new `managers` job runs `scripts/ci/manager-smoke.mjs` once per manager and operating system.
  Each run installs a repository with that manager, checks that it is detected, audits a clean
  install (it must pass) and then an install with a known high advisory (it must fail). The
  suite reads each manager's report from a recording; this job checks the recording against the
  tool as it ships today. npm and pnpm were run both ways on Windows before the job was
  committed.
- **DATA-TENANT reads the tenant column a repository names.** `tenantKeys` in the config adds
  to `tenant_id`, `store_id`, `company_id` and `organisation_id`, so a product whose tenant is
  a restaurant or a workspace is no longer read as single-tenant.
- **The score reads presence against truth.** A rule that finds a lint script counted as
  present whether or not the linter was installed, or whether the step had ever gone red. The
  gap analysis now checks each present check that a gate step backs (format, lint, typecheck,
  import graph, dead code, unit tests, audit, secret scan) against two facts already on disk.
  If the step cannot run here (the new prerequisites), or stayed green on a planted violation
  (the last `doctor --controls`), the check drops to partial and its evidence says why. If the
  step went red on its plant, it is marked proven. `measure` and the report carry one line,
  "presence and truth", with the three counts, and the JSON report carries them as `truth`.
  The measurement cache now keys on `.abatty/controls.json` and the installed tools, which git
  ignores, so a cached reading can no longer outlive either.
- **`abatty gate --preflight` says what each step needs and whether it is here, running
  nothing.** For each step it checks the script, the program the script starts (in
  `node_modules/.bin` up the tree, then on PATH), the config file the step wants, the lockfile
  the audit reads, and a container runtime for a suite that starts a database. It exits 4 when a
  configured or required step cannot run. The gate itself now prints the same finding as its
  first line, before the slowest step rather than after it, but it does not refuse: a lookup that
  cannot see a layout must never stop a gate that would have run. Plug'n'Play trees are not
  judged. This is the second half of the prerequisite preflight; the confirm-clean run of
  `doctor --controls` was the first.

- **A floor raised lands only with an approval its raiser cannot give itself.** `abatty
  baseline` asks for a reason and an owner, but the owner is a name the raiser typed, and an
  agent types one as easily as a person does (it can also edit the baseline by hand). The new
  `abatty raises` compares the baseline with the one on the base branch and names every floor
  that rose, vanished or stopped being hard, every file whose debt grew while the total held,
  and the same done through the config: a metric excluded, a path exempted, a metric taken off
  the hard list, an opt-in probe switched off, a cap or a budget raised. With `--require-review <number>` it passes only
  when somebody other than the pull request's author approved its head commit, a review the
  forge does not let an author give. The GitHub pipeline `abatty ci` generates runs it as a
  `floors` job on pull requests and again when a review is submitted or dismissed. That
  event runs the `floors` job only.

- **`abatty doctor` says what each hook actually does here, by day and at night.** It reads
  the settings that wire each hook, the config keys it reads and the tool it calls. It names a
  hook that no settings file wires, every hook switched off by `disableAllHooks` (in the
  project's settings, the local ones or the user's own), and a lint-on-edit whose linter this
  machine cannot find. `--strict` fails on any of them. The first run found one here: at night
  lint-on-edit ran `npx eslint` in a repository that declined eslint, so every edit read as a
  red lint. `lintOnEdit` is now `false` in this repository's config.

### Fixed

- **A bun repository's audit allowances apply.** bun prints its report on stdout and a banner on
  stderr after it, and the audit read from the first brace to the end of both, so every bun
  report was unreadable and the step failed even when every advisory left was allowed. An
  adopter with nineteen dated allowances had a red pre-push it could not get past, with a
  critical fix waiting behind it. The report is now read up to the brace that closes it.
- **The package's entry point is executable in git.** `bin/abatty.mjs` was committed 644; the
  published tarball never showed it, because the registry sets the bit, but this repository's
  own pipeline ran `npx abatty` against the checkout and got "permission denied", which left its
  findings upload empty. The file carries the bit now, and the pipeline calls it through node.
- **`docs.behindCode` judges a change on the day it lands, not the day after.** It exempted a
  cited file moved today, so a change merged green and the base branch went red at midnight
  with nothing committed, charged to whoever pushed next on work that did not cause it. An
  outside repository lost a push to it, and so would this one have: the 0.5.0 branch changed
  sources that five documents cite, and none had been re-read. A doc verified the same day still
  holds. The five documents here were re-read and corrected where they were behind: duplication
  is measured by `code.clones` without a dependency, the same-day rule is gone from DOC.5, and
  the standard says a suite never runs against the developer's database.

- **The gate no longer runs a database or browser suite against the developer's own database.**
  On a laptop, a suite inherited `DATABASE_URL` from the shell or from `.env`, which is the
  database the developer works against, sometimes production's. An outside trial's pre-push gate
  ran its browser suite there: it went red on data that had drifted, wrote real orders, and
  created administrator accounts with a known password that a killed run would have left behind.
  Now a suite that needs a database runs with `DATABASE_URL` pointed at `TEST_DATABASE_URL` when
  one is set, trusts the pipeline's own service in CI, and otherwise, when it can see an ambient
  database, is deferred to CI with how to give it one of its own. The trial's session showed the
  fix by hand: a database in the container the integration suite already starts took the same
  suite from red to 50 of 50. `.env` files are read for the name only, never a value.
- **Re-running `init` on an adopted repository no longer switches probes on.** A config that
  already exists and never listed `ratchet.enable` keeps an empty list. A preset's opt-in
  probes are for a new repository; switching four to eight of them on at once would turn an
  adopted one red on metrics it never asked for.
- **Five smaller corrections from the review.**
  - `update`, reading a lock from before the list of offered scripts, now says that it infers
    a script was removed, rather than asserting it.
  - A tool in a Python virtualenv at the root (`.venv`, `venv`) is found whether or not the
    shell activated it, so the preflight and the truth reading no longer depend on the shell.
  - `doctor` counts the paths the hooks protect by default when the config names none.
  - The day's table prints a move between statuses of equal worth (present to waived) as
    neutral, not as worse.
  - The probes' text reader has one definition of where a string ends, where it had two.
- **Three probes stop counting correct code.** All were found by review before release.
  - `api.floatMoney` no longer counts integer minor units (`parseInt(`, `z.number().int()`),
    which is the exact form its own reason recommends.
  - `api.rowReturn` reads a row kept in a local as returned only when the same function returns
    it, not when another action happens to return a local of the same name.
  - `change.refactorTests` no longer counts a regex's `.test(` call as a test case, and it counts
    a case turned into `test.skip(` as removed, since a skipped test lowers the bar as a deleted
    one does.
- **The boundary probes read JSX text and guard calls correctly.** Both were caught by review
  before release. An apostrophe in JSX text (`Don't`) was read as the start of a string that
  never ended, which unbalanced every function body after it: a page that guarded first read as
  "no default export function found". A quoted string now ends on its line. And every call of
  `authorize(` was read as a credentials callback, so a guard helper of that name counted as
  an unparsed boundary. Only a definition counts now: a method, or an `authorize:` property
  holding a function.
- **An advisory about a network no longer reads as an unreachable registry.** The audit's offline
  check matched the bare word "network", so a high advisory whose text mentioned one (a request
  forgery, say) was deferred to CI, and the gate counts a deferral as a pass. The check now reads
  the error codes a failed connection prints, and a yarn report that parsed is never treated as
  an outage.
- **INST-CI no longer reads a comment in a pipeline as a script it runs.** A comment saying
  "yarn 1 comes with the runner images" was charged as a script named `1` that the package
  lacks, and the check dropped to partial. Comment lines are skipped now; a comment runs
  nothing. The day's table caught it on its first run.
- **`abatty update` no longer writes back a script you removed.** The harness lock now lists
  the package scripts offered to the repository, and a script offered before and absent now is
  read as declined and left out, which the update says. A script the gate cannot run without
  (the tests, the ratchet, the typecheck on a TypeScript preset) still comes back. A lock
  written before this lists nothing, and reads as though every preset script had been offered,
  since `init` wrote them all. This repository declined `lint`, and every update added it back.
- **On Windows, a gate step whose tool is not installed now reads "could not run" instead of
  failed.** cmd.exe exits 1 both for a tool it cannot find and for a tool that ran and judged
  the work. After a script exits 1 on Windows, the gate now looks up the script's program
  (`node_modules/.bin` up the tree, then PATH with PATHEXT, and cmd.exe's builtins), and a
  program found nowhere makes the step errored (exit 4, the instrument) rather than failed
  (exit 3, the work). A path, a quoted program or a builtin keeps the tool's own verdict.
- **The best-practices digest was re-read** against the standard's guard paragraph that changed
  on 2026-09-22. The digest only says that enforcement is a hook, which is still true, so it
  is dated today. It had turned `docs.behindCode` red on main overnight with nothing pushed.

## [0.4.0] - 2026-09-22

### Changed

- **The guard reads a command as a command.** Six families of hole came out of one component in
  a single day, and every one of them was the same mistake: asking a regular expression what a
  command does. A bundled flag (`-nm`, `-fu`), `HEAD` read as though it were a branch name, a
  redirection token read as a refspec, a quoted branch, a quoted flag, and a substitution in
  command position that split `git push` into two words nothing could match. Each fix closed one
  spelling and changed nothing about the odds on the next, because the pattern was never what
  was wrong.

  `shellSegments` splits a command on the separators a shell would honour, tokenizes each
  segment the way a shell consumes quotes, drops redirections, steps past leading `VAR=value`
  assignments, and reports the program by its bare name, so `/usr/bin/git`, `git.exe` and
  `\git` are all git. A rule can then ask what git was actually asked to do.

  **The inversion is what makes it safe to ship.** A segment is read precisely only when its
  program is recognised. `git` and `gh` are. So is a short list of readers that cannot reach a
  program of their own, which is what lets an honest `rg "git push --force" docs/` through.
  Everything else is opaque and keeps the old whole-line treatment. A list of WRAPPERS could
  never be complete: `sh`, `bash`, `eval` and `xargs` are the ones anybody thinks of, and
  `timeout`, `nice`, `stdbuf`, `sudo`, `doas`, `setsid`, `script -c` and `find -exec` are the
  ones a list forgets. An opaque segment is also read token by token rather than as text, since
  `$(echo git) push --force` carries no contiguous `git push` for any pattern to find. Precision
  where the command parses, the blunt instrument where it does not, and never the other way
  round.

  **What this allows that 0.3.3 refused**, which is the point and not a side effect: a search
  whose pattern names a command, a `grep` over the guard's own source, an `echo` that says the
  name of a flag. A guard that refuses honest read-only work teaches its user to route around
  it, and that is precisely the habit refusing the bypass exists to prevent. The argument came
  from the reviewing session; it is right, and it is why this is worth a behaviour change rather
  than a seventh patch.

  **What it refuses that 0.3.3 allowed:** every substitution and variable spelling above, which
  no published version has ever caught.

  Proven three ways. Eleven unit tests over the tokenizer itself, covering the attack shapes the
  reviewing session supplied: a program reached by path or extension, a separator inside single,
  double and escaped quotes, an unterminated quote, a backslash continuation, an environment
  prefix, eleven wrappers, and four substitution forms. A corpus of fifty spellings, contributed
  by that session and by the six fixes, replayed from the base branch and again from a feature
  branch where the branch-relative rows must flip to allowed. And 96 harness decisions to 102.
  Mutation-tested in both directions: trust every segment as precise and three cases go red;
  treat the readers as unknown and the three false positives come back.

  Still open, and stated rather than hidden: the fallback has no counter on it. A fallback that
  fires constantly would be the false-positive problem wearing a new hat, and there is no
  measurement here that would say so.

## [0.3.3] - 2026-09-22

### Fixed

- **`git push "--force" origin dev` was not a force push, and `git commit "-nm" x` was not a
  bypass.** The quote sits exactly where every matcher anchors a short flag. `\s-[a-zA-Z]*f`
  needs whitespace immediately before the dash, and ` "-f"` does not have it, so quoting the
  flag walked past the two refusals that hold day and night. Five spellings, allowed by every
  version through 0.3.2: `"--force"`, `'-f'`, `"-fu"`, `"-nm"`, and a quoted forced refspec
  (`git push origin "+main"`), which nobody had thought to try until quoting became the thing
  under test.

  The comment above those matchers has always said that a quoted argument is a real bypass and
  must not be stripped. It was right about the intent and wrong about the reach: `"--no-verify"`
  was caught, but only because that one alternative carries no leading whitespace, which is luck
  rather than design and would not survive somebody splitting the alternation. It is pinned by a
  case of its own now, along with the five that were not.

  0.3.2 gave the push target a shell's treatment and left the flags with a regex's; this is the
  other half of the same word. Both the raw and the unquoted forms are tested rather than the
  stripped one alone, so the change is provably additive: no command any earlier version refused
  can become allowed by this one, which the earlier probe suites confirm. Six decisions added,
  90 to 96, and the mutant that reads only the raw form turns five of them red.

  Fifth family of this shape in a day, all of them the guard reading a shell command without
  being a shell, and the fourth of the five surfaced by fixing the third. The tokenizer that
  ends the series is still queued.

## [0.3.2] - 2026-09-22

### Fixed

- **`git push origin "main"` was not a push to the base branch.** Quotes belong to the shell:
  git is handed `main`, never `"main"`, so a target compared with them still attached matched
  no branch name and the push went through. Every version up to and including 0.3.1 allowed it,
  in single quotes and double, for the plain target and for a refspec (`"HEAD:main"`), and
  through any wrapper that leaves a quote on the last token (`sh -c "git push origin main"`).
  It also defeated the `HEAD` resolution added in 0.3.1, since `"HEAD"` with the quotes attached
  is neither `HEAD` nor `@`: one character undid that fix, and the reviewing session found that
  fifth spelling after the first four were reported. Unquoting runs before both comparisons, so
  the one line covers both, and both spellings are pinned by cases of their own rather than
  left to hold incidentally.

  This is the fourth of the family and the one that needs no knowledge at all. The other three
  asked somebody to bundle a flag or to know that `HEAD` is not a branch name; this one is
  ordinary typing. It was found while testing whether a proposed narrowing of the flag matchers
  would open holes, which is the second time today that probing one question answered a
  different and worse one. Six decisions added, both directions, mutation-tested: leave the
  quotes on and five cases go red while the branch-elsewhere ones stay green.

### Changed

- **`doctor` says the PR-only policy is not the hook's to hold, and says it as a warning.** The
  line was already honest and was printed with the glyph of a passing note, which is the wrong
  weight for the thing it reports. A regex over one shell is defence in depth; branch protection
  on the forge is the control, and no local command can see whether it is on. Four ways past
  that regex were found and closed in a single day, and this repository's own base branch was
  unprotected while it happened, which is how one of the four came to light: an agent pushed
  `main` with a spelling the guard did not read and nothing else existed to stop it. A
  repository trusting the hook alone has a weaker guarantee than its config implies, and now
  hears so on every run.

- **The README is rewritten for somebody deciding whether to install this, and three claims in
  it were false.** It said the registry package was not published and told the reader to install
  from a git ref, which stopped being true the day 0.3.0 shipped; it listed `update`,
  `night-report` and the dashboard under "what is not here yet" while documenting all three as
  working further up the same page; and its preset table said the `node` preset was proven by
  nobody, where `abatty presets` has named this repository and 2026-09-18 since the day it was.
  A page that contradicts the tool it describes costs more than a page that says less.

  615 lines to 272, and the cut is structural rather than cosmetic: what a reader needs to
  decide, install and run is on the page, and the depth it used to restate now links to the
  documents that own it. Every number in it was read from the tool rather than copied forward:
  79 rules across 15 families, 47 of them held by a machine and 12 by nothing but prose, the
  secret scan at 100 per cent both ways, eighty-four guard decisions, the preset table as
  `abatty presets` prints it. The support line claims Linux and Windows and no longer macOS,
  which nothing in CI covers. The honesty sections stay, because they are the argument.

## [0.3.1] - 2026-09-22

### Fixed

- **`git push origin HEAD` from the base branch was not a push to the base.** `HEAD`, and its
  alias `@`, are not the name of a branch: git resolves them to the branch you are standing on,
  so on `main` they are exactly the push the guard exists to refuse. `pushTarget()` compared
  the literal token against the base name, matched nothing, and let it through. The refspec
  form was never affected, because `HEAD:main` is read on its destination side and says `main`.

  Found the way the others were not: by doing it. The agent closing the two flag holes above
  pushed this repository's own `main` with `git push -u origin HEAD`, against `CLAUDE.md` §7,
  and the guard said nothing though `abatty.config.json` sets `directPushToBase: false`. Three
  spellings were open (`HEAD`, `-u HEAD`, `@`) and all three are refused now. A fixture on the
  base branch and one off it decide the two answers, because where the guard runs is what
  decides them; the fixtures carry a commit, since `rev-parse --abbrev-ref HEAD` cannot name a
  branch no commit has reached and an empty branch would have passed every case for the wrong
  reason. Mutation-tested: read `HEAD` as a literal again and both base-branch cases go red.

- **`git push -fu origin dev` was not a force push to the guard.** The same cluster defect as
  the entry below, in the other flag that is refused everywhere: `\s-f\b` cannot match `-fu`,
  because the boundary after `f` does not hold inside a cluster, so the short spelling of a
  force push passed the guard in silence. `git clean` and `rm -r` in the same file have always
  read clusters (`-[a-zA-Z]*f`), so the two flags denied unconditionally, day and night, were
  the two that could not read one. The span is scoped to the command as well, so an `-f` of a
  later command (`git push origin dev && grep -f patterns src`) is no longer this push's.

  Found by another session replaying the spellings against a repository running 0.2.0 rather
  than by reading the regex, which is the only way this class shows itself: every one of these
  holes reads as a passing guard, and the self-test agreed with the code because both had been
  written from the same wrong idea of what the flag looked like. Five decisions added, both
  directions, mutation-tested: restore the old matcher and the two cluster cases go red while
  the later-command case goes red the other way. **Both cluster holes are open in the published
  0.3.0**, which carries the bypass one too; a 0.3.1 is what closes them for an installed
  repository.

- **The guard read a `-n` of a later command as this commit's, and could not read the one
  spelling a bypass would actually be typed in.** `\bgit commit\b.*\s-n\b` had a span and a
  flag, and both were wrong. The span ran to the end of the line, so `git commit -m x && sed -n
  1p f` was refused, and so was every sentence naming `git commit` with an unrelated `-n`
  behind it: the changelog entry above this one was written by a command the guard denied for
  exactly that, which is how this was found. It now stops at a command separator, as the push
  target's span beside it already did. The flag is the more serious half: `\s-n\b` never
  matched `-nm`, because the boundary after `n` cannot hold inside a cluster, so `git commit
  -nm "x"` bypassed the hook and the guard said nothing. The shim on `PATH` has always read
  clusters (`/^-[a-zA-Z]*n/`), so the two layers disagreed about the same flag, and the one
  inside the agent's shell was the weaker. Five decisions added to the self-test, both
  directions, and each half mutation-tested: restore the old span and the two "another command"
  cases go red; restore the old flag and the cluster case goes red.

- **A control fixture that would not go away failed a suite that had already passed.** The
  release of 0.3.0 went red on `not ok 173`, with fifteen controls printed green above it and
  `ENOTEMPTY: rmdir .git/info` below: a commit forks `gc --auto`, which outlives the command
  that forked it and runs `update-server-info` into `.git/info/refs` while the teardown is
  walking that very directory. The same tree had gone green five ways an hour earlier, which is
  what a one-in-six race looks like. Two changes, because the cause and the consequence are
  different bugs: the fixture sets `gc.auto 0`, so nothing is forked to race with, and the
  teardown is `removeFixture`, which retries and then gives up quietly, because the probe has
  already answered and a directory is not a verdict. Throwing from the `finally` also masked
  whatever the block above was reporting. Control cases both ways, both mutation-tested: a
  fixture that can go, goes; a removal that throws returns the answer anyway.

## [0.3.0] - 2026-09-22

### Added

- **`abatty report` says which floors were raised, by whom, and that nobody has verified it.**
  The baseline already recorded a raise's date, reason and owner; the report never showed them,
  and a reviewer who wanted the row assembled it by hand from commit messages for two days. The
  JSON carries `floors.raised`, one row per raised metric with `verified: false` on every row,
  and the terminal prints each as "floor raised (unverified)". Unverified is the honest word:
  the owner is a string the command was given, and an agent session can type a person's name
  as easily as a person can. A raise that needs an approval the raiser cannot give itself is
  the next step; withholding the row until then would keep the whole picture dark. Control
  cases: a raise appears, the debt paid removes it.

- **The changelog rule at commit time, and the package's gate on Windows in its own CI** (two
  of the reviewer's asks, one file each). `abatty changelog --message <file>` is the commit-msg
  hook's second command: the staged files are judged against the same pair the push is judged
  by, so a source commit without its changelog line is refused before it exists rather than a
  push later, which is the difference between a rule that shapes commits and one that punishes
  pushes (the trial hit the push-time refusal four times in two days). A `no-changelog:
  <reason>` line in the message is the escape a decision needs, and the bypass reading counts
  it as reasoned. The hook `init` writes carries both commands; a repository that already has
  the hook keeps it and adds the line by hand or with `init --force`. The first commit refused
  was this one, on this repository, until the entry you are reading was staged with it. And a
  `windows-latest` job now runs the whole gate in this package's pipeline, because for two days
  the gate could not start on Windows and `main` went red three ways that no Linux run could
  see: the false green one level up from the ones the gate refuses.

- **A date derived from UTC is now refused by a machine, not by memory** (from the same review).
  The fix for the timezone bug left the rule held by whoever remembered `localToday()`, and this
  package's own argument is that a rule held by memory is a rule held by nobody. The standard
  gains **VALID.5**: a calendar day is derived from the clock it will be compared to. It is
  enforced by `valid.utcDay`, a HARD metric at zero, which finds a day sliced or split off a UTC
  instant and reports it on its line; by `VALID-LOCAL-DAY` in the catalog, which states the
  practice and reads the Python form of it as well as the JavaScript one; and by a second CI job
  that runs the whole suite on a clock whose calendar day is never the UTC one. The pipeline ran
  at UTC, which is the single clock on which this class of defect is invisible; a named city
  would not have fixed that, because it agrees with UTC for most of the day. Five control cases
  in both directions, and the probe is spliced at the seam it forbids so that it passes the scan
  it defines.

- **`--plain` on every command** (C30, the second half of it). No colour, and ASCII markers a
  byte-oriented reader can match on: `[ok]`, `[FAIL]`, `[skip]`. It is handled once at the entry
  point rather than threaded through every screen, because the screen that forgot to thread it
  would be the one a script was parsing. The glyphs are getters so the flag reaches them after
  the module was loaded. What is still open in C30 is `--json` on every command a script may
  consume; the exit codes and `--plain` are done, and `docs/PLAN.md` §1 says which is which.

- **`abatty portal`: the conformance in the catalogue's own entity descriptor** (C37, reshaped).
  The item asked for a portal plugin. A plugin is a separate package carrying that portal's
  framework as a dependency, it puts the work behind an install a whole organisation has to agree
  to, and it puts the conformance where only that portal can read it. The catalogue already has a
  format it ingests on its own, so this writes that instead: the score, the phase, the check count
  and, where a hosted service exists, the report, events and badge endpoints, as annotations.
  Nothing is installed and a team with no portal has a file that does no harm. It merges rather
  than overwrites, which is most of the work: a `catalog-info.yaml` is somebody's file, so it
  rewrites only the annotations under its own prefix, leaves the comments and everything else byte
  for byte, leaves a shape it does not understand alone rather than guessing, and refuses to
  invent an owner. `docs/PLAN.md` §10 records what is genuinely left of the original item.

- **The hosted service records adoption events** (C20). `GET /api/events` and
  `/api/events/<name>`: what changed between readings, rather than what the number is. A wall of
  scores tells an adopter nothing they can act on; "on the 14th CODE-SIZE-300 went from missing to
  present, on the 15th FLOW-COMMITS was promoted from a checklist item to something a machine
  refuses" is the adoption story, and it is what a team reads once a month rather than a number
  they stop looking at. Rules held and lost, promoted and demoted up the enforcement ladder,
  entering and leaving the catalog, waivers starting and ending, the phase moving. Everything is
  derived from the readings the service already holds, so nothing new is collected and a
  repository cannot tell the service it adopted something. Losses are events too and are not
  softened: `regressions` is counted on its own line so a dashboard cannot bury it.

- **`abatty validate`: which rules precede the commits that fix things, here** (C4). Every rule
  carries a `why`, and a `why` is an argument rather than evidence. This asks the only question a
  repository can answer on its own: do the files that break a rule turn out to be the files
  somebody later had to fix? It reads the history for fixing commits and compares the fix rate
  among the files each probe reports against the files it does not. On this repository the honest
  answer today is **too few files to say**, for every probe, and that is what it prints: below a
  sample floor the lift is `null` rather than `0`, because zero reads as "no effect" and the truth
  is "no idea". Every number carries what it is not, on the same screen: a correlation and not a
  cause; churn printed beside every rate rather than removed, since a rule that merely tracks how
  often a file changes would look excellent; a tree read as it is today against fixes from the
  whole range, an error that runs one way and flatters nothing; and one repository, named.

- **The context file grows only from a lesson** (C10). A context file grows one reasonable line at
  a time until it hits the cap and stops being read whole, and every one of those lines was
  reasonable to whoever added it. The discipline that keeps it short is not a budget, it is a
  source: a line goes in because something went wrong and was written down. A new hard probe,
  `context.unsourcedGrowth`, refuses a push that grew the context file without also touching the
  lessons catalogue or naming the lesson in a commit message. It declares what it approximates:
  it cannot see whether each added line traces to a lesson, only that the push which grew the file
  said where the growth came from. That is a far smaller conversation than the one about a file
  which has quietly doubled. Three control cases, including the one that matters - a push which
  SHORTENS the file is never a finding.

- **The harness reports what it costs to carry** (C19). Every unattended session reads the
  harness before it reads any code: the context file, the path-scoped rules, the skill, the agent
  personas. That is a bill the adopter pays on every session of every night, and nothing was
  telling them what it is; a standard that quietly eats a third of every context window is a
  standard people quietly stop installing. The night report now opens its sessions section with
  the footprint, broken down by part, and with what the night carried across all its sessions as
  a share of what it spent. On this repository the harness is 44 kB, about 11,000 tokens per
  session. The token figure is an estimate and says so in the object rather than in a comment, so
  no caller can print it as a measurement: the bytes are exact, the divisor is one round number
  for every model, and a night that reported no tokens gets `null` rather than a zero that would
  read as "the harness cost nothing".

- **The conformance statement is signed by the run, not by a key anybody holds** (C39). A
  signature is worth exactly the identity behind it, and the only identity a measurement tool
  could offer is a key on somebody's laptop or a secret in a repository: the weakest of the
  options and the likeliest to leak. So the package prints the statement and never signs it. The
  generated pipeline writes it out and signs it with the run's own short-lived workload identity,
  through the platform's attestation action, into the transparency log every verifier already
  reads; this repository's release workflow does the same for each published version, beside the
  registry's own provenance. A test checks the negative too: no key, no secret, nothing to leak.

- **The README opens with the reader's problem, and `docs/DOGFOOD.md` publishes the negative
  results** (C34, C35, C40). The README used to open with what the package is; it now opens with
  why anybody would want one, and with the finding that motivates the whole design - the same
  analysis reached a near-zero fix rate as a report and passed seventy per cent on the change
  under review. It also says what the package is honest about: it does not make anybody faster
  and is not sold as if it did. What a written, enforced standard does is amplify whatever
  discipline is already there, and a team that has not agreed on how it builds gets the same
  disagreements produced faster. `docs/DOGFOOD.md` is the evidence for and against: the score and
  what is behind it, eight bugs the instrument found in its own code, the five rules it cannot
  hold because each wants a dependency, the four places it is wrong or incomplete, and the two
  performance targets that were restated rather than met. Writing it found three em-dashes in
  output strings, which `CLAUDE.md` forbids anywhere and which are now gone.

- **The regulation's requirements as a lens, and the evidence export that reads it** (C26, C27).
  A new `cra` profile carries a mapping of the Cyber Resilience Act's twenty-one essential
  requirements onto rules that already exist, and carries **no rules of its own**: a profile that
  invented "CRA rules" would be selling the idea that holding them makes a product conform, which
  is not true and is not something a source-code tool can make true. `abatty evidence` renders it
  as a document, arranged to be read by a sceptic: the seven requirements no rule in the catalog
  bears on at all come FIRST, before the fourteen with rules behind them, because the other
  arrangement is how a reader ends up believing something nobody claimed. Every row says what the
  named rules evidence, in words, and what they do not. A rule that does not apply to the
  repository is neither held nor broken and says so rather than reading as a failure, and a rule
  the catalog does not carry is reported absent rather than skipped into a better figure. None of
  the words the mapping can print is "met". Writing it exposed one real gap, now a rule:
  `SEC-DISCLOSURE`, a coordinated vulnerability disclosure policy with a contact and a response
  time a reporter can hold you to. This repository now has one, in `SECURITY.md`.

- **`abatty attest`: the conformance statement, ready to sign** (C38, C36). What held, at which
  commit, under which version of which standard, the waivers with their owners and their expiry
  dates, the floors with who raised each one and why, and the proof from the last
  `abatty doctor --controls` run that each gate step has been watched going red. It is an in-toto
  Statement carrying a custom predicate rather than a document of this package's invention, so
  every attestation store, policy engine and verifier that already exists can hold it and gate on
  it on day one; the subject is the git commit, because a conformance statement is about a state
  of a source tree. The predicate states inside itself what it does NOT answer - the bill of
  materials, the vulnerability report, the licence inventory, the build provenance - so a reader
  who finds it in a store knows what not to ask of it, and so the record never becomes a worse
  copy of four solved problems. A statement whose controls never ran says so and the command exits
  3, because a gate of steps that cannot fail passes everything. Signing stays the pipeline's: the
  package does not hold a key.

- **Every preset has a fixture repository, and the next steps say what `init` actually wrote**
  (C49, partial). Three of the six presets had a fixture repository the suite runs `init`,
  `measure`, `doctor` and the gate against; `next`, `python` and `docs` had none, which meant the
  three nobody has run were also the three nothing would catch a break in. All six have one now.
  Running them found a real one: the by-hand steps `init` prints told every repository to fill a
  `.dependency-cruiser.cjs` and run `depcruise --baseline`, including the Python and documents
  repositories that are never written one. The steps are now derived from the files that init
  wrote. A fixture is not a proof and is not counted as one: `astro`, `python` and `docs` are
  still proven by nobody, and `abatty presets` still says so.

- **The secret scan is measured, and the measurement changed it** (C15). `abatty secrets
  --benchmark` scores the scan against a corpus published in the package: 18 documented credential
  shapes on one side, 23 look-alikes on the other, every case carrying in words the reason it is
  the verdict it is, so anybody who disagrees with a case can read it and argue with it. The
  corpus was written before the scan was touched and the first run scored 100 per cent precision
  and **67 per cent recall**. It missed six shapes, including the unquoted `API_KEY=...` that a
  `.env` file is made of and the password inside a connection string, which is the most-committed
  credential there is. All six are shapes the scan now carries, and both numbers are 100 with a
  test holding them as a floor. The corpus also found a false positive in this repository's own
  tree: the throwaway `postgres://postgres:postgres@...` every pipeline writes for a service
  container, which is now not a finding, because flagging it is how a scan teaches its reader to
  scroll past the real one. `docs/SECRET_SCAN_BENCHMARK.md` publishes the numbers and says plainly
  what the corpus is not: it is this repository's own, and a third-party benchmark is still open.

- **The dependency audit is scoped before it is trusted** (C16). An unscoped audit is the one
  people switch off: it reports a dev-only advisory nobody ships, at a severity nobody would act
  on, with no fix available, on every push, until somebody adds the flag that kills it for good.
  The gate's audit is now scoped three ways. Production dependencies only and a severity floor
  were already in the command; the third is new, an advisory allowed by package name or advisory
  id in `security.audit.allow`, with a reason and an `until` date. An allowance that has expired
  stops allowing and the gate names which one ran out, and a live allowance is printed even on a
  green run, because a decision nobody is reminded of is a decision nobody revisits. Where an
  allowance applies, the gate reads `npm audit --json` and fails on whatever is left rather than
  guessing from the text. `SEC-AUDIT` reads for the scoping instead of for the word `audit`: an
  unscoped audit is partial with what it lacks named, and a repository whose CI runs the gate has
  the built-in one. The audit moved out of `src/core/secrets.mjs` into `src/core/audit.mjs`: a
  secret scan and a supply-chain audit are two different things that shared a file.

- **The waiver rate, and a waiver that has run out** (C3). A waiver used to be a line in a list.
  It is now a number: `abatty rules` and the gap analysis report the share of the rules that could
  apply to this repository which it has set aside, over a denominator that excludes the rules that
  never applied, so a narrow stack is not flattered. The point of the rate is the catalog, not the
  repository: a rule that repository after repository waives is in all likelihood a rule that is
  wrong, and nobody can measure a false-positive rate without first counting the times somebody
  said "not here". A waiver whose `until` date has passed no longer quietly vanishes, taking the
  promise with it: the rule is measured again AND the expired waiver is named, with its date, its
  reason and what the rule reads now.

- **A rule says how far a machine can hold it** (C17). The enforced share has always named the
  rules a night should move up a level, and some of them were never going anywhere: no check can
  prove a restore would actually come back, or that a redaction list names every field that would
  hurt, or that the decisions which shaped the system are the ones in the decision log. A rule now
  carries a `ceiling`: the strongest enforcement any machine could reach, and why it stops there.
  A rule already at its ceiling leaves the promotion queue and is counted separately, so the queue
  is work that can actually be done rather than a list that never empties. The reason is on the
  rule, checked to be a reason rather than a shrug, and it is printed by `abatty explain`, carried
  in the catalog and named in the gap analysis. Five rules declare one today.

- **The ratchet's numbers carry their provenance and their limits** (C5, C6, C18). Three things a
  floor never said about itself. A raised floor now records the reason AND an owner **against the
  metric it explains**, in the baseline's `entries`, instead of one reason per write: an unrelated
  rebaseline no longer erases another metric's explanation, `abatty baseline` refuses a rise
  without `--owner` as well as `--reason`, and the entry is deleted when the debt it explained is
  paid, so it cannot be read as cover for the next rise. The reason and the owner are printed on
  the metric they belong to on every `abatty ratchet`. Every floor also records the probe
  `version` it was written under; a probe that changes what it counts reports `REDEFINED` and the
  run is red until somebody re-reads it and re-baselines, rather than comparing today's count
  against a number that answered a different question. A baseline written before the field existed
  is taken at its word rather than declared stale. And a probe that stands in for something it
  cannot measure now says so in `approximates`, printed beside its own count wherever it is red:
  `docs.behindCode` states that it is wrong in both directions and is a prompt to re-read rather
  than a verdict that a document is wrong, and `startup.eagerModules` states that a module count
  is standing in for milliseconds that belong to whichever machine measured them.

- **The bypass layer outside the agent** (C24). The guard hook refuses a force push and a hook
  bypass inside the agent's own shell, which made the refusal a property of one tool rather than
  of the repository: the same command went through from a second terminal, a script, a CI step or
  another assistant. `abatty init` now writes `.claude/bin/`, a `git` that a shell finds before
  the real one and that refuses exactly those two things, in the guard's own words, before git
  ever sees them. Everything else is handed straight through with its exit code, its signals and
  its stdio unchanged, because a layer that alters ordinary work is one people take back out.
  `ABATTY_SHIM=off` is the deliberate way past it, and it says so on stderr rather than passing
  silently. The night puts the directory on its PATH, so every subprocess a session starts meets
  the same refusal; a container sandbox keeps its own PATH, which is the image's. A new rule,
  `SEC-AGENT-SHIM`, reports whether a repository has the layer at all.

- **The night is measured on a surface it was not pointed at** (C11). A night is told which rules
  to work on and then measured on those rules, which is marking your own paper: an agent that
  fixes exactly what it was aimed at scores perfectly and may have learned nothing about the
  standard. A deterministic, date-seeded slice of the checkable surface is withheld from the
  instruction, and `abatty night-report` prints both sides and the gap. Work that generalised
  moves both; work fitted to the list moves one, and at twenty points or more the report says so
  in those words. A rule that does not apply counts on neither side, and a slice too small to read
  says that rather than producing a number.

  What "withheld" honestly means, and the document says it: withheld from the instruction, not
  hidden from the repository. The tree is readable. The claim is not containment - it is that the
  night's own instructions never name these rules, so nothing aims at them.

- **The bypass rate, in the report and in the generated pipeline** (C25). The guard refuses a
  bypass at the moment it is attempted, which leaves the one that happened where the guard was
  not: a machine whose hooks were never installed, a commit made before the harness landed, a
  pipeline committing on somebody's behalf. A bypass nobody can see afterwards is a gate with a
  hole nobody can measure. The report now carries, per push, how many commits got past the hook
  and at what rate, and the generated CI prints it and fails on one that has no reason. **The
  detection is narrower than the item asked for, and deliberately so:** "somebody typed the flag"
  is not recoverable from a git history, so what is measured is a commit that broke a rule the
  hook enforces at commit time - it cannot have passed through the hook, and reading it needs no
  cooperation from the machine that made it, which is exactly the machine whose cooperation cannot
  be assumed. A commit whose message says why is counted as a decision rather than a hole: the
  reason is the difference between a decision and a habit.

- **The sandbox's threat model is published** (C23), in `docs/standard/AUTONOMOUS_ADOPTION.md` §9.
  A sandbox nobody can describe is a claim, so the document says what the boundary holds, how it
  is proven, and - the part that matters - **what it does not contain**: the network, the
  credentials the environment already holds, whatever the gate allows, the model's own behaviour,
  and the case where `auto` finds no driver and there is no OS boundary at all. A reader can now
  decide whether it is enough for their repository instead of trusting the word "sandbox". The
  closing line is the honest one: run a night on a machine you would be willing to hand to the
  repository it is working on, because for the length of the night that is what you have done.

- **Agent security is a family of rules** (C21). The other families ask what the code does; these
  ask what the agent may do to the repository and what the repository may do to the agent - a
  different question, and the one the field's own incidents are about, because an unattended run
  is a session with no reviewer and both directions of trust are open by default. Five rules:
  `SEC-AGENT-SANDBOX` (a sandbox that proves its own boundary, and `off` stated rather than
  assumed reads differently from never considered), `SEC-AGENT-PERMISSIONS` (the deny list is the
  one place a reviewer can read what the agent may never do), `SEC-AGENT-TRUST` (the tree is read
  before a model is pointed at it), `SEC-AGENT-MCP` (a server the config does not name is a
  surface nobody reviewed) and `SEC-AGENT-BYPASS` (a bypass nobody can see afterwards is a hole
  nobody can measure). Each is a harnessed repository's: a repository nobody runs unattended reads
  `n/a` with the reason rather than failing five rules it never opted into. The catalog is 76
  rules over 15 families.

- **The repository is read before an agent is pointed at it** (C22). A night let a model read
  everything in the tree - source, documents, dependency metadata - and nothing asked what the
  repository was telling it to do. Text in a file an agent reads is an instruction in exactly the
  way a prompt is, and a repository is a place other people can write. The pre-flight now scans
  for three shapes: text that addresses a model (dropping its instructions, reassigning its role,
  forging a turn boundary, asking for a secret, asking for a control to be switched off), a
  command a document asks somebody to run (a download piped into a shell, `rm -rf` from home), and
  a manifest that runs code at install time. A finding **stops the night and is named**; it is
  never filtered out of the content, because a filter that fails quietly is the same defect as a
  gate step that checks nothing.

  The second direction is what makes it survivable. A line that forbids the thing it names is not
  an instruction to do it: this package's own guard writes the bypass flag down in order to refuse
  it, and the first version of the scan flagged ten lines of its own harness. A scan that fires on
  a repository documenting its own controls is a scan somebody switches off, and then it catches
  nothing at all. Five control cases, two of them entirely about silence.

- **A night is refused until the gate steps have been watched failing** (C12). `doctor --controls`
  plants a violation per gate step and reports a step that stays green as absent; it was a
  suggestion, and the night never asked whether it had been run. A night is hours of unattended
  work whose only stop is the gate, so a step nobody has watched go red is a guard nobody has
  tested. The night now refuses to start without the record, and refuses just as firmly when the
  record names a step that stayed green: absent is not passing.

- **The second reading of an unchanged tree is nearly free** (C44). Every `measure` read the whole
  tree and ran the whole catalog, so nothing was cheaper the second time and the inner-loop tier
  was aspirational. One property governs the design and every control case is about it: **a cache
  must never be able to turn a finding into a pass.** The key is the content of everything a rule
  could read - git's own tree object for what is committed, plus a content hash of every file that
  differs from it, staged, modified or untracked - so an edit twice in one second moves the key
  where a timestamp would not, and a file touched and restored does not. A repository without git
  has no key and is measured every time. Measured here: **149 ms to 79 ms**, of which 31 ms is the
  runtime's own floor, so the catalog run itself goes from about 90 ms to nothing.

  One thing the first implementation got wrong and the controls caught: writing the cache created
  an untracked file, which changed the key that named it, so the cache never hit in a repository
  that does not ignore `.abatty/`. The tool's own scratch folder is not an input.

- **`abatty fix` writes what a phase asks for that a machine can write** (C46). A tool that only
  refuses is half a tool, and most of day zero is not a judgement: a document with front matter, a
  row in the index, a decision record for the decisions already taken. The judgement is what goes
  inside them, and the placeholders are the questions rather than the answers. Two rules the
  fixers obey, both learned from this repository's own gate: **what is written satisfies the rules
  the repository already has**, so a document lands with its front matter and its index row and
  never trades one finding for another; and **nothing is written without being shown** - the
  default is the plan and `--write` performs it, so the destructive direction is the one that
  needs the flag. Run here it closed phase A.1: 7 of 9 held became 9 of 9, and the headline moved
  on to phase 0.

- **The first run needs no configuration** (C47), which turned out to be already true and now has
  the control case that holds it: a repository with one file and a git directory gets its phase,
  a stack detected without being named, the stage read off the tree, and five next steps - no
  `--stack`, no config, no profile.

- **The cold start is a number the ratchet holds** (C32). `startup.eagerModules` counts the
  modules the entry point parses before it knows which command was asked for - the floor under
  every command in the inner loop - and it may only fall. It lands at **3**, from 89 before the
  commands were split. The metric is the module graph rather than the milliseconds on purpose: a
  timing belongs to the machine that ran it, and a ratchet on a number that moves on its own is a
  ratchet nobody trusts. Two control cases hold the distinction the whole split depends on: an
  eager graph is counted, and the same graph behind an `await import()` costs nothing.

- **What this change introduced, before what the repository already carried** (C2). The ratchet
  reported every finding in one list, so an author reading a red gate could not tell the two lines
  they added from the four hundred the repository has carried for a year - and a reader who cannot
  tell learns to scroll past both. `abatty ratchet --range` now splits them: a finding in a file
  the range touched is reported first, under `in this change`, and the standing debt is counted
  beside it. The split is named for what it can actually know - touching a file is not the same as
  causing the finding - so `introduced` means the finding sits in a file this change edited.

- **Every rule says which kind of control it is** (C33). The category has a published vocabulary
  and the catalog did not use it: a **guide** is feedforward and steers the agent before it acts,
  a **sensor** is feedback and observes after, and each is **computational** when a processor
  decides it or **inferential** when a person or a model does. `abatty rules --json` now carries
  both for all 71 rules, derived from the family and the enforcement, and a rule may state its own
  where the derivation is wrong for it. The reading is 56 sensors to 15 guides, 52 computational
  to 19 inferential - honest for a package built around a gate, and now visible rather than
  accidental, which matters because feedback alone produces an agent that repeats its mistakes and
  feedforward alone produces one that never learns whether its rules worked.

- **A finding now carries the command that proves it was fixed** (C31). The published definition
  of a sensor in an agent harness is a signal optimised for the model and carrying the instruction
  for its own correction; measured against it this package emitted reports, because
  `Verdict.next` is a sentence for a person who already knows the codebase. The MCP surface gains
  a `findings` tool that returns, per open finding, **where** it is, **what** edit to make,
  **why** the rule exists, and **`verify`**: a command whose exit code proves the edit worked.
  `abatty check <ID>` is that command - one rule, run alone, **0** when it holds and **3** when it
  does not - so it cannot drift from the rule, because it is the rule. The loop closes without a
  human: the rule breaks, the gate refuses with an instruction, the agent edits, the agent runs
  `verify`. The control case is the one that matters and runs both ways: `verify` is non-zero
  before the edit and zero after it, with nothing else in the repository changed.

- **Findings go to the diff, as SARIF** (C45). The strongest finding in the whole evidence base is
  about placement rather than precision: the same analysis, at the same precision, reached a
  near-zero fix rate delivered as a report and above seventy per cent delivered on the change
  under review. This package produced the report. `abatty measure --sarif` and
  `abatty ratchet --sarif` now write SARIF 2.1.0, and the pipeline `abatty ci` generates emits it
  and uploads it to code scanning, so a finding appears on the line it concerns in the pull
  request - through an OASIS standard the forges already ingest rather than through a bot we would
  have to build and convince people to install. Enforcement decides the level: `hard` is an error,
  `review` a warning, `prose` a note, and a ratchet metric is an error only when the number rose,
  because the promise a ratchet makes is about the direction. `partialFingerprints` gives a
  finding an identity that survives the lines above it moving, which is the problem the per-file
  debt solves by hand today. It is a renderer and nothing else: one finding model, another
  surface, nothing recomputed.

- **The gate can say "I could not run", and the exit codes say which happened** (C48, and the
  codes of C30). A dead-code analyser that crashed and one that found dead code produced the same
  `✗ ... failed. The gate stops here.`, so the verdict conflated "your work is bad" with "my
  instrument broke" - in the one package whose whole claim is that its verdict means something. A
  fifth outcome, `errored`, now carries the second: a step whose tool could not be spawned, was
  killed by a signal, or that the shell could not find or execute is reported as the instrument
  rather than as the work, names the tool and the message, and still stops the gate, because an
  unproven step is not a passed step. The exit codes follow it and are listed in `abatty help`:
  **0** clean, **2** invalid input, flags or configuration, **3** ran correctly and found
  violations, **4** internal error or a step that could not run, **130** interrupted. Three is the
  one that matters: a gate that found something did not fail, it worked. Two control cases run in
  both directions - the same step crashing and the same step exiting non-zero after it ran - so
  the difference is watched rather than asserted.

- **`docs/DESIGN.md`: what the instrument has to become on its own terms.** The roadmap says what
  changes next and the position says where the package stands against the evidence about
  adoption; neither answers what finished looks like judged by the core and the output alone.
  This one does, in six parts: the bar when it is not users (the portfolio, the controls, the
  research), four defects that are wrong rather than unpolished (affectedness in a workspace, a
  gate with no outcome for a step that could not run, a night that reads the repository as
  trusted input, eleven shells that are not needed), one finding model behind four surfaces (the
  terminal, the agent with a `verify` command whose exit code proves the edit, SARIF for the
  pull request, the signed predicate for an auditor), the latency tiers with today's numbers
  against their targets, the first run that needs no configuration, and the order the ten items
  land in. Every claim carries the measurement or the research finding that put it there. Its
  ordering section is now a pointer to the plan, so the order lives in one place.

- **`docs/PLAN.md`: the one queue.** Three rounds of research and a design pass produced
  forty-nine changes spread across five documents, and an order that lives in more than one place
  is not an order. They are merged here into six dependency waves, each with the acceptance check
  that says when an item is done, and **every row was checked against the code at `e043e66`
  rather than against the research that asked for it**. That check changed the picture: nine of
  the forty-nine are partly built already, so §11 records what exists for each of them, with the
  file, and what is actually missing. Four are landed. The work that came from this repository
  rather than from the research is named as such.

### Changed

- **Five standard documents re-read against the harness that moved on 2026-09-21.** The
  guard's new readings (a push to the base behind a redirection, the forge's API as the same
  door, a pull request merged at night) and the shim's Windows form were in the templates and
  in their README, not in the standard that cites them: the hooks table, the enforcement map's
  night steps and the standard's own invariant now say what the guard refuses, and two counts
  that named a total of self-test checks (104, 124) name the decisions the README counts
  instead. The dogfood page closes its pull-request-template claim, which `CLAUDE.md` §10 had
  closed on 2026-09-19, and records what the first Windows and Node 20 runs found, including
  that `docs.behindCode` turns red the day after a merge with nothing pushed, which is how this
  entry came to be written.

- **The package's own CI runs on every Node it claims and on pnpm as well as npm on Windows.**
  The Linux job is a matrix over Node 20 and 22 (`engines` says `>=20`; only 22 had ever run):
  the whole gate on 22, the suite and the typecheck on 20, because the matrix's first run
  showed the repository's graph tooling refuses Node 20 (`dependency-cruiser` runs on
  `^22||^24||>=26`), which is that tool's floor and not the package's, whose claim rests on no
  runtime dependency. The findings are uploaded once per commit. The Windows job is a matrix over npm
  and pnpm, the pnpm leg installing pnpm on the runner, and the launcher case in the suite now
  spawns every launcher it finds on PATH (npm always; pnpm, yarn and bun where installed, named
  in the output) rather than npm alone: the trial's repository is pnpm on Windows, and nothing
  here had ever run `pnpm.cmd` there.

- **Two modules went over the module budget with the fixes above and are split by what they
  are for.** What a push contains (the range, how it was found, the files it and the tree
  change) is `src/core/range.mjs`, because the ratchet, the report and the MCP server ask the
  same questions and none of them runs a gate; the gate keeps the gate. The provider-neutral
  half of CI generation (the steps, the package manager's commands, the YAML helpers) stays in
  `src/ci/generate.mjs`, and each provider renders them from its own module
  (`src/ci/woodpecker.mjs`, `src/ci/github.mjs`). The `CI` flag the gate reads is read through
  the env module, the one place the package reads its environment (VALID.3), which the ratchet
  had counted as a regression. No behaviour changed; the suite that covers both is unchanged
  but for the import paths.

- **The standard documents say what the harness now ships.** `docs.behindCode` flagged four of
  them once the day rolled over, correctly: they describe a harness that moved under them. The
  git shim is now in the enforcement map's night controls (three became four), in the adoption
  plan's inventory of what `init` writes, as an invariant of its own in the engineering standard,
  and with a section in the autonomous-adoption guide explaining why a `PreToolUse` hook is a
  property of one tool rather than of the repository. The adoption plan also said "the seven
  hooks" when there are nine. Each date was bumped because the document was re-read and changed,
  which is the only reason §7 allows for bumping one.

- **Coverage and mutation testing are read for their bounds, not for their tool** (C14, C13).
  TEST-COVERAGE asked for a threshold on the tree total, which is the wrong question asked loudly:
  a whole new untested file passes while the total holds, and a refactor that deletes well-tested
  code fails for improving the codebase. It now asks for a gate on the coverage of the lines the
  change touched, with the total kept as a floor underneath. TEST-MUTATION asked whether a
  particular package was installed. It now asks for the two bounds without which mutation testing
  is the slowest check anybody has ever switched off: mutate what the change touched, and ignore
  the nodes a mutant cannot prove anything about, so a surviving mutant is a real gap in the tests
  rather than a log line. Both rules read the tool's config files, the scripts and the pipeline,
  in whichever ecosystem's spelling, instead of one vendor's file name; where a rule still names a
  tool it is because that tool is the exception, and it says so.

- **The interoperable context file is always written, and `agents` says which surfaces are
  covered** (C8). `AGENTS.md` was written only when another configured adapter asked for it, so a
  repository that named one agent was invisible to every other - the interoperability objection,
  for the cost of one file. `init` now writes it always and the primary's file imports it, so
  there is one source rather than two copies that drift, and a rule that reads the context follows
  that import rather than reporting the sections missing from a pointer. `abatty agents` lists,
  per adapter, the file it reads and whether that file is on disk: an adapter named in the config
  whose file was never written is a repository that believes it is covered while the agent reads
  nothing.

- **The context template points where it used to copy** (C9, reshaped). Its size section repeated
  the table in `.claude/rules/size-limits.md` and its command block listed commands for a stack an
  adopter may not have; both now point. 144 lines to 141. The item as written ("ships
  near-empty") is recorded as withdrawn in the plan with the reason: `DOC-CONTEXT-SECTIONS`
  requires six sections, so a near-empty template would fail the package's own rule the moment
  `init` wrote it.

- **The suite is 81 s, from 225 s** (C43, in part). The runner already parallelises files, so the
  suite was never serialised work - it was one file: `night.test.mjs` was 151 s of the 225 s, and
  nothing else could finish before it. It is now three files that run at once, split by what each
  group proves (a night that runs, the aborts and refusals, the spend and the resume), with the
  fixture they share in `test/night-helpers.mjs`. The number to watch is the longest file, now
  70 s. What is left of C43 is the gate's own steps, which still run one after another.

- **The shell is gone from every spawn site that did not need it** (C42). Eleven sites passed a
  command and an argument array and then handed both to a shell, which only added a layer that
  re-parses quoting, behaves differently on Windows, and sits exactly where a repository's own
  scripts run during an unattended night. What the shell was actually covering is narrower: on
  Windows the node tool launchers are batch files and the bare name does not resolve, so
  `src/core/spawn.mjs` names the launcher instead, which does the same job without handing the
  arguments to a parser. Two sites keep a shell and say why in a comment: the night's pre-flight
  and the Stop hook each run one command string the repository configured, not a command and its
  arguments, and that string comes from the config the hooks trust.

- **Every command loads only what it uses, and the entry point is a dispatcher again** (C41).
  Printing a version string parsed the night runner, the sandbox drivers, the hosted service, the
  MCP server and the CI generator: 89 modules and 12,845 lines were statically reachable from
  `bin/abatty.mjs`, which is the floor under every command in the inner loop. Each case now
  imports what it needs when it is chosen, and the eleven screens that were written inline moved
  into `src/cli/` beside the seven already there: `measure`, `gate` and `doctor`, `init` and
  `update`, `config` and `agents`, `scrub`, `report` and `dashboard`, `rules` and `explain`.
  `abatty version` falls from 131 ms to 45 ms, status from 131 ms to 78 ms, `measure` from 229 ms
  to 165 ms. The entry point falls from 646 code lines to 291, so `abatty explain CODE-SIZE-300`
  no longer names the file an agent edits most - the tool stops failing its own rule at the one
  place it hurt. What the remaining 45 ms is: `node -e ""` alone is 31 ms here, so the package's
  own share is about 14 ms, and the plan's 30 ms target is restated as the share above the
  runtime's floor rather than an absolute nobody can reach.

- **`docs/ROADMAP.md` is archived and points at the plan.** Four of its five tables were empty
  and the one open row split in two: the presets it wanted proven are wave 5 of the plan, and the
  repository outside the company is the position's subject. The 2026-09-15 analysis it carried of
  what stopped a stranger's repository from a meaningful score is left in place rather than
  moved, because three of its four blockers are closed and it describes a repository that no
  longer exists.

### Fixed

- **The push-time changelog check reads the same `no-changelog:` line the commit-time hook
  accepts.** The hook let a reasoned commit through and the ratchet refused the push a step
  later, on this repository, on the day the hook landed: the escape was a promise the range
  check broke. `commitsOf` now reads the whole message, and the changelog pair carries the
  excuse; an excused commit is not an offender and cures nothing before it, and the bypass
  reading still counts it as reasoned, so the decision is on the record in three places rather
  than accepted in one and refused in another. The night's Stop gate stays as it was: a night
  does not excuse itself.

- **`npm test` runs on Node 20, the oldest Node the package claims** (the matrix's second
  finding on its first day: `node --test "test/*.test.mjs"` relies on `--test` expanding the
  glob, which it does only from Node 21, so on 20 the runner found no file and the suite had
  never once run there). `scripts/test.mjs` expands the glob itself and hands `node --test` the
  files, node's flags first; the pattern stays in the script's text because the step controls
  read it to learn where a planted test has to sit. The same leg then found the suite's own
  fixture for the controls carrying the glob form, "proven" red on Node 20 for the wrong
  reason until the confirm-clean run said so; it carries a runner of the same shape now, and
  the plant path also reads a folder handed to a runner (`vitest run tests/`), which is a form
  Windows' `node --test` does not take, so no single `node --test` argument runs on every
  machine this suite does.

- **The controls pass judges the suites too, and a step red without a plant proves nothing**
  (the reviewer's second pass: `stepControls` read `preset.gate.always` alone, so the browser and
  database steps, precisely the ones that vanished from the trial's empty-range run, were the
  ones it could not see). Every suite step is now planted and judged under its suite's name, a
  suite that needs Docker is skipped out loud when the daemon is down, and two plants are
  declared for what a plant can prove: a browser test that throws where the Playwright config's
  `testDir` says (or `e2e`), an integration test that throws where the script looks. What no
  plant can prove is reported as `none` with the reason (a build is proven by its output, a
  coverage floor by a drop no single file causes, the audit by the registry) rather than left
  out. And a step that went red on its plant is run once more clean: red without the plant too
  is the environment failing, not the guard holding, and reading it as proof was the trial's
  first-day false red inside the mechanism that exists to catch false greens. That protocol
  found two in this package's own suite at once: a fixture whose `package.json` was never
  formatted had been "proving" the format step red on an unformatted file it did not need, and
  `init` wrote a `docs/README.md` with no front matter, so every freshly initialised repository
  was red on its first clean ratchet and its ratchet control was "proven" the same way. Both
  fixed at the root. A tool that cannot be spawned reads as not installed on every platform
  (127), where on Windows a missing `ruff` had read as a red control. The plants moved to
  `src/core/step-plants.mjs`; the runner keeps `step-controls.mjs`.

- **A step the preset requires cannot be skipped for want of a script, and a green with steps
  not run says how many** (the reviewer's second pass, the other half of the false green: a
  repository with a lockfile and no scripts read "gate green · 2 step(s)" with seven skipped and
  exit 0). `errored` covered the instrument breaking; it did not cover the instrument never
  being installed. A gate step now carries `required`, the preset's word on what is the
  instrument rather than an option: the tests and the ratchet wherever there is code, the
  typecheck where the preset is TypeScript-native (next, vite-react, astro), pytest for python.
  Without its script or its config such a step is `errored` and the gate cannot run, the same
  verdict as a tool that is not installed; a linter or a graph remains a dependency decision and
  is skipped as before. And the verdict no longer leads with the colour when steps did not run:
  "gate green with 4 of 9 step(s) not run (format, lint, import graph, dead code: no script or
  config)", in yellow, so the reader is made to finish the sentence. The generated pipeline's
  comment for an absent step says when the preset requires it. Three controls: the reviewer's
  repro exits 4, the required steps alone are green with the count, every step present is the
  plain verdict.

- **The suite runs green on Windows, and two of its eight red cases were the code's fault**
  (the trial's second finding as a class: "npm/Linux-shaped"). The hooks `init` writes were
  committed without their executable bit on Windows, because the bit was set on an index entry
  that did not exist yet and `git add` on a filesystem without modes reads none from disk; the
  hook was then skipped on every other machine, which is a gate that never runs. The entry is
  now staged with the bit when the file is not tracked, because the index is the only record
  there is. The git shim looked for a file named `git`, which Windows cannot run, and spawned a
  `.cmd` without the shell Node requires for one; it now looks for `git.exe` or `git.cmd` and
  gives the latter cmd.exe with the arguments quoted. The other six were the tests' shape: a
  path compared with the separator of the machine that wrote the test, a Seatbelt string with
  its backslashes unescaped, a container mount asserted as if the temp folder were never under
  the home, and two timezone cases that pin `TZ` for git, which git for Windows does not read
  (proved by a commit under `TZ=Pacific/Kiritimati` recorded at `+0200`); on Windows those two
  run in the machine's own zone, the one pair that exists there. Underneath them a harness bug:
  deleting `TZ` does not put Node's clock back on Windows, so every later case ran in whatever
  the previous one pinned; the system zone is now restored by name. One more fixture had pinned
  the audit's old "skipped" and is corrected with the rest.

- **A context file that is still the template is a description of one, and the catalog now
  says so** (the ninth defect of the trial: `AGENTS.md` shipped with `<project name>` and
  twelve other placeholders, and nobody noticed for two days because every section was there).
  `init` fills what a machine can, the project's name from `package.json` or the folder; the
  rest are the questions, and `DOC-CONTEXT` reads as partial for as long as any stands, naming
  the first three with the fix ("fill the placeholders in <>: they are the questions, not the
  answers"). A placeholder is angle-bracketed text with a space in it; a convention written the
  same way (`<topic>`, `<type>/<short-description>`), an HTML comment or a tag is not one.
  Control cases in both directions, and the catalog regenerated.

- **The front matter reads the same with CRLF as with LF** (the eighth defect of the trial: a
  document checked out with CRLF on Windows lost the last key of its front matter, and the
  ratchet went red on one operating system only). The closing `---` was found across the
  `\r\n`, but the line before it kept its `\r` and the key pattern could not cross it. The reader
  now normalises line endings once, before anything is read; every other parser in the package
  reads git's own output, which is LF. A control case reads one document both ways and expects
  the same map, byte-order mark included.

- **The practices page was behind the standard it describes** (`docs.behindCode`, red on
  `main` since VALID.5 landed on 2026-09-20: the standard gained a rule and
  `docs/standard/BEST_PRACTICES.md` still carried the day before). Re-read against the
  standard, the runtime table gains the VALID.5 row, and the date moves because the reading was
  done, not because the number was red. The catalog's INST-CI-STEPS entry says the rule as the
  check now reads it: a comment that names a step is not a step.

- **`abatty ci` writes the repository's pipeline, not a template's** (the seventh defect of
  the trial: `npm ci` and five `npm run` steps for scripts the package lacked, on a pnpm
  repository, red from the first run). The install, the audit, every `run` and every `npx`
  are now the package manager's the lockfile names (`src/core/package-manager.mjs`: npm, pnpm,
  yarn classic or berry, bun), with the runner's toolchain to match (`pnpm/action-setup`,
  `oven-sh/setup-bun`, `corepack enable` on the node image, the cache keyed on the manager). A
  gate step whose script the package does not have is written as a comment that names it, in
  the words the gap analysis uses, and a job with no runnable step is a comment block rather
  than an empty job the forge refuses to parse. `--check` compares against the same rendering,
  so a generated file is in step with itself. INST-CI-STEPS reads commands and not comments, so
  the comment that names a missing step does not count as the step. Control cases: pnpm and npm
  on one preset, an alternative script found under its own name, and the preset alone rendered
  whole for a reader.

- **A trailing redirection no longer hides a push to the base branch, and the forge's API is
  read as the same door** (the sixth defect of the trial: `git push origin main 2>&1` passed the
  PR-only guard, and `gh api` ref writes were never looked at). The guard took the last non-flag
  word as the target, and `2>&1` is a word; it now reads the arguments positionally and stops at
  the first redirection. `gh api` with a write method or a body flag against the base's ref or
  the merges endpoint is refused as a push to the base; `gh pr merge` and the API's merge of a
  pull request are refused at night, since merging is a human act the skill was never allowed.
  Nine control cases in both directions, six of them watched failing against the old guard.
  And because a regex over the agent's shell is a guard on this machine, not a policy on the
  branch, `abatty doctor` now says on every run that PR-only is held here for the agent's shell
  and on the forge by branch protection, which this machine cannot see, with the command that
  prints the ruleset to import.

- **The bypass rate read every source commit as a bypass** (the fifth defect of the trial: "the
  bypass-rate report reads the wrong config key and flags every commit"). The report handed the
  raw config to the changelog pair, which reads `changelog` at the top level while the config
  keeps it under `files`; the `then` side was null, and 41 of the last 47 commits on this
  repository read as bypasses, the ones that touched the changelog included. In the generated
  pipeline that step exits non-zero on a bypass, so it was a false red on every pull request as
  well as a false number everywhere. The pair is now resolved the way the ratchet resolves it,
  from the same function; a control case proves a commit with its changelog line reads clean
  and one without reads as the hole it is.

- **A pipeline is credited for the scripts it can run, not for the words it names** (the fourth
  defect of the trial: a generated CI file naming five scripts the package lacked was red from
  its first run and still lifted the score by six points). `INST-CI` read any pipeline file as
  present and `INST-CI-STEPS` grepped its text for `lint`; now both read the scripts the pipeline
  invokes (`npm run`, `pnpm run`, `yarn`, `bun run`) against `package.json`, a step whose script
  is missing is reported as "NAMED, no script", and the phantom scripts are listed in the
  evidence with the fix. Control cases in both directions, and the catalog regenerated.

- **A push range the gate cannot trust selects everything, never nothing** (the third defect of
  the trial: `abatty gate` in a pipeline without `--range` read "0 pushed files", skipped the
  build, browser and database suites and printed green). Two cases were read as an empty push:
  a range that could not be found at all (a detached or shallow checkout with no upstream and no
  base to fork from, where `HEAD~1` may not even exist) and a range that is genuinely empty in
  CI, where the push is the event that started the run and not a diff against an upstream the
  push itself just moved. `pushRangeInfo()` now says how the range was found and how many
  commits it holds; blind, the gate selects every tracked file, prints why in yellow, and says
  how to narrow it (`--range <before>..<sha>`). Locally an empty range still means nothing to
  push, which is what it means. The CLI passes `CI` down; the library takes it as an option so
  the suite can judge both directions on one tree.

- **A repository with no lockfile has no audit, and the gate now says so instead of passing**
  (the second defect of the trial: seventy advisories on a pnpm product, and a gate that said
  nothing for as long as it ran one). The audit step answered "skipped" without a
  `package-lock.json`, and a skipped step is a passed step at the gate; the rule the reviewer
  wrote is the one this package already claims for itself, that a check which reports nothing is
  indistinguishable from a check that is switched off. Now the audit is the package manager's,
  read from what the repository committed (`src/core/package-manager.mjs`: the `packageManager`
  field first, the lockfile otherwise): `npm audit`, `pnpm audit` or `bun audit`, each run
  against a package with a known advisory before it was wired and its JSON shape read for the
  allowances (three shapes; a banner before the JSON is skipped). yarn's is named for CI and
  deferred out loud until somebody has watched it. No lockfile at all is `errored`, the outcome
  a linter that is not installed gets, and the gate stops on it as the instrument. The audit
  runner is injectable like the script runner, so the suite is hermetic where it used to reach
  the registry, and the fixtures that were green only because the audit skipped now carry a
  lockfile. Control cases in both directions at the audit and at the gate.

- **The gate runs again on Windows: a tool launcher is a batch file, and a batch file needs
  cmd.exe** (the first of nine defects an outside trial on a pnpm + Windows product reported).
  The commit that took the shell off every spawn site named the launcher instead (`npm.cmd`),
  which Node has refused to start without a shell since 20.12 (EINVAL, the fix for
  CVE-2024-27980), so this package's own gate stopped at its first step with "format could not
  run: EINVAL" for two days. `launch()` in `src/core/spawn.mjs` is now the one place that
  decides: on Windows a launcher runs under cmd.exe with its arguments quoted for it, once;
  everywhere else and for everything else there is still no shell. The harness self-test's agent
  probe had the same belief and the same failure on a `.cmd` stub, and carries the same fix. A
  control case spawns the real launcher on every platform the suite runs on. Two limits are
  written where they hold rather than papered over: cmd.exe exits 1 both for a tool that failed
  and for a tool it could not find, so on Windows a missing tool inside an npm script is reported
  as failed with the shell's own line above it (POSIX keeps 127 and "could not run"); and five
  test fixtures were POSIX-shaped (single quotes in a script, a URL's pathname as a path) and
  answered the wrong thing on Windows before the fix could be seen.

- **Two gate steps here had never once been watched going red** (found while proving the date
  metric). `abatty doctor --controls` plants a violation per gate step and reports a step that
  stays green as ABSENT, and on this repository it had been reporting typecheck and unit tests
  as absent on every run. Two causes, both the same mistake: the plant assumed a convention the
  repository does not keep. The typecheck control wrote a `.ts` file, and this tsconfig includes
  `**/*.mjs` only, so the compiler never read it; the test control wrote `src/*.test.ts`, and the
  test script globs `test/*.test.mjs`, so the runner never ran it. The plant now follows the
  repository: the extension its own tsconfig covers, with the type error written as JSDoc where
  that is JavaScript, and the folder and name its own test script globs. A second hole in the
  same mechanism: a planted step inherited `NODE_TEST_CONTEXT` from whatever spawned it, and a
  `node --test` that sees it exits 0 on a test that threw, so the control watched a failure and
  called the step green. The planted step now runs with that variable and the coverage one
  removed. Both fixes are mutation-tested against a fixture whose typecheck and runner are
  deliberately narrow. The mechanism was not silent about any of this: it printed ABSENT and
  exited 3 every time. CI runs the self-test skipped, so nothing downstream acted on it.

- **Dates were derived in UTC and compared against local ones** (from an outside review). The
  reviewer's `npm test` failed two cases at 01:55 CEST that pass at UTC: `docs.behindCode`
  reported a document as behind code it had been verified against on the same day, because the
  probe's same-day guard compared a UTC "today" against git's `%cs`, which is the committer's
  local day. It is a HARD metric, so it failed a gate, for every user east of Greenwich in the
  hours before midnight and west of it after. The probe's own control case is what caught it.
  Every date is now derived by one `localToday()`, so the mistake is unavailable rather than
  merely fixed, and seven call sites were moved onto it. Running the suite across five timezones
  found four more of the same defect in the tests themselves and two deeper ones nobody had
  looked at: the night report matched hooks' UTC timestamps against a local folder name with a
  string prefix, which silently dropped every Stop receipt for anybody not at Greenwich, and its
  fixtures built UTC instants out of local dates. The suite now passes in UTC, Paris, Auckland,
  Los Angeles and Kolkata, and the regression cases pin a zone whose calendar day differs from
  UTC's at whatever hour they run, because a suite that only runs at UTC cannot see any of this.

- **Six agent-security rules cited `SEC.5`, which the published standard defines as outbound
  webhook signing.** A collision introduced when the family was added. The standard gains
  `SEC.7`, which says what those rules are actually about, and the six now cite it.

- **The trust scanner fired on its own repository, and would have blocked a night here** (from an
  outside review). Ten findings on this tree, every one a false positive: the scanner's own
  pattern table, its own test fixtures, the permission deny-list that forbids `rm -rf /`, and
  research prose reading "the Cyber Resilience **Act as a** deadline" and "they **act as a**
  ratchet". A night-blocking check has the tightest false-positive budget there is, and this one
  was running at roughly one hundred per cent on its author's tree, which is the shape of check
  people switch off. Four narrowings: the scanner's own two files are exempt by name (those two,
  never "tests" as a class, because a hostile repository would hide an instruction in a test file
  precisely because a scan was taught to skip them); a list that forbids what it names is read as
  forbidding, by looking for the key above rather than only the line; `act as` needs both a
  second-person lead and a role-shaped object; and the secret pattern needs a determiner, so
  "fewer output tokens" is prose again. A repository may also name paths to skip, in
  `preflight.trustAllow`, with the reason. A test asserts the scan is clean on this repository and
  a hostile fixture proves all seven attack shapes are still caught.

- **SARIF findings carried no line numbers** (from the same review). Zero of eight ratchet results
  had a region, so a forge placed them at the top of the file rather than on the line of the
  change under review, which was the whole argument for emitting SARIF. The renderer was right;
  the probes never supplied a line. The two probes that scan for occurrences now report one
  finding per occurrence on its own line, and the totals and per-file floors are untouched because
  the ratchet sums weights either way. Fingerprints gained an ordinal so two findings in one file
  are two alerts rather than one, and they still survive an unrelated line being inserted above.

- **Six test assertions accepted either answer at the exact point the fifth gate outcome exists.**
  A step whose tool ran and failed exits 3; one whose tool could not run exits 4. Widening the
  assertions to `[3, 4]` made the suite unable to detect a regression in either direction. They
  are exact again, against fixtures that decide the outcome rather than hoping for it, plus an
  end-to-end case through real npm covering both codes. Verified by running the suite with
  `eslint`, `ruff` and `mypy` removed from the machine, which is the condition that broke CI.

- **Three surfaces each decided for themselves whether a finding had a location**, and two
  disagreed. A finding now carries `where`, attached once in `runCatalog`, and the SARIF renderer
  and the agent surface both read it. The first attempt put the scrape in the renderer and this
  repository's own import graph refused it, correctly: `src/ui/` renders what it is given.

- **`bin/abatty.mjs` was 312 code lines against a 300 budget** and `explain CODE-SIZE-300` still
  named it, which wave 1 had claimed as done. The help screen moved to `src/ui/help.mjs`, where
  the boundary map says terminal text belongs; the entry point is 288 lines, the rule no longer
  names it, and the startup floor is unchanged at 3 because the import is lazy.

- **`preflight.trust` was read by a rule but absent from the config schema**, so a repository
  setting it would have failed validation. Both `preflight` keys are in the schema now.

- **Six tests pinned the machine they were written on, and went red on a clean runner.** A gate
  step whose tool is absent reports `could not run` and exits 4; one whose tool found something
  reports `failed` and exits 3. That distinction is the whole point of the fifth gate outcome, and
  six assertions had baked in whichever of the two this machine happened to produce, because the
  linter and the Python tools are installed here and are not on a CI runner. They now accept
  either, and say why: what each test is about is WHERE the gate stops, not which of the two
  reasons a particular machine had for stopping it there. A gate that sailed past the step, or
  reported a clean zero, still fails all six.

- **The coupled path for the harness named a folder it does not install into.** `templates/harness/`
  was coupled to `.claude/`, but the context-file template installs to the root as `CLAUDE.md`,
  not into `.claude/` at all - so editing it demanded a change to a folder it never touches, and
  the gate refused a correct push. The coupling is now the four pairs that are actually installs:
  the hooks, the path-scoped rules, the agents and the project settings. A rule that fires where
  nothing is wrong is the same defect as a rule that stays silent where something is.

- **A change under a shared package left the application that imports it ungated** (C29). The
  gate selected work by path, which answers only half of what a monorepo has to ask: which inputs
  changed, but not which workspaces can observe them. A change under `packages/ui` did not select
  `apps/store`, so its suites were skipped with "no matching path" and the push went through
  unchecked - a silent pass, which is the worst failure a gate can have, because nothing in the
  output says the check did not happen. The workspaces now carry a dependency graph read from
  their own manifests, and a changed workspace selects every workspace that depends on it, at any
  depth. Where the graph cannot be built, or a changed file sits outside every workspace, the gate
  runs everything and **says which of the two happened**: conservative and slow is a correct gate,
  fast and silent is not. Four control cases: one hop, two hops, a leaf nothing depends on, and
  the root-level change that widens to all; plus a gate-level case, watched failing first, where
  the application's suites run although its folder was never touched.

- **A document whose name ends another document's name was invisible to `docs.indexDrift`.** The
  probe asked whether the index text contained the path, so `PLAN.md` read as named because the
  index carries `standard/ADOPTION_PLAN.md`, and the metric reported nothing while the row was
  genuinely absent: a check that cannot see a whole class of its own subject. It now reads the
  paths the index names, each taken whole and bounded at both ends, and carries two control cases
  for exactly this shape, the missing one and the named one. Both were watched failing against the
  substring match before the fix landed.

## [0.2.0] - 2026-09-18

### Changed

- **`CODE-ESLINT` is `CODE-LINTER`.** The rule has said "a linter configured, for every language
  in the tree" for as long as it has existed, and its check has always asked each language pack
  which linter it names; only the ID still carried one vendor. A rule ID is a public contract the
  moment a repository waives one by name, so the rename lands in the release that first reaches a
  registry rather than in the one after it. Its `next` line names three JavaScript linters
  instead of one.

### Added

- **Observability is a family of rules, not a sentence.** The standard has carried the OBS.1
  pillar since it was written and the catalog held nothing for it, so a repository could be
  measured, gated and ratcheted from end to end without anyone ever asking whether its logs
  could be read, whether a secret reached them, or whether the process stopped without dropping
  the work in flight. Six rules close it: a structured logger (`OBS-STRUCTURED`), redaction by
  field path at the logger rather than at the call sites (`OBS-REDACTION`), `no-console` on the
  server's paths (`OBS-CONSOLE`), a SIGTERM that drains instead of exiting on the spot
  (`OBS-SIGTERM`), a health endpoint the deploy and the load balancer can read (`OBS-HEALTH`),
  and an error tracker configured from the environment (`OBS-TRACKER`). Each is a service's, so
  a library or a browser application reads `n/a` with the reason rather than `missing`, through
  a new `SERVICE` predicate. The enforcement levels are the honest ones: one `hard`, the rest
  `review` and `prose`, which the enforced share shows and a night can promote. Phase 13 of the
  plan carries them, with its exit condition and the enforcement map updated to name them.
- **Two more research rounds and the competitive picture.**
  `docs/standard/research/08-security-compliance-tooling.md` (agent security and the hostile
  repository, the Cyber Resilience Act as a deadline, the tooling landscape, the command-line
  guide, changes from C21) and `09-market-and-voices.md` (the guides-and-sensors vocabulary the
  field settled on, the named voices, the numbers a buyer feels, the five rings, changes from
  C31). `docs/COMPETITIVE.md` is the living picture those two argue for: what each ring does and
  what it does not, with the rule that a row without the second half is marketing.
- The position the three of them converge on, stated once: this package installs the
  computational half of a harness, proves its sensors can fail, and signs the record. Ring 5,
  compliance automation, is the one with budget and a gap that matches what the package already
  computes and currently discards.
- **`docs/POSITION.md`**: where the package stands against the adoption evidence rather than
  against taste. A scorecard graded on the repository at `583f9ce`, the wedge the survey found
  unoccupied, a ninety-day order and what would kill it. Checked before landing: the package
  size (454.6 kB packed, 1.4 MB unpacked, 214 files), the README (4,973 words, 33.8 kB) and
  `publishConfig.provenance` are exact. Three figures were not and are corrected in place: the
  suite is 143 tests and not 136, the first dogfood found nine defects and not six, and the
  latency row claimed a 6.7 s gate where the gate this repository runs before a push takes
  196 s.
- **The evidence base for the instrument** (`docs/standard/research/07-evidence-base.md`): what
  the published research, the industrial reports and the competing repositories say about the
  parts this package is made of, each finding graded and mapped to the rule, probe or command it
  bears on, with twenty consequent changes. It is the first research file about the instrument
  rather than about a technology cluster, and it records what is genuinely unclaimed: a measured
  false-positive rate for a tool's own rules, a catalog validated against the defect history of
  the repository it runs in, a harness that proves its gate can go red, and a human-owned,
  schema-versioned baseline.
- **abatty runs its own instrument** (roadmap #27): the harness, the gate, the hooks, the
  import graph and the dead-code check are installed here, `doctor` is green on a machine set
  up for a night, and `CLAUDE.md` is this repository's own rather than the template's. The
  `node` preset is proven by a named repository for the first time, and the six bugs above are
  what that first run found. The boundary map is enforced (the rules and the probes never reach
  the terminal, nothing imports the templates), the five pre-existing import cycles are the
  graph's committed debt, and `templates/harness/` is coupled to `.claude/` so the harness this
  repository runs cannot drift from the one the package ships.
- Distribution (roadmap #27): the version this repository follows is pinned in the config
  (`abatty`, written by `init`, moved by `update`, read by `doctor`); the README opens with
  the two-minute path a stranger can act on. The registry publish, the license and the
  standard in the open were done before; a repository outside the company is what is left.
- Language packs beyond JavaScript (roadmap #25): a pack names a language's extensions,
  test shape, manifest and tools; the context detects the packs of a tree and reads the
  sources of every pack; the linter, formatter, typecheck, dead-code and test rules judge
  per pack with the same words, the JavaScript-only rules are n/a elsewhere, the step
  controls plant in the pack's language and skip a tool that is not installed; the Python
  pack and an unproven `python` preset (ruff, mypy, pytest, vulture as commands), detected
  from the tree.
- Every gate step proves it can go red (roadmap #24): `abatty doctor --controls` plants a
  language-neutral violation per always-on step (an unformatted file, a debugger statement,
  a type error, a failing test, an unused export, an oversized file, a planted key), runs the
  step, removes the file, and reports a step that stays green as absent; the outcome is
  written to `.abatty/controls.json`, and INST-CONTROLS reads it beside the probes' controls.
- Coupled paths as one mechanism (roadmap #23): pairs of paths (`coupled` in the config: a
  prefix or a glob, a `why`) judged per commit over the pushed range, an offender cured only
  by a later commit touching the counterpart; the ratchet's `change.coupledMissing` probe
  (hard, with controls) for the gate and CI, the Stop hook's check at night, and the
  changelog rule re-expressed on the same mechanism.
- Presets per workspace, composed (roadmap #22): the workspaces of a monorepo read from the
  root's `workspaces` field, a pnpm workspace file or the conventional folders, each detected
  from its own dependencies or named in the config (`workspaces`), gated in its own folder by
  its own preset's steps after the root's, the built-in steps and the ratchet once at the
  root; `init` writes each workspace's preset scripts in its own package; the status screen
  and the report list them. The `docs` preset for a repository at the design stage or
  documents alone, chosen when there is no package and no sources. The status screen moved
  to its own CLI module.
- A stage for the repository (roadmap #21): design, build or run, named in the config
  (`stage`, `init --stage`) or read from the tree (documents alone are design, a deploy
  surface is run); a rule belongs to stages (`stages`) and is n/a at another with the stage
  named; the profile's phases carry their stages (day 0 alone at design, `phasesFor`); the
  report, the gap analysis, the status screen and `explain` carry the stage.
- Rules say where they apply (roadmap #20): `applies`, a predicate over the repository's
  facts (`c.stack`: package, sources, browser application, server, database, catalogues,
  service worker), and `when`, the sentence the catalog prints; where a rule does not apply
  its finding is n/a with the reason, never missing. Thirty-five rules carry one; a
  documents-only repository is read on the documents, the instrument, the harness and
  delivery alone. The rule statements name the practice, the profile names the tools
  (`tools`): the linter, the formatter, the database, the browser suite, CI.
- Profiles (roadmap #19): a standard as a package of rules, phases, presets and harness rule
  files. The 65 rules, the thirteen phases and the four presets become the built-in
  `synovitec` profile; a repository names the profiles it follows (`profiles` in the config: a
  built-in id, a file or an installed package exporting `profile`), its own rules file on
  top; `abatty profiles` lists them; the report and the catalog name them. `validate` moved
  to its own module; `./profiles` is a package export.
- Publishable to the registry (roadmap #17): the package's `repository`, `bugs`, `keywords`
  and `publishConfig` (public, with provenance), `prepublishOnly` running the gate, the
  package's own checks workflow and a release workflow publishing a `vX.Y.Z` tag after the
  gate; a test packs the tarball, installs it in a clean project and runs `init` from it,
  and asserts the tarball carries what the CLI needs and nothing of the repository's own.
  The name `abatty` is free on the registry; the first publish is a human's tag.
- The allowance and the resumable night (roadmap #16): a night's cap in the unit the account
  is billed in, dollars, sessions or tokens (`allowance` in the config, `--max-sessions`,
  `--max-tokens`), any one reached ending the night with the wrap-up not run; the spend
  written to `run.json` after every session, and `--resume` continuing an interrupted night
  counting what it spent, with the canary of that night standing.
- Sandboxed nights (roadmap #15): the OS boundary under the guard, the layer below its text
  match. The runner builds it from `sandbox` in the config (bubblewrap on Linux, `sandbox-exec`
  on macOS, a container image anywhere; `mode` auto, required or off; `--sandbox` for one
  night), keeps the tree, the hooks' log folder and the agent's state writable, mounts the
  harness, the root config and the protected paths read-only and the rest of the machine
  read-only, then proves it with a probe before the first session: a sandbox that does not
  hold refuses the night. The driver is written to `run.json` and the night report.
- Rule-ID namespacing (roadmap #14): a standard ID is `FAMILY.N` with a dot (`CODE.6`,
  `DOC.2`), a namespace of its own that no error code, hash name or third-party identifier
  shares; the hyphen form of the first days is retired across the standard, the rules, the
  templates, the presets and the catalog, `stdIds()` normalises any hyphen citation to the dot
  form, and a test walks the shipped files so the old form cannot return.
- The secret scan and the audit in the gate (roadmap #13): a built-in scanner with no
  dependency (a private key block, a cloud access key id, a provider token, a payment key, a
  chat token, a signed web token, a long literal on a secret-like name; placeholders refused;
  `abatty:allow-secret` on a line, `secrets.allow` by path), one implementation for the
  pre-commit hook (`abatty secrets --staged`, written by `init`), the gate (a built-in step
  over the tree) and CI (the generated pipeline scans the pushed range); the audit as a
  built-in gate step, skipped without a lockfile, deferred loudly when the registry is
  unreachable. The security and CI rules recognise the built-in scan.
- Type declarations generated from the JSDoc (roadmap #12): `npm run types` emits `types/`
  from the sources (buildless stays: `.d.mts` beside the `.mjs`), the package names them
  (`types`, a `types` condition on every export, shipped in `files`), and a test keeps the
  committed folder equal to a fresh emit.
- CI from the gate (roadmap #11, and #26 with it): `abatty ci` generates the pipeline from the
  preset's gate definition for Woodpecker and GitHub Actions - the gate's steps in order, the
  secret scan, the audit, the publish step guarded by the secret, the suites as their own
  pipeline or job - so the gate and CI cannot list different steps; `--check` says when a file
  is behind; `init --ci <provider>` and `ci.providers` write it on day 0; a pull-request
  template with the reviewer's checklist; `--ruleset` prints an organisation ruleset (branch
  names naming a tool refused, a pull request and the checks required), never written. The CI
  rules read both providers' files.
- The dashboard hosted (roadmap #10): `abatty serve`, a self-hosted service with no dependency
  that stores the reports CI posts (`POST /reports`, bearer token, or `--no-auth` for a machine
  nobody else reaches) and serves the dashboard over every repository, an index, one
  repository's readings, a health route and the score as a badge (`/badge/<name>.svg`);
  `abatty publish --to <url>` is the CI step, posting the newest report and measuring first
  when there is none.
- `abatty night-report` (roadmap #9): the learning distillation over a night's evidence - the
  sessions, the Stop gate's receipts and its block log, the guards' denials, the direction
  check, the state file, the decisions, the commits - into proposed lessons in the catalogue's
  shape (a recurring block, a repeated refusal, a crash, a denial storm, a blocked phase, a
  recurring decision, a loosening refused, a failed canary), each with its evidence and the
  check that would catch it; Markdown with front matter, `--json`, `--out`. The Stop gate now
  appends every block to `.claude/night/stop-blocks.jsonl`, since a receipt keeps only the last
  decision and a cured block left no trace by morning.
- The MCP server (roadmap #8): `abatty mcp [dir]`, the Model Context Protocol over stdio,
  hand-written (initialize, ping, tools/list, tools/call; one JSON-RPC message per line), six
  tools scoped to one repository and taking no path - `measure`, `ratchet`, `gate`, `scrub`,
  `report`, `explain` - each returning data, a failing gate or ratchet saying why in its
  result; declared for a night in `.claude/mcp.night.json` and named in `mcpServers` like any
  server; the skill calls the tools when the server is declared.
- The skill in the open agent-skills format (roadmap #7): `templates/skills/adopt-standards/SKILL.md`
  carries name, description, license, compatibility and metadata, and a body that names the
  config, the context file (`CLAUDE.md`, or `AGENTS.md`) and "a skill the agent has" rather
  than one vendor's; every adapter names its skills folder and `init` writes the skill there;
  the harness rule accepts the skill at any adapter's place; a test holds the format's limits.
- The agent adapters (roadmap #6): `src/agents/` describes an agent by its settings folder,
  its context file, its rules folder and format, its hook protocol and the flags of its
  headless mode; three adapters (the harness's own agent, the open `AGENTS.md` convention,
  Cursor with `.mdc` rules); `agents` in the config and `init --agent <id,id>` name a
  repository's adapters, `init` writes `AGENTS.md` (the primary importing it) and the `.mdc`
  rules; `abatty agents` lists the adapters and what a repository loses with the ones it
  named; the runner builds every session's flags from the adapter and refuses a night for a
  repository whose adapters have no hook protocol, naming what is lost; the rules' context
  reads `AGENTS.md` when it is the context file.
- The `astro` preset (roadmap #5), unproven and saying so: pages, layouts, components and
  content under `src/`, `astro check` as the typecheck, the browser suite with axe over the
  built output, no database suite by default; its fixture repository in the tests proves
  detection, init, measure, doctor and the gate's order. Express needs no preset of its own:
  the `node` preset detects it and its fixture already runs on it.
- The root config (roadmap #4): `abatty.config.json` at the repository root is the one config,
  with a JSON Schema the package ships (`schema/abatty.config.schema.json`) and a `$schema` line;
  `abatty config` lists the files, the resolved values and the problems against the schema
  (`--json`, `--migrate` to move the older `.claude/adoption.json` to the root, `--dry-run`);
  `doctor` refuses a config the schema refuses. `init` writes the root file; every reader of the
  package (the rules' context, the ratchet, the scrub, the report, the runner) and every hook
  (`configPath()`), the self-test and the stub read the root file first, the older place still
  read and the root winning key by key. The guard, the file guard, the direction check and the
  runner treat the root config as part of the harness: read-only at night, identical to the base
  or no night.
- `abatty update` (roadmap #3): the harness to the package's version, the repository's edits
  kept - a three-way merge per file against the installed copy (`init` and `update` write
  `.claude/harness.lock.json` with the version and the formatting-blind hash of every shipped
  file, and keep the installed copies under `.abatty/harness/<version>/`); untouched files take
  the new version, files edited while the package did not change them are kept, files both
  changed are merged with `git merge-file`, a conflict leaves `<file>.abatty-new` beside yours;
  `adoption.json` gains the template's new keys and keeps every value set here; the absent
  scripts are added; `--dry-run`, `--force`. `doctor` names the installed version when it is
  not the package's.
- The enforced share (roadmap #29): of the rules a repository has, the part held by a machine
  (hard, ratchet) against the part held by a reviewer or a sentence (review, prose), on the
  status and measure screens, in the report and its JSON, in the dated gap analysis and on the
  dashboard, with the rules to move up next; `abatty rules --enforcement <hard|ratchet|review|prose>`;
  the `adopt-standards` skill records the share and, budget remaining, moves one rule up a
  level per night the way the enforcement map says.
- The license and the standard in the open (roadmap #28): Apache-2.0 (`LICENSE`,
  `package.json`), contributions under a DCO (`CONTRIBUTING.md`); the standard, the adoption
  plan, the enforcement map, the autonomous-adoption protocol, the lessons, the best practices,
  the guides and the research moved into `docs/standard/`, versioned with the package
  (2026.09.15) and shipped in it; the templates and the context-file template point at the
  packaged copy (`node_modules/abatty/docs/standard/...`), never at a sibling checkout.
- `ratchet.citationsExempt`: documents that describe another repository (a standard, a guide)
  are exempt from `docs.citations`; `scrub.allow` is read from `abatty.config.json` too.
- `docs/ROADMAP.md`: items 28 to 30 - the license and the standard in the open, the enforced
  share as the main number, provenance as the default with the scrub as an option - each with
  its evidence and its tier.
- The ratchet in the package (`src/ratchet/`): `abatty ratchet [--range auto] [--json]
  [--controls]` and `abatty baseline [--reason] [--dry-run]`. Probes as data with one function
  (`{ metric, kind, standard, title, why, scan, controls }`), thirteen built in (size by kind
  and the 800 cap, the context file's cap, type escapes, raw env reads, barrels, front matter,
  the index, citations, freshness, dangling source_truth, the changelog over the pushed range),
  each with control cases both ways that the package's test runs. HARD is zero forever, RATCHET
  may only fall per total and per file; zero promotes to HARD, a rise is refused without a
  reason, scanned-zero fails where the baseline saw files. A repository's own probes in
  `abatty.probes.mjs` (validated, controls required); the config under `ratchet` in the
  adoption config or in `abatty.config.json` at the root; a readability score as a trend.
- The presets write `standards: abatty ratchet` and `standards:baseline`; the gate's ratchet
  step now runs. This package holds its own baseline (`scripts/ci/standards-baseline.json`)
  and runs the ratchet in its gate.
- `docs/ROADMAP.md`: the "any project" section - the four facts in the code that stop a
  stranger's repository from a meaningful score, and items 18 to 27 (a root config with nothing
  outside the repository, profiles, an `applies` predicate, a stage, presets per workspace,
  coupled paths, gate steps that prove they can go red, language packs, CI from the gate,
  distribution), each with its evidence and its tier.
- The rule catalog (`src/rules/`): every check as data - ID, family, statement, the standard's
  IDs, must or should, what insures it (hard, ratchet, review, prose), the phase, the reason,
  the check as a pure function of a typed repository context. `abatty measure` runs it; the
  scores of the reference repositories are unchanged (80/100, 29/100).
- `abatty rules [--family] [--level] [--phase] [--json|--md]` and `abatty explain <ID> [dir]`; the
  dated report and the dashboard carry the level and the insurance of every check;
  `docs/CATALOG.md` is the catalog as a document, kept equal by a test.
- A repository's own rules from `abatty.rules.mjs` (validated; a built-in ID is refused) and
  waivers with a reason in `adoption.json` → `rules.waived` (listed, not scored, `until` dated).
- The `adopt-standards` skill reads the catalog: `abatty rules` for the phase's checks, must
  before should, `abatty explain <ID>` before touching a check it does not understand; the
  wrap-up measures with `abatty measure` and never adds a waiver itself.

- Fixture repositories for the `vite-react` and `node` presets in the tests: detection from
  the dependencies, `init`, `measure`, `doctor` in step, the gate skeleton stopping at the
  first missing tool by name. A preset is still proven only by a repository that ran it.

### Changed

- **The first command on the front page is one that works.** The README opened with
  `npm i -D abatty` from "the first tagged release" against a registry that answers 404. It now
  installs from the branch, says the registry package is not published yet, and says what the
  line becomes on the day it is. The publish item in the position document records why.
- **The front page leads with the gate, not the reading** (evidence base C1). The two-minute path
  was install, read, init, gate: it put the report first and the thing that refuses the work
  fourth. It is now install, `init`, **`npm run gate` before every push**, `doctor --controls`,
  and only then the reading, with the reason stated and sourced: the same analysis at the same
  precision reached a near-zero fix rate as a report and above seventy per cent on the change
  under review, so placement beats precision. The hero says what the package does rather than
  what it is, in 54 words against the 150 the position document targets, and the command block
  leads with the four that do the work before the reading and the rest.
- **The headline is the phase the repository is on, not a percentage of the whole catalog.**
  `abatty` and `abatty measure` lead with the earliest phase of the plan that has unfinished
  work and its standing (`phase A.1 · 7 of 9 held`), with the phase's own title under it; the
  score over everything follows as a trend, labelled as one. A fresh application is missing the
  later phases by design: of the rules one was missing on 2026-09-18, six were phase 0 and
  seventeen were phases the plan schedules after it, so the old headline read as a verdict on
  work nobody had been asked to do yet and a healthy day-one project scored 16/100. The report
  JSON and the Markdown report carry the standing per phase, so the dashboard and a reader see
  the same number.
- `docs/POSITION.md`'s scorecard is re-measured after the gate switch: Reliability moves from
  Qualified back to Strong now that `abatty gate` is green on its own package with every step it
  ships, and §2.1 records the defect as fixed rather than open. The Latency row stays a Risk and
  gains the reason: 3 min 22 s is a gate a team learns to start and walk away from.
- Corrected before landing, as with the two documents before it: research 08 claimed two commands
  carry `--json`. Eight document it and seven were verified to emit it; `--plain`, which the
  command-line guide it cites expects, exists nowhere.
- **The ratchet is bidirectional (evidence base C7).** A floor above the value it measures is a
  finding, not a silent pass: the run is red until `abatty baseline` records what was earned, in
  the change that earned it. A one-sided ratchet accepts for free, and for ever, findings that no
  longer exist, and this repository was carrying a floor of 9 on `size.excessCode` against a
  value of 0. `improved` now fails the run and prints as `FLOOR UNLOCKED`. Locking this
  repository's floors in promoted `size.excessCode` and `size.overBudget` to HARD, which is the
  baseline writer's documented behaviour and a deliberate tightening.
- **The package runs its own gate.** `gate` and `gate:fast` were a hand-written chain that ran a
  different list from `abatty gate`, the command the package ships; the chain was green and the
  product was red. They now call `abatty gate`, the vestigial `lint` script for a linter this
  repository has not adopted is gone so the step reports as skipped, and three steps the chain
  never ran are on: the import graph, dead code and the audit. `README.md`'s "one implementation,
  three callers" is true here for the first time.
- **The scrub is a built-in gate step**, skipped where `scrub.enabled` is off and emitted into
  generated CI as well, so the gate and CI cannot list different steps and a repository that
  opted in keeps it whichever way the gate is called. Control cases in all three directions:
  opted out skips, opted in with a trace is red and names the file and line, opted in and clean
  is green.
- **The five standard documents are re-read against the code and dated again.** They carried
  `last_verified: 2026-09-14` while citing sources that moved on 2026-09-15, so `docs.behindCode`
  was red on `origin/main` and the gate could not pass on a push. The read found and corrected:
  five references to the older config path where the root config is what the hooks now resolve;
  a `verify-change` skill the plan listed as installed and `init` has never shipped; and the
  preset rule files being described as "take the ones that apply" where `init` writes every one
  the preset lists whatever the repository depends on, so a project with no ORM receives the ORM
  rules. `AUTONOMOUS_ADOPTION.md` documented the `ADOPTION_CONFIG` pin as a feature; that entry
  now records it as the defect it was. `ENFORCEMENT_MAP.md` records that FLOW.2 claimed Hard
  while the pre-push hook was not executable and nothing ran, and the standard gains the
  invariant that reading found missing: a hook that is wired is not thereby running, which is
  P.1 applied one level up.
- `abatty scrub` scans untracked files too (tracked and untracked-but-not-ignored): a new file
  that names a tool is a finding before it is committed, not after; a test that spelled the
  context file's name with an escaped dot now takes it from the vocabulary's required paths.
- The night runner is one implementation in Node, `abatty night` (roadmap #2), replacing
  `night-run.ps1` and `night-run.sh`: the same pre-flight (self-test, harness identical to the
  base, gate green, canary), the same loop (sessions per phase, a crash retried once, fifteen
  denials an abort, the harness checked before every session, the wrap-up, the push only when
  nothing was loosened), the same files under `.claude/night/`, the same exit codes; JSON in
  and out (no BOM, no locale), the agent called directly (no shell rewriting the prompt).
  `test/night.test.mjs` runs the whole runner with the stub: the happy path, canary only, six
  abort paths, three refusals.
- The harness self-test spelled its no-op gate `node -e process.exit(0)`, which a POSIX shell
  rejects (a subshell in the argument); quoted now, so the self-test and `doctor` are green on
  Linux and macOS. The stub agent answers `--version` with the version the harness requires,
  and the tests hand it to the self-test as the agent on PATH.
- Provenance is the default; the scrub is opt-in (roadmap #30). `scrub.enabled` (off unless
  set) in the adoption config or `abatty.config.json`: the guard refuses a commit, a tag, a
  pull request or an issue that names a tool only where the repository opted in; `abatty scrub
  --message` is a no-op otherwise; the report, the status screen and the dashboard show the
  no-trace figure only where it is on; `FLOW-TRAILER` is n/a otherwise. The opposite option,
  `provenance.trailer`: a disclosure line every unattended commit carries, the guard refusing a
  night commit written without it; the skill writes it. The self-test proves both (default,
  scrub on, provenance on). This package keeps the scrub on for itself.
- The template folder is `templates/harness` and is owned here (no sync from ops-hub any more);
  the context-file template is `agent-context.md.template`; the stub is `stub-agent.*`.
- Every mention of the tools in the package's files was rewritten by the map or by hand (the
  runner's identifiers, the fixtures' server names, the docs' audience values).

- The package, the command and the repository are named **abatty** (`npm i -D github:Synovitec/abatty`, `npx abatty ...`); `@synovitec/standards` and the `standards` command were the working names of the first day.

### Removed

- Ten unused exports the dead-code step named once it ran: six re-exports in
  `src/ratchet/index.mjs` that nothing imported, `countMatches` in `src/core/scrub.mjs`, and the
  `dim`, `italic` and `blue` helpers in `src/ui/term.mjs`. Two knip patterns that matched nothing
  are corrected: a pattern with no matches is the `0 findings across 0 files` this standard
  refuses everywhere else.
- The generated gap analysis and its port script: the checks live here, typed; the one
  `@ts-nocheck` is gone.

- The terminal: a zero-dependency styling layer (colour, glyphs, bars, tables, timings) that
  degrades to plain text in a pipe or CI; `abatty` alone is the repository at a glance (score,
  families, harness, no-trace, nights, next steps); every command prints a scorecard.
- The report: one dated JSON per measurement under `.abatty/reports/` (`abatty report`,
  written by `measure` and `status` too), the shape the status screen and the dashboard read.
- The dashboard: `abatty dashboard [repo ...] --open`, one self-contained page over the reports
  of one or many repositories - a score dial with the 70/90 ticks, families as stacked bars,
  the next steps in plan order, the nights, every check with filters; light and dark; the
  trend once there are two readings.
- `docs/ROADMAP.md`: what changes next and why.

- `abatty scrub`: no trace of the tools in a repository. Scans files, commit messages and pull
  requests; `--fix` rewrites files by a word map that protects the two names the agent requires;
  `--message` is the commit-msg hook; `--history` prints the filter-repo command for an existing
  history. The words are stored reversed in `vocabulary.mjs`; the hooks carry a copy and the
  guard refuses a commit, a tag, a pull request or an issue that names one, day and night. The
  agent's executable is read from `ABATTY_AGENT` or `~/.abatty/config.json`, never from the
  repository. This repository is scanned by its own gate and its own hooks.

### Fixed

- **A rule states the practice; the linter is the repository's choice.** Seven checks read
  `eslint.config.js` and nothing else, so a repository that forbids bare console output with
  oxlint or Biome failed a rule it satisfies, and the instrument said it had not done work it
  had done. The context now reads every linter configuration in the tree (flat and legacy
  ESLint, oxlint, Biome) as one text, and each check knows the names the same rule goes by:
  `no-console` and `suspicious/noConsole` (`OBS-CONSOLE`), the four shape limits against
  `noExcessiveLinesPerFile`, `noExcessiveLinesPerFunction`, `noExcessiveCognitiveComplexity` and
  `useMaxParams` (`CODE-SHAPE`), `no-restricted-imports` and `noRestrictedImports`
  (`CODE-ARCH-IMPORTS`), the a11y plugin and Biome's port of it (`A11Y-LINT`). `CODE-MAXWARN`
  accepts a lint script that runs any of the three, and the flag each one spells differently
  (`--max-warnings=0`, `--error-on-warnings`). Four control cases run the same repository under
  each linter and were watched failing against the old reader before the fix landed.
- **One plan order, the plan's own.** Three places read the phase by taking the first number out
  of it, so `A.1` (day 0) sorted as 1 and the whole of phase 0 was listed ahead of the day-0
  work that blocks it. The order now comes from the profile's declared phases, a rule that names
  two phases (`2 / 10`: installed at 2, driven to target at 10) belongs to the earlier, and a
  phase the plan does not carry sorts last instead of in the middle.
- **A preset's rule files obey `applies` like the catalog's rules do.** `init` wrote every file
  the preset listed whatever the repository depended on, so a React project with no ORM, no
  GraphQL and no component library still received `sequelize.md`, `graphql.md` and `mui.md`:
  one proving repository's stack arriving in every stranger's repository on day one. A rule
  file is now either a practice every repository of that stack owes, which always applies, or
  `{ file, needs }`, which applies only where one of `needs` is a dependency. A skip is reported
  as `n/a` with the dependencies it looked for, never silent.
- `managedFiles` takes the same verdict, so the harness agrees with itself: a rule file that does
  not apply is not managed, `update` does not add it back and `doctor` does not call it missing.
  That was the same leak seen from the other side.
- **The scrub's vocabulary check reads the command per line again.** The guard collapses every
  newline into a space before splitting the result on newlines, so the split returned the whole
  command as one line and `onlyRequiredPaths`, which exists to excuse a line whose only mention
  is the agent's own folder, could never excuse anything. A multi-line commit message was judged
  as a single line and refused for the prose around its one allowed mention. It now splits the
  raw command, with control cases for a multi-line message that is clean and one that names a
  tool on a later line. The single-line case was the only one ever tested.
- **A finding the check turned up: this repository does not run its own gate.** `npm run gate`
  is a hand-written chain, while `abatty gate --fast`, the command the package ships and the
  README calls "one implementation, three callers", goes red here in 3.9 s at the lint step,
  because `init` wrote a `lint` script for eslint and this repository has consciously not
  adopted it. Recorded in `CLAUDE.md` §10 and `docs/POSITION.md` §2.1 as the open decision it
  is: the cure changes what the gate checks, so it is not a correction to make silently.
- **The rule catalog carries each rule's next step.** Without it a rule could change the advice
  it gives and the generated catalog stay byte-identical, so the coupled pair between
  `src/rules/families/` and `docs/CATALOG.md` was refusing a push it could never be cured of.
- **The push guard reads the branch a push targets, not a word in the command.** `-` and `/`
  are word boundaries, so `\bmain\b` matched inside `fix/merge-to-main-1` and `main-nav-rework`
  and the guard refused them as pushes to the base branch. It now takes the last non-flag
  argument and the destination side of a refspec (`HEAD:main`, `:main`), with control cases in
  both directions.
- **git can run the hooks it is given.** `init` wrote `.githooks/pre-commit`, `pre-push` and
  (now) `commit-msg` without the executable bit, and git skips a hook it cannot execute with
  nothing but a hint. The pre-push hook is the gate: on this repository it never ran, which is
  how `origin/main` came to be red on `docs.behindCode` while every push looked clean. `init`
  now sets the bit on disk and in the index, repairs it on a hook it keeps, and the self-test
  refuses a wired hook whose index mode is not 100755.
- **The hooks read the repository's config again.** `init` writes `abatty.config.json` at the
  root and also wired `ADOPTION_CONFIG` at the older place, which `init` does not write, so
  every hook fell back to the template's defaults: the scrub off where the repository had opted
  in, no coupled pairs for the Stop gate, the repository's protected paths replaced by the
  template's, and nothing said so. The pin is gone, `configPath()` decides as it always
  documented, and the self-test now refuses a settings file that pins a path that is not there
  and checks that the hooks read the config it reads.
- **The harness lock records what is installed, not what the package ships.** A file `init`
  kept (the repository already had its own) was recorded at the package's hash, so `update`
  read it as "your edit; the package did not change this file" and never delivered a change to
  it again. A kept file now carries no ancestor, `update` writes the package's version beside
  it, and a file that really was installed keeps its ancestor across a re-run of `init`.
- **The config merges at every depth.** A repository that had set one key of a block lost the
  rest of it, and the harness self-test then failed on the state file it could no longer find.
- **A repository that opted into the scrub passes its own self-test.** The case for the default
  read the repository's config instead of a default one, so opting in failed the harness on the
  night it was installed for.
- **The guard reads flags from argv, not from a heredoc body.** Writing a rule, a README or a
  fixture that names the bypass flags is not an attempt to use them; a quoted argument is still
  argv and is still refused. Both directions are control cases in the self-test.
- **A unit runner is a practice, not a product.** `node --test` ships with Node and needs no
  dependency and no config file; TEST-UNIT read only vitest and jest, so a repository with its
  tests in the tree and green scored missing on having them.
- The test suite is hermetic: it no longer inherits `ADOPTION_CONFIG` from the harness a
  developer installed in this repository, which pointed the fixtures' hooks at a file that was
  not there.
- The next steps of `status` and of the dashboard sorted phase 0 last (a zero read as "no
  phase"); they now sort by the phase's number, must before should within a phase, and the
  status screen names the waived rules and the catalog problems.

## [0.1.0] - 2026-09-14

### Added

- The `abatty` command: `init --stack <next|vite-react|node>` (the harness, the tooling, the
  hook, the scripts and the day-0 documents from the templates and the preset; existing files
  kept, `--force` to overwrite, `--dry-run`), `measure` (the gap analysis as a library: score,
  every check, next steps by phase, the dated report with the standard's front matter), `gate`
  (the path-aware gate ported from paycore_dms's, driven by the preset: format with
  `--end-of-line auto`, lint, typecheck, import graph, dead code, unit tests, ratchet with the
  changelog range, then the suites by path, deferred without Docker), `doctor` (the repository's
  harness self-test and the formatting-blind drift against the shipped templates), `presets`.
- Three presets: `next` (proven by paycore_dms), `vite-react` (Paycore-Task-Manager), `node`
  (not yet proven, said so).
- The templates synced from `ops-hub/engineering/templates` with a test that fails when they
  differ; the gap analysis generated from `ops-hub/engineering/tools/gap-analysis.mjs`.
- Proven on paycore_dms: `measure` reads 80/100 over 63 checks like the ops-hub tool, `gate
  --fast` runs its seven steps green (761 tests), `doctor` reads its Prettier-formatted harness
  as in step.
