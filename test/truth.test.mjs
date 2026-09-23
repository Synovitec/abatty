import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tempRepo } from "./helpers.mjs";
import { applyTruth } from "../src/core/truth.mjs";
import { cacheKey } from "../src/core/cache.mjs";
import { presetById } from "../src/presets/index.mjs";

const node = presetById("node");
const GONE = "abatty-tool-gone-__";
const HERE = "abatty-tool-here-__";

/** A present finding as a rule would return it. @param {string} id */
const present = (id) =>
  /** @type {import("../src/rules/index.mjs").Finding} */ ({
    id,
    family: "Code",
    rule: id,
    status: "present",
    evidence: "the script is there",
    next: "",
    phase: "0",
    level: "must",
    enforcement: "hard",
    standard: [],
  });

/** @param {string} name @param {object | null} controls */
function fixture(name, controls) {
  const dir = tempRepo(name, {
    "package.json": JSON.stringify({
      scripts: { lint: `${GONE} .`, typecheck: `${HERE} -p .`, dead: `${HERE}`, test: `${HERE}` },
    }),
    [`node_modules/.bin/${HERE}`]: "",
    "knip.json": "{}",
    // As a real repository has it, so git sees neither folder and only the key's own reading can.
    ".gitignore": "node_modules/\n.abatty/\n",
  });
  if (controls) {
    mkdirSync(join(dir, ".abatty"), { recursive: true });
    writeFileSync(join(dir, ".abatty", "controls.json"), JSON.stringify(controls));
  }
  return dir;
}

const IDS = ["CODE-LINTER", "TYPES-SCRIPT", "CODE-DEADCODE", "TEST-UNIT", "DOC-CONTEXT"];

test("a present check whose step cannot run, or stayed green on its plant, drops to partial and says why", () => {
  const dir = fixture("truth", {
    steps: [
      { label: "typecheck (CODE.3)", outcome: "red" },
      { label: "dead code (CODE.6)", outcome: "green" },
    ],
  });
  const { findings, truth } = applyTruth(IDS.map(present), dir, node);
  const by = Object.fromEntries(findings.map((f) => [f.id, f]));
  assert.equal(by["CODE-LINTER"]?.status, "partial");
  assert.match(by["CODE-LINTER"]?.evidence || "", /cannot run here .*abatty-tool-gone-__/);
  assert.equal(by["CODE-DEADCODE"]?.status, "partial");
  assert.match(by["CODE-DEADCODE"]?.evidence || "", /stayed green on a planted violation/);
  assert.equal(by["TYPES-SCRIPT"]?.status, "present", "proven, and still present");
  assert.equal(by["TEST-UNIT"]?.status, "present");
  assert.equal(by["DOC-CONTEXT"]?.status, "present", "a rule no gate step backs is not judged");
  assert.deepEqual(truth, { proven: 1, contradicted: 2, unproven: 1 });
});

test("without a preset nothing is judged, and the findings come back as they went in", () => {
  const dir = fixture("truth-none", null);
  const input = IDS.map(present);
  const r = applyTruth(input, dir, null);
  assert.equal(r.findings, input);
  assert.deepEqual(r.truth, { proven: 0, contradicted: 0, unproven: 0 });
});

test("the reading's cache key moves with the controls and the tools, which git ignores", () => {
  const dir = fixture("truth-cache", null);
  const before = cacheKey(dir);
  mkdirSync(join(dir, ".abatty"), { recursive: true });
  writeFileSync(join(dir, ".abatty", "controls.json"), '{"steps":[]}');
  const controlled = cacheKey(dir);
  assert.notEqual(controlled, before);
  writeFileSync(join(dir, "node_modules", ".bin", GONE), "");
  assert.notEqual(cacheKey(dir), controlled);
});
