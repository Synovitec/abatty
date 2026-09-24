import { test } from "node:test";
import assert from "node:assert/strict";
import { tempRepo } from "./helpers.mjs";
import { offProbes } from "../src/core/opt-in.mjs";

// An adopter's coverage exclude list grew for weeks beside a probe that counts it, off by default,
// and nothing had said it existed. Doctor names each opt-in probe left off with its reading.

const VITEST =
  "export default { test: { coverage: { exclude: ['src/legacy/**', 'src/split-half.ts', 'src/other.ts'] } } };\n";

test("a probe left off is named with the total the ratchet would record, weights summed", () => {
  const dir = tempRepo("opt-in", {
    "package.json": JSON.stringify({ name: "o" }),
    "vitest.config.ts": VITEST,
    "abatty.config.json": JSON.stringify({ ratchet: { enable: [] } }),
  });
  const off = offProbes(dir);
  assert.equal(
    off.find((p) => p.metric === "test.coverageExclusions")?.reads,
    3,
    "one finding, three paths",
  );
  const push = off.find((p) => p.metric === "change.refactorTests");
  assert.equal(push?.reads, null, "a rule about a push has no reading of a tree");
  assert.match(String(push?.why), /no range/);
});

test("a probe enabled or excluded is not listed as left off", () => {
  const dir = tempRepo("opt-in-on", {
    "package.json": JSON.stringify({ name: "o" }),
    "vitest.config.ts": VITEST,
    "abatty.config.json": JSON.stringify({
      ratchet: { enable: ["test.coverageExclusions"], exclude: ["code.clones"] },
    }),
  });
  const names = offProbes(dir).map((p) => p.metric);
  assert.equal(names.includes("test.coverageExclusions"), false);
  assert.equal(names.includes("code.clones"), false);
});
