/**
 * The `measure` command: the gap analysis on screen, as JSON, as one line, and the dated
 * markdown report it leaves behind.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { buildReport } from "../core/report.mjs";
import { renderMarkdown, truthLine } from "../core/gap-analysis.mjs";
import { enforcedLine, nextSteps, phaseLine } from "./status.mjs";
import { sarifOfFindings } from "../ui/sarif.mjs";
import * as t from "../ui/term.mjs";

/**
 * @param {import("./ratchet.mjs").CliContext} cx
 */
export async function measureCommand(cx) {
  const { dir, opt, flag, out, err, VERSION } = cx;
  // `--out` is where the measurement goes, and the only place: a run asked to write one file
  // printed its JSON to the screen instead and replaced the repository's latest report, which a
  // dashboard and the MCP server read as the truth.
  const to = opt("--out");
  const r = await buildReport(dir, { abattyVersion: VERSION, write: !to });
  for (const p of r.problems) err(`${t.glyph.warn} ${p}\n`);
  /** Write `text` to `--out` when given, to the screen otherwise. @param {string} text */
  const emit = (text) => {
    if (!to) return out(text);
    const file = resolve(dir, to);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, text);
    if (!flag("--quiet")) err(`${t.glyph.ok} ${relative(dir, file).split("\\").join("/")}\n`);
  };
  if (flag("--sarif")) {
    // The same findings in the shape a forge puts on a diff. Nothing is recomputed: one finding,
    // another renderer.
    emit(
      JSON.stringify(sarifOfFindings({ findings: r.findings, version: VERSION }), null, 2) + "\n",
    );
    return;
  }
  if (flag("--json")) {
    emit(JSON.stringify(r, null, 2) + "\n");
    return;
  }
  const md = renderMarkdown({ ...r, families: r.families.map((f) => f.name) });
  const target = resolve(dir, to || join("docs", `GAP_ANALYSIS_${r.date}.md`));
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, md);
  const rel = relative(dir, target).split("\\").join("/");
  if (flag("--quiet")) {
    out(
      `${r.phase ? `Phase ${r.phase.id}: ${r.phase.held} of ${r.phase.applicable} held · ` : "Every phase held · "}Score ${r.score}/100 over ${r.applicable} applicable checks · ${rel}\n`,
    );
    return;
  }
  out(
    `\n${t.banner(VERSION)}  ${t.bold("measure")} ${t.gray("·")} ${r.name} ${t.gray(r.date)}\n\n`,
  );
  out(phaseLine(r) + "\n");
  out(enforcedLine(r.enforced) + "\n");
  const truth = truthLine(r).replace(/\*\*|`/g, "");
  if (truth) out(`  ${t.gray(truth)}\n`);
  out("\n");
  out(
    t.table(
      [
        ["family", "", "present", "partial", "missing", "n/a"],
        ...r.families.map((f) => [
          f.name,
          t.stacked(f.present, f.partial, f.missing, 16),
          String(f.present),
          String(f.partial),
          String(f.missing),
          String(f.na),
        ]),
      ],
      { align: ["l", "l", "r", "r", "r", "r"] },
    ) + "\n",
  );
  out(
    `\n  ${t.gray(`${nextSteps(r, 999).length} next step(s) · report: `)}${rel}${t.gray(" · JSON: .abatty/reports/" + r.date + ".json")}\n\n`,
  );
  return;
}
