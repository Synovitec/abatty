/**
 * The `ratchet` and `baseline` commands: the screens over src/ratchet, kept out of the
 * dispatcher so the dispatcher stays under the cap it enforces.
 */
import { EXIT } from "./exit.mjs";
import { join } from "node:path";
import { buildContext } from "../rules/context.mjs";
import { changedPaths, pushRange } from "../core/range.mjs";
import {
  compare,
  failed,
  loadProbes,
  measureAll,
  ratchetSetup,
  readBaseline,
  scoreOf,
  writeBaseline,
} from "../ratchet/index.mjs";
import { runControls } from "../ratchet/controls.mjs";
import * as t from "../ui/term.mjs";

/**
 * @typedef {{ dir: string, opt: (name: string) => string, flag: (name: string) => boolean, out: (s: string) => void, err: (s: string) => void, VERSION: string }} CliContext
 */

/** @param {"ratchet" | "baseline" | string} command @param {CliContext} c */
export async function ratchetCommand(command, c) {
  const { dir, opt, flag, out, err, VERSION } = c;
  void err;
  switch (command) {
    case "ratchet": {
      // The ratchet: every probe over the repository, judged against the committed baseline.
      // --controls runs each probe's control cases on throwaway repositories instead.
      const { adoption, config, baselineRel } = ratchetSetup(dir);
      const { probes, problems } = await loadProbes(dir, config);
      // A machine surface carries the findings and nothing else: a banner above them is a
      // parse error to whatever reads them.
      if (!flag("--json") && !flag("--sarif")) {
        out(`\n${t.banner(VERSION)}  ${t.bold("ratchet")} ${t.gray("·")} ${dir}\n\n`);
        for (const p of problems) out(`  ${t.glyph.fail} ${t.red(p)}\n`);
      }
      if (flag("--controls")) {
        let bad = 0;
        for (const p of probes) {
          const results = runControls(p);
          const failing = results.filter((r) => !r.ok);
          bad += failing.length;
          out(
            `  ${failing.length ? t.glyph.fail : t.glyph.ok} ${t.bold(p.metric)} ${t.gray(`${results.length} control(s)${p.source && p.source !== "abatty" ? " · " + p.source : ""}`)}\n`,
          );
          for (const r of failing)
            out(
              `      ${t.red(`${r.name}: expected ${r.expect}, got ${r.got}`)}${r.detail ? t.gray(" · " + r.detail) : ""}\n`,
            );
        }
        out(
          `\n${bad || problems.length ? t.glyph.fail : t.glyph.ok} ${bad || problems.length ? t.red(`${bad} control(s) failing`) : t.green("every control holds, both directions")}\n\n`,
        );
        process.exit(problems.length ? EXIT.input : bad ? EXIT.findings : EXIT.clean);
      }
      const baseline = readBaseline(dir, baselineRel);
      const rangeOpt = opt("--range");
      const base = opt("--base") || adoption?.baseBranch || "main";
      const range = rangeOpt === "auto" ? pushRange(dir, base) : rangeOpt;
      const ctx = buildContext(dir);
      const measurements = measureAll(probes, ctx, { config, range }, baseline);
      const verdicts = compare(measurements, baseline, config);
      const { score, axes } = scoreOf(measurements);
      if (flag("--sarif")) {
        // The probes carry a path and a line, which is what makes this the surface that lands on
        // the diff of the change under review rather than in a report nobody opens.
        const { sarifOfVerdicts } = await import("../ui/sarif.mjs");
        out(
          JSON.stringify(sarifOfVerdicts({ verdicts, probes, version: VERSION }), null, 2) + "\n",
        );
        process.exit(problems.length ? EXIT.input : failed(verdicts) ? EXIT.findings : EXIT.clean);
      }
      if (flag("--json")) {
        out(
          JSON.stringify(
            { repo: dir, baseline: baseline ? baselineRel : null, range, score, axes, verdicts },
            null,
            2,
          ) + "\n",
        );
        process.exit(problems.length ? EXIT.input : failed(verdicts) ? EXIT.findings : EXIT.clean);
      }
      out(
        `  ${t.gray(baseline ? `floor ${baselineRel} (${baseline.measuredAt})` : `no baseline at ${baselineRel} - every metric above zero fails until \`abatty baseline\` records the floor`)}${range ? t.gray(` · range ${range}`) : ""}\n\n`,
      );
      // `improved` reads as a failure now: an unlocked floor is slack the gate still accepts.
      const mark = (/** @type {string} */ s) =>
        s === "ok" ? t.glyph.ok : s === "skipped" ? t.glyph.skip : t.glyph.fail;
      for (const v of verdicts) {
        const word =
          v.status === "regressed"
            ? t.red("REGRESSED")
            : v.status === "hard-fail"
              ? t.red("HARD FAIL")
              : v.status === "scanned-zero"
                ? t.red("SCANNED ZERO")
                : v.status === "unbaselined"
                  ? t.red("NO FLOOR")
                  : v.status === "improved"
                    ? t.red("FLOOR UNLOCKED")
                    : v.status === "redefined"
                      ? t.red("REDEFINED")
                      : v.status === "skipped"
                        ? t.gray("skipped")
                        : t.green("ok");
        out(
          `  ${mark(v.status)} ${t.bold(v.metric.padEnd(24))} ${String(v.value).padStart(5)}${v.floor !== null ? t.gray(` / ${v.floor}`) : t.gray("      ")}  ${t.gray(v.kind.padEnd(7))} ${word}${v.scanned ? t.gray(`  · ${v.scanned} scanned`) : ""}\n`,
        );
        for (const m of v.messages)
          out(`      ${v.status === "skipped" ? t.gray(m) : t.yellow(m)}\n`);
        // Who raised this floor and why, read from the baseline, on the metric it explains.
        if (v.floorNote) out(`      ${t.gray(v.floorNote)}\n`);
        // And what the number is not: a proxy says so where it is read, beside its own count.
        if (v.approximates && v.status !== "ok" && v.status !== "skipped")
          out(`      ${t.gray(`a proxy: ${v.approximates}`)}\n`);
      }
      // What this change introduced, before what the repository already carried. A gate that
      // reports both in one list teaches its reader to scroll past both.
      if (range) {
        const { splitByRange } = await import("../ratchet/index.mjs");
        const split = splitByRange(verdicts, changedPaths(dir, range));
        if (split.introduced.length || split.standing.length) {
          out(
            `\n  ${t.bold("in this change")} ${t.gray(`${split.introduced.length} finding(s)`)}${t.gray(` · standing ${split.standing.length}`)}\n`,
          );
          for (const { metric, finding } of split.introduced.slice(0, 20))
            out(
              `    ${t.glyph.fail} ${t.gray(metric.padEnd(24))} ${finding.path}${finding.line ? t.gray(":" + finding.line) : ""}${finding.detail ? t.gray(" · " + finding.detail) : ""}\n`,
            );
          if (!split.introduced.length)
            out(`    ${t.gray("nothing this change touched; every finding is standing debt")}\n`);
        }
      }
      const red = failed(verdicts);
      out(
        `\n  ${t.gray("readability")} ${t.bold(String(score))}${t.gray("/100")} ${t.gray(
          Object.entries(axes)
            .map(([a, n]) => `${a} ${n}`)
            .join(" · "),
        )}\n`,
      );
      out(
        `\n${red || problems.length ? t.glyph.fail : t.glyph.ok} ${red || problems.length ? t.red("ratchet red") : t.green("ratchet green")} ${t.gray(`· ${verdicts.length} metric(s)`)}\n\n`,
      );
      process.exit(problems.length ? EXIT.input : red ? EXIT.findings : EXIT.clean);
    }
    case "baseline": {
      // Today's numbers as the floor: zeros promoted to HARD, a HARD metric above zero refused, a
      // rise refused without --reason and --owner (the reason belongs in the progress log too),
      // and recorded against the metric it explains rather than against the write.
      const { adoption, config, baselineRel } = ratchetSetup(dir);
      const { probes, problems } = await loadProbes(dir, config);
      out(
        `\n${t.banner(VERSION)}  ${t.bold("baseline")} ${t.gray("·")} ${join(dir, baselineRel)}\n\n`,
      );
      for (const p of problems) out(`  ${t.glyph.fail} ${t.red(p)}\n`);
      if (problems.length) process.exit(EXIT.input);
      const previous = readBaseline(dir, baselineRel);
      const base = opt("--base") || adoption?.baseBranch || "main";
      const ctx = buildContext(dir);
      const measurements = measureAll(
        probes,
        ctx,
        { config, range: pushRange(dir, base) },
        previous,
      );
      const r = writeBaseline({
        repoDir: dir,
        rel: baselineRel,
        measurements,
        config,
        previous,
        today: ctx.today,
        reason: opt("--reason"),
        owner: opt("--owner"),
        dryRun: flag("--dry-run"),
      });
      for (const m of measurements) {
        if (m.skipped) continue;
        const hard = r.baseline.hard?.includes(m.metric);
        out(
          `  ${t.glyph.dot} ${t.bold(m.metric.padEnd(24))} ${String(m.value).padStart(5)}  ${t.gray(hard ? "hard" : "ratchet")}${r.promoted.includes(m.metric) ? t.green("  promoted to HARD (zero today)") : ""}${m.value > 0 ? t.gray(`  · ${Object.keys(m.debt).length} file(s) on the list`) : ""}\n`,
        );
      }
      for (const x of r.refusals) out(`\n  ${t.glyph.fail} ${t.red(x)}\n`);
      if (r.rises.length && r.ok)
        out(
          `\n  ${t.glyph.warn} ${t.yellow(`floor(s) raised by ${opt("--owner")}: ${r.rises.join(", ")} - the reason is recorded per metric in the baseline; write the same one in docs/STANDARDS_PROGRESS.md`)}\n`,
        );
      out(
        `\n${r.ok ? t.glyph.ok : t.glyph.fail} ${r.ok ? t.green(flag("--dry-run") ? "baseline computed (not written: --dry-run)" : "baseline written") : t.red("baseline refused; nothing written")} ${t.gray(`· readability ${r.baseline.score}/100`)}\n\n`,
      );
      process.exit(r.ok ? EXIT.clean : EXIT.findings);
    }
  }
}
