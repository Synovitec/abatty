---
title: "Research 2026-09-13: the agent, AGENTS.md, agent-readable code, JSDoc as context, docs-as-code"
description: "Sourced, rule-shaped practices for the agent and documentation cluster, verified against the agent 2.1.270 docs, with the conflicts and gaps found against the standard and the autonomous-adoption protocol on the day it was written. A dated record; the standard is what was adopted."
category: reference
status: stable
audience: ["architect", "developer", "agent"]
tags: ["research", "agent-code", "agents", "agent-readability", "docs", "adr"]
related: ["../BEST_PRACTICES.md", "../ENGINEERING_STANDARD.md"]
scope: synovitec
last_verified: "2026-09-13"
---

# Research: agents, agent-readable codebases, documentation (2026 practices)

Sources are official docs unless noted. the agent version numbers are quoted where a flag or
field requires one; the corpus reflects the agent up to v2.1.270 (2026-09).

## 1. the agent best practices

### CLAUDE.md and memory

- MUST keep CLAUDE.md under 200 lines; adherence drops as length grows (https://code.claude.com/docs/en/memory).
- MUST write specific, verifiable instructions ("use 2-space indentation") over vague ones ("format code properly") (https://code.claude.com/docs/en/memory).
- SHOULD move a multi-step procedure or single-area instruction to a skill or a path-scoped rule instead of CLAUDE.md (https://code.claude.com/docs/en/memory).
- MUST NOT rely on CLAUDE.md to enforce anything that must run at a fixed point (before commit, after edit) - use a hook instead, since CLAUDE.md is delivered as a user message, not enforced config (https://code.claude.com/docs/en/memory).
- SHOULD use `@path/to/file` to import files into CLAUDE.md; imports still load into context at launch (no context savings), max recursion depth 4 hops (https://code.claude.com/docs/en/memory).
- SHOULD wrap a path in backticks (`` `@README` ``) to mention it without importing it (https://code.claude.com/docs/en/memory).
- MUST expect an approval dialog the first time a project CLAUDE.md imports a file outside the working directory; declining disables that import permanently for the project (https://code.claude.com/docs/en/memory).
- SHOULD create a `CLAUDE.md` that does `@AGENTS.md` (plus the agent-specific additions below it) when a repo already has AGENTS.md, rather than duplicating content; on Windows use the import, not a symlink, since symlinks need admin/dev mode (https://code.claude.com/docs/en/memory).
- SHOULD scope large-project instructions with `.claude/rules/*.md`, one topic per file, and use `paths:` frontmatter (glob) to load a rule only when matching files are opened (https://code.claude.com/docs/en/memory).
- SHOULD periodically review CLAUDE.md, nested CLAUDE.md and rules for contradictions; the agent picks arbitrarily between conflicting rules (https://code.claude.com/docs/en/memory).
- MUST run `/context` to verify a CLAUDE.md actually loaded; MUST use `/doctor` to get proposed trims (cuts derivable content, keeps pitfalls/rationale/conventions) (https://code.claude.com/docs/en/memory, https://code.claude.com/docs/en/best-practices).
- SHOULD include: bash commands the agent can't guess, non-default code-style rules, testing instructions, repo etiquette, project-specific architecture decisions, env quirks, gotchas. SHOULD exclude: anything derivable from reading code, standard conventions, API docs (link instead), frequently-changing info, long tutorials, file-by-file descriptions (https://code.claude.com/docs/en/best-practices).
- SHOULD add emphasis ("IMPORTANT") to exactly the one instruction the agent keeps skipping, not many lines at once - emphasizing everything defeats emphasis (https://code.claude.com/docs/en/best-practices).
- MUST check a checked-in CLAUDE.md into git so the team can maintain it; treat it like code (review, prune, test that behavior actually changes) (https://code.claude.com/docs/en/best-practices).
- Auto memory (the agent's own notes) is a separate system from CLAUDE.md: `~/.claude/projects/<project>/memory/MEMORY.md` is capped at 200 lines/25KB read at session start; topic files load on demand only (https://code.claude.com/docs/en/memory).

### Skills (SKILL.md)

- MUST put `---` as the file's literal first line or the whole file (including `---`) is read as skill body, not frontmatter (https://code.claude.com/docs/en/skills).
- SHOULD keep `description` (plus `when_to_use`) focused on the trigger case; combined they're truncated at 1,536 characters (https://code.claude.com/docs/en/skills).
- SHOULD set `disable-model-invocation: true` for any skill with side effects (deploy, commit, send-message) so it only runs via explicit `/name` (https://code.claude.com/docs/en/skills).
- SHOULD set `context: fork` (with `agent:` naming the subagent type, `background: false` to block for the result) to run a skill's instructions in an isolated subagent rather than the main context (https://code.claude.com/docs/en/skills).
- SHOULD use `allowed-tools` to pre-approve exactly the tools a skill needs for that turn (grant clears next message); use `disallowed-tools` to remove tools while the skill is active (https://code.claude.com/docs/en/skills).
- MUST NOT rely on `disable-model-invocation`, `context`, `agent`, `background`, `shell`, `effort`, `model`, `hooks`, or `paths` for portability outside the agent - these are the agent extensions, not the Agent Skills spec; only `name`, `description`, `allowed-tools`, `license`, `compatibility`, `metadata` are portable (https://code.claude.com/docs/en/skills).
- SHOULD keep SKILL.md body under 500 lines; move reference material to separate files linked from SKILL.md, since every line in SKILL.md is a recurring token cost on every turn it's active (https://code.claude.com/docs/en/skills).
- MAY register `hooks` in a skill's frontmatter; they activate when the skill is invoked and stay active for the rest of the session (https://code.claude.com/docs/en/skills).

### Subagents

- MUST place project subagents at `.claude/agents/<name>.md`, personal ones at `~/.claude/agents/<name>.md`; precedence is managed > `--agents` flag > project > user > plugin (https://code.claude.com/docs/en/sub-agents).
- SHOULD set `tools:` to an explicit allowlist for a subagent doing a narrow job (e.g. review-only: `Read, Grep, Glob, Bash`); use `disallowedTools` to subtract from an inherited pool (https://code.claude.com/docs/en/sub-agents).
- SHOULD set `model: inherit` when a subagent should track the parent's model, or name a family (`sonnet`, `opus`) otherwise; Explore is capped at Opus (https://code.claude.com/docs/en/sub-agents).
- MAY set `permissionMode` (`default`/`acceptEdits`/`auto`/`dontAsk`/`bypassPermissions`/`plan`) but note it is overridden when the parent session is already in `bypassPermissions`, `acceptEdits`, or `auto` (https://code.claude.com/docs/en/sub-agents).
- SHOULD set `memory: project` for a subagent that should accumulate cross-session learning; this auto-enables Read/Write/Edit and preloads the first 200 lines/25KB of its own MEMORY.md (https://code.claude.com/docs/en/sub-agents).
- SHOULD set `isolation: worktree` on a subagent that does mechanical, file-touching work in parallel with others, so it branches into its own git worktree rather than the main checkout (https://code.claude.com/docs/en/sub-agents, https://code.claude.com/docs/en/worktrees).
- SHOULD set `maxTurns` on a subagent doing bounded work so it stops and reports partial output rather than running unbounded (https://code.claude.com/docs/en/sub-agents).
- MUST NOT expect a subagent to see the parent conversation's auto memory; the only exception is `context: fork`, which inherits the parent conversation and system prompt (https://code.claude.com/docs/en/memory).

### Hooks

- MUST use exit code 2 to block on `PreToolUse`, `UserPromptSubmit`, `Stop`, `SubagentStop`, `PreModelSwitch`, `WorktreeCreate`; other events (`PostToolUse`, `PostToolUseFailure`, `SessionEnd`, `PostCompact`) already happened and cannot be undone by exit 2 (https://code.claude.com/docs/en/hooks).
- MUST use `hookSpecificOutput.permissionDecision` (`allow`/`deny`/`ask`) plus `permissionDecisionReason` for structured PreToolUse control instead of relying on exit codes alone (https://code.claude.com/docs/en/hooks).
- MUST NOT try to block `PermissionRequest` with exit code 2; it is ignored there - use the `decision` object (`{value, reason}`) instead (https://code.claude.com/docs/en/hooks).
- SHOULD use a `Stop` hook that exits 2 (with the reason on stderr, since that becomes what the agent reads) to force a red gate to keep the session open until it is green; the agent force-ends the turn after 8 consecutive Stop-hook blocks (https://code.claude.com/docs/en/best-practices, https://code.claude.com/docs/en/hooks).
- MUST write hooks as exec-form Node scripts (`"command": "node", "args": [...]`), not shell shims, for Windows portability; a `.cmd` shim fails in exec form (matches the ops-hub adoption doc's own convention).
- MUST know a project's `.claude/settings.json` hooks do NOT run under `-p` if `--bare` is passed, and DO run under plain `-p` even in an untrusted folder (no trust dialog appears in `-p`) (https://code.claude.com/docs/en/headless, https://code.claude.com/docs/en/permissions).
- SHOULD gate `TeammateIdle`/`TaskCreated`/`TaskCompleted` hooks (exit 2 to block+feedback) to enforce quality gates on agent-team work (https://code.claude.com/docs/en/agent-teams).

### Permissions, permission modes, settings.json

- MUST know rule evaluation order is deny, then ask, then allow, with the first match by that order winning regardless of specificity - a broad `Bash(aws *)` deny blocks even a narrower matching allow (https://code.claude.com/docs/en/permissions).
- MUST know a bare tool-name deny (`"Bash"`) removes the tool from the agent's context entirely (the agent never sees it); a scoped deny (`Bash(rm *)`) leaves the tool available and blocks only matching calls (https://code.claude.com/docs/en/permissions).
- MUST put the wildcard after the subcommand in a Bash/PowerShell rule (`Bash(git log *)` not `Bash(git * main)`), since the agent matches everything before the first `*` literally; the agent warns at startup on a leading-wildcard allow rule (https://code.claude.com/docs/en/permissions).
- MUST treat Bash/PowerShell rules as text-matching, not a security boundary: `Bash(rm *)` in deny does not stop `/bin/rm -rf` or `bash -c 'rm -rf ...'`; use sandboxing for OS-level enforcement, or a PreToolUse hook to inspect full command text (https://code.claude.com/docs/en/permissions).
- MUST write PowerShell rules as `PowerShell(...)`, a distinct namespace from `Bash(...)`; a `Bash(...)` allow rule does not cover PowerShell tool calls, and PowerShell rules resolve common aliases (`gci`/`ls`/`dir` all match `PowerShell(Get-ChildItem *)`) (https://code.claude.com/docs/en/permissions).
- MUST use `Edit(path)`/`Read(path)` for file permission rules, never `Write(path)`/`NotebookEdit(path)`/`Glob(path)` - the agent accepts but never consults a path rule on those tool names and warns at startup (https://code.claude.com/docs/en/permissions).
- SHOULD add `Read(./.env)`, `Read(./.env.*)`, `Read(~/.ssh/**)` to `permissions.deny` as a baseline secret-exclusion (matches AUTONOMOUS_ADOPTION §1.1's own recommendation) (https://code.claude.com/docs/en/permissions).
- MUST know `permissions.defaultMode: "auto"` only takes effect from user or managed settings, never from a project settings file (https://code.claude.com/docs/en/permission-modes, per AUTONOMOUS_ADOPTION.md's own verified note).
- SHOULD use `permissions.ask` for a durable human checkpoint (e.g. `Bash(git push *)`) even under auto mode - a content-scoped ask rule always forces a prompt and the classifier cannot override it (https://code.claude.com/docs/en/auto-mode-config).
- MUST use `Agent(AgentName)` deny rules (or `--disallowedTools`) to disable a specific subagent/built-in agent, e.g. `"deny": ["Agent(Explore)"]` (https://code.claude.com/docs/en/permissions).
- SHOULD set `permissions.disableBypassPermissionsMode` / `permissions.disableAutoMode` to `"disable"` in managed settings to make those modes unavailable org-wide (https://code.claude.com/docs/en/permissions).

### Auto mode and its environment config

- MUST know auto mode is a second gate: deny/ask rules are evaluated first (and always win); the classifier only sees what's left (https://code.claude.com/docs/en/auto-mode-config).
- MUST configure `autoMode.environment` (an array of natural-language prose strings, not regex/tool patterns) to tell the classifier which repos, buckets and domains are trusted - anything unnamed is treated as an exfiltration risk (https://code.claude.com/docs/en/auto-mode-config).
- MUST include the literal string `"$defaults"` in a custom `environment`/`allow`/`soft_deny`/`hard_deny` array to keep the built-in rules; omitting it replaces the whole default list for that section (https://code.claude.com/docs/en/auto-mode-config).
- MUST know `autoMode` is read only from `~/.claude/settings.json`, managed settings, or an inline `--settings`/SDK payload - never from project `.claude/settings.json` or `.claude/settings.local.json`, specifically so a checked-in repo cannot inject its own classifier trust rules (https://code.claude.com/docs/en/auto-mode-config).
- SHOULD run `agent auto-mode config` after any settings change to confirm the effective (expanded) ruleset, and `agent auto-mode critique` to get feedback on custom rules (https://code.claude.com/docs/en/auto-mode-config).
- SHOULD run `/auto-mode-setup` to draft `autoMode.environment` entries from the project's CLAUDE.md, README, git remotes and recent session commands (the agent v2.1.228+; v2.1.233+ on native Windows) (https://code.claude.com/docs/en/auto-mode-config).
- MAY set `autoMode.classifyAllShell: true` (v2.1.193+) to force every Bash/PowerShell command through the classifier even when a narrow allow rule matches, trading latency for coverage (https://code.claude.com/docs/en/auto-mode-config).

### Headless mode (`-p`) and unattended runs

- SHOULD add `--bare` for CI/scripted runs to get reproducible behavior: it skips hooks, skills, custom commands, subagents, plugins, MCP servers, auto memory and CLAUDE.md, and is slated to become `-p`'s default (https://code.claude.com/docs/en/headless).
- MUST set `ANTHROPIC_API_KEY` when using `--bare`, since bare mode does not read OAuth credentials or the system keychain (https://code.claude.com/docs/en/headless).
- MUST pass `--permission-prompts none` (the agent v2.1.259+) for unattended runs: it denies anything that would otherwise prompt a human, tells the agent not to retry, and removes `AskUserQuestion` from the tool set; it does not itself choose what's allowed - permission rules and the active mode still decide first (https://code.claude.com/docs/en/headless).
- SHOULD pair `--permission-mode auto` with `--permission-prompts none` for an unattended run, rather than `dontAsk`, so the classifier still approves ordinary work instead of denying everything off-allowlist (https://code.claude.com/docs/en/headless, matches AUTONOMOUS_ADOPTION.md's own recommendation).
- SHOULD pass `--max-budget-usd <n>` as a hard per-invocation cost ceiling, combinable with `--max-turns` for double protection.
- MUST know `the agent's headless mode` exits 0 on success and non-zero on failure, and prints failures (e.g. missing auth) as the stdout result rather than a nonzero-exit-only signal - branch on exit code, and also parse the result field.
- SHOULD use `--output-format json` to get `total_cost_usd` and a per-model cost breakdown per invocation (client-side estimate, can differ from actual bill) (https://code.claude.com/docs/en/headless).
- MUST know a `-p` run shows no workspace-trust dialog and no per-MCP-server approval prompt, even in a folder never trusted interactively - decide what an unfamiliar repo may do BEFORE running `-p` there: use `--setting-sources user`, `--bare`, or `--settings '{"disableAllHooks": true}'` (https://code.claude.com/docs/en/permissions).
- SHOULD use `--append-system-prompt` for durable behavioral additions in scripted contexts rather than conversational asks, since it's set at launch (https://code.claude.com/docs/en/memory).

### Worktrees, agent teams, workflows

- SHOULD run `agent --worktree <name>` (or `-w`) to isolate a parallel session in `.claude/worktrees/<name>/` on branch `worktree-<name>`; add `.claude/worktrees/` to `.gitignore` (https://code.claude.com/docs/en/worktrees).
- MUST know the agent enforces isolation on a worktree session with 4 checks (blocks edits to the main checkout, blocks commands whose cwd resolves there, blocks git redirects into it, blocks unparseable command shapes) - this enforcement extends to every subagent the isolated session spawns (https://code.claude.com/docs/en/worktrees).
- SHOULD add `isolation: worktree` to a subagent definition doing mechanical multi-file work so each spawn gets its own worktree, avoiding shared-file conflicts by construction (https://code.claude.com/docs/en/worktrees).
- SHOULD add a `.worktreeinclude` file (gitignore syntax) to auto-copy gitignored files (`.env`, secrets) into every new worktree, since a worktree is a fresh checkout (https://code.claude.com/docs/en/worktrees).
- MUST know permission approvals ("don't ask again") and project-scope plugins are SHARED across a repo's worktrees via the main checkout's `.claude/settings.local.json`; the `.git` directory is also shared, so `git commit` inside a worktree writes to the same history (https://code.claude.com/docs/en/worktrees).
- Agent teams (experimental, `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`): one lead session coordinates named teammates that message each other directly and share a task list; teammates do NOT inherit the lead's conversation history, only project context (CLAUDE.md, MCP, skills) (https://code.claude.com/docs/en/agent-teams).
- SHOULD start with 3-5 teammates; token cost scales linearly per teammate and coordination overhead grows past that (https://code.claude.com/docs/en/agent-teams).
- MUST break work by file ownership across teammates - "two teammates editing the same file leads to overwrites" is stated as the explicit failure mode (https://code.claude.com/docs/en/agent-teams).
- SHOULD size tasks so each is a self-contained deliverable (a function, a test file, a review) - too small wastes coordination overhead, too large risks long unattended drift; 5-6 tasks per teammate keeps everyone reassignable (https://code.claude.com/docs/en/agent-teams).
- MUST NOT expect nested teams: teammates cannot spawn their own teammates, only the lead manages the team; there is exactly one team per session (https://code.claude.com/docs/en/agent-teams).
- SHOULD favor lightweight subagents over a full agent team when work doesn't need inter-agent discussion - subagents are strictly cheaper in tokens (https://code.claude.com/docs/en/agent-teams).

### Best-practices article (official, formerly "the agent: best practices for agentic coding")

- MUST give the agent something that produces a pass/fail signal (tests, build exit code, linter, screenshot diff) - without one, "looks done" is the only signal and every mistake waits for a human to notice (https://code.claude.com/docs/en/best-practices).
- SHOULD separate explore -> plan -> implement -> commit into distinct phases via plan mode for any change spanning multiple files or an unfamiliar area; skip planning when the diff could be described in one sentence (https://code.claude.com/docs/en/best-practices).
- SHOULD scope prompts with file references, symptom+location+"what fixed looks like", and pointers to existing patterns rather than vague asks (https://code.claude.com/docs/en/best-practices).
- SHOULD delegate research to subagents to keep the main context clean; subagents run in a separate context window and report a summary back (https://code.claude.com/docs/en/best-practices).
- SHOULD run `/clear` after two failed corrections on the same issue rather than continuing to correct in a polluted context (https://code.claude.com/docs/en/best-practices).
- SHOULD add an adversarial review step: a fresh subagent reviews only the diff and stated criteria (not the reasoning that produced it) and is told to flag only correctness/requirement gaps, not style, to avoid over-engineering churn (https://code.claude.com/docs/en/best-practices).
- MUST recognize and fix 5 named failure patterns: the kitchen-sink session, correcting-over-and-over, the over-specified CLAUDE.md, the trust-then-verify gap, infinite unscoped exploration (https://code.claude.com/docs/en/best-practices).

## 2. AGENTS.md, llms.txt, agent-readable codebases

- SHOULD adopt AGENTS.md as the cross-tool convention (60k+ open-source projects, 20+ tools as of Dec 2025) when a repo must serve more than the agent; the agent itself reads only CLAUDE.md and does not read AGENTS.md directly - it must be imported or symlinked (https://agents.md/, https://code.claude.com/docs/en/memory).
- MUST know AGENTS.md has no required fields, no frontmatter, no special syntax - just markdown headings (https://agents.md/).
- SHOULD place a nested AGENTS.md per package in a monorepo; the closest AGENTS.md to the edited file wins, and an explicit user chat prompt overrides every file (https://agents.md/).
- SHOULD run `/init` (with `AGENTS.md`/`.cursorrules`/`.github/copilot-instructions.md` reading enabled via `CLAUDE_CODE_NEW_INIT=1`) to fold an existing multi-tool instruction file into CLAUDE.md rather than hand-duplicating (https://code.claude.com/docs/en/memory).
- llms.txt (a distinct, separate convention for websites, not repos): MUST place at `/llms.txt` or a docs subpath; file MUST open with an H1 (site/project name, only required section), SHOULD follow with a blockquote summary, MAY have body markdown sections, and MAY have H2-delimited sections that are markdown link lists with optional `: description` (https://llmstxt.org/).
- Note: no AI company has committed to prioritizing llms.txt in practice as of this research; treat it as a low-cost signal, not a guarantee (search result consensus, non-canonical sources).
- agent-readable codebase (no single canonical rubric found; converging practitioner consensus): SHOULD favor explicit types and strict typing (TypeScript strict over untyped JS) - reported to measurably improve AI-assistant output quality; SHOULD keep instruction files in the 50-150 line range; SHOULD regenerate/verify docs from source on every commit rather than hand-maintaining drift (https://tianpan.co/blog/2026-04-13-the-ai-legible-codebase, non-canonical but converges with official CLAUDE.md size guidance).
- The ENGINEERING_STANDARD.md's own AIR.2 (six-axis, ratcheted agent-readability score computed from the ratchet's own metrics) is more rigorous than anything published externally as a named standard; no external canonical rubric of this shape was found - it appears to be this programme's own invention, which is worth stating explicitly rather than implying external provenance.

## 3. JSDoc / TSDoc as agent context

- SHOULD use `@param`, `@returns`/`@return`, `@throws`/`@exception` for machine-checkable signature documentation (https://jsdoc.app/).
- SHOULD use `@example` to give a concrete usage pattern - the highest-value tag for an model reader inferring call-site intent, since it is executable evidence rather than a restated type (https://jsdoc.app/).
- SHOULD use `@deprecated` with a migration pointer rather than deleting a still-referenced export silently (https://jsdoc.app/).
- TSDoc's actual design goal (distinct from JSDoc): a single unambiguous doc-comment SYNTAX so multiple tools (and, by extension, agents) parse the same comment identically - `@param`/`@returns` have consistent behavior across tools, and unsupported custom tags must not corrupt parsing of the rest of the comment (https://tsdoc.org/pages/intro/approach/).
- SHOULD write doc comments that state WHY (the decision, the failure it prevents, the refusal it implements) rather than restating the signature - `@param {string} name` restates a type TypeScript already declares and is the first line to rot; this is exactly ENGINEERING_STANDARD.md CODE.7's own rule, and it is stricter and more specific than either JSDoc's or TSDoc's own published guidance, both of which stop at "document parameters and returns" without saying WHY-not-WHAT.

## 4. Documentation-as-code

- Front matter: SHOULD include `title`, `description` (used for relevance/auto-invocation-style decisions), `category`, `status`, `audience`, `tags`, `related`, `last_reviewed`/`last_verified`, `source_truth` - this is exactly the ENGINEERING_STANDARD.md DOC.2 shape; no single canonical external spec mandates these exact fields, but they are the union of common frontmatter fields (title/description/status/owner/date) reported across docs-as-code tooling (Diataxis-adjacent, docsite generators) (https://diataxis.fr/, cross-referenced against ENGINEERING_STANDARD.md).
- Diataxis: MUST classify every doc as exactly one of tutorial (learning-oriented, hands held), how-to guide (task-oriented, assumes competence), reference (information-oriented, describes the machinery), or explanation (understanding-oriented, discusses why) - mixing modes in one document is the framework's central anti-pattern (https://diataxis.fr/).
- SHOULD map an existing docs tree onto the four Diataxis types explicitly (a docs index that tags each doc by type) rather than organizing purely by feature or team, since the four types answer different reader needs at different moments (https://diataxis.fr/).
- ADR / MADR: SHOULD record each structural decision as `NNNN-title-with-dashes.md` with YAML front matter (`status: proposed|accepted|rejected|deprecated|superseded by ADR-NNNN`, `date`, `decision-makers`, optionally `consulted`/`informed`) plus body sections Context-and-Problem-Statement, Considered-Options, Decision-Outcome, and optionally Decision-Drivers, Consequences, Confirmation (https://adr.github.io/madr/).
- SHOULD supersede rather than edit a decision that changes: mark the old ADR `superseded by ADR-NNNN` and write a new numbered file, mirroring how ENGINEERING_STANDARD.md DOC.1 treats archived docs (`superseded_by`) (https://adr.github.io/madr/).
- Keep a Changelog: MUST group entries under Added/Changed/Deprecated/Removed/Fixed/Security, newest version first, each version release-dated in ISO 8601, and MUST maintain an `[Unreleased]` section for work not yet released (https://keepachangelog.com/en/1.1.0/).
- MUST optimize a changelog entry for the human reader, not for a diff/commit-log dump - "changelogs prioritize human readability over machine parsing" is the spec's own first principle, which is exactly ENGINEERING_STANDARD.md CHANGE.1's "entries are written for the reader, not the committer" (https://keepachangelog.com/en/1.1.0/).
- MUST document every released version, including patch releases, and MUST make versions linkable (https://keepachangelog.com/en/1.1.0/).

## 5. Multi-agent refactoring safety

- MUST give each parallel agent a disjoint territory: the agent's own worktree isolation is enforced at the tool-call level (blocks edits/commands/git-redirects into the main checkout, and rejects any command shape it cannot verify stays inside the worktree) rather than left to agent discipline (https://code.claude.com/docs/en/worktrees).
- MUST assign non-overlapping file ownership when running multiple agents concurrently without worktrees (agent teams) - "two teammates editing the same file leads to overwrites" is the documented failure mode, with no built-in conflict resolution beyond that discipline (https://code.claude.com/docs/en/agent-teams).
- SHOULD use one lead/integrator session that assigns or lets agents self-claim from a single shared task list, synthesizes results, and is the only one that talks to the human - matches ENGINEERING_STANDARD.md's own "standards-reviewer" (read-only, checks the diff) + "worker" split in AUTONOMOUS_ADOPTION.md (https://code.claude.com/docs/en/agent-teams).
- MUST treat a message relayed from one agent to another as untrusted input, never as user consent - a teammate cannot approve another teammate's permission prompt or relay an approval to bypass a check (https://code.claude.com/docs/en/agent-teams).
- SHOULD run a genuinely fresh, independent reviewer (not the implementing agent, and not primed with the implementer's reasoning) against the diff alone, told to report only correctness/requirement gaps - matches "measuring on a clean tree" in spirit: the reviewer's environment/context must not already contain the bias being checked for (https://code.claude.com/docs/en/best-practices).
- MUST clean up worktrees only when they hold no uncommitted/untracked work and no unpushed commits; the agent's own periodic sweep and exit-time prompts encode exactly this "never lose work invisibly" rule (https://code.claude.com/docs/en/worktrees).
- SHOULD hold a lock (`git worktree lock`) for the duration of any agent's occupancy of a worktree so a concurrent cleanup sweep cannot remove it mid-work - this is the general pattern behind "shared-index" conflicts: claim before working, release only after done or abandoned (https://code.claude.com/docs/en/worktrees).
- No independent the vendor-authored guidance on "measuring on a clean tree" for refactor verification was found outside the agent's own docs; the closest published statement of the principle is ENGINEERING_STANDARD.md's own lesson catalogue (Task-Manager: "do not measure while the tree is moving") - this appears to be house-derived, not sourced from an external standard, and should be flagged as such rather than attributed to the vendor.

## Conflicts and gaps versus ENGINEERING_STANDARD.md and AUTONOMOUS_ADOPTION.md

### (a) Claims in those two files that the official docs contradict or have moved past

- AUTONOMOUS_ADOPTION.md §1 states "`permissions.defaultMode: 'auto'` takes effect only from user or managed settings, never from a project file" - this is CONFIRMED, not contradicted, by the current permission-modes doc, but note the doc now also documents `auto` as the Pro/Max/Team **default starting mode for interactive sessions**, not merely an opt-in profile: "On Pro, Max, and Team plans, auto mode is the built-in starting permission mode for interactive terminal and VS Code sessions" (https://code.claude.com/docs/en/best-practices). AUTONOMOUS_ADOPTION.md frames auto mode as something the night runner turns on; on current plans it may already be ON by default in daytime interactive use too, which the document does not mention and should.
- AUTONOMOUS_ADOPTION.md's flag example `--effort high --model opus -n "adopt-phase-7"` combines `--max-budget-usd 25` correctly per current docs, but the doc never mentions `--permission-mode auto`'s official interaction with `autoMode.environment`/`autoMode.classifyAllShell` - a real gap, not a contradiction, addressed in (b).
- Neither file mentions that `.claude/settings.local.json`'s `autoMode` block is explicitly IGNORED by the classifier as of the agent v2.1.207+, specifically to stop a checked-in repo injecting trust rules (https://code.claude.com/docs/en/auto-mode-config). If ecomm's adoption templates ever set `autoMode` in a project-local file expecting it to take effect, it silently would not.
- AUTONOMOUS_ADOPTION.md §1.3 says "If auto mode is unavailable to the session ... the fallback is `--permission-mode dontAsk --allowedTools "<the allow list>"`" - this is consistent with current docs, which additionally clarify `dontAsk` mode still denies `AskUserQuestion` and `requiresUserInteraction` MCP tools even if allowlisted (https://code.claude.com/docs/en/permissions) - a sharper detail AUTONOMOUS_ADOPTION.md should add so the night runner's classifier prompts aren't a silent source of stalls.

### (b) Practices the official docs cover that ecomm's docs lack and should add

- Neither ops-hub doc mentions `autoMode.environment`/`autoMode.allow`/`autoMode.soft_deny`/`autoMode.hard_deny` at all. Since AUTONOMOUS_ADOPTION.md's whole design is an unattended auto-mode night run, this is a real gap: without an `autoMode.environment` block naming ecomm's trusted infra (its own GitHub org, the Woodpecker CI host `ci.synovitec.com`, the Coolify VPS, B2/restic backup target), the classifier will treat pushes to `ci.synovitec.com`-adjacent infra or the backup target as untrusted destinations and may block routine night-run operations that AUTONOMOUS_ADOPTION.md assumes will just work. Recommend adding an `autoMode.environment` block to the templates.
- Neither doc mentions `--permission-prompts none` (the agent v2.1.259+), which is the more precise mechanism for "never ask" than `--permission-mode dontAsk` alone; AUTONOMOUS_ADOPTION.md's night flags example predates or omits it. Recommend adding it alongside `--permission-mode auto` in the night-run flag set, matching the official recipe (https://code.claude.com/docs/en/headless).
- Neither doc mentions `--bare` for the standards-adoption runner. Since the runner already commits to a fully scripted, reproducible flow with explicit `--settings`/`--agents`, `--bare` (skip auto-discovery of hooks/skills/plugins/MCP/auto-memory/CLAUDE.md, load only what's explicitly passed) would remove ambient repo state as a source of "worked on my machine" drift between the night runner and CI - worth evaluating, though it would also require explicitly re-passing every hook/skill the runner currently relies on implicitly (`ADOPTION_CONFIG`, the Stop/PreToolUse hooks), since `--bare` skips exactly those by default.
- ENGINEERING_STANDARD.md §2.5 and AUTONOMOUS_ADOPTION.md describe custom hooks (guard.mjs, stop-gate.mjs) but do not reference the official `hookSpecificOutput.permissionDecision` structured-JSON contract, instead relying on exit codes 0/2 alone. This is not wrong (exit 2 does block), but adding `permissionDecision`/`permissionDecisionReason` JSON output would let the guard hook explain itself to the agent with a proper reason field rather than relying solely on stderr text.
- Neither doc mentions git-worktree-level isolation (`isolation: worktree`, `--worktree`, the four enforced isolation checks) as a mechanism for the "disjoint territories" the multi-agent-refactoring-safety topic asked about. AUTONOMOUS_ADOPTION.md runs its whole night program on ONE branch (`adopt/standards-<date>`) with ONE session at a time; it does not use the agent's own worktree isolation at all, even though the official docs treat worktrees as the primary mechanism for exactly the kind of "many files touched unattended" work the night runner does. If a future revision parallelizes phases, `isolation: worktree` (or `--worktree`) plus its four enforced checks is a stronger guarantee than hoping the phase's own file-list stays disjoint.
- Neither doc mentions `Agent(model:opus)`/`Agent(isolation:worktree)`-style parameter-scoped permission rules (matching on a specific Agent-tool parameter value, not just the tool name) - useful for e.g. denying any agent spawn that requests `bypassPermissions` while still allowing ordinary spawns.
- Neither doc discusses skills' `context: fork` / `agent:` fields as an alternative to the ad hoc "spawn a fork" pattern CLAUDE.md-adjacent skills (like the project's own `verify-change`) might want; worth a follow-up read of `ecomm/.claude/skills/verify-change/SKILL.md` against this field.
- AUTONOMOUS_ADOPTION.md's decision table (§4) has no entry for "the auto-mode classifier denies an action for infrastructure reasons (not a policy reason)" - distinct from "the gate is red for a Docker/network reason." Current docs make this a named, first-class case (`Denied by auto mode classifier`, reviewed via `/permissions` -> Recently denied, or `PermissionDenied` hook) that the decision table should route to "add to `autoMode.environment`, record as `decision: environment-gap`" rather than silently retrying or blocking the phase.
- The AGENTS.md convention (agents.md, Linux-Foundation-stewarded, 60k+ adopters) is absent from both ecomm docs and from ENGINEERING_STANDARD.md's own §2.1 document table. Since ecomm's own CLAUDE.md notes ops-hub as a sibling repo other tools might read, and since the agent explicitly recommends `@AGENTS.md` imports as the cross-tool bridge, ENGINEERING_STANDARD.md §2.1 should consider whether a repo serving multiple agent tools (not just the agent) needs an AGENTS.md that CLAUDE.md imports from, rather than the current implicit assumption that CLAUDE.md is the only entry point.
- llms.txt is absent from both files and is arguably out of scope (it targets public websites, not private admin-panel repos like ecomm) - flagged as a considered-and-excluded item rather than a gap.

### (c) What ecomm's/ops-hub's own docs already cover at or beyond the published standard

- ENGINEERING_STANDARD.md CODE.7's "the block names WHY, not the signature, and the fixer is disabled so an empty `/** */` can't satisfy the rule" is stricter and more specific than either JSDoc's or TSDoc's own published guidance, both of which stop at "these tags exist" without mandating WHY-content or banning auto-generated empty blocks.
- ENGINEERING_STANDARD.md DOC.2's front matter (with `source_truth`, `last_verified` tied to file citations, and DOC.5's diff-based - not calendar-based - freshness check) is more rigorous than Diataxis (which is silent on front matter entirely) or any of the generic "docs freshness" guidance found; no external doc-freshness standard ties staleness to a specific enumerated `source_truth` file list the way DOC.5 does.
- ENGINEERING_STANDARD.md P.1 ("a guard nobody has watched fail is not a guard," verified by reintroducing the defect) and P.6 ("encode the property, not the shape of the last defect") have no counterpart in any of the five researched official-doc topic clusters; the vendor's own docs describe hooks and gates mechanically but never state a verification-of-the-verifier principle. This is a genuine advance ecomm/ops-hub already has that the external corpus does not.
- AUTONOMOUS_ADOPTION.md's decision table (§4, pre-answering every question an unattended agent would otherwise ask) has no direct counterpart in the agent's own docs, which describe the mechanisms (hooks, auto mode, `--permission-prompts none`) but not a pattern for encoding an organization's own judgment calls ahead of a run. This is consistent with, and a genuine specialization of, the official guidance rather than a gap.
- Agent teams' officially documented `isolation: worktree` / file-ownership discipline (§1, §5 above) is exactly the mechanism ENGINEERING_STANDARD.md's multi-agent lessons (not yet written as of this research) would want to cite; ecomm's own worktree usage for `verify-change` and its check-invariants scripts already assumes single-agent-at-a-time, so there is nothing to reconcile today, but a future multi-agent ecomm workflow should adopt `isolation: worktree` explicitly rather than re-deriving file-ownership discipline from scratch.
