// Shared helpers for the .claude/hooks/*.mjs scripts. Exec form ("command": "node",
// "args": [".claude/hooks/x.mjs"]) means: cwd is the project root, stdin carries the event JSON,
// stdout is read as a decision when it is JSON, stderr is the reason the model sees on exit 2.

import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

/** The harness lives here and is read-only to the worker in an unattended run. */
export const HARNESS_DIR = ".claude/";

/**
 * Where a run keeps its counters, receipts and logs (gitignored). ADOPTION_NIGHT_DIR overrides it
 * so the self-test never writes into a real night's folder.
 */
export const NIGHT_DIR = process.env.ADOPTION_NIGHT_DIR || join(".claude", "night");

/** JSON.parse that tolerates a UTF-8 BOM - Windows PowerShell 5.1 writes one with -Encoding utf8. */
export function parseJsonText(text) {
  return JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
}
export function parseJsonFile(path) {
  return parseJsonText(readFileSync(path, "utf8"));
}

/** The event JSON the agent writes to stdin. Empty object if stdin is empty or malformed. */
export function readEvent() {
  try {
    const raw = readFileSync(0, "utf8");
    return raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** True in an unattended run: the runner exports ADOPTION_RUN=1 and hooks inherit it. */
export const NIGHT = process.env.ADOPTION_RUN === "1";

/** Where .claude/adoption.json is read from (ADOPTION_CONFIG overrides, for the self-test). */
export function configPath() {
  return process.env.ADOPTION_CONFIG || ".claude/adoption.json";
}

function withDefaults(fromFile) {
  return {
    baseBranch: "main",
    branchPrefix: "adopt/standards",
    commands: { gate: "npm run gate:fast", lintFile: "npx eslint --max-warnings=0" },
    files: {
      changelog: "CHANGELOG.md",
      state: "docs/ADOPTION_STATE.json",
      decisions: "docs/ADOPTION_DECISIONS.md",
      baseline: "scripts/ci/standards-baseline.json",
    },
    changelogRequiredFor: ["src/", "server/", "apps/", "packages/", "scripts/", "migrations/"],
    protectedPaths: ["migrations/", "drizzle/", ".env"],
    lintOnEdit: true,
    lintExtensions: [".ts", ".tsx", ".js", ".jsx", ".mjs"],
    maxStopBlocks: 6,
    ...fromFile,
    commands: { ...(fromFile.commands || {}) },
    files: { ...(fromFile.files || {}) },
  };
}

/** .claude/adoption.json as it is in the working tree, with defaults for anything it leaves out. */
export function loadConfig() {
  const path = configPath();
  try {
    return withDefaults(existsSync(path) ? parseJsonFile(path) : {});
  } catch (err) {
    // A corrupt tree copy must not crash a hook (a crashed hook does not block): defaults, and
    // the base copy where a hook reads it, decide instead.
    process.stderr.write(`[hooks] ${path} does not parse (${err.message}); using defaults\n`);
    return withDefaults({});
  }
}

/**
 * The config the Stop gate trusts at night: the copy COMMITTED ON THE BASE BRANCH, which a human
 * wrote, never the working-tree copy the worker can edit. A worker that points `commands.gate` at
 * `echo ok` in the tree changes nothing here. Falls back to the tree copy, and says so, when the
 * base has no such file (a config outside the repository, as in the self-test) - the runner's own
 * "harness untouched" check is the second net for that case.
 */
export function loadTrustedConfig(base) {
  const rel = toRepoPath(configPath());
  if (NIGHT && rel && base) {
    const text = git("show", `${base}:${rel}`);
    if (text) {
      try {
        return { config: withDefaults(parseJsonText(text)), source: "base" };
      } catch {
        /* unreadable on the base: fall through to the tree copy */
      }
    }
  }
  return { config: loadConfig(), source: "tree" };
}

/**
 * A path from a tool input as a repository-relative POSIX path, or null when it points outside
 * the repository (the hooks run with cwd = the project root).
 */
export function toRepoPath(p) {
  if (!p) return null;
  const rel = relative(resolve(process.cwd()), resolve(String(p)));
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) return rel === "" ? "" : null;
  return rel.split(sep).join("/");
}

/** Run git and return trimmed stdout, or "" when it fails - a hook must never crash on git. */
export function git(...args) {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 32 * 1024 * 1024 }).trim();
  } catch {
    return "";
  }
}

export function currentBranch() {
  return git("rev-parse", "--abbrev-ref", "HEAD");
}

/** Print a PreToolUse decision. `deny` blocks; `ask` prompts (a denial in unattended runs). */
export function decide(permissionDecision, reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision, permissionDecisionReason: reason },
    }) + "\n",
  );
}

/** A per-session counter file under .claude/night/, so a Stop hook cannot loop forever. */
export function counter(name, sessionId) {
  const file = join(NIGHT_DIR, `${name}-${sessionId || "no-session"}.json`);
  mkdirSync(dirname(file), { recursive: true });
  const value = existsSync(file) ? Number(readFileSync(file, "utf8")) || 0 : 0;
  return {
    value,
    increment() {
      writeFileSync(file, String(value + 1));
      return value + 1;
    },
  };
}

/**
 * What a hook decided, written where the runner and the morning can read it: .claude/night/<name>.json.
 * A hook that only exits leaves no trace of having run; the canary and the report need one.
 */
export function writeReceipt(name, data) {
  try {
    const file = join(NIGHT_DIR, `${name}.json`);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify({ at: new Date().toISOString(), ...data }, null, 2) + "\n");
  } catch {
    /* a receipt is evidence, never a reason to fail the hook */
  }
}

/** One JSON line per denial, .claude/night/<name>.jsonl, so a night's refusals are countable. */
export function appendLog(name, data) {
  try {
    const file = join(NIGHT_DIR, `${name}.jsonl`);
    mkdirSync(dirname(file), { recursive: true });
    appendFileSync(file, JSON.stringify({ at: new Date().toISOString(), ...data }) + "\n");
  } catch {
    /* same: evidence only */
  }
}

/**
 * The agent's executable, from the machine that runs the night, never from the repository:
 * ABATTY_AGENT, else `agent.command` in ~/.abatty/config.json. Empty when neither is set, and
 * the self-test says so before a night is spent finding out.
 */
export function agentCommand() {
  if (process.env.ABATTY_AGENT) return process.env.ABATTY_AGENT;
  try {
    const cfg = parseJsonFile(join(homedir(), ".abatty", "config.json"));
    return typeof cfg?.agent?.command === "string" ? cfg.agent.command : "";
  } catch {
    return "";
  }
}

/** Last N lines of a command's combined output, for a reason the model can act on. */
export function tail(text, lines = 60) {
  const all = String(text || "").split(/\r?\n/).filter(Boolean);
  return all.slice(-lines).join("\n");
}
