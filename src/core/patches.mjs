/**
 * A repository's own patch of abatty, found and dated against the version it runs. An adopter
 * patched 0.4.0 in node_modules (a bun `patchedDependencies` entry and a file under patches/) to
 * get past a defect 0.5.0 fixed; on the upgrade the patch either fails to apply or, worse,
 * applies to code it was never written for. `doctor` and `update` name one that no longer
 * matches the version running.
 */
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { readPackage } from "./repo.mjs";

/** A patch key or file name that patches abatty, and the version it was written against. */
const PATCHED = /^abatty[@+](\d+\.\d+\.\d+[\w.-]*?)(?:\.patch)?$/;

/**
 * The patches of abatty this repository carries for a version other than `version`, each with
 * where it is declared. Read from `patchedDependencies` (bun, npm), `pnpm.patchedDependencies`,
 * and the files a patch tool leaves under `patches/`.
 * @param {string} repoDir @param {string} version the abatty version running
 * @returns {{ where: string, patched: string }[]}
 */
export function stalePatches(repoDir, version) {
  const pkg =
    /** @type {{ patchedDependencies?: object, pnpm?: { patchedDependencies?: object } }} */ (
      readPackage(repoDir)
    );
  /** @type {{ where: string, patched: string }[]} */
  const found = [];
  const declared = { ...(pkg.patchedDependencies || {}), ...(pkg.pnpm?.patchedDependencies || {}) };
  for (const key of Object.keys(declared)) {
    const m = PATCHED.exec(key);
    if (m)
      found.push({ where: `package.json patchedDependencies "${key}"`, patched: String(m[1]) });
  }
  const dir = join(repoDir, "patches");
  if (existsSync(dir))
    for (const name of readdirSync(dir)) {
      const m = PATCHED.exec(name);
      if (m) found.push({ where: `patches/${name}`, patched: String(m[1]) });
    }
  return found.filter((p) => p.patched !== version);
}
