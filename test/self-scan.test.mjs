import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { BUILTIN_PROBES, DEFAULT_CONFIG, measureAll } from "../src/ratchet/index.mjs";
import { buildContext } from "../src/rules/context.mjs";

// A probe that reads its own source counts its own pattern, prose and control fixtures. Two of
// this release's probes did, and so did two older ones: 4 of this repository's 7 escapes and 3 of
// its 7 raw env reads were the probes' own text. Only enabled probes run here, so an opt-in probe
// that offended was never seen. Every built-in probe, enabled or not, is run over this tree,
// untracked files included, and must find nothing in the file that defines it.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PROBES_DIR = "src/ratchet/probes";

/** The file that defines each built-in metric. */
function definingFiles() {
  /** @type {Map<string, string>} */
  const at = new Map();
  for (const name of readdirSync(join(ROOT, PROBES_DIR)).filter((f) => f.endsWith(".mjs")))
    for (const m of readFileSync(join(ROOT, PROBES_DIR, name), "utf8").matchAll(
      /\bmetric:\s*"([^"]+)"/g,
    ))
      at.set(String(m[1]), `${PROBES_DIR}/${name}`);
  return at;
}

test("every built-in probe, opt-in ones included, finds nothing in its own source", () => {
  const at = definingFiles();
  const ctx = buildContext(ROOT);
  const offences = [];
  for (const probe of BUILTIN_PROBES) {
    const own = at.get(probe.metric);
    assert.ok(own, `${probe.metric} is defined in a file under ${PROBES_DIR}`);
    const [m] = measureAll([probe], ctx, { config: DEFAULT_CONFIG, range: "" }, null);
    for (const f of m?.findings || [])
      if (f.path === own) offences.push(`${probe.metric} ${f.path}:${f.line} ${f.detail || ""}`);
  }
  assert.deepEqual(offences, []);
});
