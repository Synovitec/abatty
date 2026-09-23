// PreToolUse guard on Bash|PowerShell. Two modes, one script:
//
//   daytime  (ADOPTION_RUN unset)  warns about the risky shapes and DENIES only the three that
//                                  are never right: push to the base branch, force push, --no-verify
//   night    (ADOPTION_RUN=1)      additionally denies anything that leaves the adoption branch,
//                                  rewrites history, deletes outside the tree, destroys data,
//                                  deploys, publishes, or WRITES to the harness (.claude/) or a
//                                  protected path from the shell
//
// A denial is a JSON permissionDecision on stdout (exit 0). "ask" is also a JSON decision; in an
// unattended run an ask becomes a denial, which is the intent. Everything else exits 0 with no
// output and the normal permission flow decides. protect.mjs is the twin for the file tools.

import { homedir } from "node:os";
import { HARNESS_DIR, NIGHT, ROOT_CONFIG, appendLog, currentBranch, decide, git, loadConfig, readEvent } from "./lib.mjs";
import { FORBIDDEN, onlyRequiredPaths } from "./vocabulary.mjs";
import { gitLocation, segmentDirs, shellSegments } from "./shell.mjs";

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
const segments = shellSegments(argv);
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
  if (dir === process.cwd() && !loc.length) return branch;
  return git("-C", dir, ...loc, "rev-parse", "--abbrev-ref", "HEAD") || UNKNOWN;
}
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
    if (/^(-C|-c|--git-dir|--work-tree|--namespace|--config-env)$/.test(a)) i++;
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
if (forcePush || hasFlag(/\bgit push\b[^;&|]*(\s--force\b|\s--force-with-lease\b|\s-[a-zA-Z]*f[a-zA-Z]*\b|\s\+[\w/])/)) {
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
if (bypass || hasFlag(/--no-verify\b|\bgit commit\b[^;&|]*\s-[a-zA-Z]*n[a-zA-Z]*\b/)) {
  deny("Hook bypass (--no-verify) is not a workflow. Make the gate pass instead.");
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
/** The branch a push writes to, from an argument list a shell has already been read off. */
function destinationOf(args, here = branch) {
  const positional = args.filter((a) => !a.startsWith("-"));
  if (positional.length < 3) return here; // `git`, `push`, and nothing said: the upstream
  const spec = positional[positional.length - 1];
  const dest = (spec.includes(":") ? spec.slice(spec.lastIndexOf(":") + 1) : spec).replace(/^refs\/heads\//, "");
  // `HEAD` and its alias `@` are not the name of a branch: git resolves them to the branch you
  // are standing on, so ON the base branch `git push origin HEAD` IS a push to the base. Read
  // as a literal it matched no branch name and the push went through - this hook's own
  // repository, 2026-09-22, by the agent that had just finished closing the two flag holes.
  // `HEAD:main` is unaffected: the destination side is read before this, and it says main.
  return dest === "HEAD" || dest === "@" ? here : dest;
}
/** The old whole-line reading, kept for the segments a shell could not be read off. */
function opaqueTarget() {
  const m = opaqueText.match(/\bgit push\b([^;&|]*)/);
  if (!m) return null;
  const args = [];
  for (const w of m[1].trim().split(/\s+/).filter(Boolean)) {
    if (/^\d*>{1,2}|^<|^&>/.test(w)) break;
    const bare = unquote(w);
    if (bare && !bare.startsWith("-")) args.push(bare);
  }
  // The whole-line reading cannot tell which segment moved the shell: any `cd` makes it unknown.
  const here = dirs.every((d) => d === process.cwd()) ? branch : UNKNOWN;
  return args.length < 2 ? here : destinationOf(["push", ...args], here);
}
// Every destination this command writes to: one per understood `git push`, plus the conservative
// reading of anything that was not understood. A command can carry several.
const targets = [
  // Read from `push` on: git's own `-C <dir>` before it is a location, not an argument, and read
  // as one it made `git -C wt push origin` a push to a branch named origin.
  ...segments.flatMap((s, i) =>
    !s.opaque && s.program === "git" && sub(s.args) === "push"
      ? [destinationOf(s.args.slice(s.args.indexOf("push")), branchAt(i, s.args))]
      : [],
  ),
  // An opaque segment that mentions `push` is read from that word on, so a substitution in
  // command position cannot hide the destination either.
  ...segments.flatMap((s, i) =>
    s.opaque && s.tokens.includes("push")
      ? [destinationOf(s.tokens.slice(s.tokens.indexOf("push")), branchAt(i, s.tokens.slice(s.tokens.indexOf("git") + 1)))]
      : [],
  ),
  hasFlag(/\bgit push\b/) ? opaqueTarget() : null,
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
if (targets.includes(UNKNOWN))
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
  const protectedPaths = [HARNESS_DIR, ROOT_CONFIG, ...(config.protectedPaths || [])];
  const hit = protectedPaths.find((p) => writesTo(cmd, p));
  if (hit) {
    deny(
      hit === HARNESS_DIR || hit === ROOT_CONFIG
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
process.exit(0);

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
