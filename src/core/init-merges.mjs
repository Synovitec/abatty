/**
 * What `init` does to a file the repository already owns, and what it says it did. A file it
 * writes from a template is its own; a `package.json`, a `.gitignore` or a config it merges into
 * is the repository's, so each merge adds only what is missing and names it on its line:
 * "merged" alone sent a reader to `git diff` to find out what had been done to a file of theirs.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Append the lines a file lacks, keeping every line it has, and record what was added.
 * @param {string} repoDir @param {string} rel @param {string[]} lines
 * @param {import("./init.mjs").InitEvent[]} events @param {boolean} dryRun
 */
export function appendLines(repoDir, rel, lines, events, dryRun) {
  const target = join(repoDir, rel);
  const current = existsSync(target) ? readFileSync(target, "utf8") : "";
  const missing = lines.filter((l) => !current.split(/\r?\n/).includes(l));
  if (!missing.length) {
    events.push({ file: rel, action: "kept" });
    return;
  }
  if (!dryRun)
    writeFileSync(
      target,
      (current ? current.replace(/\s*$/, "\n") : "") + missing.join("\n") + "\n",
    );
  events.push({
    file: rel,
    action: current ? "merged" : "written",
    ...(current && { detail: `added ${missing.join(", ")}` }),
  });
}

/**
 * What `.gitignore` must hold: the night's folder and abatty's own, and in a JavaScript
 * repository its packages unless the file already names them in any form. An adopter with no
 * `.gitignore` followed init's steps, committed, and committed node_modules with it.
 * @param {string} repoDir @returns {string[]}
 */
export function ignoredHere(repoDir) {
  const lines = [".claude/night/", ".abatty/"];
  const current = existsSync(join(repoDir, ".gitignore"))
    ? readFileSync(join(repoDir, ".gitignore"), "utf8")
    : "";
  if (existsSync(join(repoDir, "package.json")) && !/node_modules/.test(current))
    lines.push("node_modules/");
  return lines;
}

/**
 * The keys a merge put in or changed, as a merged line says them. A key whose value it replaced
 * (under --force) counts; one the repository already had and kept does not.
 * @param {Record<string, unknown>} after @param {Record<string, unknown>} before @param {string} kind
 * @returns {string} "" when nothing changed
 */
export function added(after, before, kind) {
  const keys = Object.keys(after).filter(
    (k) => JSON.stringify(after[k]) !== JSON.stringify(before[k]),
  );
  return keys.length ? `${kind} added: ${keys.join(", ")}` : "";
}

/**
 * A folder's name as npm takes a package name: lower case, no spaces, nothing npm refuses. The
 * folder `My Go_Svc` was written as the name verbatim, and npm refused every command after.
 * @param {string} folder @returns {string}
 */
export function packageName(folder) {
  const name = folder
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[._-]+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 214);
  return name || "repository";
}

/** Where an eslint configuration lives, flat or legacy. */
const ESLINT_CONFIGS = ["js", "mjs", "cjs", "ts"]
  .map((e) => `eslint.config.${e}`)
  .concat([".eslintrc", ".eslintrc.json", ".eslintrc.js", ".eslintrc.cjs", ".eslintrc.yml"]);

/**
 * A preset's scripts less the ones the folder has nothing to run: an eslint `lint` with no
 * eslint installed and no configuration, and a `tsc` typecheck with neither a tsconfig nor
 * TypeScript. An Astro site was given `eslint .` and a plain JavaScript package `tsc --noEmit`,
 * and each gate step could not run; without the script it is skipped by name, and the gap
 * analysis says what is missing.
 * @param {string} dir the folder whose package.json gets the scripts
 * @param {Record<string, string>} scripts @returns {Record<string, string>}
 */
export function runnableScripts(dir, scripts) {
  let pkg = {};
  try {
    pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  } catch {
    /* no package yet: nothing is installed */
  }
  const deps = {
    .../** @type {any} */ (pkg).dependencies,
    .../** @type {any} */ (pkg).devDependencies,
  };
  const out = { ...scripts };
  const linted = deps.eslint || ESLINT_CONFIGS.some((f) => existsSync(join(dir, f)));
  if (/\beslint\b/.test(out.lint || "") && !linted) delete out.lint;
  const typed = deps.typescript || existsSync(join(dir, "tsconfig.json"));
  if (/\btsc\b/.test(out.typecheck || "") && !typed) delete out.typecheck;
  return out;
}
