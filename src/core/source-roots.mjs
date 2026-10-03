/**
 * The folders a repository's sources live in, for the tools `init` points at them. The import
 * graph was given `src` alone where a `src/` existed, and knip a fixed `src/ server/ lib/`, so a
 * Next App Router app with its code in `app/` had both steps judge one module and read green: an
 * orphan file with an unused export under `app/` passed them. The roots are now the source
 * folders that exist, framework conventions included.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";

/** Source folders by convention, a single package's then a monorepo's. */
const SINGLE = ["src", "app", "pages", "components", "lib", "server", "hooks", "utils"];
const MONO = ["apps", "packages", "services"];

/**
 * The source roots that exist here, and whether they are a monorepo's workspace folders.
 * @param {string} repoDir @returns {{ roots: string[], mono: boolean }}
 */
export function sourceRoots(repoDir) {
  const mono = MONO.filter((d) => existsSync(join(repoDir, d)));
  const single = SINGLE.filter((d) => existsSync(join(repoDir, d)));
  return { roots: [...single, ...mono], mono: mono.length > 0 };
}

/** The roots as `depcruise` takes them, "." where none exists. @param {string} repoDir */
export function graphRoots(repoDir) {
  return sourceRoots(repoDir).roots.join(" ") || ".";
}

/**
 * knip's `project` list over the roots of a single package, written into the template in place
 * of its default. A monorepo keeps the default, since knip reads each workspace on its own.
 * @param {string} repoDir @param {string} template the knip.jsonc text @returns {string}
 */
export function knipForRoots(repoDir, template) {
  const { roots, mono } = sourceRoots(repoDir);
  if (mono || !roots.length) return template;
  const list = roots.map((r) => `    "${r}/**/*.{js,jsx,mjs,cjs,ts,tsx}"`).join(",\n");
  return template.replace(/"project": \[[^\]]*\]/, `"project": [\n${list}\n  ]`);
}
