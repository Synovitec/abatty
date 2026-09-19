/**
 * The `night` command: the screen over src/night, kept out of the dispatcher so the dispatcher
 * stays under the cap it enforces.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { runNight } from "../night/runner.mjs";
import { gatherNight, nightDates, renderNightReport } from "../night/report.mjs";
import { describeGap } from "../night/holdout.mjs";
import * as t from "../ui/term.mjs";

/** @param {import("./ratchet.mjs").CliContext} c */
export function nightCommand(c) {
  const { dir, opt, flag, out, err, VERSION } = c;
  switch ("night") {
    case "night": {
      // The unattended night: one headless session per phase on a dedicated branch, the
      // pre-flight (self-test, harness untouched, gate green, canary) or no night.
      const mode = opt("--mode") || "auto";
      if (mode !== "auto" && mode !== "dontAsk") {
        err(`${t.glyph.fail} --mode is auto or dontAsk\n`);
        process.exit(2);
      }
      const sandbox = opt("--sandbox") || "";
      if (sandbox && !["auto", "required", "off"].includes(sandbox)) {
        err(`${t.glyph.fail} --sandbox is auto, required or off\n`);
        process.exit(2);
      }
      out(`\n${t.banner(VERSION)}  ${t.bold("night")} ${t.gray("·")} ${dir}\n\n`);
      const r = runNight({
        repoDir: dir,
        until: opt("--until") || "07:00",
        maxCostUsd: opt("--max-cost") ? Number(opt("--max-cost")) : undefined,
        phases: opt("--phases")
          ? opt("--phases")
              .split(/[\s,]+/)
              .filter(Boolean)
          : [],
        model: opt("--model") || "opus",
        effort: opt("--effort") || "high",
        mode,
        noPush: flag("--no-push"),
        skipCanary: flag("--skip-canary"),
        canaryOnly: flag("--canary-only"),
        agent: opt("--agent"),
        sandbox: /** @type {"auto" | "required" | "off" | undefined} */ (sandbox || undefined),
        maxSessions: opt("--max-sessions") ? Number(opt("--max-sessions")) : undefined,
        maxTokens: opt("--max-tokens") ? Number(opt("--max-tokens")) : undefined,
        resume: flag("--resume"),
        log: (line) => {
          for (const l of line.split("\n")) {
            if (
              /ABORTED|failed|refused|red on|incomplete|no agent command|dirty tree|does not hold|could not start|nothing to resume/.test(
                l,
              )
            )
              out(`${t.glyph.fail} ${t.red(l)}\n`);
            else if (/^\[\d\d:\d\d\]/.test(l)) out(`${t.glyph.run} ${t.bold(l)}\n`);
            else if (/canary ok|night-run done|pre-flight done/.test(l))
              out(`${t.glyph.ok} ${t.green(l)}\n`);
            else out(`${t.gray(l)}\n`);
          }
        },
      });
      out("\n");
      process.exit(r.code);
    }
  }
}

/** The `night-report` command: the night's facts and the lessons they propose. @param {import("./ratchet.mjs").CliContext} c */
/**
 * The night's own split, read back and measured. The seed is the night's date, so the slice is
 * the same one the night withheld and a different one next time.
 * @param {string} dir @param {{ date: string }} r
 */
async function holdoutOf(dir, r) {
  try {
    const { buildReport } = await import("../core/report.mjs");
    const { splitSurface, holdoutGap } = await import("../night/holdout.mjs");
    const report = await buildReport(dir, { write: false });
    const ids = report.findings.map((f) => f.id);
    if (ids.length < 8) return null;
    return holdoutGap(report.findings, splitSurface(ids, r.date));
  } catch {
    return null;
  }
}

/**
 * `abatty night-report`: the night's facts, the lessons they propose, and the gap between the
 * surface the night was pointed at and the surface it was not.
 * @param {import("./ratchet.mjs").CliContext} c
 */
export async function nightReportCommand(c) {
  const { dir, opt, flag, out, err, VERSION } = c;
  switch ("night-report") {
    case "night-report": {
      // The learning distillation: the night's facts and the lessons they propose.
      const r = gatherNight(dir, opt("--date"));
      if (!r) {
        err(
          `${t.glyph.fail} no night to report on${opt("--date") ? ` for ${opt("--date")}` : ""}: ${nightDates(dir).length ? "nights: " + nightDates(dir).join(", ") : "no .claude/night/<date> folder (abatty night writes it)"}\n`,
        );
        process.exit(2);
      }
      // The gap between what the night was pointed at and what it was not. A night measured only
      // on the rules it was told about is marking its own paper.
      const gap = await holdoutOf(dir, r);
      if (flag("--json")) {
        out(JSON.stringify({ ...r, holdout: gap }, null, 2) + "\n");
        break;
      }
      const md =
        renderNightReport(r) + (gap ? `\n## The withheld surface\n\n${describeGap(gap)}\n` : "");
      if (opt("--out")) {
        const target = resolve(dir, opt("--out"));
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, md);
        out(
          `\n${t.banner(VERSION)}  ${t.bold("night-report")} ${t.gray(`· ${r.date} · ${r.lessons.length} lesson(s) proposed · ${relative(dir, target)}`)}\n\n`,
        );
        break;
      }
      out(md);
      break;
    }
  }
}
