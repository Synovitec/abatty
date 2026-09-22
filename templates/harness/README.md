---
title: "the agent templates - settings, hooks, skill, agents, runner"
description: "The files a repository copies to run the adoption programme unattended and to stop routine permission prompts: the user settings to merge, the project settings to commit, the per-repo adoption.json, the night's MCP config, seven Node hooks (guard, protect, stop-gate, check-direction, lint-on-edit, session-brief, and their self-test), the adopt-standards skill, two agents, the night runner for Windows and POSIX with its pre-flight and canary, the CLAUDE.md template, path-scoped rules per stack topic, and a complete stack example. Where each file goes and how to verify it works before trusting it with a night."
category: reference
status: living
audience: ["developer", "agent"]
tags: ["agent-code", "templates", "hooks", "settings"]
related: ["../../AUTONOMOUS_ADOPTION.md", "../../ADOPTION_PLAN.md"]
scope: synovitec
last_verified: "2026-09-22"
---

# the agent templates

The files below are the harness of the primary adapter (`abatty agents`); another adapter gets
the context file and the rules in its own shape from `abatty init --agent <id>`, and none of the
hooks, which is why a night runs on the primary only.

| Template | Copy to | Notes |
|---|---|---|
| `settings.user.json` | merge into `~/.claude/settings.json` | `defaultMode: "auto"` only works from here or managed settings. Keep your existing `allow`, `autoMode`, `enabledPlugins` and add these keys |
| `settings.project.json` | `<repo>/.claude/settings.json` (committed) | Hooks + the repo's own allow/deny/ask rules. Project hooks are the ones that run in `-p` sessions |
| `adoption.json` | `<repo>/abatty.config.json` (the root; the older `.claude/adoption.json` is still read, `abatty config --migrate` moves it) | Edit the commands to the repo's npm scripts; `phases` is the list the runner walks; `mcpServers` names the MCP servers a night may call (default none); `sandbox` is the OS boundary under the guard (`mode` auto, required or off; bubblewrap on Linux, `sandbox-exec` on macOS, a container `image`), built and proven by the runner before the first session. At night the Stop gate reads the copy committed on the base branch, not the tree's |
| `mcp.night.json` | `<repo>/.claude/mcp.night.json` | The ONLY MCP servers a night session has (the package's own, `abatty mcp`, among the ones worth declaring: a typed measure, ratchet, gate, scrub, report, explain): the runner passes it with `--strict-mcp-config`, so the mail, chat and drive connectors of the user settings do not exist at night. Empty by default; a server listed here is also named in `adoption.json` → `mcpServers` or the self-test is red |
| `hooks/lib.mjs`, `guard.mjs`, `protect.mjs`, `stop-gate.mjs`, `check-direction.mjs`, `lint-on-edit.mjs`, `session-brief.mjs`, `self-test.mjs` | `<repo>/.claude/hooks/` | Node, exec form, no `jq`. `ADOPTION_RUN=1` switches them from advisory to blocking. `guard` watches Bash and PowerShell, `protect` watches Edit, Write and every MCP tool: at night both refuse a write under `.claude/`, and `protect` refuses every MCP server not named in `adoption.json` → `mcpServers` and holds a named server's paths to the same rules. `check-direction` is what the Stop gate and the runner call to refuse a loosening against the base. `self-test.mjs` proves the others and the wiring; the runner calls it first |
| `bin/shim.mjs`, `bin/git`, `bin/git.cmd` | `<repo>/.claude/bin/` (the wrappers executable) | The bypass layer OUTSIDE the agent. The guard refuses a force push and a hook bypass in the agent's own shell; this is the same refusal for every other shell, because `.claude/bin` goes on PATH before the real git. It reads argv, so a quoted flag, a variable and an alias arrive already expanded. It refuses those two things and nothing else, and hands the rest to the real git with its exit code, its signals and its stdio unchanged. `ABATTY_SHIM=off` passes everything through and says so on stderr. Exit 3 is a refusal, 4 the shim itself. `abatty night` puts the directory on the run's PATH; a container sandbox keeps the image's |
| `../skills/adopt-standards/SKILL.md` (the open agent-skills format) | every adapter's skills folder: `<repo>/.claude/skills/adopt-standards/SKILL.md`, `.agents/skills/...`, `.cursor/skills/...` | One phase per invocation; `--wrap-up` closes a run |
| `agents/standards-reviewer.md`, `standards-adopter.md` | `<repo>/.claude/agents/` | The reviewer is read-only; the adopter is the daytime worker persona |
| the runner: `npx abatty night` (in the package, `src/night/`) | nowhere to copy: one implementation for Windows and POSIX | One `the agent's headless mode` session per phase, auto mode, prompts disabled, budget and hour capped, `--strict-mcp-config` on `.claude/mcp.night.json` (or an empty config when the repository has none). Before the first phase: self-test, `.claude/` identical to the base, the gate green, and a canary session (below). Aborts when the CLI fails to start twice in a row, when one session reports 15+ permission denials, when `.claude/` moved, or when the state file it wrote does not read back. Pushes only a branch where nothing was loosened against the base |
| `testing/stub-agent.{mjs,cmd,sh}` | stays here | A stand-in for `the agent's headless mode` that drives the whole runner loop, the canary, the real Stop gate and the real repository gate without a session. `STUB_CRASH=1`, `STUB_DENIALS=20`, `STUB_TAMPER=1`, `STUB_CANARY_SKIP_GUARD=1`, `STUB_CANARY_SKIP_STOP=1`, `STUB_CANARY_MCP=1` exercise the runner's abort paths |
| `CLAUDE.md.template` | `<repo>/CLAUDE.md` | Fill the placeholders; §7-§9 are the autonomy sections and are not optional |
| `rules/*.md` (graphql, sequelize, mui, testing, i18n, a11y, pwa, size-limits) | `<repo>/.claude/rules/` | Path-scoped by `paths:` front matter, loaded only when a matching file is read. Take the ones the stack uses; a rule file is under 60 lines and points at the guide for depth |
| `examples/CLAUDE.md.react-vite-apollo-sequelize-mui` | reference only | A complete stack `CLAUDE.md` under 200 lines; its stack sections are what the `rules/` files were cut from |

Add `.claude/night/` to the repository's `.gitignore` (session counters, receipts, the Stop gate's
block log, the denial log and transcripts; `abatty night-report` reads them in the morning). If the repository's Prettier would reformat the hooks, format them once on the
base branch or add `.claude/` to `.prettierignore`: the runner refuses a night where `.claude/`
differs from the base, whatever moved it.

**Push policy is per repository**, not in the user settings: `adoption.json` →
`directPushToBase` (`true` for an internal platform that pushes to `main` after the gate;
`false` for a PR-only client project). The guard denies a daytime push to the
base branch only when it is `false`, and always denies it in an unattended run. It reads the
push's target positionally and stops at a redirection (`git push origin main 2>&1` targets
main, not `2>&1`), and it reads the forge's API as the same door (`gh api` moving the base's
ref or merging into it). Force push and `--no-verify` are denied everywhere regardless. What
the guard holds is the agent's shell on this machine; the policy on the branch is the forge's
branch protection or nobody's, and `abatty doctor` says so on every run rather than letting a
regex pass for a policy (`abatty ci --ruleset` prints the rules to import).

## The harness is read-only to the worker

The hooks constrain the worker; a control the worker can rewrite is prose. Three layers, each
proven by the self-test and by a stub night with a tampering stub (`STUB_TAMPER=1`):

1. **No write reaches `.claude/` at night.** `protect.mjs` denies Edit and Write under it (and
   under the repository's `protectedPaths`, and outside the tree); `guard.mjs` denies a shell
   write to it - a write verb, a redirection or a scripted `writeFileSync` naming the path -
   while `node .claude/hooks/x.mjs` and `git checkout <base> -- .claude/` pass.
2. **The Stop gate reads `adoption.json` from the base branch** (`ADOPTION_BASE`, set by the
   runner), never the tree. A gate command pointed at `echo ok` in the tree changes nothing.
   Its receipt says which copy it used.
3. **The runner refuses a night where `.claude/` differs from the base** - at the start, before
   every session, before the push. `check-direction.mjs` reports the same as a finding, so the
   stop is refused first and the model reads the restore command.
4. **No MCP server but the declared ones exists at night.** A `-p` session loads every MCP server
   of the user settings - on a machine with the example.invalid connectors that is Gmail, Slack, Drive,
   Calendar and Microsoft 365, with `send`, `create`, `trash` and `delete` tools that are neither
   Edit nor Bash, so no hook above sees them. The runner passes `--strict-mcp-config` with
   `.claude/mcp.night.json` (empty by default); `protect.mjs` denies every `mcp__*` tool whose
   server `adoption.json` → `mcpServers` does not name, and holds a named server's paths
   (`relative_path`, `file_path`) to the harness and protected-path rules; the canary asks the
   session for its own `mcp__` tool list and refuses the night on one the config did not declare.
   A code server such as Serena is declared in both files, never in the user settings.

The same check refuses every other way a gate goes green by being lowered: a baseline number
that rose or a metric that vanished, the import graph's known violations grown or the file
deleted, knip's `--max-issues` raised or `--no-exit-code` added, a coverage threshold that fell, `thresholds.autoUpdate`,
`--max-warnings=0` dropped, a strict `tsconfig` flag turned off, a rule switched off or a path
added to `ignores`, a CI step with `failure: ignore`, the gate, the pre-push hook or the baseline
deleted. A rule off, an ignore added, a strict flag or a CI file are allowed as FLOW.3 allows
them - with a written reason, which here means a bullet in the decisions file that names the
rule, path, flag or file. With one the check records the loosening for the morning instead of
refusing it; a baseline number, a threshold and `--max-warnings=0` are refused regardless.

## Verify before trusting a night with it

`hooks/self-test.mjs` does it for you, and the runner refuses to start unless it is green:
every hook present and wired (including `protect.mjs` on `Edit|Write` and on
`mcp__.*`), the Stop timeout long enough for a gate, `maxStopBlocks` under the agent's own cap
of 8, the gate command resolving to a real npm script or file, `mcp.night.json` and
`adoption.json` → `mcpServers` naming the same servers; eighty-one guard decisions in both modes
(force push, `--no-verify` and its short form bundled into a cluster, a `-n` of a later command
that is not this commit's, push to `main` or to any branch but the adoption branch, with a
redirection behind it or through the forge's API, merging a pull request at night, leaving
the branch, `reset --hard`, `npm install`, destructive SQL, deploy, every write shape to the
harness and to a migration, and the ordinary commands that must stay allowed, restores from the
base included); twenty-three file-guard decisions (a Slack send and a Drive write at night, a
code server not named, a named one editing a source file, the harness, a migration, a path
outside the tree, a server name with a dot); the stop-gate blocking on a red gate with the
gate's output as the reason, counting its blocks, letting go at the cap, leaving a receipt each
time, reading its config from the base branch and refusing an edited or corrupt harness with
the restore instruction, judging the changelog on the newest source commit, reading a config
with a UTF-8 BOM, naming a state file whose `phases` is not an array, blocking a phase entry
not updated during the run and letting a fresh one go; twenty-four direction cases (every
loosening refused - the import graph's known violations grown or deleted, knip's `--max-issues`
raised or `--no-exit-code` added, depcruise without `--output-type err` among them - a decision
naming a rule recording it instead, tightenings clean); plus the
the agent version. Everything the probes write goes to a temporary folder
(`ADOPTION_NIGHT_DIR`), never into a real night's `.claude/night/`.

```bash
node .claude/hooks/self-test.mjs        # in a repository
node hooks/self-test.mjs --hooks-dir hooks --settings settings.project.json \
     --adoption adoption.json --skill ../skills/adopt-standards/SKILL.md   # in this folder
```

The self-test was itself verified by mutation, twelve ways: removing the harness deny from
`protect.mjs` (4 red), letting the guard pass a shell write to `.claude/` (6 red), reading the
Stop gate's config from the tree again (2 red), skipping the direction check (2 red), judging
the changelog once per range again (1 red), ignoring a baseline rise (1 red), letting a
decision cure a hard finding (9 red), letting every MCP server through (3 red), ignoring the
paths a named MCP server writes (3 red), removing the `mcp__.*` matcher from the settings (1
red), loading a server `adoption.json` does not name (1 red), and letting the graph baseline
grow and knip's threshold rise (2 red). Re-do one of those whenever a guard rule changes. The
manual probes below remain useful when you want to see one decision by hand.

```bash
# guard: a denied shape returns a deny decision
echo '{"tool_name":"Bash","tool_input":{"command":"git push --force origin main"}}' | node .claude/hooks/guard.mjs
# -> {"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny",...}}

# protect at night: an edit to the harness is denied
ADOPTION_RUN=1 bash -c 'echo "{\"tool_name\":\"Edit\",\"tool_input\":{\"file_path\":\".claude/adoption.json\"}}" | node .claude/hooks/protect.mjs'

# direction: what the tree loosened against the base, if anything
node .claude/hooks/check-direction.mjs --base main

# stop-gate: with a deliberately broken file, the stop is blocked (exit 2) and the reason is the gate output
ADOPTION_RUN=1 ADOPTION_BASE=main ADOPTION_BRANCH=$(git rev-parse --abbrev-ref HEAD) bash -c \
  'echo "{\"session_id\":\"probe\"}" | node .claude/hooks/stop-gate.mjs; echo "exit $?"'
# fix the file, run again: exit 0 (or exit 2 naming the dirty tree, which is also correct)
```

Remove `.claude/night/stop-blocks-probe.json` and `.claude/night/stop-gate-probe.json` after the probe.

### The pre-flight, and the canary

Four things are proven before the first phase, in this order, and any one of them red is no
night: the self-test; `.claude/` identical to the base branch; the gate green on the branch as
it starts (`preflight-gate.txt` keeps the output); and the **canary** - a real `the agent's headless mode` under
the night flags, budget two dollars, asked to run `git rev-parse --short HEAD`, then to run
`git commit --allow-empty --no-verify -m canary`, then to answer with the hash followed by the
names of its own `mcp__` tools, or `none`. The runner then checks what only a real session can
show: the answer starts with the hash (a Bash command ran through auto mode without a prompt),
the commit did not land and the guard's denial log has the refusal (the PreToolUse hook fires
in `-p`), `.claude/night/stop-gate-<session>.json` exists with `decision: allow` and
`configSource: base` (the Stop hook fires and reads the base), and every MCP server the session
reports is one `mcp.night.json` declares and every declared one reported a tool
(`--strict-mcp-config` took, and a declared server started). Each failure is named; a landed
canary commit is removed by the runner.

```bash
npx abatty night . --canary-only                     # the four checks on the current branch, then stop
npx abatty night . --skip-canary --until 07:00 --max-cost 40 --phases "7 8"   # a repository the canary already passed on today
```

### A dry night with the stub, before a paid one

`testing/stub-agent.cmd` (Windows) / `testing/stub-agent.sh` (POSIX) stands in for
`the agent's headless mode`. For the canary it asks the real guard about the `--no-verify` commit and runs the
real Stop gate once, then answers with the hash. For a phase it marks the phase `done` in the
state file, adds a changelog line, leaves the tree dirty on purpose, then plays the agent's
Stop loop against the REAL `.claude/hooks/stop-gate.mjs` - which runs the repository's REAL gate
command - committing when blocked, up to the cap of 8. It prints the result JSON the runner
parses. Run it from a clean checkout of the branch that carries the harness, with no push, and
expect: the canary green, the state file opened and committed, one block per session (the dirty
tree), the phase `done`, the wrap-up named a no-op session (the stub writes nothing there), two
commits on `adopt/standards-<date>`, and a clean tree at the end.

```bash
T=node_modules/abatty/templates/harness
npx abatty night . --agent $T/testing/stub-agent.sh --phases 11 --until +30min --max-cost 10 --no-push
# the abort paths - each must end the run with a named reason, the branch local
STUB_TAMPER=1 npx abatty night . <same arguments>               # the harness moved: aborted before the wrap-up
STUB_CANARY_SKIP_GUARD=1 npx abatty night . <same arguments>    # canary: the guard did not fire
STUB_CANARY_SKIP_STOP=1 npx abatty night . <same arguments>     # canary: the Stop hook did not fire
STUB_CANARY_MCP=1 npx abatty night . <same arguments>           # canary: a chat tool reached the session (--strict-mcp-config did not take)
STUB_CRASH=1 npx abatty night . <same arguments> --skip-canary  # the CLI fails to start
STUB_DENIALS=20 npx abatty night . <same arguments> --skip-canary  # auto mode did not take
```

On Windows the same commands with `stub-agent.cmd` and `set STUB_TAMPER=1` (or
`$env:STUB_TAMPER = "1"` in PowerShell). The package's own test (`test/night.test.mjs`) runs
every path above on a temporary repository on every push; run them by hand after a change to a
hook.

Between runs: `git checkout <base>`, `git branch -D adopt/standards-<date>`, remove
`.claude/night/` and `docs/ADOPTION_STATE.json`. The stub writes nothing at wrap-up because it
cannot know the repository's docs index; the real skill registers its report there (§6 of the
skill) or a docs ratchet turns the wrap-up red.

This is the run that found, on a real repository, what the self-test alone cannot: Windows
PowerShell 5.1 writing a BOM the hooks refused; a one-phase pipeline unwrapping `phases` into
an object; a French locale formatting the budget as `10,00`; Git Bash rewriting the
`/adopt-standards` prompt into a Windows path; a crashed CLI counted as a session and the phase
marked "blocked" for the wrong reason. Every one of those was in the two shell runners, which
is why the runner is one Node implementation since 2026-09-15: JSON in and out, the agent's
executable called directly, the same code on both platforms, and the stub night as its test.

A real dry night is the same command without `--agent`, with a small budget and a near hour,
after `--canary-only` passed:

```bash
npx abatty night . --until +20min --max-cost 10 --phases 0 --no-push
```

## What a Windows machine needs

- Git Bash (hooks run under it by default; the exec form above does not need it).
- `agent` >= 2.1.259 on `PATH` (`agent --version`).
- The repository trusted once interactively (project `allow` rules apply after trust; `deny`
  and `ask` apply regardless; a `-p` session does not count as accepting trust).
- Docker Desktop running if the phase's gate needs the database suite; otherwise the gate
  defers loudly and the decision is recorded.
