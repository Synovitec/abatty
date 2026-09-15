/**
 * The sandbox drivers as pure functions over a plan: each returns the argv that runs a command
 * inside the boundary, and nothing here executes. bubblewrap on Linux (user namespaces, no
 * daemon, no root), sandbox-exec on macOS (a Seatbelt profile written for the night), and a
 * container image through docker or podman wherever one runs. sandbox.mjs proves that the argv
 * holds, with a probe, before a session runs inside it.
 *
 * The boundary is the same for every driver: the working tree writable; the harness folder,
 * the root config and the protected paths read-only at the OS level; the rest of the machine
 * read-only except the temp folder (a machine keeps tools there: a signing helper, a socket),
 * the hooks' log folder under the harness and the agent's own state in the home. The network is not cut: the model is on it. Pushes, deploys
 * and publishing stay the guard's to refuse.
 */
import { realpathSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";

/**
 * @typedef {{
 *   repoDir: string,
 *   logDir: string,
 *   readOnly: string[],
 *   writable: string[],
 *   env: string[],
 *   command: string,
 *   image: string,
 *   profile: string,
 *   home: string,
 * }} Plan absolute, existing paths; `logDir` the hooks' log folder under the harness; `env` the variable names a container passes through;
 * `profile` where the Seatbelt profile is written; `home` the container's HOME.
 * @typedef {{
 *   driver: string,
 *   node: string,
 *   describe: string,
 *   wrap: (cmd: string, args: string[], env?: string[]) => { cmd: string, args: string[] },
 * }} Sandbox `node` is how the probe reaches a Node inside the boundary.
 */

/** @param {Plan} plan @returns {Sandbox} */
export function bwrapSandbox(plan) {
  const cmd = plan.command || "bwrap";
  const base = [
    "--ro-bind",
    "/",
    "/",
    "--dev",
    "/dev",
    "--proc",
    "/proc",
    "--bind",
    "/tmp",
    "/tmp",
    "--bind",
    plan.repoDir,
    plan.repoDir,
  ];
  // Order is meaning: a later bind mounts over an earlier one, so the read-only harness goes
  // over the writable tree and the writable log folder over the read-only harness. The temp
  // folder is the host's, writable: a private one hid a signing helper git kept there.
  for (const p of plan.readOnly) base.push("--ro-bind", p, p);
  for (const p of plan.writable) base.push("--bind", p, p);
  base.push("--chdir", plan.repoDir, "--die-with-parent", "--new-session");
  return {
    driver: "bwrap",
    node: process.execPath,
    describe: `bubblewrap (${cmd})`,
    wrap: (c, args) => ({ cmd, args: [...base, "--", c, ...args] }),
  };
}

/** @param {string} p the path and its real path, since macOS keeps /tmp and /var behind symlinks. */
function both(p) {
  try {
    const r = realpathSync(p);
    return r === p ? [p] : [p, r];
  } catch {
    return [p];
  }
}
/** @param {string} s */
const quote = (s) => `"${s.replace(/["\\]/g, "\\$&")}"`;
/** @param {string[]} paths */
const subpaths = (paths) =>
  paths
    .flatMap(both)
    .map((p) => `(subpath ${quote(p)})`)
    .join(" ");

/** The Seatbelt profile: the last matching rule wins, so the order below is the boundary. @param {Plan} plan */
export function seatbeltProfile(plan) {
  const temp = ["/tmp", "/private/tmp", "/var/folders", "/private/var/folders"];
  return [
    "(version 1)",
    "(allow default)",
    "(deny file-write*)",
    `(allow file-write* (literal "/dev/null") (regex #"^/dev/tty") (regex #"^/dev/fd/"))`,
    `(allow file-write* ${subpaths([...temp, plan.repoDir])})`,
    plan.readOnly.length ? `(deny file-write* ${subpaths(plan.readOnly)})` : ";; nothing read-only",
    plan.writable.length
      ? `(allow file-write* ${subpaths(plan.writable)})`
      : ";; nothing else writable",
    "",
  ].join("\n");
}

/** @param {Plan} plan @returns {Sandbox} */
export function seatbeltSandbox(plan) {
  const cmd = plan.command || "sandbox-exec";
  writeFileSync(plan.profile, seatbeltProfile(plan));
  return {
    driver: "sandbox-exec",
    node: process.execPath,
    describe: `sandbox-exec (${plan.profile})`,
    wrap: (c, args) => ({ cmd, args: ["-f", plan.profile, c, ...args] }),
  };
}

/**
 * A container: the tree and the agent's state mounted, the harness mounted read-only over it,
 * the night's variables passed by name. The image carries the agent and a Node; `sandbox.image`
 * names it, `sandbox.command` the engine (docker by default, podman works the same).
 * @param {Plan} plan @returns {Sandbox}
 */
export function containerSandbox(plan) {
  if (!plan.image) throw new Error("the container driver needs sandbox.image");
  const engine = plan.command || "docker";
  const home = plan.home || "/root";
  const hostHome = homedir();
  /** @param {string} p the same path inside, except the home, which is the container's. */
  const inside = (p) => (p.startsWith(hostHome) ? home + p.slice(hostHome.length) : p);
  const base = ["run", "--rm", "-i", "-v", `${plan.repoDir}:${plan.repoDir}`];
  for (const p of plan.readOnly) base.push("-v", `${p}:${inside(p)}:ro`);
  for (const p of plan.writable) base.push("-v", `${p}:${inside(p)}`);
  base.push("-w", plan.repoDir, "-e", `HOME=${home}`);
  return {
    driver: "container",
    node: "node",
    describe: `${engine} image ${plan.image}`,
    wrap: (c, args, env = []) => ({
      cmd: engine,
      args: [
        ...base,
        ...[...new Set([...plan.env, ...env])].flatMap((n) => ["-e", n]),
        plan.image,
        c,
        ...args,
      ],
    }),
  };
}

/** @param {string} driver @param {Plan} plan @returns {Sandbox} */
export function buildSandbox(driver, plan) {
  if (driver === "bwrap") return bwrapSandbox(plan);
  if (driver === "sandbox-exec") return seatbeltSandbox(plan);
  if (driver === "container") return containerSandbox(plan);
  throw new Error(`unknown sandbox driver "${driver}" (bwrap, sandbox-exec, container)`);
}
