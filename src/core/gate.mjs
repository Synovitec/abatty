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
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { git, hasScript, readPackage } from "./repo.mjs";

/**
 * @typedef {{ label: string, outcome: "ok" | "failed" | "skipped" | "deferred", detail?: string, ms?: number }} GateEvent
 * @typedef {{ repoDir: string, preset: import("../presets/index.mjs").Preset, fast?: boolean, range?: string, base?: string, run?: typeof runScript, dockerUp?: () => boolean, log?: (line: string) => void }} GateOptions
 */

/**
 * Run an npm script and return its exit code; output goes straight to the terminal.
 * @param {string} repoDir @param {string} script @param {string[]} [extraArgs]
 */
export function runScript(repoDir, script, extraArgs = []) {
  const r = spawnSync(
    "npm",
    ["run", "-s", script, ...(extraArgs.length ? ["--", ...extraArgs] : [])],
    { cwd: repoDir, stdio: "inherit", shell: true },
  );
  return r.status ?? 1;
}

/** Run a command as given; output goes straight to the terminal. @param {string} repoDir @param {string[]} argv */
export function runCommand(repoDir, argv) {
  const [cmd, ...args] = argv;
  const r = spawnSync(String(cmd), args, { cwd: repoDir, stdio: "inherit", shell: true });
  return r.status ?? 1;
}

function dockerRunning() {
  return spawnSync("docker", ["info"], { stdio: "ignore", shell: true }).status === 0;
}

/**
 * What the push contains. `@{u}..HEAD` while the upstream is still an ancestor of HEAD; after
 * a rebase or an amend it is not, and the diff would show the amend delta rather than the
 * push (which is how a push carrying twenty UI files once skipped the browser suite), so the
 * whole branch is judged instead; with no upstream, the fork point from the base; failing
 * that, the last commit.
 */
/** @param {string} repoDir @param {string} [base] @param {string} [explicit] */
export function pushRange(repoDir, base = "main", explicit = "") {
  if (explicit) return explicit;
  const upstream = git(repoDir, "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}");
  const linear =
    upstream &&
    spawnSync("git", ["merge-base", "--is-ancestor", "@{u}", "HEAD"], {
      cwd: repoDir,
      stdio: "ignore",
    }).status === 0;
  if (linear) return "@{u}..HEAD";
  const fork =
    git(repoDir, "merge-base", `origin/${base}`, "HEAD") ||
    git(repoDir, "merge-base", base, "HEAD");
  return fork ? `${fork}..HEAD` : "HEAD~1..HEAD";
}

/** Files whose content on disk differs from HEAD: staged, unstaged, untracked. @param {string} repoDir */
export function pendingPaths(repoDir) {
  const tracked = git(repoDir, "diff", "--name-only", "HEAD");
  const untracked = git(repoDir, "ls-files", "--others", "--exclude-standard");
  return `${tracked}\n${untracked}`.split("\n").filter(Boolean);
}

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
  const pkgScripts = readPackage(repoDir).scripts || {};

  const range = pushRange(repoDir, o.base, o.range);
  const changed = git(repoDir, "diff", "--name-only", range).split("\n").filter(Boolean);
  const pending = pendingPaths(repoDir);
  const selection = [...new Set([...changed, ...pending])];
  const touches = (/** @type {RegExp} */ re) => selection.some((p) => re.test(p));
  log(
    `Gate · range ${range} · ${changed.length} pushed file(s)${pending.length ? ` + ${pending.length} uncommitted, both select suites` : ""}`,
  );

  const resolveScript = (/** @type {import("../presets/index.mjs").GateStep} */ step) =>
    [step.script, ...(step.alternatives || [])].find(
      (s) => typeof s === "string" && typeof pkgScripts[s] === "string",
    ) || null;

  const step = (/** @type {import("../presets/index.mjs").GateStep} */ s) => {
    if (s.requires && !s.requires.some((f) => existsSync(join(repoDir, f)))) {
      events.push({ label: s.label, outcome: "skipped", detail: `no ${s.requires[0]}` });
      log(`· skipped ${s.label}: no ${s.requires[0]} in the repository`);
      return true;
    }
    if (s.command) {
      log(`\n▶ ${s.label}`);
      const t0 = Date.now();
      const code = runCommand(repoDir, s.command);
      const ms = Date.now() - t0;
      if (code !== 0) {
        events.push({ label: s.label, outcome: "failed", ms });
        log(`\n✗ ${s.label} failed (exit ${code}). The gate stops here.`);
        return false;
      }
      events.push({ label: s.label, outcome: "ok", ms });
      return true;
    }
    const script = resolveScript(s);
    if (!script) {
      events.push({ label: s.label, outcome: "skipped", detail: `no "${s.script}" script` });
      log(
        `· skipped ${s.label}: package.json has no "${s.script}" script (the gap analysis names it)`,
      );
      return true;
    }
    log(`\n▶ ${s.label}`);
    const t0 = Date.now();
    const code = run(repoDir, script, s.rangeArg ? ["--range", range] : []);
    const ms = Date.now() - t0;
    if (code !== 0) {
      events.push({ label: s.label, outcome: "failed", ms });
      log(`\n✗ ${s.label} failed (exit ${code}). The gate stops here.`);
      return false;
    }
    events.push({ label: s.label, outcome: "ok", ms });
    return true;
  };

  for (const s of preset.gate.always) if (!step(s)) return { ok: false, events, range };

  if (o.fast) {
    log("\n--fast: skipped the conditional suites. CI still runs them.");
    for (const suite of preset.gate.suites)
      events.push({ label: suite.name, outcome: "skipped", detail: "--fast" });
    return { ok: true, events, range };
  }

  for (const suite of preset.gate.suites) {
    if (!touches(suite.paths)) {
      events.push({
        label: suite.name,
        outcome: "skipped",
        detail: "no matching path in the push or the tree",
      });
      log(`\n· skipped ${suite.name}: nothing under its paths in the push or the tree`);
      continue;
    }
    if (suite.docker && !dockerUp()) {
      events.push({
        label: suite.name,
        outcome: "deferred",
        detail: "the Docker daemon is not running",
      });
      log(`\n· DEFERRED to CI: ${suite.name}\n  reason: the Docker daemon is not running.`);
      continue;
    }
    for (const s of suite.steps)
      if (!step({ ...s, label: `${s.label} · ${suite.name}` })) return { ok: false, events, range };
  }
  return { ok: true, events, range };
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
