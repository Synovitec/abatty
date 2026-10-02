/**
 * Packages that only work at one shared version, installed at different ones. A lockfile refresh
 * moved an adopter's @playwright/test to 1.63 while an override held playwright-core at 1.60,
 * and every browser worker died before running a test ("filteredStackTrace is not a function").
 * The gate did not notice: no audit reads version skew. This reads what is installed, and names
 * a family whose members disagree.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Families whose members are released together and expect each other's exact version. */
const FAMILIES = [
  ["playwright", "playwright-core", "@playwright/test"],
  ["prisma", "@prisma/client"],
  ["react", "react-dom"],
  ["vitest", "@vitest/coverage-v8", "@vitest/coverage-istanbul", "@vitest/ui", "@vitest/browser"],
];

/** The version installed at the root's node_modules, or "". @param {string} repoDir @param {string} name */
function installed(repoDir, name) {
  try {
    return String(
      JSON.parse(readFileSync(join(repoDir, "node_modules", name, "package.json"), "utf8"))
        .version || "",
    );
  } catch {
    return "";
  }
}

/**
 * The families installed at more than one version, each with what is installed.
 * @param {string} repoDir @returns {{ family: string, versions: string }[]}
 */
export function splitPairs(repoDir) {
  /** @type {{ family: string, versions: string }[]} */
  const out = [];
  for (const family of FAMILIES) {
    const found = family.map((n) => [n, installed(repoDir, n)]).filter(([, v]) => v);
    if (new Set(found.map(([, v]) => v)).size > 1)
      out.push({
        family: family[0] || "",
        versions: found.map(([n, v]) => `${n} ${v}`).join(", "),
      });
  }
  return out;
}
