/**
 * The gate: everything that must hold before a push, in one place, driven by the preset.
 * Ported from the gate paycore_dms proved (scripts/ci/gate.mjs, 2026-09): one implementation
 * called by `.githooks/pre-push`, `npm run gate` and the night's Stop hook.
 *
 * PATH-AWARE ON PURPOSE. The always-on set runs in about two minutes. The expensive suites run
 * only when the push OR the working tree touches the paths the preset names for them, because
 * the suites build and test the tree; the changelog range check reads the push alone, because
 * it is a rule about commits. When Docker is absent a suite is DEFERRED, loudly, never silently
 * skipped. --fast is the deliberate way to defer and says so.
 *
 * A monorepo composes presets: after the root's steps, each workspace with a preset runs that
 * preset's steps in its own folder (its own scripts, its suites' paths under its folder); the
 * built-in steps (the secret scan, the audit) and the ratchet run once, at the root.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { asResult, dockerRunning, launch, runCommand, runScript } from "./spawn.mjs";
import { git, hasScript, readConfig, readPackage } from "./repo.mjs";
import { pendingPaths, pushRangeInfo } from "./range.mjs";
import { scanSecrets } from "./secrets.mjs";
import { auditOutcome } from "./audit.mjs";
import { scanFiles, scrubConfig } from "./scrub.mjs";
import { affectedWorkspaces } from "../presets/workspaces.mjs";
import { prerequisites } from "./prereqs.mjs";
import { suiteDatabase } from "./hermetic.mjs";

/**
 * @typedef {"ok" | "failed" | "errored" | "skipped" | "deferred"} GateOutcome
 * @typedef {{ label: string, outcome: GateOutcome, detail?: string, ms?: number }} GateEvent
 * @typedef {{ label: string, outcome: GateOutcome, detail?: string, ms?: number, workspace?: string }} GateEventW
 * @typedef {import("./spawn.mjs").RunResult} RunResult
 * @typedef {(cmd: string, args: string[]) => { status: number | null, output: string }} AuditRunner
 * @typedef {{ repoDir: string, preset: import("../presets/index.mjs").Preset, fast?: boolean, range?: string, base?: string, ci?: boolean, run?: (repoDir: string, script: string, extraArgs?: string[], env?: Record<string, string>) => RunResult | number, audit?: AuditRunner, dockerUp?: () => boolean, db?: { url: string, test: string }, log?: (line: string) => void, workspaces?: { path: string, preset: import("../presets/index.mjs").Preset | null }[] }} GateOptions
 */

/** The audit as spawned in a repository: the package manager's command, its output in one string. @param {string} repoDir @returns {AuditRunner} */
const spawnAudit = (repoDir) => (cmd, args) => {
  const l = launch(cmd, args);
  const r = spawnSync(l.file, l.args, {
    cwd: repoDir,
    encoding: "utf8",
    shell: l.shell,
    maxBuffer: 16 * 1024 * 1024,
  });
  return { status: r.status, output: (r.stdout || "") + (r.stderr || "") };
};

/**
 * Run the gate. Returns the events and whether it passed; the first failing step ends it.
 * @param {GateOptions} o
 */
export function runGate(o) {
  const { repoDir, preset } = o;
  const run = o.run || runScript;
  const dockerUp = o.dockerUp || dockerRunning;
  const log = o.log || ((line) => process.stdout.write(line + "\n"));
  /** @type {GateEvent[]} */
  const events = [];
  const rootScripts = readPackage(repoDir).scripts || {};
  let pkgScripts = rootScripts;
  let cwd = repoDir;
  let prefix = "";
  let presetId = preset.id;
  /** The variables a suite's steps run with: a database of the run's own (src/core/hermetic.mjs). */
  /** @type {Record<string, string>} */
  let suiteEnv = {};

  const info = pushRangeInfo(repoDir, o.base, o.range);
  const range = info.range;
  // A range the gate could not find, or an empty one in CI, is not an empty push. In CI the
  // push is the event that started the run, not a diff against an upstream that was updated by
  // that very push; on a detached or shallow checkout there is no upstream at all. Reading either
  // as "0 pushed files" skipped every suite and printed green, which is the one thing a gate
  // must never do by accident. Blind, the gate selects everything and says why.
  const blind = info.how === "unknown" || info.commits < 0 || (o.ci === true && info.commits === 0);
  const changed = blind
    ? git(repoDir, "ls-files").split("\n").filter(Boolean)
    : git(repoDir, "diff", "--name-only", range).split("\n").filter(Boolean);
  const pending = pendingPaths(repoDir);
  const selection = [...new Set([...changed, ...pending])];
  log(
    blind
      ? `Gate · range ${range} could not be trusted (${
          info.how === "unknown" || info.commits < 0
            ? `no upstream and no ${o.base || "main"} to fork from`
            : "in CI the push is the event, not a diff against the upstream"
        }): every path is selected, ${changed.length} tracked file(s)${pending.length ? ` + ${pending.length} uncommitted` : ""}. Pass --range <before>..<sha> to narrow it`
      : `Gate · range ${range} · ${changed.length} pushed file(s)${pending.length ? ` + ${pending.length} uncommitted, both select suites` : ""}`,
  );
  // Said before the first step rather than found after the slowest one; said, not refused,
  // because a lookup that cannot see a layout must never stop a gate that would have run.
  const unready = prerequisites(repoDir, preset, { dockerUp: () => true }).filter(
    (p) => p.state === "missing",
  );
  if (unready.length)
    log(
      `· preflight: ${unready.length} step(s) look unable to run here: ${unready.map((p) => `${p.label} (${p.detail})`).join("; ")}`,
    );

  const resolveScript = (/** @type {import("../presets/index.mjs").GateStep} */ step) =>
    [step.script, ...(step.alternatives || [])].find(
      (s) => typeof s === "string" && typeof pkgScripts[s] === "string",
    ) || null;

  const step = (/** @type {import("../presets/index.mjs").GateStep} */ s) => {
    if (s.builtin && prefix) return true; // the built-in steps run once, at the root
    if (s.builtin === "secrets") {
      log(`\n▶ ${s.label}`);
      const t0 = Date.now();
      const r = scanSecrets(repoDir, { mode: "tree" });
      if (r.findings.length) {
        for (const f of r.findings) log(`  ${f.path}:${f.line}  ${f.kind}  ${f.sample}`);
        events.push({
          label: s.label,
          outcome: "failed",
          ms: Date.now() - t0,
          detail: `${r.findings.length} finding(s)`,
        });
        log(
          `\n✗ ${s.label} failed (${r.findings.length} finding(s)). Rotate the secret, remove it, or mark a false positive on its line with abatty:allow-secret. The gate stops here.`,
        );
        return false;
      }
      events.push({
        label: s.label,
        outcome: "ok",
        ms: Date.now() - t0,
        detail: `${r.scanned} file(s)`,
      });
      return true;
    }
    if (s.builtin === "scrub") {
      // Opt-in, like the feature it holds: a repository that did not ask for the scrub skips it,
      // one that did has the gate refuse the trace before a push, which is the last point a file
      // can still be changed without rewriting history.
      const cfg = scrubConfig(repoDir);
      if (!cfg.enabled) {
        events.push({ label: s.label, outcome: "skipped", detail: "scrub.enabled is off" });
        return true;
      }
      log(`\n▶ ${s.label}`);
      const t0 = Date.now();
      const findings = scanFiles(repoDir, { allow: cfg.allow });
      if (findings.length) {
        for (const f of findings.slice(0, 20)) log(`  ${f.where}:${f.line}  ${f.text}`);
        events.push({
          label: s.label,
          outcome: "failed",
          ms: Date.now() - t0,
          detail: `${findings.length} finding(s)`,
        });
        log(
          `\n✗ ${s.label} failed (${findings.length} finding(s)). Say it without the name, or allow the path in scrub.allow with the reason in the decisions file. The gate stops here.`,
        );
        return false;
      }
      events.push({ label: s.label, outcome: "ok", ms: Date.now() - t0 });
      return true;
    }
    if (s.builtin === "audit") {
      log(`\n▶ ${s.label}`);
      const t0 = Date.now();
      const cfg = readConfig(repoDir);
      const a = auditOutcome(repoDir, o.audit || spawnAudit(repoDir), {
        allow: cfg?.security?.audit?.allow || [],
        level: cfg?.security?.audit?.level,
      });
      // An advisory the repository allows, and an allowance whose date has run out, are said out
      // loud on a green step: a decision nobody is reminded of is a decision nobody revisits.
      if (a.outcome === "ok" && a.detail) log(`  ${a.detail}`);
      if (a.outcome === "failed") {
        log(a.detail);
        events.push({ label: s.label, outcome: "failed", ms: Date.now() - t0 });
        log(`\n✗ ${s.label} failed. The gate stops here.`);
        return false;
      }
      // No lockfile is no instrument: the same verdict as a linter that is not installed, and
      // for the same reason. A step that cannot run is never a step that passed.
      if (a.outcome === "errored") {
        events.push({ label: s.label, outcome: "errored", ms: Date.now() - t0, detail: a.detail });
        log(
          `\n✗ ${s.label} could not run: ${a.detail}. The gate stops here, and this is the instrument, not the work.`,
        );
        return false;
      }
      if (a.outcome === "deferred") log(`\n· DEFERRED to CI: ${s.label}\n  reason: ${a.detail}.`);
      events.push({
        label: s.label,
        outcome: a.outcome,
        ms: Date.now() - t0,
        detail: a.detail || undefined,
      });
      return true;
    }
    // A step the preset requires is the instrument itself: without its script or its config the
    // gate cannot run, and says so, rather than passing with the step skipped. A repository
    // whose every step was skipped for want of a script read "gate green" and exited 0; the
    // reviewer who found it called it the other half of the false green, and it was.
    const absent = (/** @type {string} */ what) => {
      if (!s.required) return false;
      events.push({
        label: prefix + s.label,
        outcome: "errored",
        detail: `${what}: a step the ${presetId} preset requires`,
      });
      log(
        `\n✗ ${prefix}${s.label} could not run: ${what}, and the ${presetId} preset requires this step. Write the script (init writes the preset's), or the gate cannot run. This is the instrument, not the work.`,
      );
      return true;
    };
    if (s.requires && !s.requires.some((f) => existsSync(join(cwd, f)))) {
      if (absent(`no ${s.requires[0]}`)) return false;
      events.push({ label: prefix + s.label, outcome: "skipped", detail: `no ${s.requires[0]}` });
      log(
        `· skipped ${prefix}${s.label}: no ${s.requires[0]} in ${prefix ? "the workspace" : "the repository"}`,
      );
      return true;
    }
    if (s.command) {
      log(`\n▶ ${prefix}${s.label}`);
      const t0 = Date.now();
      const res = asResult(runCommand(cwd, s.command));
      const ms = Date.now() - t0;
      if (res.errored) {
        events.push({ label: prefix + s.label, outcome: "errored", ms, detail: res.detail });
        log(
          `\n✗ ${prefix}${s.label} could not run: ${s.command.join(" ")} · ${res.detail}. The gate stops here, and this is the instrument, not the work.`,
        );
        return false;
      }
      if (res.code !== 0) {
        events.push({ label: prefix + s.label, outcome: "failed", ms });
        log(`\n✗ ${prefix}${s.label} failed (exit ${res.code}). The gate stops here.`);
        return false;
      }
      events.push({ label: prefix + s.label, outcome: "ok", ms });
      return true;
    }
    if (s.rangeArg && prefix) return true; // the ratchet runs once, at the root
    const script = resolveScript(s);
    if (!script) {
      if (absent(`no "${s.script}" script`)) return false;
      events.push({
        label: prefix + s.label,
        outcome: "skipped",
        detail: `no "${s.script}" script`,
      });
      log(
        `· skipped ${prefix}${s.label}: ${prefix ? "the workspace's" : ""} package.json has no "${s.script}" script (the gap analysis names it)`,
      );
      return true;
    }
    log(`\n▶ ${prefix}${s.label}`);
    const t0 = Date.now();
    const res = asResult(run(cwd, script, s.rangeArg ? ["--range", range] : [], suiteEnv));
    const ms = Date.now() - t0;
    if (res.errored) {
      events.push({ label: prefix + s.label, outcome: "errored", ms, detail: res.detail });
      log(
        `\n✗ ${prefix}${s.label} could not run: npm run ${script} · ${res.detail}. The gate stops here, and this is the instrument, not the work.`,
      );
      return false;
    }
    if (res.code !== 0) {
      events.push({ label: prefix + s.label, outcome: "failed", ms });
      log(`\n✗ ${prefix}${s.label} failed (exit ${res.code}). The gate stops here.`);
      return false;
    }
    events.push({ label: prefix + s.label, outcome: "ok", ms });
    return true;
  };

  // Which inputs changed is half the question; which workspaces can observe them is the other,
  // and a path filter cannot answer it. Without this a change under a shared package left the
  // application that imports it ungated, and said nothing.
  const affected = affectedWorkspaces(repoDir, o.workspaces || [], selection);
  if (affected.everything) log(`\n· every workspace is selected: ${affected.everything}`);

  /** The suites of a preset, path-aware under a folder. @param {import("../presets/index.mjs").Preset} p @param {string} under */
  const suites = (p, under) => {
    for (const suite of p.gate.suites) {
      const name = prefix + suite.name;
      const byPath = selection.some(
        (f) => f.startsWith(under) && suite.paths.test(f.slice(under.length)),
      );
      const ws = under.replace(/\/$/, "");
      const byGraph = Boolean(ws) && !byPath && affected.selected.has(ws);
      if (byGraph)
        log(
          `\n· ${name}: selected by the workspace graph${affected.viaGraph.get(ws) ? ` · ${affected.viaGraph.get(ws)} changed and ${ws} depends on it` : ""}`,
        );
      const hit = byPath || byGraph;
      if (!hit) {
        events.push({
          label: name,
          outcome: "skipped",
          detail: "no matching path in the push or the tree",
        });
        log(`\n· skipped ${name}: nothing under its paths in the push or the tree`);
        continue;
      }
      if (suite.docker && !dockerUp()) {
        events.push({
          label: name,
          outcome: "deferred",
          detail: "the Docker daemon is not running",
        });
        log(`\n· DEFERRED to CI: ${name}\n  reason: the Docker daemon is not running.`);
        continue;
      }
      // A suite that needs a database gets one the run owns, or waits for CI: never the one the
      // developer works against.
      const db = suite.docker
        ? suiteDatabase([repoDir, join(repoDir, under)], { ci: o.ci === true, db: o.db })
        : { ok: /** @type {const} */ (true), env: {} };
      if (!db.ok) {
        events.push({ label: name, outcome: "deferred", detail: `not hermetic: ${db.reason}` });
        log(`\n· DEFERRED to CI: ${name}\n  reason: ${db.reason}.`);
        continue;
      }
      suiteEnv = db.env;
      for (const s of suite.steps)
        if (!step({ ...s, label: `${s.label} · ${suite.name}` })) return false;
      suiteEnv = {};
    }
    return true;
  };

  const gated = (o.workspaces || []).filter((w) => w.preset);
  // The verdict, with the instrument's own state beside it: a step that could not run is not a
  // step that found something, and a caller that exits on the difference needs to see it.
  const done = (/** @type {boolean} */ ok) => ({
    ok,
    events,
    range,
    blind,
    errored: events.some((e) => e.outcome === "errored"),
  });

  for (const s of preset.gate.always) if (!step(s)) return done(false);
  for (const w of gated) {
    const p = /** @type {import("../presets/index.mjs").Preset} */ (w.preset);
    cwd = join(repoDir, w.path);
    prefix = `${w.path} · `;
    pkgScripts = readPackage(cwd).scripts || {};
    presetId = p.id;
    log(`\n· workspace ${w.path} (${p.id})`);
    for (const s of p.gate.always) if (!step(s)) return done(false);
  }
  cwd = repoDir;
  prefix = "";
  pkgScripts = rootScripts;
  presetId = preset.id;

  if (o.fast) {
    log("\n--fast: skipped the conditional suites. CI still runs them.");
    for (const suite of preset.gate.suites)
      events.push({ label: suite.name, outcome: "skipped", detail: "--fast" });
    for (const w of gated)
      for (const suite of /** @type {any} */ (w.preset).gate.suites)
        events.push({ label: `${w.path} · ${suite.name}`, outcome: "skipped", detail: "--fast" });
    return done(true);
  }

  if (!suites(preset, "")) return done(false);
  for (const w of gated) {
    cwd = join(repoDir, w.path);
    prefix = `${w.path} · `;
    pkgScripts = readPackage(cwd).scripts || {};
    presetId = /** @type {any} */ (w.preset).id;
    if (!suites(/** @type {any} */ (w.preset), `${w.path}/`)) return done(false);
  }
  return done(true);
}

/**
 * The always-on scripts the preset expects that package.json does not have (for doctor).
 * @param {string} repoDir @param {import("../presets/index.mjs").Preset} preset
 */
export function missingGateScripts(repoDir, preset) {
  return preset.gate.always
    .map((s) => s.script)
    .filter((s) => typeof s === "string" && !hasScript(repoDir, s));
}
