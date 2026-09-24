/**
 * Diff-scoped mutation (standard TEST.5), with no dependency: one small textual change per line a
 * push changed, the tests that name the changed module run against it, the file put back. A
 * mutant the tests did not notice is a changed line whose behaviour no test holds, which is the
 * one question a green suite cannot answer and an agent's own tests are least likely to ask. The
 * shape is the one industrial mutation settled on: only changed lines, one mutant per line, a
 * report rather than a score, since a whole-repository mutation score says little once the size
 * of the suite is accounted for.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, posix } from "node:path";
import { git } from "./repo.mjs";
import { codeOnly } from "../ratchet/probes/lex.mjs";
import { testRunEnv } from "./env.mjs";

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
 * The lines each shipped source file gained since `base`, working tree included.
 * @param {string} repoDir @param {string} base
 * @returns {Map<string, number[]>}
 */
export function changedLines(repoDir, base) {
  const diff = git(repoDir, "diff", "-U0", "--no-color", "--no-ext-diff", base);
  /** @type {Map<string, number[]>} */
  const out = new Map();
  let file = "";
  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ ")) file = line.replace(/^\+\+\+ (b\/)?/, "");
    const hunk = /^@@ -\S+ \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (!hunk || !SHIPPED.test(file) || TEST.test(file)) continue;
    const start = Number(hunk[1]);
    const lines = out.get(file) || [];
    for (let n = start; n < start + (hunk[2] === undefined ? 1 : Number(hunk[2])); n++)
      lines.push(n);
    out.set(file, lines);
  }
  return out;
}

/**
 * Who imports whom, by relative specifier, over the tracked scripts: the map from a file to the
 * files that import it.
 * @param {string} repoDir @returns {Map<string, string[]>}
 */
function importers(repoDir) {
  /** @type {Map<string, string[]>} */
  const by = new Map();
  const files = git(repoDir, "ls-files")
    .split("\n")
    .filter((f) => SHIPPED.test(f));
  const known = new Set(files);
  for (const f of files) {
    const text = readFileSync(join(repoDir, f), "utf8");
    for (const m of text.matchAll(/(?:from|import\s*\(?)\s*["'](\.{1,2}\/[^"']+)["']/g)) {
      const target = posix.normalize(posix.join(posix.dirname(f), String(m[1])));
      if (!known.has(target)) continue;
      by.set(target, [...(by.get(target) || []), f]);
    }
  }
  return by;
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
  const graph = importers(repoDir);
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
 * @typedef {{ file: string, line: number, operator: string, outcome: "killed" | "survived" | "no test" | "timeout" }} Mutant
 */

/**
 * Plant each mutant, run the tests that name its module, put the file back, whatever happened.
 * @param {{ repoDir: string, base: string, command: string, max: number, timeoutMs: number, log?: (s: string) => void }} o
 * `command` runs the tests, with `{files}` where the test files go (`node --test {files}`).
 * @returns {Mutant[]}
 */
export function runMutants(o) {
  /** @type {Mutant[]} */
  const mutants = [];
  for (const [file, lines] of changedLines(o.repoDir, o.base)) {
    const path = join(o.repoDir, file);
    if (!existsSync(path)) continue;
    const original = readFileSync(path, "utf8");
    const rows = original.split("\n");
    const code = codeOnly(original).split("\n");
    const tests = testsFor(o.repoDir, file);
    for (const n of lines) {
      if (mutants.length >= o.max) return mutants;
      const m = mutantOf(rows[n - 1] ?? "", code[n - 1] ?? "");
      if (!m) continue;
      if (!tests.length) {
        mutants.push({ file, line: n, operator: m.operator, outcome: "no test" });
        continue;
      }
      const mutated = rows.map((r, i) => (i === n - 1 ? m.text : r)).join("\n");
      try {
        writeFileSync(path, mutated);
        o.log?.(`  ${file}:${n} ${m.operator}\n`);
        const cmd = o.command.replace("{files}", tests.map((t) => JSON.stringify(t)).join(" "));
        const r = spawnSync(cmd, {
          cwd: o.repoDir,
          shell: true,
          stdio: "ignore",
          env: testRunEnv(),
          timeout: o.timeoutMs,
        });
        const outcome = r.error ? "timeout" : r.status === 0 ? "survived" : "killed";
        mutants.push({ file, line: n, operator: m.operator, outcome });
      } finally {
        writeFileSync(path, original);
      }
    }
  }
  return mutants;
}
