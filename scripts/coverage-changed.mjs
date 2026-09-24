// The coverage of the lines a push changed (TEST.4), from the coverage `npm test` just measured
// with Node's own runner: no coverage tool, no dependency. The gate runs this after the unit step
// and names the range in ABATTY_RANGE.
//
// What it can see: the files the tests load in their own processes. A module reached only through
// a spawned CLI is not measured there, so a changed line in one is listed as not measured rather
// than called untested. What fails: under THRESHOLD of the changed lines the tests could have
// run were run.
//
//   node scripts/coverage-changed.mjs [range]      exit 0 held, 3 below the floor, 4 no data
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { posix } from "node:path";

const THRESHOLD = 0.8;
const DATA = ".abatty/coverage/lines.json";
const SOURCES = /^src\/.*\.mjs$/;

const range = process.argv[2] || process.env.ABATTY_RANGE || "";

/** @param {string[]} args */
const git = (...args) => spawnSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

/**
 * Where the change starts: the left side of the range (the merge base for `a...b`), or HEAD with
 * no range. The diff runs from there to the working tree, so what is staged, planted or not yet
 * committed is judged as well: a check of committed history alone passed over the change being
 * made, and a step's control could never turn it red.
 */
function base() {
  if (!range) return "HEAD";
  const three = range.split("...");
  if (three.length === 2)
    return (
      git("merge-base", three[0] || "HEAD", three[1] || "HEAD").stdout.trim() || String(three[0])
    );
  return range.split("..")[0] || "HEAD";
}
if (!existsSync(DATA)) {
  console.error(`coverage of the changed lines: no ${DATA}; run npm test first`);
  process.exit(4);
}
/** @type {{ files: Record<string, { covered: number[], uncovered: number[], noLines?: boolean }> }} */
const data = JSON.parse(readFileSync(DATA, "utf8"));

/** The lines each source file gained in the range, from git's own diff. */
function changedLines() {
  const from = base();
  const r = git("diff", "-U0", "--no-color", "--no-ext-diff", from, "--", "src");
  if (r.status !== 0) {
    console.error(`coverage of the changed lines: git could not diff from ${from}`);
    process.exit(4);
  }
  /** @type {Map<string, number[]>} */
  const out = new Map();
  let file = "";
  // A header only between `diff --git` and the first hunk: a removed `-- ` line is content.
  let header = false;
  for (const line of r.stdout.split("\n")) {
    if (line.startsWith("diff --git ")) header = true;
    if (header && line.startsWith("+++ ")) file = line.replace(/^\+\+\+ (b\/)?/, "");
    const hunk = /^@@ -\S+ \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (hunk) header = false;
    if (!hunk || !SOURCES.test(file)) continue;
    const start = Number(hunk[1]);
    const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
    const lines = out.get(file) || [];
    for (let n = start; n < start + count; n++) lines.push(n);
    out.set(file, lines);
  }
  return out;
}

let run = 0;
let runnable = 0;
/** @type {string[]} */
const missed = [];
/** @type {string[]} */
const unmeasured = [];
/**
 * Whether some other module imports a file: one that is imported is reached through a spawned
 * process the runner does not measure, while one nothing imports and no test loaded is untested.
 * @param {string} file
 */
function imported(file) {
  const name = file.split("/").pop() || file;
  const r = git("grep", "-l", "-F", `/${name}"`, "--", "src", "bin");
  // The specifier resolved from the importing file, not the name matched anywhere: a new
  // untested `index.mjs` read as imported because some other `index.mjs` was.
  return r.stdout
    .split("\n")
    .filter((f) => f && f !== file)
    .some((f) =>
      [...readFileSync(f, "utf8").matchAll(/["'](\.{1,2}\/[^"']+)["']/g)].some(
        (m) => posix.normalize(posix.join(posix.dirname(f), String(m[1]))) === file,
      ),
    );
}

for (const [file, lines] of changedLines()) {
  const cov = data.files[file];
  // A runtime that measured the file but gave no per-line data cannot judge it: fail, and say so.
  if (cov?.noLines) {
    console.error(
      `coverage of the changed lines: ${file} was measured with no per-line data (this Node's coverage lacks it); nothing can be judged`,
    );
    process.exit(4);
  }
  if (!cov && imported(file)) {
    unmeasured.push(file);
    continue;
  }
  if (!cov) {
    runnable += lines.length;
    missed.push(`${file}: every changed line (no test loads it, nothing imports it)`);
    continue;
  }
  const covered = new Set(cov.covered);
  const uncovered = new Set(cov.uncovered);
  const holes = lines.filter((n) => uncovered.has(n));
  run += lines.filter((n) => covered.has(n)).length;
  runnable += lines.filter((n) => covered.has(n) || uncovered.has(n)).length;
  if (holes.length) missed.push(`${file}: ${holes.join(", ")}`);
}

const share = runnable ? run / runnable : 1;
const pct = (share * 100).toFixed(1);
console.log(
  `coverage of the changed lines: ${run} of ${runnable} run by the tests (${pct}%, floor ${THRESHOLD * 100}%)`,
);
for (const m of missed) console.log(`  not run: ${m}`);
if (unmeasured.length)
  console.log(
    `  not measured (reached only through a spawned process, or loaded by no test): ${unmeasured.join(", ")}`,
  );
process.exit(share >= THRESHOLD ? 0 : 3);
