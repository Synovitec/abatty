import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { linkPreviousReadings, withSuccessor } from "../src/core/readings.mjs";
import { frontMatterFaults } from "../src/ratchet/probes/frontmatter.mjs";
import { frontMatter } from "../src/ratchet/probes/lib.mjs";

// `measure` wrote GAP_ANALYSIS_<date>.md on every run and left the one before it naming nothing,
// so an adopter's older reading was quoted as the current score.

const FM = (/** @type {string} */ extra = "") =>
  `---\ntitle: "T"\nstatus: stable\n${extra}---\n\n# T\n`;

test("the reading measure writes becomes the successor of the one before it, and only that", () => {
  const dir = mkdtempSync(join(tmpdir(), "abatty-readings-"));
  const file = (/** @type {string} */ n) => join(dir, n);
  writeFileSync(file("GAP_ANALYSIS_2026-09-20.md"), FM('superseded_by: "./PLAN.md"\n'));
  writeFileSync(file("GAP_ANALYSIS_2026-09-21.md"), FM());
  writeFileSync(file("GAP_ANALYSIS_2026-09-22.md"), FM());
  writeFileSync(file("PLAN.md"), FM());
  assert.deepEqual(linkPreviousReadings(file("GAP_ANALYSIS_2026-09-22.md")), [
    "GAP_ANALYSIS_2026-09-21.md",
  ]);
  const next = (/** @type {string} */ n) =>
    frontMatter(readFileSync(file(n), "utf8"))?.superseded_by;
  assert.equal(next("GAP_ANALYSIS_2026-09-21.md"), "./GAP_ANALYSIS_2026-09-22.md");
  assert.equal(
    next("GAP_ANALYSIS_2026-09-20.md"),
    "./PLAN.md",
    "a link already written is left alone",
  );
  assert.equal(next("GAP_ANALYSIS_2026-09-22.md"), undefined, "the newest names nothing");
  assert.deepEqual(linkPreviousReadings(file("GAP_ANALYSIS_2026-09-22.md")), [], "a second run");
});

test("a reading written under another name links nothing", () => {
  const dir = mkdtempSync(join(tmpdir(), "abatty-readings-"));
  writeFileSync(join(dir, "report.md"), FM());
  assert.deepEqual(linkPreviousReadings(join(dir, "report.md")), []);
});

test("an empty superseded_by line is filled in place, CRLF kept, and a YAML reader still takes it", () => {
  const text = FM("superseded_by:\n").replace(/\n/g, "\r\n");
  const linked = withSuccessor(text, "./NEXT.md");
  assert.equal(linked.match(/superseded_by/g)?.length, 1);
  assert.equal(linked.includes("\n") && !/[^\r]\n/.test(linked), true, "every line ends in CRLF");
  assert.deepEqual(frontMatterFaults(linked), []);
  assert.equal(frontMatter(linked)?.superseded_by, "./NEXT.md");
});

test("a document without front matter is left as it is", () => {
  assert.equal(withSuccessor("# T\n", "./NEXT.md"), "# T\n");
});
