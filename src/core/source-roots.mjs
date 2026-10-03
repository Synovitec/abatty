/**
 * The folders a repository's sources live in, for the tools `init` points at them. The import
 * graph was given `src` alone where a `src/` existed, and knip a fixed `src/ server/ lib/`, so a
 * Next App Router app with its code in `app/` had both steps judge one module and read green: an
 * orphan file with an unused export under `app/` passed them. The roots are now the source
 * folders that exist, framework conventions included.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readJsonFile } from "./repo.mjs";

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
  // The configs a flat config loads by name: knip does not follow FlatCompat's strings.
  const compat = compatConfigs(repoDir);
  const named = compat.length
    ? template.replace(
        /"ignoreDependencies": \[\]/,
        `"ignoreDependencies": [${compat.map((d) => `"${d}"`).join(", ")}]`,
      )
    : template;
  const { roots, mono } = sourceRoots(repoDir);
  if (mono || !roots.length) return named;
  // A framework's own files are sources too: a component imported only from `.astro` pages read
  // as unused while the pages that import it were never in the project.
  const pkg = readJsonFile(repoDir, "package.json") || {};
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const exts = [
    "js",
    "jsx",
    "mjs",
    "cjs",
    "ts",
    "tsx",
    ...["astro", "vue", "svelte"].filter((f) => f in deps),
  ];
  const list = roots.map((r) => `    "${r}/**/*.{${exts.join(",")}}"`).join(",\n");
  return named.replace(/"project": \[[^\]]*\]/, `"project": [\n${list}\n  ]`);
}

/**
 * The dependency-cruiser config for this repository: the template, less its `tsConfig` where the
 * root has no tsconfig.json. A monorepo root keeps its tsconfigs in the workspaces, and depcruise
 * refused to start (TS5083: cannot read file 'tsconfig.json').
 * @param {string} repoDir @param {string} template @returns {string}
 */
export function depcruiseFor(repoDir, template) {
  if (existsSync(join(repoDir, "tsconfig.json"))) return template;
  return template.replace(
    /^(\s*)tsConfig: \{ fileName: "tsconfig\.json" \},$/m,
    '$1// No tsconfig.json at the root: point this at one to resolve its paths aliases.\n$1// tsConfig: { fileName: "tsconfig.json" },',
  );
}

/**
 * The eslint configs a flat config loads by name through FlatCompat (`compat.extends("next/
 * core-web-vitals")`), as the packages that ship them. knip reads a flat config's imports, not
 * these strings, and called `eslint-config-next` unused in create-next-app's own setup.
 * @param {string} repoDir @returns {string[]} the installed packages named that way
 */
export function compatConfigs(repoDir) {
  const file = ["eslint.config.mjs", "eslint.config.js", "eslint.config.cjs", "eslint.config.ts"]
    .map((f) => join(repoDir, f))
    .find((f) => existsSync(f));
  if (!file) return [];
  const text = readFileSync(file, "utf8");
  const names = [...text.matchAll(/extends\(([^)]*)\)/g)].flatMap((m) =>
    [...String(m[1]).matchAll(/["']([^"']+)["']/g)].map((n) => String(n[1])),
  );
  /** The package a FlatCompat name loads. @param {string} n */
  const packageOf = (n) => {
    const head = String(n.replace(/^plugin:/, "").split("/")[0]);
    if (n.startsWith("plugin:")) return `eslint-plugin-${head}`;
    return head.startsWith("eslint-config-") || head.startsWith("@")
      ? head
      : `eslint-config-${head}`;
  };
  const pkg = readJsonFile(repoDir, "package.json") || {};
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  return [...new Set(names.map(packageOf))].filter((d) => d in deps);
}
