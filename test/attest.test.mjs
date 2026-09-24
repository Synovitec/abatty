import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NEXT_PKG, cli, git, tempRepo } from "./helpers.mjs";
import { PREDICATE_TYPE, SCOPE, STATEMENT_TYPE, attestation } from "../src/core/attest.mjs";
import { buildReport } from "../src/core/report.mjs";
import { CONTROLS_VERSION, currentControls } from "../src/core/step-controls.mjs";

/** A repository with a waiver, a control run and a baseline entry: everything the record carries. */
async function furnished() {
  const dir = tempRepo("attest", {
    "package.json": NEXT_PKG,
    "src/index.ts": "export const x = 1;\n",
    "abatty.config.json": JSON.stringify({
      standard: { version: "1.4.0" },
      rules: {
        waived: {
          "DOC-ADR": { reason: "the decisions live in the wiki", until: "2999-01-01" },
          "SEC-AUDIT": { reason: "was meant to be revisited", until: "2020-01-01" },
        },
      },
    }),
  });
  mkdirSync(join(dir, ".abatty"), { recursive: true });
  writeFileSync(
    join(dir, ".abatty/controls.json"),
    JSON.stringify({
      at: "2026-09-19T00:00:00.000Z",
      abatty: CONTROLS_VERSION,
      steps: [
        { label: "lint (CODE.4)", outcome: "red", detail: "went red" },
        { label: "typecheck (CODE.3)", outcome: "green", detail: "stayed GREEN" },
      ],
      absent: ["typecheck (CODE.3)"],
    }),
  );
  mkdirSync(join(dir, "scripts/ci"), { recursive: true });
  writeFileSync(
    join(dir, "scripts/ci/standards-baseline.json"),
    JSON.stringify({
      measuredAt: "2026-09-18",
      metrics: { "size.overBudget": 2 },
      entries: {
        "size.overBudget": {
          at: "2026-09-18",
          was: 1,
          now: 2,
          reason: "phase 8 splits these",
          owner: "platform",
        },
      },
    }),
  );
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "chore: furnish");
  const report = await buildReport(dir, { abattyVersion: "9.9.9" });
  return { dir, statement: attestation({ repoDir: dir, report, version: "9.9.9" }) };
}

test("the attestation is an in-toto statement about the commit, not a document of our own", async () => {
  const { dir, statement } = await furnished();
  assert.equal(statement._type, STATEMENT_TYPE);
  assert.equal(statement.predicateType, PREDICATE_TYPE);
  const subject = /** @type {any[]} */ (statement.subject);
  assert.equal(subject.length, 1);
  assert.equal(subject[0].digest.gitCommit, git(dir, "rev-parse", "HEAD"));
  assert.match(String(subject[0].digest.gitCommit), /^[0-9a-f]{40}$/);
});

test("the record says what it does not answer, so nobody reads it as a bill of materials", () => {
  assert.ok(SCOPE.doesNotAnswer.some((s) => /bill of materials/.test(s)));
  assert.ok(SCOPE.doesNotAnswer.some((s) => /vulnerabilit/.test(s)));
  assert.ok(SCOPE.doesNotAnswer.some((s) => /licence/.test(s)));
  assert.ok(SCOPE.doesNotAnswer.some((s) => /provenance/.test(s)));
  assert.ok(SCOPE.answers.every((s) => s.length > 30));
});

test("the record carries the waivers with their owners, the floors with who raised them, and the proof each gate step can fail", async () => {
  const { statement } = await furnished();
  const p = /** @type {any} */ (statement).predicate;

  assert.equal(p.standard.version, "1.4.0", "the standard's version, not the tool's");
  assert.equal(p.instrument.version, "9.9.9");

  const waived = p.waivers.find((/** @type {any} */ w) => w.rule === "DOC-ADR");
  assert.equal(waived.stillWaived, true);
  assert.equal(waived.expired, false);
  assert.equal(waived.reason, "the decisions live in the wiki");
  // an expired waiver is in the record as expired, not quietly absent from it
  const gone = p.waivers.find((/** @type {any} */ w) => w.rule === "SEC-AUDIT");
  assert.equal(gone.expired, true);
  assert.equal(gone.stillWaived, false);

  assert.equal(p.ratchet.raised["size.overBudget"].owner, "platform");
  assert.equal(p.ratchet.metrics["size.overBudget"], 2);

  assert.equal(p.controls.ran, true);
  assert.equal(p.controls.provenRed, 1);
  assert.deepEqual(p.controls.absent, ["typecheck (CODE.3)"]);

  assert.ok(p.conformance.length > 50);
  assert.deepEqual(Object.keys(p.conformance[0]).sort(), [
    "enforcement",
    "level",
    "rule",
    "standard",
    "status",
  ]);
});

test("a record whose gate was never proved capable of failing says so, and the command exits 3", () => {
  const dir = tempRepo("attest-nocontrols", {
    "package.json": NEXT_PKG,
    "src/index.ts": "export const x = 1;\n",
  });
  const r = cli(["attest", dir, "--out", "out/att.json"], dir);
  assert.equal(r.code, 3, "a record with no control run is not a complete record");
  assert.match(r.out, /controls never run/);
  const written = cli(["attest", dir, "--json"], dir);
  const p = JSON.parse(written.out).predicate;
  assert.equal(p.controls.ran, false);
  assert.match(p.controls.note, /abatty doctor --controls/);
});

test("a control run from before the version stamp is not read as proof, by any reader", () => {
  assert.equal(currentControls({ at: "x", steps: [], absent: [] }), null);
  assert.equal(currentControls({ abatty: "0.4.0", steps: [] }), null);
  assert.ok(currentControls({ abatty: CONTROLS_VERSION, steps: [] }));
});
