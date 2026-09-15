// A stand-in for `the agent's headless mode` that exercises the night runner, the state file, the changelog
// rule and the Stop gate WITHOUT a model or a paid session. It does what a compliant agent
// would do for one phase - mark it done with numbers, add a changelog line, commit - and then
// plays the agent's Stop loop: run the stop-gate hook, and if it blocks, act on the reason
// (commit what is uncommitted) and try again, up to the agent's own cap of 8.
//
// It prints the same JSON shape the runner parses (total_cost_usd, permission_denials, is_error).
//
//   ABATTY_AGENT=<path>/stub-agent.sh npx abatty night . --until +10min --max-cost 10 --no-push

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const argv = process.argv.slice(2);
// The self-test and the runner ask the agent for its version before a night is spent on it.
if (argv.includes("--version")) {
  // The version the harness requires of the agent, so the self-test's version check passes on the stub.
  process.stdout.write("2.1.259 (stub-agent, a stand-in for the agent's headless mode)\n");
  process.exit(0);
}
const prompt = argv[argv.indexOf("-p") + 1] || "";
const phase = process.env.ADOPTION_PHASE ?? "";
const wrapUp = /--wrap-up/.test(prompt);
const readJson = (p) => {
  const text = readFileSync(p, "utf8");
  return JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
};
const configPath = process.env.ADOPTION_CONFIG || (existsSync("abatty.config.json") ? "abatty.config.json" : ".claude/adoption.json");
const config = readJson(configPath);
const stateFile = config.files?.state || "docs/ADOPTION_STATE.json";
const changelog = config.files?.changelog || "CHANGELOG.md";
const git = (...a) => execFileSync("git", a, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const log = (m) => process.stderr.write(`[stub] ${m}\n`);

log(`prompt: ${prompt} · phase: ${phase} · branch: ${git("rev-parse", "--abbrev-ref", "HEAD")}`);

// Failure knobs, to prove the runner's own guards rather than only the happy path:
//   STUB_CRASH=1     exit 1 with no result JSON, like a CLI that fails to start
//   STUB_DENIALS=20  a result carrying that many permission denials, like a -p session whose
//                    mode did not take and that was refused everything
//   STUB_CANARY_SKIP_GUARD=1 / STUB_CANARY_SKIP_STOP=1  a canary in which the guard / the Stop
//                    hook did not fire, to prove the runner refuses the night on each
//   STUB_CANARY_MCP=1  a canary that reports a Slack tool, as a session in which
//                    --strict-mcp-config did not take; the runner must refuse the night
//   STUB_TAMPER=1   the phase also commits an edit to the config, as a worker that
//                    reached the config would; the Stop gate must refuse and the runner must abort
if (process.env.STUB_CRASH === "1") {
  process.stderr.write("Error: simulated startup failure (STUB_CRASH=1)\n");
  process.exit(1);
}
if (process.env.STUB_DENIALS) {
  const n = Number(process.env.STUB_DENIALS) || 0;
  process.stdout.write(JSON.stringify({ type: "result", subtype: "success", is_error: false, result: "stub refused everything", total_cost_usd: 0.4, permission_denials: Array.from({ length: n }, (_, i) => ({ tool_name: "Bash", tool_input: { command: `cmd ${i}` } })), session_id: `stub-${process.pid}` }) + "\n");
  process.exit(0);
}

// The canary: what a real session does when the runner's pre-flight prompt reaches it. The guard
// is asked about the --no-verify commit (and appends its denial), the Stop hook runs once (and
// leaves its receipt), and the answer is the short hash - unless a knob says a hook did not fire.
if (/^Canary for the night harness/.test(prompt)) {
  const head = git("rev-parse", "--short", "HEAD");
  const denials = [];
  if (process.env.STUB_CANARY_SKIP_GUARD !== "1") {
    const r = spawnSync(process.execPath, [".claude/hooks/guard.mjs"], { input: JSON.stringify({ tool_name: "Bash", tool_input: { command: "git commit --allow-empty --no-verify -m canary" } }), encoding: "utf8", env: process.env });
    let decision = "none";
    try { decision = JSON.parse(r.stdout).hookSpecificOutput.permissionDecision; } catch {}
    log(`canary: guard said ${decision} to the --no-verify commit`);
    if (decision === "deny") denials.push({ tool_name: "Bash", tool_input: { command: "git commit --allow-empty --no-verify -m canary" } });
    else git("commit", "--allow-empty", "--no-verify", "-m", "canary");
  } else {
    git("commit", "--allow-empty", "--no-verify", "-m", "canary");
  }
  const sessionId = `stub-canary-${process.pid}`;
  if (process.env.STUB_CANARY_SKIP_STOP !== "1") {
    const r = spawnSync(process.execPath, [".claude/hooks/stop-gate.mjs"], { input: JSON.stringify({ session_id: sessionId }), encoding: "utf8", env: process.env });
    log(`canary: stop-gate exit ${r.status}`);
  }
  // The MCP part of the answer: "none" as a real session under --strict-mcp-config with an empty
  // config answers, or a Slack tool when STUB_CANARY_MCP=1 says the flag did not take.
  const mcp = process.env.STUB_CANARY_MCP === "1" ? "mcp__mail_example__send_message" : "none";
  process.stdout.write(JSON.stringify({ type: "result", subtype: "success", is_error: false, result: `${head} ${mcp}`, total_cost_usd: 0.31, permission_denials: denials, session_id: sessionId }) + "\n");
  process.exit(0);
}

if (wrapUp) {
  // The real skill writes docs/ADOPTION_REPORT_<date>.md AND adds it to the docs index; a stub
  // cannot know the repository's index format, so it leaves the tree as it is and only proves
  // the Stop loop on a wrap-up.
  log("wrap-up: nothing to write in the stub");
} else {
  const state = readJson(stateFile);
  if (!Array.isArray(state.phases)) throw new Error(`${stateFile}: "phases" is not an array (the runner wrote it wrong)`);
  const entry = state.phases.find((p) => String(p.id) === String(phase));
  if (!entry) throw new Error(`phase ${phase} not in ${stateFile}`);
  entry.status = "done";
  entry.numbersBefore = entry.numbersBefore || { stub: 1 };
  entry.numbersAfter = { stub: 0 };
  entry.updatedAt = new Date().toISOString();
  writeFileSync(stateFile, JSON.stringify(state, null, 2) + "\n");
  if (existsSync(changelog)) {
    const text = readFileSync(changelog, "utf8");
    const marker = /## \[Unreleased\]\s*\n/i;
    writeFileSync(changelog, marker.test(text) ? text.replace(marker, (m) => `${m}\n- Stub run: phase ${phase} exercised the harness.\n`) : `## [Unreleased]\n\n- Stub run: phase ${phase} exercised the harness.\n\n${text}`);
  }
  if (process.env.STUB_TAMPER === "1") {
    const cfgPath = configPath;
    const tampered = { ...readJson(cfgPath), commands: { ...(readJson(cfgPath).commands || {}), gate: "node -e process.exit(0)" } };
    writeFileSync(cfgPath, JSON.stringify(tampered, null, 2) + "\n");
    git("add", cfgPath);
    git("commit", "-q", "-m", "chore: point the gate at a no-op (tamper)");
    log(`tamper: committed an edit to ${cfgPath}`);
  }
  // Leave the tree DIRTY on purpose: the Stop gate must be what forces the commit.
}

// ---- the agent's Stop loop, as the harness would drive it ---------------------------------
const sessionId = `stub-${process.pid}`;
let blocks = 0;
for (let attempt = 1; attempt <= 8; attempt++) {
  const r = spawnSync(process.execPath, [".claude/hooks/stop-gate.mjs"], { input: JSON.stringify({ session_id: sessionId, stop_hook_active: attempt > 1 }), encoding: "utf8", env: process.env });
  if (r.status === 0) { log(`stop allowed after ${blocks} block(s)`); break; }
  blocks++;
  const reason = (r.stderr || "").trim().split("\n").slice(0, 3).join(" | ");
  log(`stop blocked (${attempt}): ${reason.slice(0, 200)}`);
  // Act on the reason the way the skill says: commit the finished step with a message.
  try {
    git("add", "-A");
    git("commit", "-q", "-m", wrapUp ? `chore(standards): wrap up run (stub)` : `chore(standards): phase ${phase} - stub`);
  } catch (e) {
    log(`nothing to commit or commit failed: ${String(e.message).slice(0, 120)}`);
  }
}

process.stdout.write(JSON.stringify({ type: "result", subtype: "success", is_error: false, result: `stub finished ${wrapUp ? "wrap-up" : "phase " + phase}`, total_cost_usd: 1.25, permission_denials: [], session_id: sessionId }) + "\n");
