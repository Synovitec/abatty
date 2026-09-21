/**
 * The two commands that judge: `gate`, the path-aware gate the pre-push hook and the night run,
 * and `doctor`, the harness self-test and the drift against the package.
 */
import { join } from "node:path";
import { CONFIG_FILE, LEGACY_CONFIG } from "../core/config.mjs";
import { detectWorkspaces } from "../presets/workspaces.mjs";
import { doctor } from "../core/doctor.mjs";
import { runGate } from "../core/gate.mjs";
import { EXIT } from "./exit.mjs";
import { readAdoption } from "../core/repo.mjs";
import * as t from "../ui/term.mjs";

/**
 * @param {import("./ratchet.mjs").CliContext} cx @param {import("../presets/index.mjs").Preset} preset
 */
export async function gateCommand(cx, preset) {
  const { dir, opt, flag, out, err, VERSION } = cx;
  const base = opt("--base") || readAdoption(dir)?.baseBranch || "main";
  const t0 = Date.now();
  const r = runGate({
    repoDir: dir,
    preset,
    workspaces: detectWorkspaces(dir, readAdoption(dir)),
    fast: flag("--fast"),
    range: opt("--range"),
    base,
    // The pipelines set CI; a gate run there without --range cannot read the push from git.
    ci: Boolean(process.env.CI),
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
  out(
    `\n${r.ok ? t.glyph.ok : t.glyph.fail} ${r.ok ? t.green("gate green") : r.errored ? t.red("gate could not run") : t.red("gate red")} ${t.gray(`· ${ran.length} step(s) in ${t.duration(Date.now() - t0)}`)}${r.errored ? t.yellow(" · a step could not run: the instrument, not the work") : ""}${r.events.some((e) => e.outcome === "deferred") ? t.yellow(" · a suite deferred to CI") : ""}\n`,
  );
  for (const e of r.events)
    out(
      `  ${e.outcome === "ok" ? t.glyph.ok : e.outcome === "failed" ? t.glyph.fail : e.outcome === "errored" ? t.glyph.warn : e.outcome === "deferred" ? t.glyph.defer : t.glyph.skip} ${e.outcome === "skipped" ? t.gray(e.label) : e.label}${e.outcome === "errored" ? t.yellow(" could not run") : ""}${e.ms ? t.gray("  " + t.duration(e.ms)) : ""}${e.detail ? t.gray("  · " + e.detail) : ""}\n`,
    );
  out("\n");
  process.exit(r.errored ? EXIT.error : r.ok ? EXIT.clean : EXIT.findings);
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
  if (r.missingScripts.length)
    out(
      `  ${t.glyph.warn} gate scripts absent from package.json: ${r.missingScripts.join(", ")}\n`,
    );
  for (const p of r.config.problems) out(`  ${t.glyph.fail} ${t.red("config: " + p)}\n`);
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
