/**
 * The two commands that judge: `gate`, the path-aware gate the pre-push hook and the night run,
 * and `doctor`, the harness self-test and the drift against the package.
 */
import { join } from "node:path";
import { CONFIG_FILE, LEGACY_CONFIG } from "../core/config.mjs";
import { detectWorkspaces } from "../presets/workspaces.mjs";
import { doctor } from "../core/doctor.mjs";
import { prerequisites } from "../core/prereqs.mjs";
import { runGate } from "../core/gate.mjs";
import { EXIT } from "./exit.mjs";
import { ciFromEnv } from "../core/env.mjs";
import { git, readAdoption } from "../core/repo.mjs";
import { pushLines, pushPlan, refRange } from "../core/push-refs.mjs";
import { readFileSync } from "node:fs";
import * as t from "../ui/term.mjs";
import { stalePatches } from "../core/patches.mjs";

/**
 * @param {import("./ratchet.mjs").CliContext} cx @param {import("../presets/index.mjs").Preset} preset
 */
export async function gateCommand(cx, preset) {
  const { dir, opt, flag, out, err, VERSION } = cx;
  if (flag("--preflight")) process.exit(preflightScreen(cx, preset));
  const base = opt("--base") || readAdoption(dir)?.baseBranch || "main";
  // --refs: the pre-push hook hands the lines git gave it, and the gate judges the push they
  // describe rather than whatever is checked out (src/core/push-refs.mjs).
  let range = opt("--range");
  if (flag("--refs")) {
    const pushed = refsVerdict(cx, base);
    if (typeof pushed === "number") process.exit(pushed);
    range = pushed || range;
  }
  const t0 = Date.now();
  const r = runGate({
    repoDir: dir,
    preset,
    workspaces: detectWorkspaces(dir, readAdoption(dir)),
    fast: flag("--fast"),
    range,
    base,
    // The pipelines set CI; a gate run there without --range cannot read the push from git.
    ci: ciFromEnv(),
    log: (line) => {
      const l = line.replace(/^\n/, "");
      if (l.startsWith("▶ ")) out(`\n${t.glyph.run} ${t.bold(l.slice(2))}\n`);
      else if (l.startsWith("✗ ")) out(`\n${t.glyph.fail} ${t.red(l.slice(2))}\n`);
      else if (l.startsWith("· DEFERRED")) out(`\n${t.glyph.defer} ${t.yellow(l.slice(2))}\n`);
      else if (l.startsWith("· ")) out(`${t.glyph.skip} ${t.gray(l.slice(2))}\n`);
      else if (l.startsWith("Gate ·"))
        out(
          `\n${t.banner(VERSION)}  ${t.bold("gate")} ${/could not be trusted/.test(l) ? t.yellow(l.slice(5)) : t.gray(l.slice(5))}\n`,
        );
      else out(`${t.gray(l)}\n`);
    },
  });
  const ran = r.events.filter(
    (e) => e.outcome === "ok" || e.outcome === "failed" || e.outcome === "errored",
  );
  // A step skipped for want of a script did not run, and a verdict that leads with the colour
  // hides how much of the gate that was: "gate green" over two steps of nine is a sentence a
  // reader has to be made to finish.
  const unrun = r.events.filter(
    (e) => e.outcome === "skipped" && /^no (".*" script|\S+)$/.test(e.detail || ""),
  );
  const headline = r.ok
    ? unrun.length
      ? t.yellow(
          `gate green with ${unrun.length} of ${unrun.length + ran.length} step(s) not run`,
        ) +
        t.gray(
          ` (${unrun.map((e) => e.label.replace(/ \(.*/, "")).join(", ")}: no script or config)`,
        )
      : t.green("gate green")
    : r.errored
      ? t.red("gate could not run")
      : t.red("gate red");
  out(
    `\n${r.ok ? (unrun.length ? t.glyph.warn : t.glyph.ok) : t.glyph.fail} ${headline} ${t.gray(`· ${ran.length} step(s) in ${t.duration(Date.now() - t0)}`)}${r.errored ? t.yellow(" · a step could not run: the instrument, not the work") : ""}${r.events.some((e) => e.outcome === "deferred") ? t.yellow(" · a suite deferred to CI") : ""}\n`,
  );
  for (const e of r.events)
    out(
      `  ${e.outcome === "ok" ? t.glyph.ok : e.outcome === "failed" ? t.glyph.fail : e.outcome === "errored" ? t.glyph.warn : e.outcome === "deferred" ? t.glyph.defer : t.glyph.skip} ${e.outcome === "skipped" ? t.gray(e.label) : e.label}${e.outcome === "errored" ? t.yellow(" could not run") : ""}${e.ms ? t.gray("  " + t.duration(e.ms)) : ""}${e.detail ? t.gray("  · " + e.detail) : ""}\n`,
    );
  out("\n");
  process.exit(r.errored ? EXIT.error : r.ok ? EXIT.clean : EXIT.findings);
}

/**
 * The push the hook describes on stdin, read before the gate runs: an exit code when there is
 * nothing to run (only deletions and tags) or a ref the checkout cannot judge, else the range the
 * judged ref adds ("" to let the gate find it).
 * @param {import("./ratchet.mjs").CliContext} cx @param {string} base @returns {number | string}
 */
function refsVerdict(cx, base) {
  let text = "";
  try {
    // A terminal is somebody typing, not git handing lines: reading it would wait for ever.
    if (!process.stdin.isTTY) text = readFileSync(0, "utf8");
  } catch {
    /* no stdin: nothing was handed, the gate reads the push itself */
  }
  const lines = pushLines(text);
  // Nothing handed (the hook run by hand): the gate reads the push itself, as it always has.
  if (!lines.length) return "";
  const head = git(cx.dir, "rev-parse", "HEAD");
  const plan = pushPlan(lines, head, (sha) => git(cx.dir, "rev-parse", `${sha}^{commit}`));
  for (const s of plan.skipped) cx.out(`${t.glyph.skip} ${t.gray(s)}\n`);
  if (plan.refused.length) {
    for (const s of plan.refused) cx.out(`${t.glyph.fail} ${t.red(s)}\n`);
    return EXIT.findings;
  }
  if (!plan.judge.length) {
    cx.out(`${t.glyph.ok} ${t.green("nothing pushed that the gate judges")}\n`);
    return EXIT.clean;
  }
  // Every judged ref names HEAD, and together they add what lies past the oldest of their bases:
  // judging the first alone let a second ref, further behind on its remote, carry commits unseen.
  const froms = plan.judge.map(
    (l) => refRange(l, git(cx.dir, "merge-base", base, head)).split("..")[0] || "",
  );
  if (froms.some((f) => !f)) return "";
  const from = froms.length === 1 ? froms[0] : git(cx.dir, "merge-base", "--octopus", ...froms);
  return from ? `${from}..${head}` : "";
}

/**
 * `gate --preflight`: what each step needs and whether it is here, with nothing run. Exit 4 when
 * a step that would run cannot, since that is the instrument and not the work.
 * @param {import("./ratchet.mjs").CliContext} cx @param {import("../presets/index.mjs").Preset} preset
 */
function preflightScreen(cx, preset) {
  const list = prerequisites(cx.dir, preset);
  cx.out(
    `\n${t.banner(cx.VERSION)}  ${t.bold("gate --preflight")} ${t.gray("· " + preset.id)}\n\n`,
  );
  for (const p of list)
    cx.out(
      `  ${p.state === "ready" ? t.glyph.ok : p.state === "off" ? t.glyph.skip : t.glyph.warn} ${p.state === "off" ? t.gray(p.label) : p.label}${p.required ? t.gray(" (required)") : ""}${t.gray("  · " + p.detail)}\n`,
    );
  const missing = list.filter((p) => p.state === "missing");
  cx.out(
    `\n${missing.length ? t.glyph.warn + " " + t.yellow(`${missing.length} step(s) cannot run here`) : t.glyph.ok + " " + t.green("every configured step can run here")}\n\n`,
  );
  return missing.length ? EXIT.error : EXIT.clean;
}

/**
 * @param {import("./ratchet.mjs").CliContext} cx @param {import("../presets/index.mjs").Preset | null} preset
 */
export async function doctorCommand(cx, preset) {
  const { dir, opt, flag, out, err, VERSION } = cx;
  const r = doctor({
    repoDir: dir,
    preset,
    strict: flag("--strict"),
    skipSelfTest: flag("--skip-self-test"),
    controls: flag("--controls"),
  });
  out(`\n${t.banner(VERSION)}  ${t.bold("doctor")} ${t.gray("·")} ${dir}\n\n`);
  if (r.controls) {
    out(t.heading("Controls", "every gate step planted a violation and must have gone red"));
    for (const s of r.controls.steps)
      out(
        `  ${s.outcome === "red" ? t.glyph.ok : s.outcome === "green" ? t.glyph.fail : t.glyph.skip} ${s.outcome === "green" ? t.red(s.label) : s.outcome === "red" ? s.label : t.gray(s.label)}${t.gray("  · " + s.detail)}${s.ms ? t.gray("  " + t.duration(s.ms)) : ""}\n`,
      );
    out("\n");
  } else if (flag("--controls"))
    out(`  ${t.glyph.warn} --controls needs a preset (--stack, or stack in the config)\n`);
  for (const l of r.selfTest.output
    .split("\n")
    .filter((x) => /FAIL|harness ok|failure|skipped/.test(x))) {
    out(
      `  ${/FAIL|failure/.test(l) ? t.glyph.fail + " " + t.red(l.replace(/^\s*FAIL\s*/, "")) : t.glyph.ok + " " + l.trim()}\n`,
    );
  }
  for (const d of r.drift)
    if (d.state !== "in step") out(`  ${t.glyph.warn} ${t.status(d.state)}  ${d.file}\n`);
  out(
    `  ${r.differs.length || r.missing.length ? t.glyph.warn : t.glyph.ok} drift: ${r.differs.length} file(s) differ from the shipped templates, ${r.missing.length} missing${r.differs.length ? t.gray(" · abatty update merges the package's version with your edits; or keep yours and say why in the decisions file") : ""}\n`,
  );
  if (r.notExecutable.length)
    out(
      `  ${t.glyph.fail} ${t.red(`git records ${r.notExecutable.join(", ")} as not executable, so git skips ${r.notExecutable.length > 1 ? "them" : "it"} on every other machine`)}${t.gray(` · git update-index --chmod=+x -- ${r.notExecutable.join(" ")}, then commit`)}\n`,
    );
  if (r.missingScripts.length)
    out(
      `  ${t.glyph.warn} gate scripts absent from package.json: ${r.missingScripts.join(", ")}\n`,
    );
  out(
    t.heading(
      "Hooks",
      "what each one does here, by day and at night, from the settings and the config",
    ),
  );
  for (const h of r.hooks) {
    out(
      `  ${h.warn ? t.glyph.warn : t.glyph.ok} ${h.hook}${t.gray("  · " + (h.wired.join(", ") || "unwired"))}\n`,
    );
    out(t.gray(`      day    ${h.day}\n      night  ${h.night}\n`));
    if (h.warn) out(`      ${t.yellow(h.warn)}\n`);
  }
  out("\n");
  for (const p of stalePatches(dir, VERSION))
    out(
      `  ${t.glyph.warn} ${t.yellow(`a patch of abatty ${p.patched} is still declared (${p.where}), and this is ${VERSION}`)}${t.gray(" · remove it once the upgrade carries its fix, or it applies to code it was not written for")}
`,
    );
  for (const p of r.config.problems) out(`  ${t.glyph.fail} ${t.red("config: " + p)}\n`);
  // What the guard holds and what it cannot: a regex over the agent's shell is a guard on this
  // machine's agent, not a policy on the branch. It is a warning rather than a note because the
  // regex was got past four ways in a single day (2026-09-22: a bundled flag, HEAD read as a
  // branch name, a redirection token, a quoted target), and because this repository's own base
  // branch was unprotected at the time, which is how one of those four was found. A reader who
  // believes the hook is the policy is the reader this line is for.
  const adoption = readAdoption(dir);
  const base = adoption?.baseBranch || "main";
  if (adoption?.directPushToBase !== true)
    out(
      `  ${t.glyph.warn} PR-only on ${base} is held here by a regex over one shell, which is defence in depth and not the control. Branch protection on the forge is the control, and this machine cannot see whether it is on: ${t.gray("abatty ci --ruleset prints the rules to import")}\n`,
    );
  if (r.config.files.length === 1 && r.config.files[0] === LEGACY_CONFIG)
    out(
      `  ${t.glyph.warn} the config is at the older place (${LEGACY_CONFIG}); abatty config --migrate moves it to ${CONFIG_FILE}\n`,
    );
  if (r.pinned && r.pinned !== r.packageVersion)
    out(
      `  ${t.glyph.warn} the config pins abatty ${r.pinned}, the package is ${r.packageVersion} · abatty update moves the pin with the harness\n`,
    );
  if (r.installed && r.installed !== r.packageVersion)
    out(
      `  ${t.glyph.warn} harness installed by abatty ${r.installed}, the package is ${r.packageVersion} · abatty update\n`,
    );
  else if (!r.installed && r.drift.some((d) => d.state !== "missing"))
    out(
      `  ${t.glyph.warn} no harness lock (.claude/harness.lock.json): abatty update writes it and merges from here on\n`,
    );
  out(
    `\n${r.ok ? t.glyph.ok + " " + t.green("doctor: ok") : t.glyph.fail + " " + t.red("doctor: NOT ok")}\n\n`,
  );
  process.exit(r.ok ? EXIT.clean : EXIT.findings);
}
