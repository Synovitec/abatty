/**
 * `abatty scrub`: no trace of the tools in a repository - its tracked files, its commit
 * messages, its pull requests. `check` finds; `fix` rewrites files by a word map; history is a
 * separate, deliberate step (`--history` prints the git-filter-repo command, it never runs it).
 *
 * A line that mentions only the paths the agent requires (its settings folder, its context
 * file) is not a finding. A repository allows its own product terms through
 * `adoption.json` → `scrub.allow`: path substrings whose files are skipped, with the reason
 * beside each in the decisions file.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { FORBIDDEN, FORBIDDEN_ALL, REQUIRED_PATHS, onlyRequiredPaths } from "./vocabulary.mjs";
import { git, readAdoption } from "./repo.mjs";

/** @typedef {{ kind: "file" | "commit" | "pr", where: string, line?: number, text: string }} ScrubFinding */

const TEXT_EXT =
  /\.(mjs|cjs|js|jsx|ts|tsx|json|jsonc|md|mdx|txt|yml|yaml|toml|ps1|sh|cmd|html|css|scss|svg|sql|env\.example|gitignore|prettierignore|gitattributes)$/i;

/** Tracked text files, minus the allow-list and the vocabulary itself. @param {string} repoDir @param {string[]} allow */
export function scannableFiles(repoDir, allow = []) {
  const out = git(repoDir, "ls-files", "-z").split("\0").filter(Boolean);
  const skip = [
    ...allow,
    "vocabulary.mjs",
    "scrub-map.mjs",
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
  ];
  return out.filter(
    (f) =>
      (TEXT_EXT.test(f) || !/\./.test(f.split("/").pop() || "")) &&
      !skip.some((s) => f.includes(s)),
  );
}

/** Findings in the tracked files. @param {string} repoDir @param {{ allow?: string[] }} [o] */
export function scanFiles(repoDir, o = {}) {
  /** @type {ScrubFinding[]} */
  const findings = [];
  for (const f of scannableFiles(repoDir, o.allow)) {
    let text;
    try {
      text = readFileSync(join(repoDir, f), "utf8");
    } catch {
      continue;
    }
    if (!FORBIDDEN.test(text)) continue;
    text.split(/\r?\n/).forEach((line, i) => {
      if (FORBIDDEN.test(line) && !onlyRequiredPaths(line))
        findings.push({ kind: "file", where: f, line: i + 1, text: line.trim().slice(0, 160) });
    });
  }
  return findings;
}

/** Findings in commit messages over a range (default: the whole history of the current branch). @param {string} repoDir @param {string} [range] */
export function scanCommits(repoDir, range = "") {
  /** @type {ScrubFinding[]} */
  const findings = [];
  const args = ["log", "--format=%H%x00%B%x01", ...(range ? [range] : [])];
  const out = git(repoDir, ...args);
  for (const rec of out.split("\x01")) {
    const [sha, body = ""] = rec.trim().split("\x00");
    if (!sha) continue;
    for (const line of body.split(/\r?\n/))
      if (FORBIDDEN.test(line) && !onlyRequiredPaths(line))
        findings.push({ kind: "commit", where: sha.slice(0, 7), text: line.trim().slice(0, 160) });
  }
  return findings;
}

/** Findings in the pull requests of the GitHub repository (title and body), via gh. @param {string} repoDir @param {number} [limit] */
export function scanPullRequests(repoDir, limit = 300) {
  const r = spawnSync(
    "gh",
    ["pr", "list", "--state", "all", "--limit", String(limit), "--json", "number,title,body"],
    { cwd: repoDir, encoding: "utf8", shell: true },
  );
  if (r.status !== 0) return { ok: false, findings: [], error: (r.stderr || "gh failed").trim() };
  /** @type {ScrubFinding[]} */
  const findings = [];
  for (const pr of JSON.parse(r.stdout || "[]")) {
    for (const line of `${pr.title}\n${pr.body || ""}`.split(/\r?\n/))
      if (FORBIDDEN.test(line) && !onlyRequiredPaths(line))
        findings.push({ kind: "pr", where: `#${pr.number}`, text: line.trim().slice(0, 160) });
  }
  return { ok: true, findings, error: "" };
}

/**
 * Rewrite the tracked files by the word map, longest keys first, case-sensitive; returns the
 * files changed. The map is the repository's (`adoption.json` → `scrub.map`) over the default.
 * @param {string} repoDir @param {Record<string,string>} map @param {{ allow?: string[], dryRun?: boolean }} [o]
 */
export function fixFiles(repoDir, map, o = {}) {
  const keys = Object.keys(map).sort((a, b) => b.length - a.length);
  const changed = [];
  for (const f of scannableFiles(repoDir, o.allow)) {
    let text;
    try {
      text = readFileSync(join(repoDir, f), "utf8");
    } catch {
      continue;
    }
    if (!FORBIDDEN.test(text)) continue;
    // The agent's own paths are placeholders while the map runs, so a folder name survives.
    let next = text;
    REQUIRED_PATHS.forEach((p, i) => (next = next.split(p).join(`\u0000R${i}\u0000`)));
    for (const k of keys) next = next.replace(keyPattern(k), () => map[k] ?? "");
    REQUIRED_PATHS.forEach((p, i) => (next = next.split(`\u0000R${i}\u0000`).join(p)));
    if (next !== text) {
      if (!o.dryRun) writeFileSync(join(repoDir, f), next);
      changed.push(f);
    }
  }
  return changed;
}

/**
 * A key made of letters, digits and spaces is a word or a phrase and applies at word boundaries
 * only (the tool's name inside an identifier is not a mention - it is reported, and renamed
 * by hand or by the repository's own map entry); a key with punctuation is applied literally.
 * @param {string} key
 */
function keyPattern(key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return /^[A-Za-z0-9 ]+$/.test(key)
    ? new RegExp(`(?<![A-Za-z0-9_$])${escaped}(?![A-Za-z0-9_])`, "g")
    : new RegExp(escaped, "g");
}

/** The per-repository allow-list from adoption.json. @param {string} repoDir */
export function allowList(repoDir) {
  const a = readAdoption(repoDir);
  return Array.isArray(a?.scrub?.allow) ? a.scrub.allow.map(String) : [];
}

/** Leftover matches in a text, for the summary. @param {string} text */
export function countMatches(text) {
  return (text.match(FORBIDDEN_ALL) || []).length;
}
