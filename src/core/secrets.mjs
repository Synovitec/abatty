/**
 * The secret scan: one implementation for the pre-commit hook (the staged files), the gate
 * (the tree), and CI (the pushed range). No dependency, no network: a short list of shapes
 * that are secrets wherever they appear (a private key block, a cloud access key, a hosting
 * provider's token, a payment key, a chat token, a signed web token) and one generic shape (an
 * assignment of a long literal to a name that says key, secret, token or password). A false
 * positive is silenced on its line with `abatty:allow-secret`, or by path through
 * `secrets.allow` in the config, with the reason beside it.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { git, readConfig } from "./repo.mjs";

/** @typedef {{ path: string, line: number, kind: string, sample: string }} SecretFinding */

const ALLOW_MARK = "abatty:allow-secret";
const SKIP_PATH =
  /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|standards-baseline\.json)$|(^|\/)(node_modules|\.git|dist|build|coverage)\/|\.(png|jpe?g|gif|webp|svg|ico|woff2?|ttf|otf|eot|pdf|zip|gz|tgz|br|mp[34]|mov|wasm|map)$/;
const SKIP_SELF = /(^|\/)secrets\.(mjs|test\.mjs)$/;

/** @type {[kind: string, re: RegExp][]} */
export const SHAPES = [
  [
    "private key block",
    /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY(?: BLOCK)?-----/,
  ],
  ["cloud access key id", /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
  ["hosting provider token", /\bgh[pousr]_[A-Za-z0-9]{36,}\b|\bgithub_pat_[A-Za-z0-9_]{60,}\b/],
  ["payment key", /\b[sr]k_(?:live|test)_[A-Za-z0-9]{20,}\b/],
  ["chat token", /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/],
  ["signed web token", /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/],
  [
    "a long literal assigned to a secret-like name",
    /\b(?:api[_-]?key|secret[_-]?key|client[_-]?secret|access[_-]?token|auth[_-]?token|password|passwd)\b\s*[:=]\s*["'`]([A-Za-z0-9+/=_\-.]{16,})["'`]/i,
  ],
];

/** Placeholders and samples nobody would use: a value that is only x's, stars or one digit, or one that starts like a template. */
const PLACEHOLDER_WHOLE = /^(?:x+|\*+|0+|1+)$/i;
const PLACEHOLDER_START =
  /^(?:<[^>]+>|\$\{|\{\{|your[-_ ]|change[-_ ]?me|example|placeholder|dummy|sample|test|redacted)/i;

/** Scan one text. @param {string} path @param {string} text */
export function scanText(path, text) {
  /** @type {SecretFinding[]} */
  const out = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] || "";
    if (line.includes(ALLOW_MARK)) continue;
    for (const [kind, re] of SHAPES) {
      const m = line.match(re);
      if (!m) continue;
      const value = m[1] || m[0];
      if (PLACEHOLDER_WHOLE.test(value) || PLACEHOLDER_START.test(value)) continue;
      out.push({ path, line: i + 1, kind, sample: value.slice(0, 6) + "…" + value.slice(-3) });
      break;
    }
  }
  return out;
}

/** The allow-list of paths: `secrets.allow` in the config. @param {string} repoDir */
export function secretsAllow(repoDir) {
  const c = readConfig(repoDir);
  return Array.isArray(c?.secrets?.allow) ? c.secrets.allow.map(String) : [];
}

/**
 * Scan files of the repository. `mode`: "tree" (tracked and untracked-but-not-ignored),
 * "staged" (the index, for the pre-commit hook), or a git range (the files it touched).
 * @param {string} repoDir @param {{ mode?: "tree" | "staged" | string, allow?: string[] }} [o]
 * @returns {{ scanned: number, findings: SecretFinding[] }}
 */
export function scanSecrets(repoDir, o = {}) {
  const mode = o.mode || "tree";
  /** @type {string[]} */
  const allow = o.allow || secretsAllow(repoDir);
  /** @type {string[]} */
  let files;
  if (mode === "staged")
    files = git(repoDir, "diff", "--cached", "--name-only", "--diff-filter=ACMR").split("\n");
  else if (mode === "tree")
    files = git(
      repoDir,
      "ls-files",
      "-z",
      "--cached",
      "--others",
      "--exclude-standard",
      "--deduplicate",
    ).split("\0");
  else files = git(repoDir, "diff", "--name-only", "--diff-filter=ACMR", mode).split("\n");
  files = files
    .filter(Boolean)
    .filter((f) => !SKIP_PATH.test(f) && !SKIP_SELF.test(f) && !allow.some((a) => f.includes(a)));
  /** @type {SecretFinding[]} */
  const findings = [];
  let scanned = 0;
  for (const f of files) {
    const p = join(repoDir, f);
    if (!existsSync(p)) continue;
    try {
      if (statSync(p).size > 2 * 1024 * 1024) continue;
      const buf = readFileSync(p);
      if (buf.subarray(0, 512).includes(0)) continue; // binary
      scanned++;
      findings.push(...scanText(f, buf.toString("utf8")));
    } catch {
      /* unreadable: not a finding */
    }
  }
  return { scanned, findings };
}

/**
 * The audit, as the gate runs it: `npm audit --audit-level=high` when a lockfile exists. No
 * network is a deferral to CI, said loudly, never a red gate and never a green one.
 * @param {string} repoDir @param {(cmd: string, args: string[]) => { status: number | null, output: string }} run
 * @returns {{ outcome: "ok" | "failed" | "skipped" | "deferred", detail: string }}
 */
export function auditOutcome(repoDir, run) {
  if (
    !existsSync(join(repoDir, "package-lock.json")) &&
    !existsSync(join(repoDir, "npm-shrinkwrap.json"))
  )
    return { outcome: "skipped", detail: "no package-lock.json (an npm audit needs one)" };
  const r = run("npm", ["audit", "--audit-level=high", "--omit=dev"]);
  if (r.status === 0) return { outcome: "ok", detail: "" };
  if (
    /ENOTFOUND|ECONNREFUSED|EAI_AGAIN|ETIMEDOUT|ENETUNREACH|network|registry.*(unreachable|offline)/i.test(
      r.output,
    )
  )
    return { outcome: "deferred", detail: "the registry is unreachable; CI runs the audit" };
  return {
    outcome: "failed",
    detail: r.output.split(/\r?\n/).filter(Boolean).slice(-8).join("\n"),
  };
}
