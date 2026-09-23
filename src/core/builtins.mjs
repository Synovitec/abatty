/**
 * The gate's built-in steps, the ones this package runs itself rather than a repository script:
 * the secret scan, the opt-in scrub and the dependency audit. Each pushes its event and says why
 * on the log; a step returns whether the gate goes on. Split from the gate so the gate is the
 * order of the steps and the suites' selection, and these are what three of the steps do.
 */
import { spawnSync } from "node:child_process";
import { launch } from "./spawn.mjs";
import { readConfig } from "./repo.mjs";
import { scanSecrets } from "./secrets.mjs";
import { auditOutcome } from "./audit.mjs";
import { scanFiles, scrubConfig } from "./scrub.mjs";

/** The audit as spawned in a repository: the package manager's command, its output in one string. @param {string} repoDir @returns {import("./gate.mjs").AuditRunner} */
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
 * Run one built-in step. True when the gate goes on (passed, skipped or deferred), false when it
 * stops here.
 * @param {import("../presets/index.mjs").GateStep} s
 * @param {{ repoDir: string, log: (line: string) => void, events: import("./gate.mjs").GateEvent[], audit?: import("./gate.mjs").AuditRunner }} ctx
 */
export function builtinStep(s, ctx) {
  const { repoDir, log, events } = ctx;
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
    const a = auditOutcome(repoDir, ctx.audit || spawnAudit(repoDir), {
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
  return true;
}
