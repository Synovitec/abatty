// The test runner as `npm test` calls it: `node --test` over the files a glob names, expanded
// here rather than by node, because `--test` only expands a glob itself from Node 21 and this
// package claims 20. The glob stays in the script's text on purpose: the step controls read it
// to learn where a planted test has to sit for this runner to find it.
//
//   node scripts/test.mjs "test/*.test.mjs" [--test-name-pattern=...] [more node --test flags]
import { mkdirSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

/** A `dir/*.suffix` pattern as the files it names, in order; anything else as it is. @param {string} arg */
function expand(arg) {
  const m = arg.match(/^([^*]+)\/\*(\.[^/*]+)$/);
  if (!m) return [arg];
  const dir = String(m[1]);
  const suffix = String(m[2]);
  return readdirSync(dir)
    .filter((f) => f.endsWith(suffix))
    .sort()
    .map((f) => `${dir}/${f}`);
}

// node reads its own flags before the first file, so the flags go first whatever order they came in.
const args = process.argv.slice(2).flatMap(expand);
const flags = args.filter((a) => a.startsWith("--"));
const files = args.filter((a) => !a.startsWith("--"));
// Node's own coverage, for the changed-line check the gate runs next (scripts/coverage-changed.mjs):
// measured by the run that already happens, at about five per cent of its time, rather than by a
// second run of a suite that takes minutes. The usual report still goes to the terminal.
mkdirSync(".abatty/coverage", { recursive: true });
// A caller that names its own reporter keeps it, and gets the coverage file beside it: forcing
// spec as well gave three reporters and two destinations, which node refuses to start with.
const ownReporter = flags.some((f) => f.startsWith("--test-reporter"));
const coverage = [
  "--experimental-test-coverage",
  ...(ownReporter ? [] : ["--test-reporter=spec", "--test-reporter-destination=stdout"]),
  "--test-reporter=./scripts/coverage-reporter.mjs",
  "--test-reporter-destination=.abatty/coverage/lines.json",
];
const r = spawnSync(process.execPath, ["--test", ...coverage, ...flags, ...files], {
  stdio: "inherit",
});
process.exit(r.status ?? 1);
