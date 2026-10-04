/**
 * The `prove` command: which of this repository's checks can actually fail, judged on a copy
 * of it, with nothing written here (src/core/prove.mjs). The screen a stranger meets first.
 */
import { prove } from "../core/prove.mjs";
import { EXIT } from "./exit.mjs";
import * as t from "../ui/term.mjs";
import { readJsonFile } from "../core/repo.mjs";

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
      `\n${t.banner(VERSION)}  ${t.bold("prove")} ${t.gray(`· ${preset.name} · on a copy of this repository; nothing is written here`)}\n  ${t.gray("it runs this repository's own scripts with your environment, as running its tests does: not a sandbox")}\n\n`,
    );
  const r = prove({
    repoDir: dir,
    preset,
    suites: flag("--suites"),
    // What is running, as it runs: a test suite can take minutes, and a silent screen reads hung.
    // A live line's log path is inside the copy, gone by the end of the run: the summary names
    // the folder they are kept in instead.
    log: json
      ? undefined
      : (line) => out(`  ${t.gray(line.replace(/;? ?what it printed: \S+/, ""))}\n`),
  });
  // The repository's own checks are counted; abatty's built-in scans are said apart: "2 of 2"
  // on a repository with one test script counted the secret scan this package brings as its own.
  const own = r.steps.filter((s) => !s.builtin);
  const red = own.filter((s) => s.outcome === "red");
  const green = r.steps.filter((s) => s.outcome === "green");
  const builtins = r.steps.filter((s) => s.builtin && s.outcome === "red");
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
    // What is shown is said exactly: each went red on ONE planted violation and green again
    // without it. That a check can fail is shown; that it catches every violation is not.
    out(
      judged
        ? `\n${green.length ? t.glyph.fail : unjudged.length ? t.glyph.warn : t.glyph.ok} ${red.length} of ${judged} of your check(s)${unjudged.length ? " judged here" : ""} went red on a planted violation and green again without it${green.length ? ` · ${t.red(`${green.length} stayed green, so ${green.length === 1 ? "it does" : "they do"} not check what ${green.length === 1 ? "its name says" : "their names say"}: ${green.map((s) => s.label).join(", ")}`)}` : ", so each can fail on at least that"}\n`
        : `\n${t.glyph.skip} nothing to prove: no gate step of the ${preset.id} preset runs here (no script or config for any of them)\n`,
    );
    if (builtins.length)
      out(
        `  ${t.gray(`and abatty's own ${builtins.map((s) => s.label).join(", ")}, which needs no setup here`)}\n`,
      );
    if (unjudged.length)
      out(
        `${t.glyph.warn} ${t.yellow(`${unjudged.length} more could not be judged here (${unjudged.map((s) => s.label).join(", ")}): each was red before its plant, or its tool is missing. The copy is the repository at this commit, so a red before the plant is most often the repository's own failure or the machine's (a flaky test, a service down, a file only this machine has); what they printed is kept`)}\n`,
      );
    // The suites are out of a default run: said, where the repository has one, so a database or
    // browser suite does not read as forgotten (an adopter set TEST_DATABASE_URL and saw none).
    const suites = flag("--suites") ? [] : suitesHere(dir, preset);
    if (suites.length)
      out(`  ${t.gray(`not run by default: ${suites.join("; ")} · --suites runs them too`)}\n`);
    if (r.logs) out(`  ${t.gray(`what each step printed: ${r.logs}`)}\n`);
    out("\n");
  }
  process.exitCode = green.length ? EXIT.findings : EXIT.clean;
}

/**
 * The preset's suites this repository has a script for, by name: the ones a default run leaves
 * out. @param {string} dir @param {import("../presets/index.mjs").Preset} preset @returns {string[]}
 */
function suitesHere(dir, preset) {
  const scripts = readJsonFile(dir, "package.json")?.scripts || {};
  return (preset.gate.suites || [])
    .filter((suite) => suite.steps.some((s) => typeof scripts[String(s.script)] === "string"))
    .map((suite) => suite.name);
}
