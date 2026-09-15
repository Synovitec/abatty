/**
 * The `night` command: the screen over src/night, kept out of the dispatcher so the dispatcher
 * stays under the cap it enforces.
 */
import { runNight } from "../night/runner.mjs";
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
      out(`\n${t.banner(VERSION)}  ${t.bold("night")} ${t.gray("·")} ${dir}\n\n`);
      const r = runNight({
        repoDir: dir,
        until: opt("--until") || "07:00",
        maxCostUsd: opt("--max-cost") ? Number(opt("--max-cost")) : 60,
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
        log: (line) => {
          for (const l of line.split("\n")) {
            if (/ABORTED|failed|refused|red on|incomplete|no agent command|dirty tree/.test(l))
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
