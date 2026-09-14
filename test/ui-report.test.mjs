import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { NEXT_PKG, cli, tempRepo } from "./helpers.mjs";
import { bar, stacked, table, duration } from "../src/ui/term.mjs";
import { allReports, buildReport, latestReport } from "../src/core/report.mjs";
import { renderDashboard } from "../src/ui/dashboard.mjs";

test("the terminal helpers degrade to plain text when colour is off", () => {
  // The test runner is not a TTY, so every helper must return plain glyphs and no escapes.
  assert.equal(bar(50, 10).replace(/\[[0-9;]*m/g, ""), "█████░░░░░");
  assert.equal(stacked(2, 1, 1, 8), "████▒▒░░");
  const t = table(
    [
      ["a", "bb"],
      ["ccc", "d"],
    ],
    { align: ["l", "r"] },
  );
  assert.match(t, /a\s+bb\n\s+───\s+──\n\s+ccc\s+d/);
  assert.equal(duration(950), "950 ms");
  assert.equal(duration(61_500), "1 min 2 s");
});

test("a report is written under .abatty/reports and read back as the latest reading", async () => {
  const dir = tempRepo("report", { "package.json": NEXT_PKG, "src/a.ts": "export const a = 1;\n" });
  const r = await buildReport(dir, { abattyVersion: "0.0.0-test" });
  assert.equal(r.version, 1);
  assert.equal(typeof r.score, "number");
  assert.ok(existsSync(join(dir, ".abatty", "reports", `${r.date}.json`)));
  assert.equal(latestReport(dir)?.score, r.score);
  assert.equal(allReports(dir).length, 1);
  assert.equal(r.harness.present, false);
  assert.equal(r.scrub.lines, 0);
});

test("status is the default command and shows the score, the families and the next steps", () => {
  const dir = tempRepo("status", { "package.json": NEXT_PKG });
  const r = cli([dir], dir);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /abatty v/);
  assert.match(r.out, /\/100/);
  assert.match(r.out, /Harness/);
  assert.match(r.out, /Next/);
});

test("the dashboard embeds the reports, both themes and the score dial", async () => {
  const dir = tempRepo("dash", { "package.json": NEXT_PKG });
  const r = await buildReport(dir);
  const html = renderDashboard([{ name: "fixture-next", reports: [r] }], {
    abattyVersion: "0.0.0-test",
  });
  assert.match(html, /<title>abatty<\/title>/);
  assert.match(html, /prefers-color-scheme:dark/);
  assert.match(html, /\[data-theme="dark"\]/);
  assert.match(html, /class="dial"/);
  assert.ok(html.includes(JSON.stringify(r.score)));
  const out = cli(["dashboard", dir, "--out", join(dir, "d.html")], dir);
  assert.equal(out.code, 0, out.out);
  assert.ok(existsSync(join(dir, "d.html")));
  assert.match(readFileSync(join(dir, "d.html"), "utf8"), /fixture-next/);
});
