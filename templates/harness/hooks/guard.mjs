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

import { HARNESS_DIR, NIGHT, ROOT_CONFIG, appendLog, currentBranch, decide, loadConfig, readEvent } from "./lib.mjs";
import { FORBIDDEN, onlyRequiredPaths } from "./vocabulary.mjs";

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
const hasFlag = (re) => re.test(argv);
function deny(reason) {
  if (NIGHT) appendLog("guard-denials", { tool: event.tool_name, command: cmd.slice(0, 300), reason });
  decide("deny", reason);
  process.exit(0);
}

// ---- always denied ----------------------------------------------------------------------
if (hasFlag(/\bgit push\b.*(\s--force\b|\s-f\b|\s--force-with-lease\b|\s\+[\w/])/)) {
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
if (hasFlag(/--no-verify\b|\bgit commit\b[^;&|]*\s-[a-zA-Z]*n[a-zA-Z]*\b/)) {
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
function pushTarget() {
  const m = argv.match(/\bgit push\b([^;&|]*)/);
  if (!m) return null;
  const words = m[1].trim().split(/\s+/).filter(Boolean);
  const args = [];
  for (const w of words) {
    if (/^\d*>{1,2}|^<|^&>/.test(w)) break; // `>`, `>>`, `2>`, `2>&1`, `&>`, `<`: the shell's, not git's
    if (!w.startsWith("-")) args.push(w);
  }
  if (args.length < 2) return branch;
  const spec = args[args.length - 1];
  return (spec.includes(":") ? spec.slice(spec.lastIndexOf(":") + 1) : spec).replace(/^refs\/heads\//, "");
}
const target = hasFlag(/\bgit push\b/) ? pushTarget() : null;
// A push is not the only write to a branch: the forge's API moves a ref or merges into it
// without git. `gh api` with a write method (or a body flag, which implies POST) to the base's
// ref or to the merges endpoint is the same act by another door. `gh pr merge` is the pull
// request landing, which is what PR-only means, and stays a human's call by day.
const apiWrite = /\bgh api\b/.test(argv) && /\s(-X|--method)\s+(PATCH|POST|PUT|DELETE)\b|\s(-f|-F|--field|--raw-field|--input)\b/i.test(argv);
const B = "\\b"; // a word boundary as a string: in a template literal the same two characters are a backspace
const apiRefWrite = apiWrite && new RegExp(B + "gh api" + B + "[^;&|]*/(git/refs/heads/(" + base + "|master)" + B + "|merges" + B + ")").test(argv);
const pushesBase = target === base || target === "master" || apiRefWrite;
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
  if (has(/\bgit push\b/)) {
    const target = cmd.match(/\bgit push\b(?:\s+-[-\w]+)*\s+\S+\s+([^\s:]+)(?::(\S+))?/);
    const pushed = target ? target[2] || target[1] : branch;
    if (!adoption || pushed !== adoption) {
      deny(`Unattended run: pushes go to ${adoption || "the adoption branch"} only (this one targets "${pushed}").`);
    }
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
