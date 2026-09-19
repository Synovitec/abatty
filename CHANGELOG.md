# Changelog

Keep a Changelog, SemVer. Every commit that touches source, tests, scripts or docs adds a line
under Unreleased in the same commit.

## [Unreleased]

### Added

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

### Changed

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

### Added

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

### Added

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

### Added

- **The sandbox's threat model is published** (C23), in `docs/standard/AUTONOMOUS_ADOPTION.md` §9.
  A sandbox nobody can describe is a claim, so the document says what the boundary holds, how it
  is proven, and - the part that matters - **what it does not contain**: the network, the
  credentials the environment already holds, whatever the gate allows, the model's own behaviour,
  and the case where `auto` finds no driver and there is no OS boundary at all. A reader can now
  decide whether it is enough for their repository instead of trusting the word "sandbox". The
  closing line is the honest one: run a night on a machine you would be willing to hand to the
  repository it is working on, because for the length of the night that is what you have done.

### Added

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

### Added

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

### Fixed

- **The coupled path for the harness named a folder it does not install into.** `templates/harness/`
  was coupled to `.claude/`, but the context-file template installs to the root as `CLAUDE.md`,
  not into `.claude/` at all - so editing it demanded a change to a folder it never touches, and
  the gate refused a correct push. The coupling is now the four pairs that are actually installs:
  the hooks, the path-scoped rules, the agents and the project settings. A rule that fires where
  nothing is wrong is the same defect as a rule that stays silent where something is.

### Changed

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
  adopter may not have; both now point. 144 lines to 141. The item as written - "ships near-empty"
  - is recorded as withdrawn in the plan with the reason: `DOC-CONTEXT-SECTIONS` requires six
  sections, so a near-empty template would fail the package's own rule the moment `init` wrote it.

### Added

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

### Added

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

### Added

- **The cold start is a number the ratchet holds** (C32). `startup.eagerModules` counts the
  modules the entry point parses before it knows which command was asked for - the floor under
  every command in the inner loop - and it may only fall. It lands at **3**, from 89 before the
  commands were split. The metric is the module graph rather than the milliseconds on purpose: a
  timing belongs to the machine that ran it, and a ratchet on a number that moves on its own is a
  ratchet nobody trusts. Two control cases hold the distinction the whole split depends on: an
  eager graph is counted, and the same graph behind an `await import()` costs nothing.

### Changed

- **The suite is 81 s, from 225 s** (C43, in part). The runner already parallelises files, so the
  suite was never serialised work - it was one file: `night.test.mjs` was 151 s of the 225 s, and
  nothing else could finish before it. It is now three files that run at once, split by what each
  group proves (a night that runs, the aborts and refusals, the spend and the resume), with the
  fixture they share in `test/night-helpers.mjs`. The number to watch is the longest file, now
  70 s. What is left of C43 is the gate's own steps, which still run one after another.

### Added

- **What this change introduced, before what the repository already carried** (C2). The ratchet
  reported every finding in one list, so an author reading a red gate could not tell the two lines
  they added from the four hundred the repository has carried for a year - and a reader who cannot
  tell learns to scroll past both. `abatty ratchet --range` now splits them: a finding in a file
  the range touched is reported first, under `in this change`, and the standing debt is counted
  beside it. The split is named for what it can actually know - touching a file is not the same as
  causing the finding - so `introduced` means the finding sits in a file this change edited.

### Added

- **Every rule says which kind of control it is** (C33). The category has a published vocabulary
  and the catalog did not use it: a **guide** is feedforward and steers the agent before it acts,
  a **sensor** is feedback and observes after, and each is **computational** when a processor
  decides it or **inferential** when a person or a model does. `abatty rules --json` now carries
  both for all 71 rules, derived from the family and the enforcement, and a rule may state its own
  where the derivation is wrong for it. The reading is 56 sensors to 15 guides, 52 computational
  to 19 inferential - honest for a package built around a gate, and now visible rather than
  accidental, which matters because feedback alone produces an agent that repeats its mistakes and
  feedforward alone produces one that never learns whether its rules worked.

### Added

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

### Added

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

### Changed

- **The shell is gone from every spawn site that did not need it** (C42). Eleven sites passed a
  command and an argument array and then handed both to a shell, which only added a layer that
  re-parses quoting, behaves differently on Windows, and sits exactly where a repository's own
  scripts run during an unattended night. What the shell was actually covering is narrower: on
  Windows the node tool launchers are batch files and the bare name does not resolve, so
  `src/core/spawn.mjs` names the launcher instead, which does the same job without handing the
  arguments to a parser. Two sites keep a shell and say why in a comment: the night's pre-flight
  and the Stop hook each run one command string the repository configured, not a command and its
  arguments, and that string comes from the config the hooks trust.

### Fixed

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

### Changed

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

### Added

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

### Fixed

- **A document whose name ends another document's name was invisible to `docs.indexDrift`.** The
  probe asked whether the index text contained the path, so `PLAN.md` read as named because the
  index carries `standard/ADOPTION_PLAN.md`, and the metric reported nothing while the row was
  genuinely absent: a check that cannot see a whole class of its own subject. It now reads the
  paths the index names, each taken whole and bounded at both ends, and carries two control cases
  for exactly this shape, the missing one and the named one. Both were watched failing against the
  substring match before the fix landed.

### Added

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

- **`docs/ROADMAP.md` is archived and points at the plan.** Four of its five tables were empty
  and the one open row split in two: the presets it wanted proven are wave 5 of the plan, and the
  repository outside the company is the position's subject. The 2026-09-15 analysis it carried of
  what stopped a stranger's repository from a meaningful score is left in place rather than
  moved, because three of its four blockers are closed and it describes a repository that no
  longer exists.

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
