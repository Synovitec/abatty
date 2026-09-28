/**
 * The installed abatty against the version the config pins. A branch that moved the pin (an
 * `update` merged from main) leaves `node_modules/abatty` where the last install put it; the
 * gate then judges the push with an older instrument than the repository adopted, and a check
 * the pin promised is quietly absent. An adopter found it after a week of reds nothing explained.
 * `doctor` compares the pin with the package too, but the gate is what runs on every push.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readAdoption, readJsonFile } from "./repo.mjs";
import { managerFor } from "./package-manager.mjs";

/**
 * The version of the package this module belongs to. Read here rather than from update.mjs,
 * which reaches the gate through doctor and would close a cycle.
 */
export function runningVersion() {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  return String(readJsonFile(root, "package.json")?.version || "0.0.0");
}

/**
 * Negative when version `a` is older than `b`, by SemVer precedence: a pre-release sorts before
 * its release, and its identifiers compare numerically where both are numbers.
 * @param {string} a @param {string} b @returns {number}
 */
export function compareVersions(a, b) {
  const split = (/** @type {string} */ v) => {
    const m = /^v?([^-+]*)(?:-([^+]*))?/.exec(v);
    const core = (m?.[1] || "").split(".").map((n) => Number(n) || 0);
    return { core, pre: m?.[2] ? m[2].split(".") : [] };
  };
  const x = split(a);
  const y = split(b);
  for (let i = 0; i < 3; i++)
    if (x.core[i] !== y.core[i]) return (x.core[i] || 0) - (y.core[i] || 0);
  if (!x.pre.length || !y.pre.length) return y.pre.length - x.pre.length;
  for (let i = 0; i < Math.max(x.pre.length, y.pre.length); i++) {
    const [p, q] = [x.pre[i], y.pre[i]];
    if (p === q) continue;
    if (p === undefined || q === undefined) return p === undefined ? -1 : 1;
    const [np, nq] = [/^\d+$/.test(p), /^\d+$/.test(q)];
    if (np && nq) return Number(p) - Number(q);
    if (np !== nq) return np ? -1 : 1;
    return p < q ? -1 : 1;
  }
  return 0;
}

/**
 * The gate's line when an abatty older than the pin is what runs or what is installed, or "".
 * The copy in node_modules is read when there is one, since the hooks run that copy; the running
 * package is read as well, for a gate started from elsewhere. A line and never a refusal.
 * @param {string} repoDir @param {string} running the version of the package running now
 */
export function pinBehindLine(repoDir, running) {
  const pin = readAdoption(repoDir)?.abatty;
  if (typeof pin !== "string" || !pin) return "";
  let installed = "";
  try {
    installed = String(
      readJsonFile(join(repoDir, "node_modules", "abatty"), "package.json")?.version || "",
    );
  } catch {
    // no installed copy (or an unreadable one): the running package is the one to judge
  }
  const behind = [
    installed && compareVersions(installed, pin) < 0 ? `node_modules/abatty is ${installed}` : "",
    running !== installed && compareVersions(running, pin) < 0
      ? `the abatty running is ${running}`
      : "",
  ].filter(Boolean);
  return behind.length
    ? `! ${behind.join(" and ")}, older than the ${pin} abatty.config.json pins: this push is judged by the older instrument, and what ${pin} checks is not checked. Reinstall (${managerFor(repoDir).id} install)`
    : "";
}
