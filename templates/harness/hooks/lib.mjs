// Shared helpers for the .claude/hooks/*.mjs scripts. Exec form ("command": "node",
// "args": [".claude/hooks/x.mjs"]) means: cwd is the project root, stdin carries the event JSON,
// stdout is read as a decision when it is JSON, stderr is the reason the model sees on exit 2.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
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

/** The one config at the root (a tool-neutral name any agent reads), and its older place. */
export const ROOT_CONFIG = "abatty.config.json";
export const LEGACY_CONFIG = ".claude/adoption.json";

/** Where the config is read from: ADOPTION_CONFIG (the self-test), else the root file when it exists, else the older place. */
export function configPath() {
  if (process.env.ADOPTION_CONFIG) return process.env.ADOPTION_CONFIG;
  return existsSync(ROOT_CONFIG) ? ROOT_CONFIG : LEGACY_CONFIG;
}

/** True for a path the worker never writes at night: the agent folder and the root config. */
export function isHarnessPath(rel) {
  return rel.startsWith(HARNESS_DIR) || rel === ROOT_CONFIG;
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
    scrub: { enabled: false, ...(fromFile.scrub || {}) },
    provenance: { trailer: "", ...(fromFile.provenance || {}) },
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
 * The uncommitted files as they are now, each with a hash of its content ("gone" when deleted):
 * what a session found when it started. Several sessions share one worktree, and a night that
 * judges the whole tree at its stop would be told to commit or delete files another session
 * owns; with this taken at the start it judges only what it changed itself.
 * @returns {Record<string, string>}
 */
export function treeSnapshot() {
  const snap = {};
  // Not through git(): it trims, and the first line's leading status column is part of the format.
  let status = "";
  try {
    status = execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch {
    return snap;
  }
  for (const line of status.split("\n")) {
    if (!line.trim()) continue;
    const path = line.slice(3).replace(/^.* -> /, "").replace(/^"|"$/g, "");
    let hash = "gone";
    try {
      hash = createHash("sha1").update(readFileSync(path)).digest("hex");
    } catch {
      /* deleted, or a folder: "gone" is the fact to compare */
    }
    snap[path] = hash;
  }
  return snap;
}

/** Where a session's starting snapshot is kept. @param {string | undefined} sessionId */
export const snapshotFile = (sessionId) => join(NIGHT_DIR, `start-tree-${sessionId || "no-session"}.json`);

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

/**
 * Coupled paths, the same mechanism the ratchet's probe runs (src/core/coupled.mjs in the
 * package): a pattern is a prefix, or a glob with `*` and `**`; over a range, oldest first, a
 * commit touching a `when` path without a `then` path is an offender until a later commit
 * touches the `then` path. Returns one line per offender.
 */
export function coupledOffenders(range, declared) {
  const pairs = (Array.isArray(declared) ? declared : [])
    .map((d) => ({ when: [].concat(d?.when ?? []).map(String), then: [].concat(d?.then ?? []).map(String), why: String(d?.why || "") }))
    .filter((p) => p.when.length && p.then.length);
  if (!pairs.length) return [];
  const matcher = (pattern) => {
    const p = String(pattern).replace(/\\/g, "/");
    if (!/[*?]/.test(p)) return (path) => path === p || path.startsWith(p) || path.includes(`/${p}`);
    let re = "^";
    for (let i = 0; i < p.length; i++) {
      const ch = p.charAt(i);
      if (ch === "*" && p.charAt(i + 1) === "*") {
        if (p.charAt(i + 2) === "/") {
          re += "(?:.*/)?";
          i += 2;
        } else {
          re += ".*";
          i += 1;
        }
      } else if (ch === "*") re += "[^/]*";
      else if (ch === "?") re += "[^/]";
      else re += /[.+^${}()|[\]\\]/.test(ch) ? `\\${ch}` : ch;
    }
    return (path) => new RegExp(re + "$").test(path);
  };
  const commits = git("log", "--reverse", "--no-merges", "--format=%h%x00%s", range)
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      const [sha, subject] = l.split("\0");
      return { sha, subject: subject || "", files: git("diff-tree", "--no-commit-id", "--name-only", "-r", sha).split("\n").filter(Boolean) };
    });
  const out = [];
  for (const pair of pairs) {
    const whenHit = pair.when.map(matcher);
    const thenHit = pair.then.map(matcher);
    let pending = [];
    for (const c of commits) {
      if (c.files.some((f) => thenHit.some((m) => m(f)))) {
        pending = [];
        continue;
      }
      const hit = c.files.filter((f) => whenHit.some((m) => m(f)));
      if (hit.length) pending.push(`${c.sha} ${c.subject}: ${hit[0]} changed, ${pair.then.join(" or ")} not touched after it${pair.why ? ` (${pair.why})` : ""}`);
    }
    out.push(...pending);
  }
  return out;
}
