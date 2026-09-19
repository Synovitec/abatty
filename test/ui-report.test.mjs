import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { NEXT_PKG, cli, tempRepo } from "./helpers.mjs";
import { bar, bold, duration, glyph, setPlain, stacked, table } from "../src/ui/term.mjs";
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
  assert.equal(r.scrub.enabled, false, "provenance is the default");
  assert.equal(typeof r.enforced.total, "number");
  assert.ok(r.enforced.share === null || (r.enforced.share >= 0 && r.enforced.share <= 100));
  assert.equal(
    r.enforced.hard + r.enforced.ratchet + r.enforced.review + r.enforced.prose,
    r.enforced.total,
  );
});

test("status is the default command and shows the score, the families and the next steps", () => {
  const dir = tempRepo("status", { "package.json": NEXT_PKG });
  const r = cli([dir], dir);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /abatty v/);
  assert.match(r.out, /\/100/);
  assert.match(r.out, /Harness/);
  assert.match(r.out, /Next/);
  assert.match(r.out, /held by a machine|nothing present yet/);
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

test("--plain reaches every command: no colour, and markers a byte-oriented reader can match", () => {
  const dir = process.cwd();
  const plain = cli(["presets", "--plain"], dir).out;
  assert.match(plain, /\[ok\] next/, "an ASCII marker, not a tick");
  assert.match(plain, /\[!\] astro/);
  assert.equal(/\u001b\[/.test(plain), false, "no escape sequences");
  assert.equal(/[✓✗▶↷•→]/.test(plain), false, "no glyphs a log parser cannot match");

  // and the control in the other direction: without it the words are the same
  const normal = cli(["presets"], dir).out;
  assert.match(normal, /next\s+Next\.js/);
  assert.match(plain, /next\s+Next\.js/);

  // it is not a command's flag: a command that never heard of it is plain too
  const rules = cli(["rules", dir, "--family", "Security", "--plain"], dir).out;
  assert.equal(/[✓✗•]/.test(rules), false, rules.slice(0, 200));
  assert.match(rules, /SEC-SECRETS/);
});

test("--plain turns colour off even where a terminal would have had it", () => {
  // A spawned test process is never a TTY, so the colour half of --plain cannot be watched
  // failing from the outside. It is watched here instead, by pretending to be one.
  const was = process.stdout.isTTY;
  const wasNoColor = process.env.NO_COLOR;
  const wasCi = process.env.CI;
  try {
    process.stdout.isTTY = true;
    delete process.env.NO_COLOR;
    delete process.env.CI;
    setPlain(false);
    assert.notEqual(bold("x"), "x", "a TTY without --plain has colour, or this proves nothing");
    assert.match(glyph.ok, /✓/);
    setPlain(true);
    assert.equal(bold("x"), "x");
    assert.equal(glyph.ok, "[ok]");
  } finally {
    setPlain(false);
    process.stdout.isTTY = was;
    if (wasNoColor !== undefined) process.env.NO_COLOR = wasNoColor;
    if (wasCi !== undefined) process.env.CI = wasCi;
  }
});
