/**
 * Diff-scoped mutation (standard TEST.5), with no dependency: one small textual change per line a
 * push changed, the tests nearest the changed module run against it, the file put back. A mutant
 * the tests did not notice is a changed line whose behaviour no test holds, which is the one
 * question a green suite cannot answer and an agent's own tests are least likely to ask. The
 * shape is the one industrial mutation settled on: only changed lines, one mutant per line, a
 * report rather than a score, since a whole-repository mutation score says little once the size
 * of the suite is accounted for.
 *
 * A source file is changed on disk while its tests run, so the run is built to leave nothing
 * behind: the original is written to a recovery file before the mutant is planted, a signal stops
 * the run after the file is put back, and a run killed outright is repaired by the next one.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { git } from "./repo.mjs";
import { codeOnly } from "../ratchet/probes/lex.mjs";
import { testRunEnv } from "./env.mjs";
import { importersOf } from "./imports.mjs";

/**
 * The textual mutants, in the order they are tried: the first one a line's code carries is the
 * line's mutant. Each is a change a test that checks the line's behaviour notices.
 * @type {[RegExp, string, string][]} pattern, replacement, what the change means
 */
const OPERATORS = [
  [/===/, "!==", "equality inverted"],
  [/!==/, "===", "inequality inverted"],
  [/ <= /, " < ", "boundary moved"],
  [/ >= /, " > ", "boundary moved"],
  [/ < /, " <= ", "boundary moved"],
  [/ > /, " >= ", "boundary moved"],
  [/&&/, "||", "and made or"],
  [/\|\|/, "&&", "or made and"],
  [/\breturn true\b/, "return false", "result inverted"],
  [/\breturn false\b/, "return true", "result inverted"],
  [/\bif \(!/, "if (", "negation dropped"],
  [/ \+ 1\b/, " - 1", "off by one"],
  [/ - 1\b/, " + 1", "off by one"],
];

const SHIPPED = /\.[cm]?[jt]sx?$/;
const TEST = /\.(test|spec)\.[cm]?[jt]sx?$|(^|\/)(tests?|__tests__|e2e)\//;
/** Where the original of a planted file waits until it is put back. */
const RECOVERY = ".abatty/mutate-restore.json";

/**
 * The mutant of one line: the first operator whose match lies in the line's code, not in a string
 * or a comment, applied at that place. Null when the line carries none.
 * @param {string} line the line as written @param {string} code the same line, strings and comments blanked
 * @returns {{ text: string, operator: string } | null}
 */
export function mutantOf(line, code) {
  for (const [re, to, what] of OPERATORS) {
    const m = re.exec(code);
    if (!m) continue;
    return { text: line.slice(0, m.index) + line.slice(m.index).replace(re, to), operator: what };
  }
  return null;
}

/**
 * The lines each shipped source file gained since `base`, the working tree and new untracked
 * files included. The diff is limited to scripts and read with a large buffer: a diff over the
 * default one was read as empty, and a branch full of changes reported no mutant. A file header
 * is only read as one between `diff --git` and the first hunk, so a removed line that starts
 * with `-- ` is never taken for a path.
 * @param {string} repoDir @param {string} base
 * @returns {Map<string, number[]>}
 */
export function changedLines(repoDir, base) {
  const r = spawnSync(
    "git",
    [
      "diff",
      "-U0",
      "--no-color",
      "--no-ext-diff",
      base,
      "--",
      ":(glob)**/*.[cm][jt]s",
      ":(glob)**/*.[jt]s",
      ":(glob)**/*.[jt]sx",
    ],
    { cwd: repoDir, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 },
  );
  /** @type {Map<string, number[]>} */
  const out = new Map();
  let file = "";
  let header = false;
  for (const line of String(r.stdout || "").split("\n")) {
    if (line.startsWith("diff --git ")) header = true;
    if (header && line.startsWith("+++ ")) file = line.replace(/^\+\+\+ (b\/)?/, "");
    const hunk = /^@@ -\S+ \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (!hunk) continue;
    header = false;
    if (!SHIPPED.test(file) || TEST.test(file)) continue;
    const start = Number(hunk[1]);
    const lines = out.get(file) || [];
    for (let n = start; n < start + (hunk[2] === undefined ? 1 : Number(hunk[2])); n++)
      lines.push(n);
    out.set(file, lines);
  }
  for (const f of git(repoDir, "ls-files", "--others", "--exclude-standard").split("\n")) {
    if (!SHIPPED.test(f) || TEST.test(f) || out.has(f)) continue;
    const count = readFileSync(join(repoDir, f), "utf8").split("\n").length;
    out.set(
      f,
      Array.from({ length: count }, (_, i) => i + 1),
    );
  }
  return out;
}

/**
 * The tests that can notice a change to a module: the nearest ring of test files on the import
 * graph, the ones importing it or else the ones importing an importer, and so on. A probe is
 * reached through the registry that lists it, never by name, so a test that runs every probe's
 * controls is the probe's test; the word match that stood alone ran a test naming `refs` against
 * the refs probe and read three killable mutants as survived. The word match is kept for what a
 * relative import cannot reach. A module neither finds has no test to run, and says so.
 * @param {string} repoDir @param {string} file
 */
export function testsFor(repoDir, file) {
  const graph = importersOf(repoDir);
  const seen = new Set([file]);
  let ring = [file];
  for (let depth = 0; depth < 4 && ring.length; depth++) {
    ring = ring.flatMap((f) => graph.get(f) || []).filter((f) => !seen.has(f) && seen.add(f));
    const tests = ring.filter((f) => TEST.test(f));
    if (tests.length) return tests.sort();
  }
  const stem = basename(file).replace(/\.[^.]+$/, "");
  return git(
    repoDir,
    "grep",
    "-l",
    "-F",
    "-w",
    stem,
    "--",
    ":(glob)**/*.test.*",
    ":(glob)**/*.spec.*",
  )
    .split("\n")
    .filter(Boolean);
}

/**
 * Put back a file a run was killed before restoring: the recovery file holds its original.
 * @param {string} repoDir @returns {string} the path restored, or ""
 */
export function restoreInterrupted(repoDir) {
  const at = join(repoDir, RECOVERY);
  if (!existsSync(at)) return "";
  try {
    const { file, original } = JSON.parse(readFileSync(at, "utf8"));
    writeFileSync(join(repoDir, String(file)), String(original));
    rmSync(at);
    return String(file);
  } catch {
    return "";
  }
}

/**
 * @typedef {{ file: string, line: number, operator: string, outcome: "killed" | "survived" | "no test" | "timeout" | "tests red" }} Mutant
 * @typedef {{ mutants: Mutant[], interrupted: boolean, restored: string }} MutationRun
 */

/**
 * Plant each mutant, run the nearest tests, put the file back, whatever happened. A file's tests
 * run once unmutated first: a suite already red, or a command that cannot run, would read every
 * mutant as killed, so that file is reported as `tests red` and none of its mutants is judged.
 * A timeout under a shell ends the shell; on Windows the test process it started can outlive it.
 * @param {{ repoDir: string, base: string, command: string, max: number, timeoutMs: number, log?: (s: string) => void }} o
 * `command` runs the tests, with `{files}` where the test files go (`node --test {files}`).
 * @returns {MutationRun}
 */
export function runMutants(o) {
  const restored = restoreInterrupted(o.repoDir);
  /** @type {Mutant[]} */
  const mutants = [];
  let interrupted = false;
  const stop = () => (interrupted = true);
  const signals = /** @type {NodeJS.Signals[]} */ (["SIGINT", "SIGTERM", "SIGHUP"]);
  for (const s of signals) process.on(s, stop);
  /** @param {string[]} tests */
  const run = (tests) =>
    spawnSync(o.command.replace("{files}", tests.map((t) => JSON.stringify(t)).join(" ")), {
      cwd: o.repoDir,
      shell: true,
      stdio: "ignore",
      env: testRunEnv(),
      timeout: o.timeoutMs,
    });
  try {
    for (const [file, lines] of changedLines(o.repoDir, o.base)) {
      const path = join(o.repoDir, file);
      if (!existsSync(path)) continue;
      const original = readFileSync(path, "utf8");
      const rows = original.split("\n");
      const code = codeOnly(original).split("\n");
      const tests = testsFor(o.repoDir, file);
      let clean = null;
      for (const n of lines) {
        if (interrupted || mutants.length >= o.max) return { mutants, interrupted, restored };
        const m = mutantOf(rows[n - 1] ?? "", code[n - 1] ?? "");
        if (!m) continue;
        if (!tests.length) {
          mutants.push({ file, line: n, operator: m.operator, outcome: "no test" });
          continue;
        }
        if (clean === null) clean = run(tests).status === 0;
        if (!clean) {
          mutants.push({ file, line: n, operator: m.operator, outcome: "tests red" });
          break;
        }
        mkdirSync(dirname(join(o.repoDir, RECOVERY)), { recursive: true });
        writeFileSync(join(o.repoDir, RECOVERY), JSON.stringify({ file, original }));
        try {
          writeFileSync(path, rows.map((r, i) => (i === n - 1 ? m.text : r)).join("\n"));
          o.log?.(`  ${file}:${n} ${m.operator}\n`);
          const r = run(tests);
          const timedOut =
            /** @type {NodeJS.ErrnoException | undefined} */ (r.error)?.code === "ETIMEDOUT";
          const outcome = timedOut
            ? "timeout"
            : r.error
              ? "tests red"
              : r.status === 0
                ? "survived"
                : "killed";
          mutants.push({ file, line: n, operator: m.operator, outcome });
        } finally {
          writeFileSync(path, original);
          rmSync(join(o.repoDir, RECOVERY), { force: true });
        }
      }
    }
    return { mutants, interrupted, restored };
  } finally {
    for (const s of signals) process.off(s, stop);
  }
}
