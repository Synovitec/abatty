// Stop hook: in an unattended run the session may not end while "done" is only an opinion.
//
// Order, cheapest failure last on purpose: the gate runs FIRST so the agent fixes code before it
// commits it; then nothing may have been loosened against the base branch (a green bought by a
// raised floor, a lowered threshold, a rule switched off or an edited hook is not green); then the
// tree must be clean (every step is a commit); then the newest source-touching commit on the
// branch must be followed or accompanied by a CHANGELOG touch; then the phase's entry in the state
// file must have been updated during this run. Any failure blocks the stop with exit 2 - the
// documented behaviour that blocks regardless of JSON - and the reason on stderr is what the model
// reads next.
//
// What this hook trusts: the adoption.json COMMITTED ON THE BASE BRANCH (ADOPTION_BASE from the
// runner), never the working-tree copy, because the worker can edit the tree. The tree copy is
// the fallback when the base has none, and the receipt says which one was used.
//
// A counter per session caps the blocks (config.maxStopBlocks, default 6). After that the session
// is allowed to end and the runner reads the state file to mark the phase blocked. Without the
// cap, one defect the model cannot fix would burn the whole night on a loop.
//
// Every invocation leaves a receipt in .claude/night/stop-gate-<session>.json: what it checked,
// what it decided, why. The canary and the morning report read them.
//
// Daytime (ADOPTION_RUN unset): exits 0 immediately. The gate is still yours to run.

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { checkDirection, formatDirection } from "./check-direction.mjs";
import { join } from "node:path";
import { NIGHT, NIGHT_DIR, appendLog, counter, currentBranch, git, loadConfig, loadTrustedConfig, parseJsonFile, readEvent, tail, writeReceipt } from "./lib.mjs";

if (!NIGHT) process.exit(0);

// Fail closed: a hook that crashes exits 1, which the agent treats as non-blocking, and the
// session would end on the defect. At night an internal error is a refusal with the error as
// the reason; the agent's own cap of 8 consecutive blocks bounds it.
process.on("uncaughtException", (err) => {
  process.stderr.write(`[stop-gate] internal error, refusing the stop: ${err && err.stack ? err.stack : err}\n`);
  process.exit(2);
});

const event = readEvent();
const treeConfig = loadConfig();
const base = process.env.ADOPTION_BASE || treeConfig.baseBranch || "main";
const { config, source } = loadTrustedConfig(base);
const blocks = counter("stop-blocks", event.session_id);
const phase = process.env.ADOPTION_PHASE;
const receipt = { sessionId: event.session_id || null, phase: phase ?? null, branch: currentBranch(), base, configSource: source, checks: [], decision: null, reason: null };
const receiptName = `stop-gate-${event.session_id || "no-session"}`;

if (blocks.value >= (config.maxStopBlocks || 6)) {
  receipt.decision = "cap";
  receipt.reason = `${blocks.value} blocks this session`;
  writeReceipt(receiptName, receipt);
  process.stderr.write(`[stop-gate] ${blocks.value} blocks this session; letting it end. The runner will mark the phase blocked.\n`);
  process.exit(0);
}

function block(check, reason) {
  const n = blocks.increment();
  receipt.checks.push({ check, ok: false });
  receipt.decision = "block";
  receipt.reason = reason.split("\n")[0].slice(0, 300);
  receipt.blockNumber = n;
  writeReceipt(receiptName, receipt);
  // The receipt is overwritten by the next attempt; the log keeps every block for the morning.
  appendLog("stop-blocks", { sessionId: event.session_id || null, phase: phase ?? null, check, reason: receipt.reason, block: n });
  process.stderr.write(`[stop-gate] block ${n}/${config.maxStopBlocks || 6}\n${reason}\n`);
  process.exit(2);
}
const pass = (check, detail) => receipt.checks.push({ check, ok: true, ...(detail ? { detail } : {}) });

// 1. The branch.
const branch = currentBranch();
const wanted = process.env.ADOPTION_BRANCH || "";
if (wanted && branch !== wanted) {
  block("branch", `You are on "${branch}" but the run works on "${wanted}". Run: git checkout ${wanted}`);
}
pass("branch");

// 2. The gate. The command string comes from the committed adoption.json (base copy at night), not
// from the model or a request, and it needs a shell on Windows (npm is a .cmd shim) - which is why
// this is execSync with shell: true rather than execFile.
const gateCmd = config.commands?.gate || "npm run gate:fast";
if (source === "tree") process.stderr.write(`[stop-gate] adoption.json is not on ${base}; using the working-tree copy\n`);
try {
  execSync(gateCmd, { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8", timeout: 25 * 60 * 1000, maxBuffer: 64 * 1024 * 1024, shell: true });
} catch (err) {
  const out = `${err.stdout || ""}\n${err.stderr || ""}`;
  block("gate", `The gate is red (${gateCmd}). Fix the cause, never the threshold; never add an eslint-disable or raise a baseline number to pass. Last lines:\n${tail(out, 80)}`);
}
pass("gate", gateCmd);

// 3. Nothing loosened against the base: the harness untouched, no floor raised, no threshold
// lowered, no rule off or ignore added without a decision naming it, the instrument's files present.
const direction = checkDirection({ base, config });
if (!direction.ok) {
  if (process.env.ADOPTION_BASE) block("direction", `The base branch "${base}" cannot be read, so nothing about this branch can be judged. This is the environment, not the phase; the runner will stop.`);
  pass("direction", `skipped: ${direction.error}`);
} else if (direction.blocking.length) {
  block("direction", `${formatDirection(direction).join("\n")}\n\nA green gate reached this way does not count. Restore what was loosened; a deliberate exemption is a bullet in ${config.files?.decisions || "docs/ADOPTION_DECISIONS.md"} that names the rule, path or flag, and then this check records it instead of refusing it.`);
} else {
  pass("direction", direction.recorded.length ? `${direction.recorded.length} loosening(s) recorded by decision` : undefined);
}

// 4. A clean tree: every finished step is a commit.
const dirty = git("status", "--porcelain")
  .split("\n")
  .filter((l) => l.trim() && !l.includes(".claude/night/"));
if (dirty.length > 0) {
  block("tree", `Uncommitted changes:\n${dirty.slice(0, 40).join("\n")}\n\nCommit them (Conventional Commit, one behaviour per commit, a line under [Unreleased] in ${config.files?.changelog || "CHANGELOG.md"}), or restore them if they are not a finished step.`);
}
pass("tree");

// 5. The changelog, per commit over the branch range: every source-touching commit is followed or
// accompanied by a changelog touch. A single line added at the start of the branch used to cover
// twenty later commits without one; now the newest source commit is what is judged, and the cure
// is monotone (a commit that adds the missing entries), because amending is denied at night.
const mergeBase = git("merge-base", base, "HEAD") || git("merge-base", `origin/${base}`, "HEAD");
if (mergeBase) {
  const changelog = config.files?.changelog || "CHANGELOG.md";
  const required = config.changelogRequiredFor || [];
  const offenders = [];
  for (const sha of git("log", "--format=%H", "--no-merges", `${mergeBase}..HEAD`).split("\n").filter(Boolean)) {
    const files = git("diff-tree", "--no-commit-id", "--name-only", "-r", sha).split("\n").filter(Boolean);
    if (files.includes(changelog)) break;
    if (required.some((p) => files.some((f) => f.startsWith(p)))) offenders.push(sha);
  }
  if (offenders.length) {
    const list = offenders.slice(0, 10).map((sha) => git("log", "-1", "--format=%h %s", sha)).join("\n");
    block("changelog", `${offenders.length} commit(s) touched source after the last ${changelog} entry:\n${list}\n\nAdd the entries for them under ## [Unreleased], written for the reader, in a new commit (amending is not allowed unattended).`);
  }
}
pass("changelog");

// 6. The state file, for the phase this session was started for.
const stateFile = config.files?.state || "docs/ADOPTION_STATE.json";
const runFile = join(NIGHT_DIR, "run.json");
if (phase !== undefined && phase !== "" && phase !== "wrap-up" && existsSync(stateFile) && existsSync(runFile)) {
  try {
    const state = parseJsonFile(stateFile);
    const run = parseJsonFile(runFile);
    if (!Array.isArray(state.phases)) {
      block("state", `${stateFile}: "phases" must be an array of { id, status, ... }, got ${state.phases === undefined ? "nothing" : typeof state.phases}. Rewrite it as an array (one entry per phase in .claude/adoption.json) and commit.`);
    }
    const entry = state.phases.find((p) => String(p.id) === String(phase));
    const updated = entry?.updatedAt || "";
    if (!entry || !run.startedAt || updated < run.startedAt) {
      block("state", `${stateFile} has no update for phase ${phase} since the run started (${run.startedAt || "unknown"}). Set phases[${phase}].status to done | in_progress | blocked with reason, numbersBefore, numbersAfter, updatedAt (ISO), and commit it.`);
    }
  } catch (err) {
    block("state", `${stateFile} is unreadable: ${err.message}. Restore a valid JSON state file and commit it.`);
  }
}
pass("state");

receipt.decision = "allow";
writeReceipt(receiptName, receipt);
process.exit(0);
