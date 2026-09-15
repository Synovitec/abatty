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
function deny(reason) {
  if (NIGHT) appendLog("guard-denials", { tool: event.tool_name, command: cmd.slice(0, 300), reason });
  decide("deny", reason);
  process.exit(0);
}

// ---- always denied ----------------------------------------------------------------------
if (has(/\bgit push\b.*(\s--force\b|\s-f\b|\s--force-with-lease\b|\s\+[\w/])/)) {
  deny("Force push is never allowed. Rebase onto the remote or make a new commit.");
}
if (has(/--no-verify\b|\bgit commit\b.*\s-n\b/)) {
  deny("Hook bypass (--no-verify) is not a workflow. Make the gate pass instead.");
}
// Provenance is the default: nothing here refuses a commit for naming the agent. A repository
// that opted into the scrub (adoption.json → scrub.enabled, white-label work) has a commit, a
// tag, a pull request or an issue that names the tools refused day and night, before it lands,
// because a commit is the one thing a night cannot rewrite. The words are in vocabulary.mjs; a
// line that only mentions the agent's own paths is not a mention.
const isCommitText = /\bgit commit\b|\bgh pr (create|edit|merge)\b|\bgit tag\b.*-m|\bgh (issue|release) create\b/.test(cmd);
if (config.scrub?.enabled === true && isCommitText) {
  const said = cmd.split(/\r?\n/).find((line) => FORBIDDEN.test(line) && !onlyRequiredPaths(line));
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
const pushesBase =
  has(new RegExp(`\\bgit push\\b.*\\b(${base}|master)\\b`)) ||
  (has(/\bgit push\b/) && !has(/\bgit push\b\s+\S+\s+\S/) && branch === base);
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
