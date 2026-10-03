/**
 * Codemod, 2026-10-03: the tests that call `init` for the synovitec setup (the agent harness, the
 * standard's documents, the per-commit changelog line) name that profile, now that `init` sets
 * up the minimal profile unless told otherwise (decision 0002, the 1.0 scope). A test that calls
 * `init` and already names a profile is left alone. Dry run by default; `--write` applies.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = new URL("../../test/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const write = process.argv.includes("--write");
let files = 0;
let calls = 0;
for (const f of readdirSync(dir).filter((n) => n.endsWith(".mjs"))) {
  const path = join(dir, f);
  const text = readFileSync(path, "utf8");
  let n = 0;
  // `["init", ...]` argument arrays without --profile: the flag goes right after the command.
  // Not git's own (`spawnSync("git", ["init", ...])`): the first run rewrote three of those.
  const next = text.replace(/(?<!"git",\s*)\["init",(?![^\]]*"--profile")/g, () => {
    n++;
    return '["init", "--profile", "synovitec",';
  });
  if (!n) continue;
  files++;
  calls += n;
  console.log(`${f}: ${n}`);
  if (write) writeFileSync(path, next);
}
console.log(`${calls} call(s) in ${files} file(s)${write ? ", written" : " (dry run)"}`);
