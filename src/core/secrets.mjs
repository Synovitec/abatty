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
  ["cloud API key", /\bAIza[0-9A-Za-z_\-]{35}\b/],
  ["package registry token", /\bnpm_[A-Za-z0-9]{36}\b/],
  ["mail provider key", /\bSG\.[A-Za-z0-9_\-]{16,}\.[A-Za-z0-9_\-]{16,}\b/],
  // The password inside a connection string: the capture is the password alone, so the
  // placeholder rules below judge `${PGPASSWORD}` and `pass` the way they judge any other value.
  [
    "a connection string carrying a password",
    /\b[a-z][a-z0-9+.\-]*:\/\/([^\s:/@]+):([^\s:/@]{8,})@/,
  ],
  [
    "a long literal assigned to a secret-like name",
    /\b(?:api[_-]?key|secret[_-]?key|client[_-]?secret|account[_-]?key|access[_-]?token|auth[_-]?token|password|passwd)\b\s*[:=]\s*["'`]([A-Za-z0-9+/=_\-.]{16,})["'`]/i,
  ],
  // The same name, UNQUOTED: a .env file, an npmrc, a connection string's own segments. Without
  // this the most common shape of all was the one shape the scan could not see.
  [
    "a long value assigned to a secret-like name",
    /\b(?:api[_-]?key|secret[_-]?key|client[_-]?secret|account[_-]?key|access[_-]?token|auth[_-]?token|authToken|_authToken|password|passwd)\b\s*[:=]\s*([A-Za-z0-9+/=_\-.]{16,})\s*[;,]?\s*$/im,
  ],
];

/** Placeholders and samples nobody would use: a value that is only x's, stars or one digit, or one that starts like a template. */
const PLACEHOLDER_WHOLE = /^(?:x+|\*+|0+|1+)$/i;
const PLACEHOLDER_START =
  /^(?:<[^>]+>|\$\{|\$[A-Za-z_]|\{\{|your[-_ ]|change[-_ ]?me|example|placeholder|dummy|sample|test|redacted)/i;
/**
 * A throwaway credential in a connection string: the password is the user name, or it is one of
 * the values every service container in every pipeline uses. Flagging these is how a scan trains
 * its reader to scroll past it, and the day a real one appears they scroll past that too.
 */
const THROWAWAY = /^(?:postgres|mysql|mariadb|mongo|redis|root|admin|guest|test|user|example)$/i;

/** A value that is an expression, not a literal: the correct pattern must never be a finding. */
const EXPRESSION =
  /^(?:process\.env|import\.meta|os\.environ|System\.getenv|Deno\.env|config\.|env\.|secrets\.|vars\.)/i;

/** A source file of a programming language: a literal there is quoted, so an unquoted value is a name. */
const CODE_FILE = /\.(?:[cm]?[jt]sx?|py|go|rb|java|kt|cs|php|rs|swift|scala|dart)$/i;
/** A fixture, a test or a fake: where a sample credential is the point, not a leak. */
const SAMPLE_FILE =
  /(^|\/)(?:fixtures?|__fixtures__|__mocks__|tests?|__tests__|e2e|spec)\/|\.(?:test|spec)\.[^/]+$|(^|\/)[^/]*(?:fixture|fake|mock|stub)[^/]*$/i;
/** The two shapes that read a name, not a format: the ones a readable sample value trips. */
const GENERIC = new Set([
  "a long literal assigned to a secret-like name",
  "a long value assigned to a secret-like name",
]);

/**
 * Bits per character of a value: a readable sample (`mp_access_xyz789`) sits well below a
 * generated secret, whose characters are close to uniform.
 * @param {string} v
 */
function entropy(v) {
  /** @type {Record<string, number>} */
  const n = {};
  for (const c of v) n[c] = (n[c] || 0) + 1;
  return Object.values(n).reduce((h, k) => h - (k / v.length) * Math.log2(k / v.length), 0);
}

/**
 * Scan one text. Two readings are narrowed by where the text lives, because an adopter's scan
 * reported twenty-six findings and none was a secret. In source code the unquoted shape is not
 * read: a literal there is quoted, so `token: config.apiToken` is a variable read and never a
 * leak. In a fixture, a test or a fake, a match on a secret-like NAME counts only when its value
 * looks generated; a provider's own key format is reported wherever it appears.
 * @param {string} path @param {string} text
 */
export function scanText(path, text) {
  /** @type {SecretFinding[]} */
  const out = [];
  const lines = text.split(/\r?\n/);
  const code = CODE_FILE.test(path);
  const sample = SAMPLE_FILE.test(path);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] || "";
    if (line.includes(ALLOW_MARK)) continue;
    for (const [kind, re] of SHAPES) {
      if (code && kind === "a long value assigned to a secret-like name") continue;
      const m = line.match(re);
      if (!m) continue;
      // The connection-string shape captures the user and the password; everything else captures
      // the value alone in group 1, or matches wholesale.
      const isUrl = kind === "a connection string carrying a password";
      const value = isUrl ? String(m[2]) : m[1] || m[0];
      if (isUrl && (value === m[1] || THROWAWAY.test(value))) continue;
      if (PLACEHOLDER_WHOLE.test(value) || PLACEHOLDER_START.test(value)) continue;
      if (EXPRESSION.test(value)) continue;
      if (sample && GENERIC.has(kind) && entropy(value) < 4) continue;
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
