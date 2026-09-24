import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CONFIG, compare } from "../src/ratchet/index.mjs";

// A count cannot say which finding is new. Showing the first few of a file over its floor read as
// "you introduced these", so the reader is given the whole file and the two ways out.

test("a file over its floor lists every one of its findings, and names both ways out", () => {
  const findings = Array.from({ length: 14 }, (_, i) => ({ path: "src/a.ts", line: i + 1 }));
  /** @type {import("../src/ratchet/index.mjs").Measurement} */
  const m = {
    metric: "x.debt",
    kind: "ratchet",
    value: 15,
    scanned: 2,
    findings: [...findings, { path: "src/b.ts", line: 9 }],
    debt: { "src/a.ts": 14, "src/b.ts": 1 },
    probe: /** @type {any} */ ({ metric: "x.debt", kind: "ratchet", controls: [] }),
  };
  const floor = {
    measuredAt: "2026-09-24",
    metrics: { "x.debt": 15 },
    debt: { "x.debt": { "src/a.ts": 13, "src/b.ts": 2 } },
  };
  const [v] = compare([m], floor, DEFAULT_CONFIG);
  const text = v?.messages.join("\n") || "";
  assert.equal(v?.status, "regressed");
  assert.match(text, /per file: src\/a\.ts 13 → 14/);
  for (let line = 1; line <= 14; line++) assert.match(text, new RegExp(`src/a\\.ts:${line}\\b`));
  assert.doesNotMatch(text, /src\/b\.ts:9/, "a file within its floor is not listed");
  assert.match(text, /two ways out: .*abatty baseline --reason/);
});
