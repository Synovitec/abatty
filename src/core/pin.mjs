/**
 * How a repository pins this package, read for the one shape that silently stops an upgrade: a
 * range on a prerelease. `^0.7.0-rc.12` matches the later candidates of 0.7.0 and the releases
 * below 0.8.0, never `0.8.0-rc.1`, so a package manager kept an adopter on the old candidate
 * while `abatty update` moved the harness, and the two disagreed until the pin was edited by hand.
 */
import { readJsonFile } from "./repo.mjs";

/**
 * The range a repository gives this package when it is a range on a prerelease, or "": an exact
 * pin, a range on a release and no pin at all are each what they say.
 * @param {string} repoDir @returns {string}
 */
export function prereleaseRange(repoDir) {
  const pkg = readJsonFile(repoDir, "package.json") || {};
  const spec = String(pkg.devDependencies?.abatty || pkg.dependencies?.abatty || "");
  return /^[\^~]\d+\.\d+\.\d+-/.test(spec) ? spec : "";
}
