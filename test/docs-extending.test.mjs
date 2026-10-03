import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BUILTIN_PROBES } from "../src/ratchet/index.mjs";

// The README listed the opt-in probes and the ones on probation by hand: when it was moved to
// docs/EXTENDING.md the table missed change.testTamper and the probation paragraph named three
// probes that had left probation two releases before. Both lists are held to the code here.

const DOC = readFileSync(new URL("../docs/EXTENDING.md", import.meta.url), "utf8");

/** @param {Iterable<string>} xs */
const sorted = (xs) => [...xs].sort();

test("the opt-in table names exactly the probes that are opt-in", () => {
  const section = DOC.split("## Opt-in probes")[1]?.split("\n## ")[0] || "";
  const named = [...section.matchAll(/^\| `([a-z]+\.[A-Za-z]+)`/gm)].map((m) => String(m[1]));
  assert.deepEqual(
    sorted(named),
    sorted(BUILTIN_PROBES.filter((p) => p.optIn).map((p) => p.metric)),
  );
});

test("the probation line names exactly the probes on probation", () => {
  const line = DOC.split("On probation today:")[1]?.split("\n\n")[0] || "";
  const named = [...line.matchAll(/`([a-z]+\.[A-Za-z]+)`/g)].map((m) => String(m[1]));
  assert.deepEqual(
    sorted(named),
    sorted(BUILTIN_PROBES.filter((p) => p.probation).map((p) => p.metric)),
  );
});
