// PreToolUse guard on Bash|PowerShell. Two modes, one script:
//
//   daytime  (ADOPTION_RUN unset)  warns about the risky shapes and DENIES only the three that
//                                  are never right: push to the base branch, force push, --no-verify
///                                  (and its spelling as configuration, core.hooksPath); it ASKS
//                                  before a migration, naming the database host it would reach
//   night    (ADOPTION_RUN=1)      additionally denies anything that leaves the adoption branch,
//                                  rewrites history, deletes outside the tree, destroys data,
//                                  deploys, publishes, or WRITES to the harness (.claude/) or a
//                                  protected path from the shell
//
// A denial is a JSON permissionDecision on stdout (exit 0). "ask" is also a JSON decision; in an
// unattended run an ask becomes a denial, which is the intent. Everything else exits 0 with no
// output and the normal permission flow decides. protect.mjs is the twin for the file tools.

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { GIT_HOOKS_DIRS, HARNESS_DIR, NIGHT, ROOT_CONFIG, appendLog, currentBranch, decide, git, loadConfig, readEvent } from "./lib.mjs";
import { FORBIDDEN, onlyRequiredPaths } from "./vocabulary.mjs";
import { gitLocation, programName, segmentDirs, shellSegments } from "./shell.mjs";

// Fail closed: a crashed PreToolUse hook does not block, so at night an internal error denies.
process.on("uncaughtException", (err) => {
  if (NIGHT) decide("deny", `Unattended run: the guard hit an internal error and refuses by default (${err && err.message ? err.message : err}).`);
  process.exit(0);
});

const event = readEvent();
if (!["Bash", "PowerShell"].includes(event.tool_name)) process.exit(0);

const raw = String(event.tool_input?.command || "");
const cmd = raw.replace(/\s+/g, " ").trim();
if (!cmd) process.exit(0);

const config = loadConfig();
const base = config.baseBranch || "main";
const branch = currentBranch();

const has = (re) => re.test(cmd);
// A heredoc body is stdin, never argv: a flag written inside one is the text of a file being
// written, not a flag of the command writing it. The flag checks read the command with those
// bodies removed, so documenting `--no-verify` in a rule, a README or a test fixture is not an
// attempt to use it. Quoted arguments are NOT removed, because `git commit "--no-verify"` is a
// real bypass; only the body between a heredoc's marker and its terminator goes.
const argv = raw
  .replace(/<<-?\s*(['"]?)([A-Za-z_]\w*)\1[\s\S]*?\n[ \t]*\2\b/g, " ")
  .replace(/\s+/g, " ")
  .trim();
// Five families of hole came from matching a regex against a whole line: a bundled flag, HEAD
// read as a branch name, a redirection token read as a refspec, a quoted branch, a quoted flag.
// Each fix closed one spelling and changed nothing about the odds on the next, because the
// mistake was never the pattern. It was asking a pattern what a command does.
//
// The segments carry what each program was actually asked to do. A segment whose program is
// recognised is read precisely; one that is not is `opaque` and keeps the whole-line treatment.
// That inversion is what makes this safe to ship: a list of WRAPPERS can never be complete
// (sh, bash, eval, xargs are the obvious ones; timeout, nice, stdbuf, sudo, setsid, script and
// find -exec are the ones a list forgets), so the list is of readers that cannot reach a
// program at all, and everything else is conservative by default.
//
// `hasFlag` therefore answers over the opaque segments alone. A flag inside a search pattern is
// no longer this command's, which is what stops the guard refusing honest read-only work and
// teaching its user to route around the thing it exists for. Both the raw and the unquoted form
// are tested, since a quote sits exactly where these patterns anchor a short flag.
const segments = shellSegments(argv, { powershell: event.tool_name === "PowerShell" });
const opaqueText = segments.filter((s) => s.opaque).map((s) => s.raw).join(" ; ");
// The folder each segment runs in: `cd <worktree> && git push` pushes the worktree's branch, not
// the one checked out where this hook runs (shell.mjs). Asked once, here, the branch was another
// checkout's, and a push from a worktree was judged by it in both directions.
const dirs = segmentDirs(segments, process.cwd(), homedir());
/** What a push whose branch cannot be known resolves to: it is refused, never guessed. A branch name holds no space, so this is never one. */
const UNKNOWN = "an unresolved folder";
/** The branch checked out where segment `i` runs, with git's own `-C`/`--git-dir` applied. */
function branchAt(i, args = []) {
  const dir = dirs[i];
  const loc = gitLocation(args);
  if (dir === null || dir === undefined || loc === null) return UNKNOWN;
  // An empty answer (git failing here) is not a branch: judged as one, it named no target, the
  // push produced none, and the night's adoption-branch rule had nothing to refuse.
  if (dir === process.cwd() && !loc.length) return branch || UNKNOWN;
  return git("-C", dir, ...loc, "rev-parse", "--abbrev-ref", "HEAD") || UNKNOWN;
}
/**
 * `git` and the options it takes before its subcommand, as a pattern: a wrapper's text
 * (`sh -c "git -C . push --force"`) is read by pattern, and one that required `git push` side by
 * side let every global option hide the push inside a wrapper.
 */
const GIT = String.raw`\bgit(?:\s+(?:-C|-c|--git-dir|--work-tree|--namespace|--config-env|--attr-source)\s+\S+|\s+-{1,2}[\w-]+(?:=\S+)?)*\s+`;
const hasFlag = (re) => re.test(opaqueText) || re.test(opaqueText.replace(/['"]/g, ""));
/** The argument lists of one program, from the segments that were understood. */
const invocations = (name) => segments.filter((s) => !s.opaque && s.program === name).map((s) => s.args);
// An opaque segment has no trustworthy program, so every token in it is treated as though it
// might be git's. `$(echo git) push --force origin dev` carries no contiguous `git push` for a
// pattern to find, which is why every version through 0.3.3 allowed it: the substitution broke
// the two words apart. Reading the tokens asks the only question that survives that.
const maybeGit = segments.filter((s) => s.opaque).map((s) => s.tokens);
/** A short flag as git reads it: `-fu` carries `-f`, and a long flag is its own token. */
const carries = (args, short, ...longs) =>
  args.some((a) => (/^-[a-zA-Z]+$/.test(a) ? a.slice(1).includes(short) : longs.includes(a)));
/**
 * The git subcommand, past git's own global options and their values. `git -C wt push --force`
 * read `wt` as the subcommand, so the precise reading never saw a push there at all.
 */
const sub = (args) => {
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (/^(-C|-c|--git-dir|--work-tree|--namespace|--config-env|--attr-source|--super-prefix)$/.test(a)) i++;
    else if (!a.startsWith("-") && !/^[A-Za-z_]\w*=/.test(a)) return a;
  }
  return "";
};
function deny(reason) {
  if (NIGHT) appendLog("guard-denials", { tool: event.tool_name, command: cmd.slice(0, 300), reason });
  decide("deny", reason);
  process.exit(0);
}

// ---- always denied ----------------------------------------------------------------------
// A force push, in every spelling git accepts: the long flags, the short one alone or bundled
// into a cluster, and a refspec forced with a leading `+`.
const forces = (a) =>
  carries(a, "f", "--force", "--force-with-lease") || a.some((x) => /^\+[\w/]/.test(x) && !x.startsWith("-"));
const forcePush =
  invocations("git").some((a) => sub(a) === "push" && forces(a)) ||
  maybeGit.some((t) => t.includes("push") && forces(t));
if (forcePush || hasFlag(new RegExp(GIT + String.raw`push\b[^;&|]*(\s--force\b|\s--force-with-lease\b|\s-[a-zA-Z]*f[a-zA-Z]*\b|\s\+[\w/])`))) {
  deny("Force push is never allowed. Rebase onto the remote or make a new commit.");
}
// The short form, read the way the shim beside this hook reads it. Two defects lived in the
// span and in the flag. `.*` ran to the end of the line, so a `-n` belonging to a LATER command
// was read as this commit's: `git commit -m x && sed -n 1p f` was refused, and so was any
// sentence naming `git commit` with an unrelated `-n` behind it (this entry was written by a
// command the guard refused for exactly that). The span now stops at a command separator, as
// the push target's does. And `\s-n\b` could not see a cluster: `-n` bundled as `-nm` bypasses
// the hook exactly as `-n` does, and the boundary after `n` never held, so the one spelling
// somebody reaching for the bypass would type was the one spelling that got through.
const bypasses = (a) => a.includes("--no-verify") || (a.includes("commit") && carries(a, "n"));
const bypass =
  invocations("git").some((a) => a.includes("--no-verify") || (sub(a) === "commit" && carries(a, "n"))) ||
  maybeGit.some(bypasses);
if (bypass || hasFlag(new RegExp(String.raw`--no-verify\b|` + GIT + String.raw`commit\b[^;&|]*\s-[a-zA-Z]*n[a-zA-Z]*\b`))) {
  deny("Hook bypass (--no-verify) is not a workflow. Make the gate pass instead.");
}
// The same bypass by its effect: git runs the hooks from `core.hooksPath`, so pointing it
// elsewhere or unsetting it skips every hook exactly as the flag does, once (`git -c`, the
// GIT_CONFIG_* environment) or for good (`git config`). An adopter replayed five such spellings
// and all passed, from the base branch too. Reading the setting stays allowed, and so does
// pointing it AT the hooks: `abatty hooks` sets it to `.githooks`, husky to `.husky/_`, and a
// first rule that refused every write refused the install command its own message named.
const HOOKS_PATH = /^core\.hookspath\b/i;
/** A folder that holds the hooks: setting the key to one installs them rather than skipping them. */
const HOOKS_HOME = /^(\.\/)?(\.githooks|\.husky(\/_)?)\/?$/;
const bareWord = (v) => String(v).replace(/^["']|["']$/g, "");
// The environment spelling, as an assignment and not as text: a search for it stays a search.
const CONFIG_ENV = /^GIT_CONFIG_(KEY_\d+=["']?core\.hookspath|PARAMETERS=.*core\.hookspath)/i;
/** The `VAR=value` words that lead a segment: the environment its program runs in. */
const assignments = (tokens) => {
  const out = [];
  for (const t of tokens) {
    if (!/^[A-Za-z_]\w*=/.test(t)) break;
    out.push(t);
  }
  return out;
};
const configRead = (a) => a.some((x) => /^(--get(-all|-regexp)?|--list|-l|get|list)$/.test(x));
/**
 * Whether a list of words points the hooks away: `-c` directly followed by the key with a value
 * that is not a hooks folder, `--config-env` naming it, or a `config` that unsets the key or sets
 * it to anything but a hooks folder. The same reading serves a git call the guard understood and
 * an opaque segment, where it is what keeps `bash -c "grep core.hooksPath …"` (bash's own `-c`)
 * and `$(git config core.hooksPath)` (a read) from being refused.
 */
const pointsAway = (t) => {
  for (let i = 0; i < t.length; i++) {
    const x = bareWord(t[i]);
    const next = bareWord(t[i + 1] || "");
    if (x === "-c" && HOOKS_PATH.test(next) && !HOOKS_HOME.test(next.slice(next.indexOf("=") + 1))) return true;
    if (/^--config-env(=core\.hookspath|$)/i.test(x) && (x.includes("=") || HOOKS_PATH.test(next))) return true;
    if (x !== "config") continue;
    const rest = t.slice(i + 1).map(bareWord);
    const at = rest.findIndex((y) => HOOKS_PATH.test(y));
    if (at < 0 || configRead(rest)) continue;
    if (rest.some((y) => /^(--unset(-all)?|unset)$/.test(y))) return true;
    // `git config core.hooksPath` alone reads it; the word after the key is the value it sets.
    const value = rest[at + 1];
    if (value !== undefined && !value.startsWith("-") && !HOOKS_HOME.test(value)) return true;
  }
  return false;
};
// A wrapper's quoted text (`sh -c "git config core.hooksPath /tmp"`) is one word to the segments,
// so it is read by pattern, anchored on git as the other rules' patterns are, and judged by value.
const HOME_AHEAD = String.raw`(?:\.\/)?(?:\.githooks|\.husky(?:\/_)?)\/?(?:\s|["']|\)|$)`;
const HOOKS_TEXT = new RegExp(
  [
    String.raw`\bgit\b[^;&|]*\s-c\s+["']?core\.hookspath=(?!${HOME_AHEAD})`,
    String.raw`\bgit\b[^;&|]*\sconfig\b[^;&|]*\s(?:--unset(?:-all)?|unset)\s+["']?core\.hookspath`,
    String.raw`\bgit\b[^;&|]*\sconfig\b(?:\s+-[\w-]+)*\s+["']?core\.hookspath["']?\s+(?!-|["']?${HOME_AHEAD})\S`,
  ].join("|"),
  "i",
);
const hooksOff =
  invocations("git").some(pointsAway) ||
  maybeGit.some(pointsAway) ||
  hasFlag(HOOKS_TEXT) ||
  segments.some(
    (s) =>
      assignments(s.tokens).some((x) => CONFIG_ENV.test(x)) ||
      (/^(export|env|set|declare)$/.test(s.program) && s.args.some((x) => CONFIG_ENV.test(x))),
  ) ||
  /\$env:GIT_CONFIG_(KEY_\d+|PARAMETERS)\s*=\s*["']?[^;&|]*core\.hookspath/i.test(cmd);
if (hooksOff) {
  deny("Pointing core.hooksPath elsewhere, or unsetting it, skips the hooks exactly as --no-verify does. Make the gate pass instead; reinstall the hooks with the package's hooks command.");
}
// Provenance is the default: nothing here refuses a commit for naming the agent. A repository
// that opted into the scrub (adoption.json → scrub.enabled, white-label work) has a commit, a
// tag, a pull request or an issue that names the tools refused day and night, before it lands,
// because a commit is the one thing a night cannot rewrite. The words are in vocabulary.mjs; a
// line that only mentions the agent's own paths is not a mention.
const isCommitText = /\bgit commit\b|\bgh pr (create|edit|merge)\b|\bgit tag\b.*-m|\bgh (issue|release) create\b/.test(cmd);
if (config.scrub?.enabled === true && isCommitText) {
  // Per LINE of the raw command, not of the collapsed one: `cmd` has had every newline turned
  // into a space, so splitting it on newlines yielded the whole command as a single line and
  // `onlyRequiredPaths` could never excuse anything. A multi-line message whose one mention is
  // the agent's own folder was refused for the other twenty lines around it.
  const said = raw.split(/\r?\n/).find((line) => FORBIDDEN.test(line) && !onlyRequiredPaths(line));
  if (said) deny(`No trace of the tools in a commit, a tag, a pull request or an issue (scrub.enabled): the text names one (${said.trim().slice(0, 80)}). Say it again without the name.`);
}
// The opposite option: a repository that asks for a disclosure trailer (adoption.json →
// provenance.trailer) has every unattended commit carry it; a night commit written without it
// is refused, by day a human decides.
const trailer = typeof config.provenance?.trailer === "string" ? config.provenance.trailer.trim() : "";
if (NIGHT && trailer && /\bgit commit\b.*\s-m\b/.test(cmd) && !cmd.includes(trailer)) {
  deny(`Unattended commits carry the disclosure trailer this repository asks for (provenance.trailer): add "${trailer}" as the last line of the message.`);
}
// Pushing to the base branch is a per-repository policy (adoption.json → directPushToBase):
// an internal platform may push to main after the gate, a client project with an IP transfer
// is PR-only. Unattended runs never push to it, whatever the policy.
// The branch a push TARGETS, not a word that appears in the command: `git push -u origin
// feature/main-nav` pushes nothing to main, and a guard reading the substring refuses a branch
// for its name. `-` and `/` are word boundaries, so \bmain\b matched half the branch names a
// team uses. The target is the last positional argument before any redirection, its destination
// side when it is a refspec (`HEAD:main`, `:main` for a delete); with no refspec the push goes
// to the current branch's upstream, which is the current branch. A redirection is not an
// argument: `git push origin main 2>&1` targets main, and reading `2>&1` as the target was the
// hole that let a push to main through (an outside trial found it in a day).
/**
 * Quotes belong to the shell, not to git: by the time git is handed `"main"` the shell has
 * taken them off, so a target compared with them still attached matches no branch name at all.
 * `git push origin "main"` was allowed by every version up to 0.3.1 for exactly that reason,
 * and quoting a branch name is not a trick somebody has to know, it is ordinary typing. A
 * trailing quote left by a wrapper (`sh -c "git push origin main"`) goes the same way.
 * @param {string} w
 */
const unquote = (w) => w.replace(/^['"]+/, "").replace(/['"]+$/, "");
/**
 * Every branch a push writes to, from an argument list a shell has already been read off (from
 * `push` on). Each refspec after the remote is a destination: reading the last one alone let
 * `git push origin main adopt/x` through a night whose rule is "the adoption branch only", which
 * the version before had refused. `--all` and `--mirror` write every branch, the base among them.
 * A destination the shell computes (`$(...)`, a variable) is unknown, never read as a name.
 * @param {string[]} args @param {string} [here] the branch checked out where the push runs
 * @returns {string[]}
 */
function destinationsOf(args, here = branch || UNKNOWN) {
  if (args.some((a) => /^--(all|mirror|branches)$/.test(a))) return [base];
  const positional = args.filter((a) => !a.startsWith("-"));
  if (positional.length < 3) return [here]; // `push` and a remote at most: the upstream
  return positional.slice(2).map((spec) => {
    if (/[$`]/.test(spec)) return UNKNOWN;
    const dest = (spec.includes(":") ? spec.slice(spec.lastIndexOf(":") + 1) : spec).replace(/^\+/, "").replace(/^refs\/heads\//, "");
    // `HEAD` and its alias `@` are not the name of a branch: git resolves them to the branch you
    // are standing on, so ON the base branch `git push origin HEAD` IS a push to the base. Read
    // as a literal it matched no branch name and the push went through - this hook's own
    // repository, 2026-09-22, by the agent that had just finished closing the two flag holes.
    // `HEAD:main` is unaffected: the destination side is read before this, and it says main.
    return dest === "HEAD" || dest === "@" ? here : dest;
  });
}
/** The index of git in a segment's tokens, whatever path or extension reached it. */
const gitAt = (tokens) => tokens.findIndex((t) => programName(t) === "git");
/**
 * The whole-line reading, kept for the segments a shell could not be read off: each such segment
 * whose text pushes is read where IT runs, so a `cd` before an unrelated command that merely
 * quotes the words (`cd sub && npm test -- -t 'git push'`) is not a push from nowhere.
 */
function opaqueTargets() {
  return segments.flatMap((s, i) => {
    if (!s.opaque) return [];
    const m = s.raw.replace(/['"]/g, " ").match(new RegExp(GIT + String.raw`push\b([^;&|]*)`));
    if (!m) return [];
    const args = [];
    for (const w of String(m[1]).trim().split(/\s+/).filter(Boolean)) {
      if (/^\d*>{1,2}|^<|^&>/.test(w)) break;
      const bare = unquote(w);
      if (bare) args.push(bare);
    }
    const loc = m[0].match(/\s-C\s+(\S+)/);
    return destinationsOf(["push", ...args], branchAt(i, loc ? ["-C", String(loc[1])] : []));
  });
}
// Every destination this command writes to: one per refspec of each understood `git push`,
// plus the conservative reading of anything that was not understood. A command can carry several.
const targets = [
  // Read from `push` on: git's own `-C <dir>` before it is a location, not an argument, and read
  // as one it made `git -C wt push origin` a push to a branch named origin.
  ...segments.flatMap((s, i) =>
    !s.opaque && s.program === "git" && sub(s.args) === "push"
      ? destinationsOf(s.args.slice(s.args.indexOf("push")), branchAt(i, s.args))
      : [],
  ),
  // An opaque segment that mentions `push` is read from that word on, so a substitution in
  // command position cannot hide the destination either.
  ...segments.flatMap((s, i) =>
    s.opaque && s.tokens.includes("push")
      ? destinationsOf(s.tokens.slice(s.tokens.indexOf("push")), branchAt(i, s.tokens.slice(gitAt(s.tokens) + 1)))
      : [],
  ),
  ...opaqueTargets(),
].filter(Boolean);
// A push is not the only write to a branch: the forge's API moves a ref or merges into it
// without git. `gh api` with a write method (or a body flag, which implies POST) to the base's
// ref or to the merges endpoint is the same act by another door. `gh pr merge` is the pull
// request landing, which is what PR-only means, and stays a human's call by day.
const WRITE_METHOD = /^(PATCH|POST|PUT|DELETE)$/i;
const BODY_FLAG = /^(-f|-F|--field|--raw-field|--input)$/;
const apiRefWritePrecise = invocations("gh").some((a) => {
  if (a[0] !== "api") return false;
  const method = a.findIndex((x) => x === "-X" || x === "--method");
  const writes = (method >= 0 && WRITE_METHOD.test(a[method + 1] || "")) || a.some((x) => BODY_FLAG.test(x));
  const path = a.find((x) => x.includes("/") && !x.startsWith("-")) || "";
  return writes && new RegExp(`/(git/refs/heads/(${base}|master)\\b|merges\\b)`).test(path);
});
const apiWrite = /\bgh api\b/.test(opaqueText) && /\s(-X|--method)\s+(PATCH|POST|PUT|DELETE)\b|\s(-f|-F|--field|--raw-field|--input)\b/i.test(opaqueText);
const B = "\\b"; // a word boundary as a string: in a template literal the same two characters are a backspace
const apiRefWrite = apiRefWritePrecise || (apiWrite && new RegExp(B + "gh api" + B + "[^;&|]*/(git/refs/heads/(" + base + "|master)" + B + "|merges" + B + ")").test(opaqueText));
// By the repository's push policy: where a push to the base is allowed by day, the branch a push
// writes to does not matter by day, and refusing it for being unknown was a denial for nothing.
if (targets.includes(UNKNOWN) && (NIGHT || config.directPushToBase !== true))
  deny("This push names no branch and runs in a folder the guard cannot follow (a variable, a subshell, `cd -`), so the branch it writes to is unknown. Name it: git push origin <branch>.");
const pushesBase = targets.some((t) => t === base || t === "master") || apiRefWrite;
if (pushesBase && (NIGHT || config.directPushToBase !== true)) {
  deny(
    NIGHT
      ? `Unattended run: pushing to ${base} is a human act. Push ${process.env.ADOPTION_BRANCH || "the adoption branch"} instead.`
      : `This repository is PR-only on ${base} (adoption.json → directPushToBase). Push the working branch and open a PR.`,
  );
}

// ---- night-only denials -----------------------------------------------------------------
if (NIGHT) {
  const adoption = process.env.ADOPTION_BRANCH || "";
  // Every push goes to the adoption branch or nowhere. The base-branch rule above is not
  // enough: with a base other than main, `git push origin main` slipped through it (caught by
  // the self-test on the first dry run). A bare `git push` is judged by the current branch.
  // Read from the targets above, not from the words `git push`: `git -C wt push origin main`
  // carries no contiguous `git push`, and a pattern for it let every such spelling through.
  const stray = targets.find((t) => t !== adoption);
  if (targets.length && (!adoption || stray !== undefined)) {
    deny(`Unattended run: pushes go to ${adoption || "the adoption branch"} only (this one targets "${stray ?? targets[0]}").`);
  }
  // `git checkout <base> -- <path>` restores a file from the base and stays on the branch; it is
  // how the harness is put back when the direction check names it. Only a checkout WITHOUT the
  // `--` separator leaves the branch.
  const restores = has(/\bgit checkout\s+(\S+\s+)?--\s/);
  const leaves =
    !restores &&
    (has(new RegExp(`\\bgit (checkout|switch)\\s+(-b\\s+\\S+\\s+)?(${base}|master)\\b`)) ||
      (adoption && has(/\bgit (checkout|switch)\s+(?!-)(\S+)/) && !cmd.includes(adoption)));
  if (leaves) {
    deny(`Unattended run: stay on ${adoption || "the adoption branch"}. Switching branches is not allowed.`);
  }
  const rules = [
    [/\bgh pr merge\b|\bgh api\b[^;&|]*\/pulls\/\d+\/merge\b/, "Merging a pull request is a human act; the morning reads the branch."],
    [/\bgit reset\s+--hard\b/, "git reset --hard discards work; revert with a new commit instead."],
    [/\bgit clean\b.*-[a-zA-Z]*f/, "git clean -f deletes untracked work; leave it and record it."],
    [/\bgit branch\s+(-D|--delete --force)\b/, "Force-deleting a branch is not allowed unattended."],
    [/\bgit (rebase|commit --amend|filter-branch|reflog expire)\b/, "History rewriting is not allowed unattended."],
    [/\brm\s+-[a-zA-Z]*r[a-zA-Z]*\s+(\/|~|\.\.|\.git\b|\*|\$HOME)/, "Recursive delete outside or at the root of the tree is not allowed."],
    [/\bRemove-Item\b.*-Recurse\b.*(\\\\|\/|~|\.\.|\.git\b|\*)/, "Recursive delete outside or at the root of the tree is not allowed."],
    [/\b(DROP\s+(DATABASE|TABLE|SCHEMA|ROLE)|TRUNCATE\s+(TABLE\s+)?\w)/i, "Destructive SQL is not allowed unattended."],
    [/\bDELETE\s+FROM\s+\w+\s*(;|$|")/i, "DELETE without a WHERE is not allowed unattended."],
    [/\b(npm|pnpm|yarn)\s+publish\b/, "Publishing is not allowed unattended."],
    [/\b(coolify|deploy|release)\b.*\.(sh|ps1)\b|\bdocker compose\b.*production|\bproduction-deploy\b/i, "Deploying is not allowed unattended."],
    // A package NAME after the verb is a dependency change; a flag (`--frozen-lockfile`) is a
    // lockfile install and stays allowed, as does a bare `npm ci` / `pnpm install`.
    [/\b(npm|pnpm|yarn)\s+(install|add|i|update|upgrade|remove|uninstall)\s+(?!-)\S/, "Dependency changes are deferred to the morning (decision: dependency-deferred). Record the need in docs/ADOPTION_DECISIONS.md."],
    [/\b(sequelize|prisma|drizzle-kit)\b.*\b(migrate|push)\b.*(production|testing|test\.env|\.env\.prod)/i, "A migration against a non-local database is not allowed."],
  ];
  for (const [re, why] of rules) {
    if (has(re)) deny(`Unattended run: ${why}`);
  }
  // A WRITE to the harness or a protected path from the shell: a write verb, a redirection or a
  // scripted write whose segment names the path. Reading, linting, running or restoring it
  // (`node .claude/hooks/x.mjs`, `git checkout <base> -- .claude/`) is not a write and passes.
  const protectedPaths = [HARNESS_DIR, ROOT_CONFIG, ...GIT_HOOKS_DIRS, ...(config.protectedPaths || [])];
  const hit = protectedPaths.find((p) => writesTo(cmd, p));
  if (hit) {
    deny(
      hit === HARNESS_DIR || hit === ROOT_CONFIG || GIT_HOOKS_DIRS.includes(hit)
        ? "Unattended run: the harness (.claude/, abatty.config.json) is read-only tonight. Record the change you need as decision: harness-change; the morning applies it."
        : "Unattended run: that path is protected (applied migrations, env files, production compose). Write the next migration instead of editing one; never touch env files.",
    );
  }
  process.exit(0);
}

// ---- daytime: advisory only -------------------------------------------------------------
const warnings = [
  [/\bgit reset\s+--hard\b/, "git reset --hard discards uncommitted work."],
  [/\bgit clean\b.*-[a-zA-Z]*f/, "git clean -f deletes untracked files."],
  [/\bgit branch\s+-D\b/, "git branch -D skips the merged check."],
  [/\b(DROP\s+(DATABASE|TABLE|SCHEMA)|TRUNCATE\b|DELETE\s+FROM)/i, "Destructive SQL: check the target database."],
];
for (const [re, why] of warnings) {
  if (has(re)) process.stderr.write(`[guard] ${why}\n`);
}
// A migration by day is asked about, naming the database it would reach. By day nothing else
// stood between a migration and a shared database: one from an unmerged branch was applied to
// an adopter's shared database from a shell whose DATABASE_URL nobody had looked at. The host is
// named; the user and the password never are.
// Read with quoted text taken out: a commit message, a search pattern or an echo that names a
// migration command runs none. A script counts when its name is a migration's (db:migrate,
// migrate:deploy), not when it only contains the word (migration:generate, test:migrations).
const MIGRATION = /\b(prisma\s+(migrate\s+(deploy|dev|reset|resolve)|db\s+push)|drizzle-kit\s+(migrate|push)|sequelize(-cli)?\s+db:migrate|knex\s+migrate:(latest|up|down|rollback)|alembic\s+(upgrade|downgrade)|rails\s+db:(migrate|rollback)|manage\.py\s+migrate|flyway\s+migrate|goose\s+(up|down)|(npm|pnpm|yarn|bun)\s+(run\s+)?(db:migrate|db:push|migrate)(:(deploy|dev|up|latest|run|reset|prod))?(?=\s|$))/i;
const unquoted = argv.replace(/"(?:[^"\\]|\\.)*"|'[^']*'/g, " ");
if (MIGRATION.test(unquoted)) decide("ask", `This runs a migration against ${migrationTarget(cmd)}. Is that the database you mean?`);
process.exit(0);

/**
 * Where a migration would go: the DATABASE_URL set on the command itself, else this shell's,
 * else the repository's env files, read for the host alone. Tools disagree on which env file
 * they load (one reads .env alone, a framework reads .env.local first), so when the two files
 * name different hosts both are named. Only a host that reads as one is ever shown: a URL whose
 * credentials sit where a host would (a SQL Server connection string, an opaque URL) is named
 * as unreadable, so the prompt can never carry a password.
 */
function migrationTarget(command) {
  const inline = /\bDATABASE_URL=("[^"]*"|'[^']*'|\S+)/.exec(command)?.[1]?.replace(/^["']|["']$/g, "");
  if (inline) return hostOf(inline, "set on the command");
  if (process.env.DATABASE_URL) return hostOf(process.env.DATABASE_URL, "from this shell's DATABASE_URL");
  const found = [];
  for (const f of [".env.local", ".env"]) {
    try {
      const line = readFileSync(f, "utf8").split(/\r?\n/).find((l) => /^\s*(export\s+)?DATABASE_URL\s*=/.test(l));
      if (line) found.push(hostOf(line.replace(/^\s*(export\s+)?DATABASE_URL\s*=\s*/, "").trim().replace(/^["']|["']$/g, ""), `from ${f}`));
    } catch {}
  }
  if (!found.length) return "a database this command does not name (no DATABASE_URL on it, in this shell, or in .env): check which one the tool reads";
  const hosts = new Set(found.map((x) => x.replace(/ \(from [^)]*\)$/, "")));
  return hosts.size > 1 ? `${found.join(" or ")}, depending on which file the tool loads` : String(found[found.length - 1]);
}

/** A URL's host, port and database name, or "unreadable" when any of them could be a secret. */
function hostOf(url, from) {
  try {
    const u = new URL(url);
    const hierarchical = /^[a-z][\w+.-]*:\/\//i.test(url);
    const host = u.hostname;
    const path = u.pathname && u.pathname !== "/" ? u.pathname : "";
    if (!hierarchical || (host && !/^[\w.-]+$|^\[[0-9a-f:.]+\]$/i.test(host)) || (path && !/^\/[\w.-]+$/.test(path)))
      return `a DATABASE_URL whose host cannot be shown safely (${from}): read it yourself before answering`;
    return `${host || "a local socket"}${u.port ? `:${u.port}` : ""}${path} (${from})`;
  } catch {
    return `a DATABASE_URL that does not parse as a URL (${from})`;
  }
}

/** True when one segment of the command (split on | ; && ||) writes to a path containing `p`. */
function writesTo(command, p) {
  const esc = p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const verb = /(^|\s)(rm|mv|cp|tee|truncate|touch|patch|sed\s+-i\S*|git\s+(rm|mv|apply)|Remove-Item|Move-Item|Copy-Item|Set-Content|Add-Content|Out-File|Clear-Content|New-Item|(npx\s+)?prettier\s+(--write|-w)|(npx\s+)?eslint\s+.*--fix)\b/;
  const redirect = new RegExp(`>{1,2}\\s*["']?[^\\s"'|;&]*${esc}`);
  const scripted = new RegExp(`(writeFile|writeFileSync|appendFile|appendFileSync|WriteAllText|AppendAllText|open\\([^)]*['"][wa])[^;]*${esc}`);
  return command
    .split(/\s*(?:\|\||&&|;|\|)\s*/)
    .some((seg) => (seg.includes(p) && (verb.test(seg) || scripted.test(seg))) || redirect.test(seg));
}
