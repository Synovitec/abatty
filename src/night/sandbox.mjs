/**
 * The sandbox under the guard. The guard is a text match on commands; the sandbox is the layer
 * below it: an OS boundary that holds whatever a command was called, in whatever shell, through
 * whatever script. Before the first session the runner builds it from the config, then PROVES
 * it with a probe (a Node inside the boundary tries the tree, the hooks' log folder, the
 * harness, the root config, the protected paths and its own runtime folder) - a sandbox that is
 * present but does not hold refuses the night, because a night that claims a boundary it lacks
 * is worse than one that says it has none.
 *
 * `sandbox.mode`: `auto` (a driver found on the machine, else the guard alone, said loudly),
 * `required` (no driver, no night), `off`. `sandbox.driver` names one instead of detecting it;
 * `sandbox.command` its executable; `sandbox.image` a container image (which selects the
 * container driver); `sandbox.readOnly` and `sandbox.writable` extend the boundary; `sandbox.env`
 * names the variables a container passes through.
 */
import { existsSync, mkdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { buildSandbox } from "./sandbox-drivers.mjs";

/** @typedef {import("./sandbox-drivers.mjs").Sandbox} Sandbox */
/** @typedef {import("./sandbox-drivers.mjs").Plan} Plan */
/**
 * @typedef {{ mode: "auto" | "required" | "off", driver: string, command: string, image: string, readOnly: string[], writable: string[], env: string[], home: string }} SandboxConfig
 * @typedef {{ driver: string, sandbox: Sandbox | null, note: string, refuse: string }} Prepared
 */

export const MODES = ["auto", "required", "off"];
export const DRIVERS = ["bwrap", "sandbox-exec", "container"];

/** @param {unknown} v @returns {string[]} */
const strings = (v) => (Array.isArray(v) ? v.map(String).filter(Boolean) : []);

/**
 * The config's `sandbox` block, normalised; a mode given on the command line wins.
 * @param {any} config @param {string} [override]
 * @returns {SandboxConfig}
 */
export function sandboxConfig(config, override = "") {
  const s = config?.sandbox && typeof config.sandbox === "object" ? config.sandbox : {};
  const mode = String(override || s.mode || "auto");
  if (!MODES.includes(mode))
    throw new Error(`sandbox.mode is one of ${MODES.join(", ")}, not "${mode}"`);
  const driver = String(s.driver || (s.image ? "container" : ""));
  if (driver && !DRIVERS.includes(driver))
    throw new Error(`sandbox.driver is one of ${DRIVERS.join(", ")}, not "${driver}"`);
  return {
    mode: /** @type {SandboxConfig["mode"]} */ (mode),
    driver,
    command: String(s.command || ""),
    image: String(s.image || ""),
    readOnly: strings(s.readOnly),
    writable: strings(s.writable),
    env: strings(s.env),
    home: String(s.home || "/root"),
  };
}

/** @param {string} bin true when the executable runs at all (ENOENT is the one failure that counts). */
export function found(bin) {
  const r = spawnSync(bin, ["--version"], { stdio: "ignore" });
  return !r.error;
}

/**
 * The driver for this machine: the configured one, else the image's container engine, else
 * bubblewrap on Linux, else sandbox-exec on macOS, else none.
 * @param {SandboxConfig} cfg @param {(bin: string) => boolean} [has]
 */
export function detectDriver(cfg, has = found) {
  if (cfg.driver) return cfg.driver;
  if (cfg.image) return has(cfg.command || "docker") || has("podman") ? "container" : "";
  if (process.platform === "linux" && has(cfg.command || "bwrap")) return "bwrap";
  if (process.platform === "darwin" && has(cfg.command || "sandbox-exec")) return "sandbox-exec";
  return "";
}

/**
 * The boundary as paths: what the harness needs read-only, what the hooks and the agent need
 * writable. Only paths that exist are bound; a protected prefix such as `.env.` is a rule for
 * the guard, not a mount.
 * @param {SandboxConfig} cfg
 * @param {{ repoDir: string, folder: string, protectedPaths: string[], nightDir: string }} c
 * @returns {Plan}
 */
export function sandboxPlan(cfg, c) {
  const repoDir = resolve(c.repoDir);
  const harness = join(repoDir, c.folder);
  const ro = [
    harness,
    join(repoDir, "abatty.config.json"),
    ...c.protectedPaths.map((p) => resolve(repoDir, p)),
    ...cfg.readOnly.map((p) => resolve(repoDir, p)),
  ];
  const home = homedir();
  // The hooks' log folder (denials, receipts, counters) is under the harness; it stays writable.
  const logDir = join(harness, "night");
  mkdirSync(logDir, { recursive: true });
  const rw = [
    logDir,
    join(home, c.folder),
    join(home, `${c.folder}.json`),
    ...cfg.writable.map((p) => resolve(repoDir, p)),
  ];
  return {
    repoDir,
    logDir,
    readOnly: [...new Set(ro)].filter((p) => existsSync(p) && p !== repoDir),
    writable: [...new Set(rw)].filter((p) => existsSync(p) && !ro.includes(p)),
    env: cfg.env,
    command: cfg.command,
    image: cfg.image,
    profile: join(resolve(c.nightDir), "sandbox.sb"),
    home: cfg.home,
  };
}

// What runs inside: every write the boundary must allow or refuse, reported as one JSON line.
// A probe file is written and removed; a read-only file is opened for append and closed, which
// changes nothing when it succeeds and proves the hole when it does.
const PROBE = `
const fs = require("node:fs"), path = require("node:path");
const [repo, night, ...ro] = process.argv.slice(1);
const name = ".abatty-sandbox-probe";
const attempt = (p, append) => {
  try {
    if (append) fs.closeSync(fs.openSync(p, "a"));
    else { fs.writeFileSync(p, "probe"); fs.unlinkSync(p); }
    return "ok";
  } catch (e) { return "denied:" + (e.code || e.message); }
};
const out = {
  tree: attempt(path.join(repo, name)),
  night: attempt(path.join(night, name)),
  outside: attempt(path.join(path.dirname(process.execPath), name)),
  readOnly: {},
};
for (const p of ro) out.readOnly[p] = fs.statSync(p).isDirectory() ? attempt(path.join(p, name)) : attempt(p, true);
process.stdout.write("ABATTY_PROBE " + JSON.stringify(out) + "\\n");
`;

/**
 * The verdict on a probe's line: what must be writable is, what must not is not.
 * @param {any} r @param {string} runtimeDir
 * @returns {string[]} findings, empty when the boundary holds
 */
export function judgeProbe(r, runtimeDir) {
  /** @type {string[]} */
  const f = [];
  if (r.tree !== "ok") f.push(`the working tree is not writable inside the sandbox (${r.tree})`);
  if (r.night !== "ok")
    f.push(
      `the hooks' log folder under the harness is not writable inside the sandbox (${r.night}); the guard could not record a denial`,
    );
  if (r.outside === "ok")
    f.push(
      `the runtime folder ${runtimeDir} is writable inside the sandbox: the boundary does not hold`,
    );
  for (const [p, v] of Object.entries(r.readOnly || {}))
    if (v === "ok") f.push(`${p} is writable inside the sandbox: the boundary does not hold`);
  return f;
}

/**
 * Run the probe inside the sandbox. `unavailable` when the driver could not start at all.
 * @param {Sandbox} sb @param {Plan} plan
 * @returns {{ findings: string[], unavailable: string }}
 */
export function probeSandbox(sb, plan) {
  const w = sb.wrap(sb.node, ["-e", PROBE, plan.repoDir, plan.logDir, ...plan.readOnly]);
  const r = spawnSync(w.cmd, w.args, { cwd: plan.repoDir, encoding: "utf8", timeout: 120_000 });
  const line = String(r.stdout || "")
    .split(/\r?\n/)
    .find((l) => l.startsWith("ABATTY_PROBE "));
  if (!line) {
    const why = r.error
      ? r.error.message
      : String(r.stderr || "")
          .trim()
          .split(/\r?\n/)
          .slice(-3)
          .join(" | ") || `exit ${r.status}`;
    return { findings: [], unavailable: why };
  }
  const runtime = sb.driver === "container" ? "of the image's node" : dirname(process.execPath);
  return {
    findings: judgeProbe(JSON.parse(line.slice("ABATTY_PROBE ".length)), runtime),
    unavailable: "",
  };
}

/**
 * Build and prove the night's sandbox. Never throws for a refused night: `refuse` carries the
 * reason; `note` is the line the runner logs either way.
 * @param {any} config
 * @param {{ repoDir: string, folder: string, nightDir: string, mode?: string }} c
 * @returns {Prepared}
 */
export function prepareSandbox(config, c) {
  /** @type {SandboxConfig} */
  let cfg;
  try {
    cfg = sandboxConfig(config, c.mode || "");
  } catch (e) {
    return {
      driver: "none",
      sandbox: null,
      note: "",
      refuse: e instanceof Error ? e.message : String(e),
    };
  }
  const alone = "the guard is the only layer tonight";
  if (cfg.mode === "off")
    return {
      driver: "none",
      sandbox: null,
      note: `sandbox off (sandbox.mode): ${alone}`,
      refuse: "",
    };
  const driver = detectDriver(cfg);
  if (!driver) {
    const why = `no sandbox driver on this machine (bwrap on Linux, sandbox-exec on macOS, or a container image in sandbox.image)`;
    return cfg.mode === "required"
      ? { driver: "none", sandbox: null, note: "", refuse: `${why}; sandbox.mode is required` }
      : { driver: "none", sandbox: null, note: `${why}: ${alone}`, refuse: "" };
  }
  const plan = sandboxPlan(cfg, {
    repoDir: c.repoDir,
    folder: c.folder,
    protectedPaths: strings(config?.protectedPaths),
    nightDir: c.nightDir,
  });
  /** @type {Sandbox} */
  let sb;
  try {
    sb = buildSandbox(driver, plan);
  } catch (e) {
    return { driver, sandbox: null, note: "", refuse: e instanceof Error ? e.message : String(e) };
  }
  const p = probeSandbox(sb, plan);
  if (p.unavailable)
    return {
      driver,
      sandbox: null,
      note: "",
      refuse: `the sandbox (${sb.describe}) could not start: ${p.unavailable}`,
    };
  if (p.findings.length)
    return {
      driver,
      sandbox: null,
      note: "",
      refuse: `the sandbox (${sb.describe}) does not hold:\n${p.findings.map((f) => `- ${f}`).join("\n")}`,
    };
  const ro = plan.readOnly.length;
  const dirs = plan.readOnly.filter((x) => statSync(x).isDirectory()).length;
  return {
    driver,
    sandbox: sb,
    note: `sandbox ${sb.describe}: ${ro} path(s) read-only at the OS level (${dirs} folder(s), the harness and the root config among them), the rest of the machine read-only (the temp folder aside), the tree and the hooks' log writable; proven by a probe`,
    refuse: "",
  };
}
