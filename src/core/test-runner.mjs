/**
 * Which unit runner a repository's tests run on, read from the script that runs them, and the
 * command that runs a chosen set of test files on it. The TEST rule asks the first question;
 * `abatty mutate` asks both. Its default was `node --test {files}` on every stack, so a vitest
 * product had every mutant read as `tests red` and nothing judged.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { git, readPackage } from "./repo.mjs";
import { packageManager } from "./package-manager.mjs";

/** @typedef {"vitest" | "bun test" | "jest" | "node --test" | ""} Runner */

/**
 * The runner a script names, or "" when it names none (a wrapper like `node scripts/test.mjs`, a
 * hand-off like `turbo run test`).
 * @param {string} script @returns {Runner}
 */
export function runnerOfScript(script) {
  if (/\bvitest\b/.test(script)) return "vitest";
  if (/\bbun test\b/.test(script)) return "bun test";
  if (/\bjest\b/.test(script)) return "jest";
  if (/\bnode\b[^&|]*--test/.test(script)) return "node --test";
  return "";
}

/**
 * The runner of a repository: its own test script, else the first workspace's, else an installed
 * runner, else the platform's when a test imports `node:test`. "" when nothing says, which is
 * reported rather than guessed.
 * @param {string} repoDir @returns {Runner}
 */
export function runnerOf(repoDir) {
  const pkg = readPackage(repoDir);
  const own = runnerOfScript(String(pkg.scripts?.test || ""));
  if (own) return own;
  const manifests = git(repoDir, "ls-files", "--", ":(glob)**/package.json")
    .split("\n")
    .filter((f) => f && f !== "package.json");
  for (const f of manifests) {
    try {
      const r = runnerOfScript(
        String(JSON.parse(readFileSync(join(repoDir, f), "utf8")).scripts?.test || ""),
      );
      if (r) return r;
    } catch {
      /* a manifest that does not parse names no runner */
    }
  }
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  if (deps.vitest) return "vitest";
  if (deps.jest) return "jest";
  const platform = git(
    repoDir,
    "grep",
    "-l",
    "-E",
    "[\"']node:test[\"']",
    "--",
    ":(glob)**/*.test.*",
  );
  return platform ? "node --test" : "";
}

/**
 * The command that runs a set of test files on the repository's runner, `{files}` where they go,
 * through its package manager for an installed runner. "" when the runner is unknown.
 * @param {string} repoDir @returns {string}
 */
export function testFilesCommand(repoDir) {
  const runner = runnerOf(repoDir);
  const exec = (/** @type {string} */ tool) =>
    (packageManager(repoDir)?.exec(tool) || ["npx", tool]).join(" ");
  if (runner === "vitest") return `${exec("vitest")} run {files}`;
  if (runner === "jest") return `${exec("jest")} {files}`;
  if (runner === "bun test") return "bun test {files}";
  if (runner === "node --test")
    return [
      "node",
      ...nodeFlags(String(readPackage(repoDir).scripts?.test || "")),
      "--test",
      "{files}",
    ].join(" ");
  return "";
}

/** node flags that take their value as the next word. */
const VALUED = new Set([
  "--import",
  "--require",
  "-r",
  "--loader",
  "--conditions",
  "-C",
  "--env-file",
]);
/** What a test file run on its own does not want: a report written elsewhere, a coverage pass. */
const RUN_WIDE =
  /^--(test-reporter|test-coverage|experimental-test-coverage|test-concurrency|test-shard)/;

/**
 * The node flags a `node --test` script runs its files with (`--experimental-strip-types`,
 * `--import tsx`), less the run-wide ones. mutate ran `node --test {files}` bare, so a repository
 * whose tests needed a loader read every mutant as `tests red` and judged nothing.
 * @param {string} script @returns {string[]}
 */
export function nodeFlags(script) {
  const words = (script.match(/\bnode\b([^&|;]*)/)?.[1] || "").trim().split(/\s+/).filter(Boolean);
  /** @type {string[]} */
  const out = [];
  for (let i = 0; i < words.length; i++) {
    const w = String(words[i]);
    if (!w.startsWith("-") || w === "--test") continue;
    const value = VALUED.has(w) && i + 1 < words.length ? String(words[++i]) : "";
    if (!RUN_WIDE.test(w)) out.push(...(value ? [w, value] : [w]));
  }
  return out;
}
