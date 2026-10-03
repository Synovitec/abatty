/**
 * The `prove` command: which of this repository's checks can actually fail, judged on a copy
 * of it, with nothing written here (src/core/prove.mjs). The screen a stranger meets first.
 */
import { prove } from "../core/prove.mjs";
import { EXIT } from "./exit.mjs";
import * as t from "../ui/term.mjs";

/** A step that runs here and could not be judged on its copy. */
const UNJUDGED = /red without a plant|the tool is not installed/;

/**
 * @param {import("./ratchet.mjs").CliContext} cx @param {import("../presets/index.mjs").Preset} preset
 */
export async function proveCommand(cx, preset) {
  const { dir, flag, out, VERSION } = cx;
  const json = flag("--json");
  if (!json)
    out(
      `\n${t.banner(VERSION)}  ${t.bold("prove")} ${t.gray(`· ${preset.name} · on a copy of this repository; nothing is written here`)}\n\n`,
    );
  const r = prove({
    repoDir: dir,
    preset,
    suites: flag("--suites"),
    // What is running, as it runs: a test suite can take minutes, and a silent screen reads hung.
    log: json ? undefined : (line) => out(`  ${t.gray(line)}\n`),
  });
  const red = r.steps.filter((s) => s.outcome === "red");
  const green = r.steps.filter((s) => s.outcome === "green");
  if (json) out(JSON.stringify(r, null, 2) + "\n");
  else {
    out("\n");
    for (const s of r.steps) {
      const mark =
        s.outcome === "red" ? t.glyph.ok : s.outcome === "green" ? t.glyph.fail : t.glyph.skip;
      out(
        `  ${mark} ${t.bold(s.label)}  ${s.outcome === "green" ? t.red(s.detail) : t.gray(s.detail)}\n`,
      );
    }
    const judged = red.length + green.length;
    // A step that runs here and could not be judged (red before its plant, its tool missing) is
    // named on the summary: "3 of 3" read as everything proven while five steps were not.
    const unjudged = r.steps.filter((s) => s.outcome === "skipped" && UNJUDGED.test(s.detail));
    out(
      judged
        ? `\n${green.length ? t.glyph.fail : t.glyph.ok} ${red.length} of ${judged} check(s) went red on a planted violation${green.length ? ` · ${t.red(`${green.length} stayed green, so ${green.length === 1 ? "it does" : "they do"} not check what ${green.length === 1 ? "its name says" : "their names say"}: ${green.map((s) => s.label).join(", ")}`)}` : ", so each can stop a bad change"}\n`
        : `\n${t.glyph.skip} nothing to prove: no gate step of the ${preset.id} preset runs here (no script or config for any of them)\n`,
    );
    if (unjudged.length)
      out(
        `${t.glyph.warn} ${t.yellow(`${unjudged.length} more could not be judged here (${unjudged.map((s) => s.label).join(", ")}): each was red before its plant, or its tool is missing; what they printed is kept`)}\n`,
      );
    if (r.logs) out(`  ${t.gray(`what each step printed: ${r.logs}`)}\n`);
    out("\n");
  }
  process.exitCode = green.length ? EXIT.findings : EXIT.clean;
}
