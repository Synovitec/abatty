// The test runner as `npm test` calls it: `node --test` over the files a glob names, expanded
// here rather than by node, because `--test` only expands a glob itself from Node 21 and this
// package claims 20. The glob stays in the script's text on purpose: the step controls read it
// to learn where a planted test has to sit for this runner to find it.
//
//   node scripts/test.mjs "test/*.test.mjs" [--test-name-pattern=...] [more node --test flags]
import { readdirSync } from "node:fs";
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
const r = spawnSync(process.execPath, ["--test", ...flags, ...files], { stdio: "inherit" });
process.exit(r.status ?? 1);
