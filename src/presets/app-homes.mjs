/**
 * Where a preset's app lives, when it is not the root. A preset's suites are selected by paths
 * read from the root (`app/`, `e2e/`); a monorepo whose Next app is `apps/web`, a workspace with
 * no preset of its own, matched none of them, and its browser suite never ran. The folder that
 * holds the preset's app marker (`next.config.*`) is the app's home, and the suites' paths are
 * read under it as well.
 */
import { posix } from "node:path";

/**
 * The folders below the root holding the preset's app marker, less the workspaces that have a
 * preset of their own (their suites already run under them).
 * @param {import("./index.mjs").Preset | null} preset @param {string[]} files tracked paths
 * @param {string[]} [gated] the paths of workspaces with a preset
 * @returns {string[]} each with a trailing slash
 */
export function appHomes(preset, files, gated = []) {
  const marker = preset?.appMarker;
  if (!marker) return [];
  const homes = files
    .filter((f) => marker.test(f) && f.includes("/"))
    .map((f) => `${posix.dirname(f)}/`)
    .filter((h) => !gated.some((g) => h === `${g.replace(/\/$/, "")}/`));
  return [...new Set(homes)];
}

/**
 * Whether a suite's paths match a file, read from the root or from any of the app's homes.
 * @param {RegExp} paths @param {string} file @param {string[]} homes
 */
export function suiteReads(paths, file, homes) {
  if (paths.test(file)) return true;
  return homes.some((h) => file.startsWith(h) && paths.test(file.slice(h.length)));
}
