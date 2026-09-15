/**
 * The `ratchet` and `baseline` commands: the screens over src/ratchet, kept out of the
 * dispatcher so the dispatcher stays under the cap it enforces.
 */
import { join } from "node:path";
import { buildContext } from "../rules/context.mjs";
import { pushRange } from "../core/gate.mjs";
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
      if (!flag("--json")) {
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
        process.exit(bad || problems.length ? 1 : 0);
      }
      const baseline = readBaseline(dir, baselineRel);
      const rangeOpt = opt("--range");
      const base = opt("--base") || adoption?.baseBranch || "main";
      const range = rangeOpt === "auto" ? pushRange(dir, base) : rangeOpt;
      const ctx = buildContext(dir);
      const measurements = measureAll(probes, ctx, { config, range }, baseline);
      const verdicts = compare(measurements, baseline, config);
      const { score, axes } = scoreOf(measurements);
      if (flag("--json")) {
        out(
          JSON.stringify(
            { repo: dir, baseline: baseline ? baselineRel : null, range, score, axes, verdicts },
            null,
            2,
          ) + "\n",
        );
        process.exit(failed(verdicts) || problems.length ? 1 : 0);
      }
      out(
        `  ${t.gray(baseline ? `floor ${baselineRel} (${baseline.measuredAt})` : `no baseline at ${baselineRel} - every metric above zero fails until \`abatty baseline\` records the floor`)}${range ? t.gray(` · range ${range}`) : ""}\n\n`,
      );
      const mark = (/** @type {string} */ s) =>
        s === "ok" || s === "improved" ? t.glyph.ok : s === "skipped" ? t.glyph.skip : t.glyph.fail;
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
                    ? t.green("improved")
                    : v.status === "skipped"
                      ? t.gray("skipped")
                      : t.green("ok");
        out(
          `  ${mark(v.status)} ${t.bold(v.metric.padEnd(24))} ${String(v.value).padStart(5)}${v.floor !== null ? t.gray(` / ${v.floor}`) : t.gray("      ")}  ${t.gray(v.kind.padEnd(7))} ${word}${v.scanned ? t.gray(`  · ${v.scanned} scanned`) : ""}\n`,
        );
        for (const m of v.messages)
          out(
            `      ${v.status === "skipped" || v.status === "improved" ? t.gray(m) : t.yellow(m)}\n`,
          );
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
      process.exit(red || problems.length ? 1 : 0);
    }
    case "baseline": {
      // Today's numbers as the floor: zeros promoted to HARD, a HARD metric above zero refused, a
      // rise refused without --reason (and the reason belongs in the progress log too).
      const { adoption, config, baselineRel } = ratchetSetup(dir);
      const { probes, problems } = await loadProbes(dir, config);
      out(
        `\n${t.banner(VERSION)}  ${t.bold("baseline")} ${t.gray("·")} ${join(dir, baselineRel)}\n\n`,
      );
      for (const p of problems) out(`  ${t.glyph.fail} ${t.red(p)}\n`);
      if (problems.length) process.exit(1);
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
          `\n  ${t.glyph.warn} ${t.yellow(`floor(s) raised with a reason: ${r.rises.join(", ")} - write the same reason in docs/STANDARDS_PROGRESS.md`)}\n`,
        );
      out(
        `\n${r.ok ? t.glyph.ok : t.glyph.fail} ${r.ok ? t.green(flag("--dry-run") ? "baseline computed (not written: --dry-run)" : "baseline written") : t.red("baseline refused; nothing written")} ${t.gray(`· readability ${r.baseline.score}/100`)}\n\n`,
      );
      process.exit(r.ok ? 0 : 1);
    }
  }
}
