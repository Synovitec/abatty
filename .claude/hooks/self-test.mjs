// Proves the harness before it is trusted with a night. "A guard nobody has watched fail is
// not a guard" applies to the guards themselves: this runs the guard, the file guard, the
// direction check and the stop-gate against known inputs in both modes and asserts the decision,
// checks the wiring in settings.json and adoption.json, and checks the the agent version
// supports the flags the runner passes.
//
//   node .claude/hooks/self-test.mjs                       from the repository root
//   node hooks/self-test.mjs --hooks-dir hooks \
//        --settings settings.project.json --adoption adoption.json   (inside the templates)
//
// Exit 1 on any failure. The night runner calls this first and refuses to start on red. Every
// counter, receipt and log the probes write goes to a temporary folder (ADOPTION_NIGHT_DIR), never
// into a real night's .claude/night/.

import { execFileSync, spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { availableParallelism, cpus, homedir, tmpdir } from "node:os";
import { agentCommand, configPath } from "./lib.mjs";
import { sampleTrailer } from "./vocabulary.mjs";
import { dirname, join, resolve } from "node:path";

const args = process.argv.slice(2);
// Same BOM tolerance as lib.mjs, without importing it: the self-test must still report when
// lib.mjs itself is broken.
const readJson = (p) => {
  const text = readFileSync(p, "utf8");
  return JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
};
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const HOOKS = opt("--hooks-dir", ".claude/hooks");
const SETTINGS = opt("--settings", ".claude/settings.json");
const ADOPTION = opt("--adoption", existsSync("abatty.config.json") ? "abatty.config.json" : ".claude/adoption.json");
const SKILL = opt("--skill", ".claude/skills/adopt-standards/SKILL.md");
const MCP_NIGHT = opt("--mcp", join(dirname(SETTINGS), "mcp.night.json"));
const HOOKS_ABS = resolve(HOOKS);

let failures = 0;
function check(name, ok, detail = "") {
  process.stdout.write(`${ok ? "  ok  " : "  FAIL"} ${name}${detail ? " · " + detail : ""}\n`);
  if (!ok) failures++;
}

const tmp = mkdtempSync(join(tmpdir(), "harness-"));
const nightDir = join(tmp, "night");
// The cases assume the base branch is PR-only. A repository that allows a direct push to it
// (directPushToBase: true) is right to, and its own config made ten of these cases fail: they
// run against its config with that one key set as they assume, and one case proves its setting.
const ownConfig = (() => {
  try {
    return readJson(ADOPTION);
  } catch {
    return {};
  }
})();
const policyCfg = join(tmp, "policy.json");
writeFileSync(policyCfg, JSON.stringify({ ...ownConfig, directPushToBase: false }));
const directCfg = join(tmp, "direct.json");
writeFileSync(directCfg, JSON.stringify({ ...ownConfig, directPushToBase: true }));
const baseEnv = { ADOPTION_RUN: "", ADOPTION_BRANCH: "", ADOPTION_PHASE: "", ADOPTION_BASE: "", ADOPTION_NIGHT_DIR: nightDir, ADOPTION_CONFIG: policyCfg };

/** Run a hook with an event on stdin and an environment; returns { code, stdout, stderr }. */
function hook(file, event, env = {}, cwd = process.cwd()) {
  const r = spawnSync(process.execPath, [join(HOOKS_ABS, file)], {
    cwd,
    input: JSON.stringify(event),
    encoding: "utf8",
    env: { ...process.env, ...baseEnv, ...env },
  });
  return { code: r.status, stdout: r.stdout || "", stderr: r.stderr || "" };
}
/**
 * The same, without waiting: the guard and file-guard cases are two hundred independent runs of
 * one hook, and run one after another they were most of doctor's thirty seconds on Windows, where
 * starting a process costs about a tenth of a second. They run a few at a time instead, as many
 * as the machine has cores, and are reported in the order they are written.
 */
function hookAsync(file, event, env = {}, cwd = process.cwd()) {
  return new Promise((done) => {
    const child = spawn(process.execPath, [join(HOOKS_ABS, file)], { cwd, env: { ...process.env, ...baseEnv, ...env } });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (e) => done({ code: -1, stdout, stderr: stderr + String(e) }));
    child.on("close", (code) => done({ code, stdout, stderr }));
    child.stdin.end(JSON.stringify(event));
  });
}
/** Run `fn` over `items`, `width` at a time; the results in the items' order. */
async function pooled(items, fn) {
  const width = Math.max(2, Math.min(8, typeof availableParallelism === "function" ? availableParallelism() : cpus().length));
  const out = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: width }, worker));
  return out;
}
const decisionOf = (r) => {
  try {
    return JSON.parse(r.stdout).hookSpecificOutput?.permissionDecision ?? "none";
  } catch {
    return "none";
  }
};
const bash = (command) => ({ tool_name: "Bash", tool_input: { command } });
/**
 * A throwaway repository standing on a named branch, for the cases whose answer depends on it.
 * The commit is not decoration: `rev-parse --abbrev-ref HEAD` cannot name a branch that no
 * commit has reached, so without it the guard reads an empty branch and every case passes for
 * the wrong reason.
 */
function repoOnBranch(name, branch) {
  const dir = join(tmp, name);
  mkdirSync(dir, { recursive: true });
  const git = (...args) => spawnSync("git", args, { cwd: dir, stdio: "ignore" });
  git("init", "-q", "-b", branch);
  git("config", "user.email", "selftest@example.com");
  git("config", "user.name", "Self test");
  git("commit", "-q", "--allow-empty", "--no-gpg-sign", "-m", "init");
  return dir;
}
const edit = (file_path, tool_name = "Edit") => ({ tool_name, tool_input: { file_path } });
const night = { ADOPTION_RUN: "1", ADOPTION_BRANCH: "adopt/standards-selftest", ADOPTION_PHASE: "0" };
const oneLine = (s) => String(s).replace(/\s+/g, " ").slice(0, 120);

process.stdout.write("\nHarness self-test\n\n");

try {
  // ---- 1. files and wiring ------------------------------------------------------------------
  for (const f of ["lib.mjs", "shell.mjs", "vocabulary.mjs", "guard.mjs", "protect.mjs", "stop-gate.mjs", "check-direction.mjs", "session-brief.mjs", "lint-on-edit.mjs"]) {
    check(`hook present: ${f}`, existsSync(join(HOOKS, f)));
  }
  check(`skill present: ${SKILL}`, existsSync(SKILL));
  let settings = null;
  try {
    settings = readJson(SETTINGS);
    check(`settings parse: ${SETTINGS}`, true);
  } catch (e) {
    check(`settings parse: ${SETTINGS}`, false, e.message);
  }
  if (settings) {
    const matchers = (event, script) => (settings.hooks?.[event] || []).filter((m) => (m.hooks || []).some((h) => (h.args || []).join(" ").includes(script) || String(h.command || "").includes(script)));
    const wired = (event, script) => matchers(event, script).length > 0;
    check("settings wires PreToolUse → guard.mjs", wired("PreToolUse", "guard.mjs"));
    check("settings wires PreToolUse Edit|Write → protect.mjs", matchers("PreToolUse", "protect.mjs").some((m) => /Edit/.test(m.matcher || "") && /Write/.test(m.matcher || "")), `matcher: ${matchers("PreToolUse", "protect.mjs").map((m) => m.matcher).join(", ") || "none"}`);
    // An MCP tool is neither Edit nor Bash: without this matcher a server loaded at night (a
    // connector from the user settings, a code server) writes and sends with no hook watching.
    const mcpMatcher = matchers("PreToolUse", "protect.mjs").find((m) => { try { return new RegExp(m.matcher || "").test("mcp__serena__replace_content"); } catch { return false; } });
    check("settings wires PreToolUse mcp__* → protect.mjs", Boolean(mcpMatcher), `matcher: ${matchers("PreToolUse", "protect.mjs").map((m) => m.matcher).join(", ") || "none"}`);
    check("settings wires Stop → stop-gate.mjs", wired("Stop", "stop-gate.mjs"));
    check("settings wires SessionStart → session-brief.mjs", wired("SessionStart", "session-brief.mjs"));
    // The hook as the settings spell it, either way: `args` beside `command`, or the whole line in
    // `command` (`cd` into the project folder `&& node .claude/hooks/stop-gate.mjs`). Reading only the
    // first failed a harness written the second way.
    const stopTimeout = (settings.hooks?.Stop || []).flatMap((m) => m.hooks || []).find((h) => [h.command, ...(h.args || [])].join(" ").includes("stop-gate"))?.timeout;
    check("Stop hook timeout is long enough for a gate (>= 600s)", (stopTimeout ?? 0) >= 600, `timeout=${stopTimeout}`);
    // The hooks read the config through lib.mjs; this file resolves it its own way. When the two
    // disagree the hooks quietly run on defaults: no scrub, no coupled pairs, the repository's
    // protected paths replaced by the template's, and nothing says so. settings.json pinning
    // ADOPTION_CONFIG at a file init does not write was exactly that, and it was invisible here
    // because the self-test read the right file while every hook read the wrong one.
    const pinned = settings.env?.ADOPTION_CONFIG;
    check("settings does not pin a config path that does not exist", !pinned || existsSync(pinned), pinned ? `env.ADOPTION_CONFIG=${pinned}` : "not pinned");
    // Only where this file resolved the config the same way a hook does; a run inside the
    // templates folder names its own with --adoption and the two are meant to differ.
    if (args.indexOf("--adoption") < 0)
      check("the hooks read the config this test reads", resolve(configPath()) === resolve(ADOPTION), `hooks: ${configPath()}; here: ${ADOPTION}`);
  }
  // git skips a hook that is not executable and says so only as a hint, so a pre-push hook
  // written 644 means the gate never runs and a red push reads as a green one. The mode git
  // obeys is the one in the index, which is also the one that survives a clone.
  // Not having them installed is a repository's choice (the night has its own Stop gate), so
  // that is said and not failed; a hook that IS wired and that git cannot run is the defect.
  const hooksPath = (spawnSync("git", ["config", "--get", "core.hooksPath"], { encoding: "utf8" }).stdout || "").trim();
  if (!hooksPath) process.stdout.write("  ok   git hooks not installed here (npm run hooks:install)\n");
  if (hooksPath) {
    const indexed = (spawnSync("git", ["ls-files", "-s", "--", hooksPath], { encoding: "utf8" }).stdout || "").trim().split("\n").filter(Boolean);
    for (const line of indexed) {
      const mode = line.slice(0, 6);
      const file = line.split("\t").pop();
      check(`git can run ${file}`, mode === "100755", `mode ${mode}; git update-index --chmod=+x ${file}`);
    }
  }
  let adoption = null;
  try {
    adoption = readJson(ADOPTION);
    check(`adoption parse: ${ADOPTION}`, true);
    check("adoption names a gate command", typeof adoption.commands?.gate === "string" && adoption.commands.gate.length > 0);
    check("adoption names the state file", typeof adoption.files?.state === "string");
    check("adoption maxStopBlocks stays under the agent's own cap of 8", (adoption.maxStopBlocks ?? 6) < 8, `maxStopBlocks=${adoption.maxStopBlocks ?? 6}`);
    // The runner loads mcp.night.json with --strict-mcp-config; protect.mjs allows the servers
    // adoption.json names. A server in one and not the other is either loaded-and-denied on
    // every call or allowed-and-absent: named in both, or in neither.
    const allowedServers = Array.isArray(adoption.mcpServers) ? adoption.mcpServers : [];
    if (existsSync(MCP_NIGHT)) {
      try {
        const loaded = Object.keys(readJson(MCP_NIGHT).mcpServers || {});
        const undeclared = loaded.filter((x) => !allowedServers.includes(x));
        check("mcp.night.json loads only servers adoption.json -> mcpServers names", undeclared.length === 0, `loaded: ${loaded.join(", ") || "none"}; allowed: ${allowedServers.join(", ") || "none"}`);
        const unloaded = allowedServers.filter((x) => !loaded.includes(x));
        check("every server adoption.json allows is loaded by mcp.night.json", unloaded.length === 0, unloaded.length ? `allowed but not loaded: ${unloaded.join(", ")}` : "");
      } catch (e) {
        check(`mcp.night.json parse: ${MCP_NIGHT}`, false, e.message);
      }
    } else {
      check("mcp.night.json absent: the runner loads no MCP server, so adoption.json must allow none", allowedServers.length === 0, allowedServers.length ? `allowed: ${allowedServers.join(", ")}` : "no MCP at night");
    }
    // The gate command must RESOLVE, or the stop-gate blocks on "command not found" until its
    // cap and the whole night is spent on a typo. `npm run x` / `pnpm x` must name a script that
    // exists; `node file` must name a file that exists; anything else is reported, not judged.
    const gateCmd = String(adoption.commands?.gate || "");
    const pkg = existsSync("package.json") ? readJson("package.json") : null;
    let m;
    if (!pkg) {
      check("gate command resolution", true, "no package.json in this folder (templates), skipped");
    } else if ((m = gateCmd.match(/^(?:npm|pnpm|yarn)\s+(?:run\s+)?(?:-s\s+)?([\w:.-]+)/))) {
      check("gate command names an existing npm script", Boolean(pkg.scripts?.[m[1]]), `${gateCmd} -> script "${m[1]}" ${pkg.scripts?.[m[1]] ? "found" : "NOT in package.json"}`);
    } else if ((m = gateCmd.match(/^node\s+(\S+)/))) {
      check("gate command names an existing file", existsSync(m[1]), `${gateCmd}`);
    } else {
      check("gate command is set", gateCmd.length > 0, gateCmd || "empty");
    }
  } catch (e) {
    check(`adoption parse: ${ADOPTION}`, false, e.message);
  }

  // ---- 2. the guard, both directions, both modes ---------------------------------------------
  const cases = [
    ["day: force push", bash("git push --force origin main"), {}, "deny"],
    ["day: --no-verify", bash("git commit --no-verify -m x"), {}, "deny"],
    ["day: ordinary commit", bash("git commit -m 'feat: x'"), {}, "none"],
    ["day: run the gate", bash("npm run gate:fast"), {}, "none"],
    ["day: a migration is asked about, naming the host", bash("DATABASE_URL=postgres://u:p@db.example.com:5432/app npx prisma migrate deploy"), {}, "ask"],
    ["day: a migration script is asked about", bash("pnpm run db:migrate"), {}, "ask"],
    ["day: reading the migration status is not", bash("npx prisma migrate status"), {}, "none"],
    ["day: listing migrations is not", bash("ls prisma/migrations"), {}, "none"],
    ["day: a message that names a migration command is not", bash('git commit -m "fix: prisma migrate deploy in CI"'), {}, "none"],
    ["day: a script that only generates a migration is not", bash("pnpm migration:generate"), {}, "none"],
    ["night: push the adoption branch", bash("git push -u origin adopt/standards-selftest"), night, "none"],
    ["night: push main", bash("git push origin main"), night, "deny"],
    ["night: push another branch", bash("git push origin feat/other"), night, "deny"],
    ["night: push with refspec to another branch", bash("git push origin HEAD:release"), night, "deny"],
    ["night: merging a pull request is a human act", bash("gh pr merge 12 --squash"), night, "deny"],
    ["night: merging through the API is the same act", bash("gh api -X PUT repos/o/r/pulls/12/merge"), night, "deny"],
    ["night: reading a pull request is not merging it", bash("gh pr view 12"), night, "none"],
    ["night: push -u the adoption branch with flags", bash("git push --set-upstream origin adopt/standards-selftest"), night, "none"],
    ["night: checkout main", bash("git checkout main"), night, "deny"],
    ["night: checkout the adoption branch", bash("git checkout adopt/standards-selftest"), night, "none"],
    ["night: reset --hard", bash("git reset --hard HEAD~1"), night, "deny"],
    ["night: npm install <package>", bash("npm install lodash"), night, "deny"],
    ["night: pnpm install --frozen-lockfile", bash("pnpm install --frozen-lockfile"), night, "none"],
    ["night: npm ci", bash("npm ci"), night, "none"],
    ["night: restore one file", bash("git checkout -- src/a.ts"), night, "none"],
    ["night: restore one file from the base", bash("git checkout main -- src/a.ts"), night, "none"],
    ["night: DROP TABLE", bash("psql -c 'DROP TABLE orders'"), night, "deny"],
    ["night: deploy script", bash("bash scripts/deploy/production-deploy.sh"), night, "deny"],
    ["night: lint a file", bash("npx eslint --max-warnings=0 src/a.ts"), night, "none"],
    ["night: redirect into the harness", bash("echo x > .claude/adoption.json"), night, "deny"],
    ["night: sed -i on a hook", bash("sed -i 's/exit 2/exit 0/' .claude/hooks/stop-gate.mjs"), night, "deny"],
    ["night: git rm a harness file", bash("git rm .claude/settings.json"), night, "deny"],
    ["night: scripted write to a stop counter", bash("node -e \"require('fs').writeFileSync('.claude/night/stop-blocks-x.json','99')\""), night, "deny"],
    ["night: prettier --write on the harness", bash("npx prettier --write .claude/hooks"), night, "deny"],
    ["night: run a hook", bash("node .claude/hooks/self-test.mjs"), night, "none"],
    ["night: run a hook, stdout elsewhere", bash("node .claude/hooks/check-direction.mjs > /tmp/out.txt"), night, "none"],
    ["night: read the config", bash("cat .claude/adoption.json | grep gate"), night, "none"],
    ["night: redirect into the root config", bash("echo x > abatty.config.json"), night, "deny"],
    ["night: read the root config", bash("cat abatty.config.json"), night, "none"],
    ["day: redirect into the root config", bash("echo x > abatty.config.json"), {}, "none"],
    ["night: restore the harness from the base", bash("git checkout main -- .claude/"), night, "none"],
    ["night: redirect into a migration", bash("echo 'ALTER TABLE x' > migrations/0001_init.sql"), night, "deny"],
    ["night: list migrations", bash("ls migrations/"), night, "none"],
    ["PowerShell: force push", { tool_name: "PowerShell", tool_input: { command: "git push -f origin main" } }, {}, "deny"],
    ["PowerShell: Set-Content on the harness", { tool_name: "PowerShell", tool_input: { command: "Set-Content .claude/adoption.json '{}'" } }, night, "deny"],
    ["other tool is ignored", { tool_name: "Edit", tool_input: { file_path: "x" } }, night, "none"],
  ];
  const corruptCfg = join(tmp, "corrupt.json");
  writeFileSync(corruptCfg, "{ not json");
  cases.push(["night: a corrupt adoption.json still denies a harness write", bash("echo x > .claude/adoption.json"), { ...night, ADOPTION_CONFIG: corruptCfg }, "deny"]);
  cases.push(["night: a corrupt adoption.json still allows an ordinary command", bash("npm test"), { ...night, ADOPTION_CONFIG: corruptCfg }, "none"]);
  // The bypass flags, in both directions. A flag inside a heredoc body is the text of a file
  // being written and not a flag of the command writing it, so a rule, a README or a fixture may
  // say the word; a quoted argument is still argv and is still refused.
  const bypass = ["--no", "verify"].join("-");
  cases.push([`the bypass flag is refused`, bash(`git commit ${bypass} -m "x"`), {}, "deny"]);
  cases.push([`the bypass flag quoted is still argv and still refused`, bash(`git commit "${bypass}" -m "x"`), {}, "deny"]);
  // The short form and its cluster: the spelling somebody reaching for the bypass types.
  cases.push(["the short bypass flag is refused", bash(`git commit -n -m "x"`), {}, "deny"]);
  cases.push(["the short bypass flag bundled into a cluster is refused", bash(`git commit -nm "x"`), {}, "deny"]);
  cases.push(["a cluster without it is ordinary work", bash(`git commit -am "x"`), {}, "none"]);
  // A `-n` of a LATER command is not this commit's: the span stops at the separator, or every
  // sentence naming a commit with a flag behind it is a bypass.
  cases.push(["a -n belonging to another command is not a bypass of this one", bash(`git commit -m "x" && sed -n 1p README.md`), {}, "none"]);
  cases.push(["nor is one behind a pipe", bash(`git commit -m "x" | tee -n log`), {}, "none"]);
  // The same bypass by its effect: the hooks run from core.hooksPath, so moving or unsetting it
  // skips them as the flag does. Reading it is not a write.
  const hooksKey = ["core", "hooksPath"].join(".");
  cases.push(["core.hooksPath pointed away for one commit is refused", bash(`git -c ${hooksKey}=/dev/null commit -m x`), {}, "deny"]);
  cases.push(["core.hooksPath unset for good is refused", bash(`git config --unset ${hooksKey}`), {}, "deny"]);
  cases.push(["core.hooksPath through the environment is refused", bash(`GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=${hooksKey} GIT_CONFIG_VALUE_0=/dev/null git commit -m x`), {}, "deny"]);
  cases.push(["reading core.hooksPath is allowed", bash(`git config --get ${hooksKey}`), {}, "none"]);
  cases.push(["pointing core.hooksPath at the hooks installs them and is allowed", bash(`git config ${hooksKey} .githooks`), {}, "none"]);
  cases.push(["editing a line that names core.hooksPath is not setting it", bash(`sed -i s/a/b/ docs/${hooksKey}.md`), {}, "none"]);
  cases.push(["force push is refused", bash("git push --force origin main"), {}, "deny"]);
  // The short form and its cluster, the same defect the bypass check carried: `-fu` is a force
  // push and the boundary after `f` never held inside a cluster.
  cases.push(["the short force flag is refused", bash("git push -f origin dev"), {}, "deny"]);
  cases.push(["the short force flag bundled into a cluster is refused", bash("git push -fu origin dev"), {}, "deny"]);
  cases.push(["and in the other order", bash("git push -uf origin dev"), {}, "deny"]);
  cases.push(["a cluster without it is ordinary work", bash("git push -uq origin dev"), {}, "none"]);
  cases.push(["an -f of another command is not this push's", bash("git push origin dev && grep -f patterns.txt src"), {}, "none"]);
  // The push target, not a word in the command: both directions, because a guard that refuses a
  // branch for carrying the base's name in it is a guard a team switches off.
  cases.push(["a push to the base branch is refused", bash("git push origin main"), {}, "deny"]);
  cases.push(["directPushToBase: true lets the same push through by day", bash("git push origin main"), { ADOPTION_CONFIG: directCfg }, "none"]);
  cases.push(["directPushToBase: true still refuses it at night", bash("git push origin main"), { ...night, ADOPTION_CONFIG: directCfg }, "deny"]);
  cases.push(["a push to the base by refspec is refused", bash("git push origin HEAD:main"), {}, "deny"]);
  cases.push(["deleting the base branch is refused", bash("git push origin :main"), {}, "deny"]);
  // Quotes are the shell's: git never sees them, so a target compared with them still attached
  // matches no branch. Quoting a branch name is ordinary typing, not a trick.
  cases.push(["a quoted base branch is still the base", bash(`git push origin "main"`), {}, "deny"]);
  cases.push(["single quotes too", bash("git push origin 'main'"), {}, "deny"]);
  cases.push(["a quoted refspec to the base is still the base", bash(`git push origin "HEAD:main"`), {}, "deny"]);
  cases.push(["a quoted branch elsewhere is still elsewhere", bash(`git push -u origin "feat/x"`), {}, "none"]);
  // The other half of the same word: a quote sits where the matchers anchor a short flag, so
  // ` "-f"` carries no `\s-`. The last of these passes even without the fix, because the bypass
  // alternative has no leading `\s`; it is pinned anyway, since it holds by luck and the luck
  // would not survive somebody splitting that alternation.
  cases.push(["a quoted force flag is still a force push", bash(`git push "--force" origin dev`), {}, "deny"]);
  cases.push(["in single quotes too", bash("git push '-f' origin dev"), {}, "deny"]);
  cases.push(["a quoted cluster is still one", bash(`git push "-fu" origin dev`), {}, "deny"]);
  cases.push(["a quoted forced refspec is still forced", bash(`git push origin "+main"`), {}, "deny"]);
  cases.push(["a quoted bypass cluster is still a bypass", bash(`git commit "-nm" "x"`), {}, "deny"]);
  cases.push([`a quoted long bypass flag is still one`, bash(`git commit "${bypass}" -m "x"`), {}, "deny"]);
  // HEAD is not a branch name: git resolves it to the branch you are standing on, so on the base
  // branch it IS the base, and reading it as a literal let a push to main through. Judged from
  // two throwaway repositories, one standing on the base and one not, because where the guard
  // runs is what decides the answer.
  const onBase = repoOnBranch("on-base", "main");
  const offBase = repoOnBranch("off-base", "feat/x");
  cases.push(["pushing HEAD from the base branch is a push to the base", bash("git push origin HEAD"), {}, "deny", onBase]);
  cases.push(["so is the alias @, with -u", bash("git push -u origin @"), {}, "deny", onBase]);
  cases.push(["pushing HEAD from another branch is not", bash("git push origin HEAD"), {}, "none", offBase]);
  // Quoting defeated the HEAD resolution too, by the same one character: `"HEAD"` is neither
  // HEAD nor @. The unquoting below covers it, but a case that holds incidentally is not a
  // case, so both spellings are pinned here.
  cases.push(["a quoted HEAD from the base branch is still the base", bash(`git push origin "HEAD"`), {}, "deny", onBase]);
  cases.push(["and a quoted alias", bash(`git push -u origin "@"`), {}, "deny", onBase]);
  cases.push(["a branch whose name carries the base's is not the base", bash("git push -u origin fix/merge-to-main-1"), {}, "none"]);
  cases.push(["nor is one that starts with it", bash("git push -u origin main-nav-rework"), {}, "none"]);
  // A redirection is the shell's, not git's: it was read as the target, and the push went through.
  cases.push(["a push to the base with a trailing redirection is still a push to the base", bash("git push origin main 2>&1"), {}, "deny"]);
  cases.push(["a push to the base into a log file is still one", bash("git push origin main > push.log"), {}, "deny"]);
  cases.push(["a push elsewhere with a redirection is still elsewhere", bash("git push -u origin feat/x 2>&1 | tail -3"), {}, "none"]);
  // The forge's API is another door to the same branch.
  cases.push(["moving the base's ref through the API is a push to the base", bash("gh api -X PATCH repos/o/r/git/refs/heads/main -f sha=abc123"), {}, "deny"]);
  cases.push(["merging into the base through the API is a push to the base", bash("gh api -X POST repos/o/r/merges -f base=main -f head=feat/x"), {}, "deny"]);
  cases.push(["reading the base's ref through the API is not a write", bash("gh api repos/o/r/git/refs/heads/main"), {}, "none"]);
  cases.push(["moving another ref through the API is not the base", bash("gh api -X PATCH repos/o/r/git/refs/heads/feat/x -f sha=abc123"), {}, "none"]);
  cases.push([`a heredoc that documents the bypass flag is a file being written`, bash(`cat > docs/RULES.md <<'EOF'\n${bypass} is not a workflow.\ngit push --force is never allowed.\nEOF`), {}, "none"]);
  // A command is read as a command now, not as a line of text. A reader's arguments are the
  // reader's: refusing an honest search teaches its user to route around the hook, which is the
  // habit the hook exists to prevent.
  cases.push(["a search whose pattern names a command is a search", bash(`rg "git push --force" docs/`), {}, "none"]);
  cases.push(["reading the guard's own source is reading", bash(`grep -nE "git push|${bypass}" .claude/hooks/guard.mjs`), {}, "none"]);
  cases.push(["saying the name of a thing is not doing it", bash(`echo "the bypass flag is ${bypass}"`), {}, "none"]);
  // And the other direction, which is what makes the above safe to allow: a program the guard
  // cannot resolve is read conservatively, token by token, so a substitution cannot hide the
  // two words from each other.
  cases.push(["a substitution in command position is still a force push", bash("$(echo git) push --force origin dev"), {}, "deny"]);
  cases.push(["so is a variable holding the program", bash("$GIT push --force origin dev"), {}, "deny"]);
  cases.push(["and a wrapper nobody put on a list", bash("timeout 5 git push --force origin dev"), {}, "deny"]);
  // Provenance is the default: with the scrub off (the template's default) a commit that carries
  // the agent's trailer passes. The vocabulary, under a config that opted in: a commit, a pull
  // request or an issue that names the tools is refused day and night; the samples are built at
  // runtime so this file names none of them.
  const scrubCfg = join(tmp, "scrub-on.json");
  writeFileSync(scrubCfg, JSON.stringify({ ...readJson(ADOPTION), scrub: { enabled: true } }));
  const scrubOn = { ADOPTION_CONFIG: scrubCfg };
  // Both sides are written here, from this repository's config with the one key set either way:
  // the pair proves the guard reads `scrub.enabled`, and it reads the same in a repository that
  // opted in as in one that did not. Pointing the default case at the repository's own config was
  // the bug - a repository with the scrub on then failed its own harness on the default's case.
  const scrubOffCfg = join(tmp, "scrub-off.json");
  writeFileSync(scrubOffCfg, JSON.stringify({ ...readJson(ADOPTION), scrub: { enabled: false } }));
  const defaults = { ADOPTION_CONFIG: scrubOffCfg };
  cases.push(["default: a commit whose message carries the authorship trailer passes (provenance kept)", bash(`git commit -m "feat: x\n\n${sampleTrailer()}"`), defaults, "none"]);
  cases.push(["default, night: the same commit passes", bash(`git commit -m "feat: x\n\n${sampleTrailer()}"`), { ...night, ...defaults }, "none"]);
  cases.push(["scrub on, night: a commit whose message carries the authorship trailer", bash(`git commit -m "feat: x\n\n${sampleTrailer()}"`), { ...night, ...scrubOn }, "deny"]);
  cases.push(["scrub on, day: the same commit is refused by day too", bash(`git commit -m "feat: x\n\n${sampleTrailer()}"`), scrubOn, "deny"]);
  cases.push(["scrub on, day: a pull request body that names the tool", bash(`gh pr create --title "feat: x" --body "${sampleTrailer()}"`), scrubOn, "deny"]);
  cases.push(["scrub on, night: a commit without a trailer", bash('git commit -m "feat: x\n\nwhy it changed"'), { ...night, ...scrubOn }, "none"]);
  cases.push(["scrub on, day: a commit that names the agent's own paths only", bash('git commit -m "chore: restore .claude/adoption.json and CLAUDE.md from main"'), scrubOn, "none"]);
  // The same message over several lines: the check is per line of the raw command, and reading
  // the collapsed one meant the whole message was judged as a single line, so the paths this
  // vocabulary must allow were drowned by the prose around them.
  cases.push(["scrub on, day: a multi-line message whose only mention is the agent's own paths", bash('git commit -m "refactor: split the gate\n\nThe step list moves out of the runner so the hook and CI read one file.\n\nRestores CLAUDE.md from main, unchanged.\n\nNo behaviour change."'), scrubOn, "none"]);
  cases.push(["scrub on, day: a multi-line message that names a tool on a later line", bash(`git commit -m "refactor: split the gate\n\nThe step list moves out of the runner.\n\n${sampleTrailer()}"`), scrubOn, "deny"]);
  cases.push(["scrub on, day: an ordinary command that names the tool is not a commit", bash(`echo "${sampleTrailer()}"`), scrubOn, "none"]);
  // The opposite option: a disclosure trailer the repository asks for on unattended commits.
  const provCfg = join(tmp, "provenance.json");
  writeFileSync(provCfg, JSON.stringify({ ...readJson(ADOPTION), provenance: { trailer: "Assisted-by: an unattended run" } }));
  const provOn = { ADOPTION_CONFIG: provCfg };
  cases.push(["provenance, night: a commit without the disclosure trailer is refused", bash('git commit -m "feat: x\n\nwhy"'), { ...night, ...provOn }, "deny"]);
  cases.push(["provenance, night: a commit with the disclosure trailer passes", bash('git commit -m "feat: x\n\nwhy\n\nAssisted-by: an unattended run"'), { ...night, ...provOn }, "none"]);
  cases.push(["provenance, day: a human commit without the trailer is the human's decision", bash('git commit -m "feat: x"'), provOn, "none"]);
  // A script is read as what it runs: an adopter's `pnpm db:setup` force-reset the live database
  // and passed day and night, because the guard read the line typed, not the script it ran.
  const withScripts = repoOnBranch("with-scripts", "feat/x");
  writeFileSync(
    join(withScripts, "package.json"),
    JSON.stringify({ scripts: { "db:setup": "prisma db push --force-reset --accept-data-loss", setup: "pnpm db:setup", "db:push": "prisma db push", lint: "eslint ." } }),
  );
  cases.push(["night: a script that force-resets the database", bash("pnpm db:setup"), night, "deny", withScripts]);
  cases.push(["night: a script that calls that script", bash("npm run setup"), night, "deny", withScripts]);
  cases.push(["day: a script that force-resets the database is asked about", bash("pnpm db:setup"), {}, "ask", withScripts]);
  cases.push(["day: a schema push is a migration, not a git push", bash("pnpm exec prisma db push"), {}, "ask", withScripts]);
  cases.push(["day: an ordinary script is not", bash("pnpm lint"), {}, "none", withScripts]);
  // On the base branch the misreading showed: a schema push was refused as a git push to main.
  const onMain = repoOnBranch("with-scripts-main", "main");
  cases.push(["day, on the base: a schema push is a migration, not a push to main", bash("pnpm exec prisma db push"), {}, "ask", onMain]);
  // The hooks folder by its bare name, as well as with its slash.
  for (const c of ["rm -rf .githooks", "rmdir .githooks", "git rm -r .githooks", "mv .githooks /tmp/x", "find .githooks -delete", "rm -rf ./.husky"])
    cases.push([`night: remove the hooks folder (${c})`, bash(c), night, "deny"]);
  cases.push(["night: list the hooks folder", bash("ls .githooks"), night, "none"]);
  // A case may name the directory it is judged from: the branch the guard reads is the branch of
  // the repository it runs in, and `HEAD` means a different thing on the base branch than off it.
  const guardRuns = await pooled(cases, ([, event, env, , cwd]) => hookAsync("guard.mjs", event, env, cwd || process.cwd()));
  for (const [i, [name, , , expected]] of cases.entries()) {
    const r = guardRuns[i];
    const got = decisionOf(r);
    check(`guard · ${name}`, r.code === 0 && got === expected, `expected ${expected}, got ${got}${r.code !== 0 ? ", exit " + r.code : ""}`);
  }

  // The migration prompt names the host and never a credential, whatever shape the URL has.
  const reasonOf = (r) => {
    try {
      return String(JSON.parse(r.stdout).hookSpecificOutput?.permissionDecisionReason || "");
    } catch {
      return "";
    }
  };
  const migrationReason = reasonOf(hook("guard.mjs", bash("DATABASE_URL=postgres://u:pw1@db.example.com:5432/app npx prisma migrate deploy"), { DATABASE_URL: "" }));
  check("guard · day: the migration prompt names host, port and database", /db\.example\.com:5432\/app/.test(migrationReason), oneLine(migrationReason));
  check("guard · day: the migration prompt never shows the user or the password", migrationReason !== "" && !/pw1|\bu:/.test(migrationReason), oneLine(migrationReason));
  const opaque = reasonOf(hook("guard.mjs", bash('DATABASE_URL="sqlserver://localhost;user=SA;password=S3cret" npx prisma migrate deploy'), { DATABASE_URL: "" }));
  check("guard · day: a connection string with the password where a host would be is not shown", opaque !== "" && !/S3cret|SA;/.test(opaque), oneLine(opaque));

  // ---- 2b. the file guard: the harness and the protected paths are read-only at night ----------
  const mcp = (tool_name, tool_input) => ({ tool_name, tool_input });
  const withMcp = join(tmp, "with-mcp.json");
  writeFileSync(withMcp, JSON.stringify({ mcpServers: ["serena"], protectedPaths: ["migrations/", ".env"] }));
  // the agent names a server's tools with [^A-Za-z0-9_] replaced by "_": "mail.example" is mcp__mail_example__*.
  const withDotted = join(tmp, "with-dotted.json");
  writeFileSync(withDotted, JSON.stringify({ mcpServers: ["mail.example"] }));
  const fileCases = [
    ["day: edit adoption.json", edit(".claude/adoption.json"), {}, "none"],
    ["night: edit adoption.json", edit(".claude/adoption.json"), night, "deny"],
    ["day: edit the root config", edit("abatty.config.json"), {}, "none"],
    ["night: edit the root config", edit("abatty.config.json"), night, "deny"],
    ["night: write a hook", edit(".claude/hooks/stop-gate.mjs", "Write"), night, "deny"],
    ["night: edit a stop counter", edit(".claude/night/stop-blocks-x.json"), night, "deny"],
    ["night: edit settings.json by absolute path", edit(resolve(".claude/settings.json")), night, "deny"],
    ["night: edit a source file", edit("src/a.ts"), night, "none"],
    ["night: edit the decisions file", edit("docs/ADOPTION_DECISIONS.md"), night, "none"],
    ["night: edit an applied migration", edit("migrations/0001_init.sql"), night, "deny"],
    ["night: write .env.local", edit(".env.local", "Write"), night, "deny"],
    ["night: write outside the repository", edit("../elsewhere/x.ts", "Write"), night, "deny"],
    ["night: a Bash event is ignored", bash("echo x > .claude/adoption.json"), night, "none"],
    // MCP tools: every server is refused unless adoption.json -> mcpServers names it, and a
    // named server's tool is held to the same path rules as Edit and Write.
    ["day: an MCP send is not judged here", mcp("mcp__mail_example__send_message", { channel: "x", text: "y" }), {}, "none"],
    ["night: a Slack send from the user settings", mcp("mcp__mail_example__send_message", { channel: "x", text: "y" }), night, "deny"],
    ["night: a Drive file creation", mcp("mcp__drive_example__create_file", { name: "x" }), night, "deny"],
    ["night: a code server not named in adoption.json", mcp("mcp__serena__find_symbol", { name_path: "x" }), night, "deny"],
    ["night: a named code server, a symbol read", mcp("mcp__serena__find_symbol", { name_path: "x", relative_path: "src/a.ts" }), { ...night, ADOPTION_CONFIG: withMcp }, "none"],
    ["night: a named code server, an edit to a source file", mcp("mcp__serena__replace_content", { relative_path: "src/a.ts", needle: "a", repl: "b" }), { ...night, ADOPTION_CONFIG: withMcp }, "none"],
    ["night: a named code server, an edit to the harness", mcp("mcp__serena__replace_content", { relative_path: ".claude/adoption.json", needle: "a", repl: "b" }), { ...night, ADOPTION_CONFIG: withMcp }, "deny"],
    ["night: a named code server, an edit to an applied migration", mcp("mcp__serena__replace_symbol_body", { relative_path: "migrations/0001_init.sql", name_path: "x" }), { ...night, ADOPTION_CONFIG: withMcp }, "deny"],
    ["night: a named code server, a path outside the repository", mcp("mcp__serena__create_text_file", { relative_path: "../elsewhere/x.ts" }), { ...night, ADOPTION_CONFIG: withMcp }, "deny"],
    ["night: a named code server, a server name written with a dot", mcp("mcp__mail_example__send_message", { text: "y" }), { ...night, ADOPTION_CONFIG: withDotted }, "none"],
  ];
  const fileRuns = await pooled(fileCases, ([, event, env]) => hookAsync("protect.mjs", event, env));
  for (const [i, [name, , , expected]] of fileCases.entries()) {
    const r = fileRuns[i];
    const got = decisionOf(r);
    check(`protect · ${name}`, r.code === 0 && got === expected, `expected ${expected}, got ${got}${r.code !== 0 ? ", exit " + r.code + " " + oneLine(r.stderr) : ""}`);
  }

  // ---- 3. the stop-gate: red gate blocks, day exits 0, block cap lets go ---------------------
  const cfg = (gate, extra = {}) => {
    const p = join(tmp, "adoption.json");
    writeFileSync(p, JSON.stringify({ commands: { gate }, files: { state: join(tmp, "state.json") }, maxStopBlocks: 2, ...extra }));
    return p;
  };
  const day = hook("stop-gate.mjs", { session_id: "selftest-day" }, { ADOPTION_CONFIG: cfg("node -e process.exit(1)") });
  check("stop-gate · daytime never blocks", day.code === 0, `exit ${day.code}`);

  const sid = "selftest-" + Date.now();
  const red = hook("stop-gate.mjs", { session_id: sid }, { ...night, ADOPTION_BRANCH: "", ADOPTION_CONFIG: cfg('node -e "console.log(\'probe failure\');process.exit(1)"') });
  check("stop-gate · red gate blocks the stop (exit 2)", red.code === 2, `exit ${red.code}`);
  check("stop-gate · the reason carries the gate output", /gate is red/.test(red.stderr) && /probe failure/.test(red.stderr));
  const redReceipt = join(nightDir, `stop-gate-${sid}.json`);
  check("stop-gate · a block leaves a receipt naming the check", existsSync(redReceipt) && readJson(redReceipt).decision === "block" && readJson(redReceipt).checks.some((c) => c.check === "gate" && c.ok === false), existsSync(redReceipt) ? oneLine(readFileSync(redReceipt, "utf8")) : "no receipt");

  const red2 = hook("stop-gate.mjs", { session_id: sid }, { ...night, ADOPTION_BRANCH: "", ADOPTION_CONFIG: cfg("node -e process.exit(1)") });
  check("stop-gate · second block counts (2/2)", red2.code === 2 && /block 2\/2/.test(red2.stderr));
  const red3 = hook("stop-gate.mjs", { session_id: sid }, { ...night, ADOPTION_BRANCH: "", ADOPTION_CONFIG: cfg("node -e process.exit(1)") });
  check("stop-gate · cap reached lets the session end and says so", red3.code === 0 && /letting it end/.test(red3.stderr));
  check("stop-gate · the cap leaves a receipt", existsSync(redReceipt) && readJson(redReceipt).decision === "cap");

  const green = hook("stop-gate.mjs", { session_id: "selftest-green-" + Date.now() }, { ...night, ADOPTION_BRANCH: "", ADOPTION_PHASE: "", ADOPTION_CONFIG: cfg("node -e \"process.exit(0)\"", { changelogRequiredFor: [] }) });
  check("stop-gate · green gate reaches the later checks (exit 0 or a named block, never a crash)", green.code === 0 || (green.code === 2 && /Uncommitted|CHANGELOG|state|direction/.test(green.stderr)), `exit ${green.code} ${oneLine(green.stderr)}`);

  // A config file with a UTF-8 BOM (what Windows PowerShell 5.1 writes) must parse, not block
  // as "unreadable" until the cap. Proven on the config path, which every hook reads first.
  const bomCfg = join(tmp, "adoption-bom.json");
  writeFileSync(bomCfg, "﻿" + JSON.stringify({ commands: { gate: "node -e \"process.exit(0)\"" }, files: { state: join(tmp, "state.json") }, changelogRequiredFor: [], maxStopBlocks: 2 }));
  const bom = hook("stop-gate.mjs", { session_id: "selftest-bom-" + Date.now() }, { ...night, ADOPTION_BRANCH: "", ADOPTION_PHASE: "", ADOPTION_CONFIG: bomCfg });
  check("stop-gate · a config with a UTF-8 BOM is read, not a crash", bom.code === 0 || (bom.code === 2 && /Uncommitted|CHANGELOG|state|direction/.test(bom.stderr)), `exit ${bom.code}${bom.code !== 0 && bom.code !== 2 ? " " + bom.stderr.slice(0, 120) : ""}`);

  // The state-file checks need a CLEAN tree to be reached (the dirty-tree block comes first),
  // so they run inside throwaway git repositories rather than this checkout.
  const gitIn = (repo, ...a) => execFileSync("git", ["-c", "user.name=selftest", "-c", "user.email=selftest@example.invalid", ...a], { cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  const write = (repo, rel, text) => {
    mkdirSync(dirname(join(repo, rel)), { recursive: true });
    writeFileSync(join(repo, rel), text);
  };
  const newRepo = (name) => {
    const repo = join(tmp, name);
    mkdirSync(repo, { recursive: true });
    gitIn(repo, "init", "-q", "-b", "main");
    return repo;
  };
  const cfgIn = (name, state, extra = {}) => {
    // Fixtures live OUTSIDE the repository so its tree stays clean.
    const stateP = join(tmp, name + "-state.json");
    writeFileSync(stateP, JSON.stringify(state));
    const p = join(tmp, name + ".json");
    writeFileSync(p, JSON.stringify({ commands: { gate: "node -e \"process.exit(0)\"" }, files: { state: stateP }, changelogRequiredFor: [], maxStopBlocks: 3, ...extra }));
    return p;
  };

  const repo = newRepo("repo");
  write(repo, ".gitignore", ".claude/\n");
  gitIn(repo, "add", ".gitignore");
  gitIn(repo, "commit", "-q", "-m", "init");
  writeFileSync(join(nightDir, "run.json"), JSON.stringify({ startedAt: "2026-01-01T00:00:00Z" }));

  // A state file whose "phases" is an object (what a one-phase PowerShell pipeline used to
  // write) is named as the defect, in a block the model can act on - not a crash, not "unreadable".
  const shape = hook("stop-gate.mjs", { session_id: "selftest-shape-" + Date.now() }, { ...night, ADOPTION_BRANCH: "", ADOPTION_PHASE: "0", ADOPTION_CONFIG: cfgIn("shape", { startedAt: "2026-01-01T00:00:00Z", phases: { id: 0, status: "pending" } }) }, repo);
  check("stop-gate · phases that is not an array is named, not a crash", shape.code === 2 && /must be an array/.test(shape.stderr), `exit ${shape.code} ${oneLine(shape.stderr)}`);

  // A phase entry not updated since the run started blocks; one updated after it lets go.
  const stale = hook("stop-gate.mjs", { session_id: "selftest-stale-" + Date.now() }, { ...night, ADOPTION_BRANCH: "", ADOPTION_PHASE: "0", ADOPTION_CONFIG: cfgIn("stale", { startedAt: "2026-01-01T00:00:00Z", phases: [{ id: 0, status: "pending" }] }) }, repo);
  check("stop-gate · a phase entry not updated during the run blocks", stale.code === 2 && /no update for phase 0/.test(stale.stderr), `exit ${stale.code}`);
  const freshSid = "selftest-fresh-" + Date.now();
  const fresh = hook("stop-gate.mjs", { session_id: freshSid }, { ...night, ADOPTION_BRANCH: "", ADOPTION_PHASE: "0", ADOPTION_CONFIG: cfgIn("fresh", { startedAt: "2026-01-01T00:00:00Z", phases: [{ id: 0, status: "done", updatedAt: "2026-01-01T01:00:00Z" }] }) }, repo);
  check("stop-gate · a phase entry updated during the run, clean tree, green gate: stop allowed", fresh.code === 0, `exit ${fresh.code} ${oneLine(fresh.stderr)}`);
  const freshReceipt = join(nightDir, `stop-gate-${freshSid}.json`);
  check("stop-gate · an allowed stop leaves a receipt with every check ok", existsSync(freshReceipt) && readJson(freshReceipt).decision === "allow" && readJson(freshReceipt).checks.every((c) => c.ok), existsSync(freshReceipt) ? oneLine(readFileSync(freshReceipt, "utf8")) : "no receipt");

  // Several sessions share one worktree: a file another session left uncommitted before this one
  // started, untouched since, is not this session's to commit or restore. One it wrote still is.
  write(repo, "notes-of-another-session.md", "theirs\n");
  const shareSid = "selftest-share-" + Date.now();
  const shareCfg = cfgIn("share", { startedAt: "2026-01-01T00:00:00Z", phases: [{ id: 0, status: "done", updatedAt: "2026-01-01T01:00:00Z" }] });
  const shareEnv = { ...night, ADOPTION_BRANCH: "", ADOPTION_PHASE: "0", ADOPTION_CONFIG: shareCfg };
  hook("session-brief.mjs", { session_id: shareSid }, shareEnv, repo);
  const shared = hook("stop-gate.mjs", { session_id: shareSid }, shareEnv, repo);
  check("stop-gate · a file uncommitted before the session started is left alone", shared.code === 0, `exit ${shared.code} ${oneLine(shared.stderr)}`);
  write(repo, "mine.md", "mine\n");
  const mine = hook("stop-gate.mjs", { session_id: shareSid }, shareEnv, repo);
  const named = mine.stderr.split("\n\n")[0] || "";
  check("stop-gate · a file the session wrote blocks, and only it is named", mine.code === 2 && /mine\.md/.test(named) && !/notes-of-another-session/.test(named), `exit ${mine.code} ${oneLine(mine.stderr)}`);
  rmSync(join(repo, "notes-of-another-session.md"));
  rmSync(join(repo, "mine.md"));

  // ---- 3b. the stop-gate trusts the base branch's adoption.json, not the tree's ---------------
  // The worker points commands.gate at a command that fails in the TREE copy; the base copy says
  // green. What must decide is the base: the block names the edited harness, never a red gate.
  const trust = newRepo("trust");
  write(trust, ".claude/adoption.json", JSON.stringify({ commands: { gate: "node -e \"process.exit(0)\"" }, files: { state: "docs/ADOPTION_STATE.json" }, changelogRequiredFor: [] }));
  gitIn(trust, "add", "-A");
  gitIn(trust, "commit", "-q", "-m", "base with harness");
  gitIn(trust, "checkout", "-q", "-b", "adopt/standards-selftest");
  write(trust, ".claude/adoption.json", JSON.stringify({ commands: { gate: "node -e process.exit(1)" }, files: { state: "docs/ADOPTION_STATE.json" }, changelogRequiredFor: [] }));
  gitIn(trust, "commit", "-q", "-am", "chore: point the gate at a failing command");
  const trustSid = "selftest-trust-" + Date.now();
  const trusted = hook("stop-gate.mjs", { session_id: trustSid }, { ...night, ADOPTION_PHASE: "", ADOPTION_BASE: "main", ADOPTION_CONFIG: ".claude/adoption.json" }, trust);
  const trustReceipt = join(nightDir, `stop-gate-${trustSid}.json`);
  check("stop-gate · the gate command comes from the base branch, not the edited tree", trusted.code === 2 && !/gate is red/.test(trusted.stderr) && existsSync(trustReceipt) && readJson(trustReceipt).configSource === "base", `exit ${trusted.code}, source ${existsSync(trustReceipt) ? readJson(trustReceipt).configSource : "?"} ${oneLine(trusted.stderr)}`);
  check("stop-gate · an edited harness blocks with the restore instruction", /\.claude\/ differ from main/.test(trusted.stderr) && /git checkout main -- \.claude\//.test(trusted.stderr), oneLine(trusted.stderr));
  // A tree copy that does not even parse must not crash the hook (a crashed Stop hook does not
  // block): the base copy decides, and the corrupt file is what the block names.
  write(trust, ".claude/adoption.json", "{ not json");
  const corrupt = hook("stop-gate.mjs", { session_id: "selftest-corrupt-" + Date.now() }, { ...night, ADOPTION_PHASE: "", ADOPTION_BASE: "main", ADOPTION_CONFIG: ".claude/adoption.json" }, trust);
  check("stop-gate · a corrupt tree adoption.json is a block, never a crash", corrupt.code === 2 && /\.claude\//.test(corrupt.stderr), `exit ${corrupt.code} ${oneLine(corrupt.stderr)}`);
  gitIn(trust, "checkout", "-q", "main", "--", ".claude/");
  gitIn(trust, "commit", "-q", "-m", "chore(standards): restore the harness");
  const restored = hook("stop-gate.mjs", { session_id: "selftest-restored-" + Date.now() }, { ...night, ADOPTION_PHASE: "", ADOPTION_BASE: "main", ADOPTION_CONFIG: ".claude/adoption.json" }, trust);
  check("stop-gate · the harness restored from the base: stop allowed", restored.code === 0, `exit ${restored.code} ${oneLine(restored.stderr)}`);

  // ---- 3c. the changelog is judged per commit: the newest source commit must be covered ----------
  const cl = newRepo("changelog");
  write(cl, "CHANGELOG.md", "# Changelog\n\n## [Unreleased]\n\n");
  write(cl, "src/a.ts", "export const a = 1;\n");
  gitIn(cl, "add", "-A");
  gitIn(cl, "commit", "-q", "-m", "init");
  gitIn(cl, "checkout", "-q", "-b", "adopt/standards-selftest");
  const clCfg = cfgIn("changelog", { startedAt: "2026-01-01T00:00:00Z", phases: [] }, { changelogRequiredFor: ["src/"], files: { state: join(tmp, "changelog-state.json"), changelog: "CHANGELOG.md" } });
  const clEnv = { ...night, ADOPTION_PHASE: "", ADOPTION_BASE: "main", ADOPTION_CONFIG: clCfg };
  write(cl, "src/a.ts", "export const a = 2;\n");
  write(cl, "CHANGELOG.md", "# Changelog\n\n## [Unreleased]\n\n- a is 2\n");
  gitIn(cl, "commit", "-q", "-am", "feat: a is 2");
  const covered = hook("stop-gate.mjs", { session_id: "selftest-cl1-" + Date.now() }, clEnv, cl);
  check("stop-gate · a source commit with its changelog line: stop allowed", covered.code === 0, `exit ${covered.code} ${oneLine(covered.stderr)}`);
  write(cl, "src/a.ts", "export const a = 3;\n");
  gitIn(cl, "commit", "-q", "-am", "feat: a is 3");
  const uncovered = hook("stop-gate.mjs", { session_id: "selftest-cl2-" + Date.now() }, clEnv, cl);
  check("stop-gate · a later source commit without a changelog touch blocks and names it", uncovered.code === 2 && /after the last CHANGELOG\.md entry/.test(uncovered.stderr) && /a is 3/.test(uncovered.stderr), `exit ${uncovered.code} ${oneLine(uncovered.stderr)}`);
  write(cl, "CHANGELOG.md", "# Changelog\n\n## [Unreleased]\n\n- a is 3\n- a is 2\n");
  gitIn(cl, "commit", "-q", "-am", "docs(changelog): a is 3");
  const cured = hook("stop-gate.mjs", { session_id: "selftest-cl3-" + Date.now() }, clEnv, cl);
  check("stop-gate · a new commit with the missing entries cures it", cured.code === 0, `exit ${cured.code} ${oneLine(cured.stderr)}`);

  // ---- 4. the direction check: every loosening it must refuse, and the tightenings it must not --
  const dir = newRepo("direction");
  const basePkg = { scripts: { lint: "eslint . --max-warnings=0", gate: "node scripts/ci/gate.mjs", standards: "node scripts/ci/check-standards.mjs", graph: "depcruise src --config .dependency-cruiser.cjs --ignore-known --output-type err", dead: "knip --max-issues 3" } };
  const pkgWith = (patch) => JSON.stringify({ scripts: { ...basePkg.scripts, ...patch } });
  write(dir, "package.json", JSON.stringify(basePkg));
  write(dir, "scripts/ci/gate.mjs", "// gate\n");
  write(dir, ".dependency-cruiser-known-violations.json", JSON.stringify([{ from: "src/a.ts", to: "src/b.ts", rule: { severity: "error", name: "no-circular" } }, { from: "src/b.ts", to: "src/a.ts", rule: { severity: "error", name: "no-circular" } }]));
  write(dir, "scripts/ci/standards-baseline.json", JSON.stringify({ metrics: { "size.overBudget": 5, "fn.long": 0 }, debt: { "size.overBudget": { "src/a.ts": 5 } } }));
  write(dir, "eslint.config.mjs", `export default [{ ignores: ["dist/"] }, { rules: { "max-lines": ["warn", { max: 300 }], "no-await-in-loop": "error", complexity: ["warn", 12] } }];\n`);
  write(dir, "vitest.config.ts", `export default { test: { coverage: { thresholds: { lines: 80.5, branches: 70 } } } };\n`);
  write(dir, "tsconfig.json", `{ // jsonc\n  "compilerOptions": { "strict": true } }\n`);
  write(dir, ".githooks/pre-push", "#!/bin/sh\nnpm run gate\n");
  write(dir, ".woodpecker/checks.yaml", "steps:\n  - name: lint\n    commands: [npm run lint]\n");
  write(dir, "docs/ADOPTION_DECISIONS.md", "# Decisions\n");
  gitIn(dir, "add", "-A");
  gitIn(dir, "commit", "-q", "-m", "base");
  gitIn(dir, "checkout", "-q", "-b", "adopt/standards-selftest");
  const direction = () => {
    const r = spawnSync(process.execPath, [join(HOOKS_ABS, "check-direction.mjs"), "--base", "main"], { cwd: dir, encoding: "utf8", env: { ...process.env, ...baseEnv } });
    return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
  };
  const restore = () => gitIn(dir, "checkout", "-q", "--", ".");
  const expectDirection = (name, mutate, expectCode, pattern) => {
    mutate();
    const r = direction();
    check(`direction · ${name}`, r.code === expectCode && (!pattern || pattern.test(r.out)), `exit ${r.code} ${oneLine(r.out)}`);
    restore();
  };
  expectDirection("unchanged tree is clean", () => {}, 0, /nothing loosened/);
  expectDirection("a baseline number that rose blocks", () => write(dir, "scripts/ci/standards-baseline.json", JSON.stringify({ metrics: { "size.overBudget": 6, "fn.long": 0 }, debt: { "size.overBudget": { "src/a.ts": 6 } } })), 2, /rose 5 → 6/);
  expectDirection("a baseline number that fell is clean", () => write(dir, "scripts/ci/standards-baseline.json", JSON.stringify({ metrics: { "size.overBudget": 4, "fn.long": 0 }, debt: { "size.overBudget": { "src/a.ts": 4 } } })), 0);
  expectDirection("a metric removed from the baseline blocks", () => write(dir, "scripts/ci/standards-baseline.json", JSON.stringify({ metrics: { "size.overBudget": 5 }, debt: {} })), 2, /fn\.long.*gone/);
  const ruleOff = `export default [{ ignores: ["dist/"] }, { rules: { "max-lines": ["warn", { max: 300 }], "no-await-in-loop": "off", complexity: ["warn", 12] } }];\n`;
  expectDirection("a rule switched off without a decision blocks", () => write(dir, "eslint.config.mjs", ruleOff), 2, /no-await-in-loop/);
  expectDirection("the same rule off with a decision naming it is recorded, not refused", () => {
    write(dir, "eslint.config.mjs", ruleOff);
    write(dir, "docs/ADOPTION_DECISIONS.md", "# Decisions\n- 2026-01-01 phase 1: no-await-in-loop switched off under server/ (ordered DDL)\n");
  }, 0, /with a decision naming it/);
  expectDirection("a path added to ignores blocks", () => write(dir, "eslint.config.mjs", `export default [{ ignores: ["dist/", "src/legacy/"] }, { rules: { "max-lines": ["warn", { max: 300 }], "no-await-in-loop": "error", complexity: ["warn", 12] } }];\n`), 2, /src\/legacy\/.*added to ignores/);
  expectDirection("a rule tightened and a new block at error are clean", () => write(dir, "eslint.config.mjs", `export default [{ ignores: ["dist/"] }, { rules: { "max-lines": ["error", { max: 300 }], "no-await-in-loop": "error", complexity: ["warn", 12] } }, { files: ["src/**"], rules: { "no-console": "error" } }];\n`), 0);
  expectDirection("a coverage threshold that fell blocks", () => write(dir, "vitest.config.ts", `export default { test: { coverage: { thresholds: { lines: 70, branches: 70 } } } };\n`), 2, /lines threshold #1 fell 80\.5 → 70/);
  expectDirection("thresholds.autoUpdate appearing blocks", () => write(dir, "vitest.config.ts", `export default { test: { coverage: { thresholds: { lines: 80.5, branches: 70, autoUpdate: true } } } };\n`), 2, /autoUpdate/);
  expectDirection("--max-warnings=0 dropped from the lint script blocks", () => write(dir, "package.json", pkgWith({ lint: "eslint ." })), 2, /no longer runs with --max-warnings=0/);
  expectDirection("the gate script removed from package.json blocks", () => write(dir, "package.json", JSON.stringify({ scripts: { ...basePkg.scripts, gate: undefined } })), 2, /"gate" was removed/);
  // the import graph and dead code (CODE.5, CODE.6): the tool's own debt only shrinks
  expectDirection("known import-graph violations that grew block", () => write(dir, ".dependency-cruiser-known-violations.json", JSON.stringify([{ from: "src/a.ts", to: "src/b.ts", rule: { severity: "error", name: "no-circular" } }, { from: "src/b.ts", to: "src/a.ts", rule: { severity: "error", name: "no-circular" } }, { from: "src/c.ts", to: "src/d.ts", rule: { severity: "error", name: "no-orphans" } }])), 2, /known import-graph violations rose 2 → 3/);
  expectDirection("known import-graph violations that shrank are clean", () => write(dir, ".dependency-cruiser-known-violations.json", JSON.stringify([{ from: "src/a.ts", to: "src/b.ts", rule: { severity: "error", name: "no-circular" } }])), 0);
  expectDirection("the known-violations file deleted blocks", () => rmSync(join(dir, ".dependency-cruiser-known-violations.json")), 2, /known-violations file of the import graph was deleted/);
  expectDirection("knip --max-issues raised blocks", () => write(dir, "package.json", pkgWith({ dead: "knip --max-issues 9" })), 2, /knip --max-issues rose 3 → 9/);
  expectDirection("knip --max-issues lowered is clean", () => write(dir, "package.json", pkgWith({ dead: "knip --max-issues 0" })), 0);
  expectDirection("knip gaining --no-exit-code blocks", () => write(dir, "package.json", pkgWith({ dead: "knip --max-issues 3 --no-exit-code" })), 2, /gained --no-exit-code/);
  expectDirection("depcruise losing --output-type err blocks", () => write(dir, "package.json", pkgWith({ graph: "depcruise src --config .dependency-cruiser.cjs --ignore-known" })), 2, /--output-type err dropped/);
  expectDirection("a strict flag turned off blocks", () => write(dir, "tsconfig.json", `{ "compilerOptions": { "strict": false } }\n`), 2, /"strict" was true/);
  expectDirection("a pre-push hook that no longer runs the gate blocks", () => write(dir, ".githooks/pre-push", "#!/bin/sh\nexit 0\n"), 2, /no longer mentions the gate/);
  expectDirection("a CI step made non-blocking blocks", () => write(dir, ".woodpecker/checks.yaml", "steps:\n  - name: lint\n    failure: ignore\n    commands: [npm run lint]\n"), 2, /failure: ignore/);
  expectDirection("a harness file added to the index blocks", () => {
    write(dir, ".claude/adoption.json", "{}");
    gitIn(dir, "add", ".claude/adoption.json");
  }, 2, /under \.claude\/ differ from main/);
  gitIn(dir, "rm", "-q", "--cached", ".claude/adoption.json");
  rmSync(join(dir, ".claude"), { recursive: true, force: true });
  const unknownBase = spawnSync(process.execPath, [join(HOOKS_ABS, "check-direction.mjs"), "--base", "no-such-branch"], { cwd: dir, encoding: "utf8", env: { ...process.env, ...baseEnv } });
  check("direction · an unknown base is reported, not judged (exit 1)", unknownBase.status === 1 && /not found/.test(unknownBase.stdout + unknownBase.stderr), `exit ${unknownBase.status}`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

// ---- 4b. the user settings the night inherits: no attribution trailer ------------------------------
// the agent appends authorship to every commit unless the USER settings set attribution.commit
// to "" (settings.user.json carries it; a merge nobody verified left nine trailers on the first real
// night). The guard refuses the commit at night; this says why before a night is spent on refusals.
try {
  const scrubOnHere = readJson(ADOPTION)?.scrub?.enabled === true;
  if (!scrubOnHere) {
    check("user settings: attribution left to the agent (provenance is the default; scrub.enabled is off)", true);
    throw null;
  }
  const userSettings = join(homedir(), ".claude", "settings.json");
  const us = existsSync(userSettings) ? readJson(userSettings) : null;
  const commitAttr = us?.attribution?.commit;
  check("user settings: attribution.commit is empty (no trailer on the night's commits)", commitAttr === "", us ? (commitAttr === undefined ? "attribution not set: merge the attribution block of templates/harness/settings.user.json into ~/.claude/settings.json" : `attribution.commit=${JSON.stringify(commitAttr)}`) : "no ~/.claude/settings.json");
} catch (e) {
  if (e !== null) check("user settings: attribution.commit is empty (no trailer on the night's commits)", false, e.message);
}

// ---- 5. the agent version --------------------------------------------------------------------
try {
  const agent = agentCommand();
  if (!agent) throw new Error("no agent command: set ABATTY_AGENT or agent.command in ~/.abatty/config.json");
  // No shell, except where one is load-bearing: on Windows a tool launcher and a .cmd stub are
  // batch files, which are scripts for cmd.exe, and Node refuses to spawn one without a shell
  // (EINVAL since 20.12). The path is quoted for that shell; the one argument has nothing to quote.
  const win = process.platform === "win32";
  const batch = win && (/^(npm|npx|yarn|pnpm|bun)$/.test(agent) || /\.(cmd|bat)$/i.test(agent));
  const exe = batch && !/\.(cmd|bat)$/i.test(agent) ? `${agent}.cmd` : agent;
  const v = execFileSync(batch ? `"${exe}"` : exe, ["--version"], { encoding: "utf8", shell: batch }).trim();
  const m = v.match(/(\d+)\.(\d+)\.(\d+)/);
  const ok = m && (Number(m[1]) > 2 || (Number(m[1]) === 2 && (Number(m[2]) > 1 || (Number(m[2]) === 1 && Number(m[3]) >= 259))));
  check("agent >= 2.1.259 (--permission-prompts none)", Boolean(ok), v);
} catch (e) {
  check("agent on PATH", false, String(e && e.message ? e.message : e));
}

process.stdout.write(`\n${failures === 0 ? "harness ok" : failures + " failure(s) - do not start a night on this harness"}\n`);
process.exit(failures === 0 ? 0 : 1);
