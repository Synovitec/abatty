/**
 * Packages the code imports and no manifest declares. An adopter imported `server-only` from 13
 * files without declaring it: the gate read 13 import-graph errors and 13 dead-code findings, one
 * per file, and nothing said the one thing to do, install it. This names each such package once,
 * with how many files import it.
 */
import { readFileSync } from "node:fs";
import { builtinModules } from "node:module";
import { join, posix } from "node:path";
import { git, readJsonFile } from "./repo.mjs";
import { aliasScopes, unalias } from "./ts-paths.mjs";
import { codeOnly } from "../ratchet/probes/lex.mjs";

/** A bare specifier as imported or required: `pkg`, `@scope/pkg`, `pkg/sub`. */
const IMPORT =
  /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|^\s*import\s+)["']([^"'./][^"']*)["']/gm;
const SOURCE = /\.[cm]?[jt]sx?$/;
const BUILTIN = new Set(builtinModules.flatMap((m) => [m, `node:${m}`]));
/**
 * Modules a runtime provides rather than a package: Bun's own (`bun`; `bun:test` has a colon) and
 * k6's (`k6`, `k6/http`, run by the k6 binary). An adopter on Bun was told `bun add bun k6`,
 * which installs the wrong things.
 */
const RUNTIME = new Set(["bun", "k6"]);

/** The package a specifier names: `@scope/pkg/sub` is `@scope/pkg`, `pkg/sub` is `pkg`. @param {string} spec */
const packageOf = (spec) =>
  spec
    .split("/")
    .slice(0, spec.startsWith("@") ? 2 : 1)
    .join("/");

/**
 * Every package imported from tracked sources that no package.json in the repository declares
 * (dependencies of any kind, at the root or a workspace) and that is not a workspace itself.
 * @param {string} repoDir @returns {{ name: string, files: number }[]}
 */
export function undeclaredImports(repoDir) {
  const tracked = git(repoDir, "ls-files").split("\n").filter(Boolean);
  const manifests = tracked.filter((f) => /(^|\/)package\.json$/.test(f));
  const declared = new Set();
  for (const m of manifests) {
    const pkg = readJsonFile(repoDir, m) || {};
    if (pkg.name) declared.add(String(pkg.name));
    for (const k of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"])
      for (const d of Object.keys(pkg[k] || {})) declared.add(d);
  }
  const scopes = aliasScopes(repoDir, tracked);
  /** @type {Map<string, number>} */
  const counts = new Map();
  for (const f of tracked) {
    if (!SOURCE.test(f) || /(^|\/)node_modules\//.test(f)) continue;
    let text = "";
    try {
      text = readFileSync(join(repoDir, f), "utf8");
    } catch {
      continue;
    }
    const seen = new Set();
    // Only an import the code makes: a fixture's string or a comment that reads like one is text.
    const code = codeOnly(text);
    for (const m of text.matchAll(IMPORT)) {
      const at = (m.index ?? 0) + m[0].search(/\S/);
      if (code.slice(at, at + 4) !== text.slice(at, at + 4)) continue;
      const spec = String(m[1]);
      // A builtin by its prefix; a backslash is a regular expression's escape, never a module.
      if (spec.startsWith("node:") || spec.includes("\\")) continue;
      // A virtual module (`astro:content`), a builtin, an alias the tsconfig resolves: no package.
      if (spec.includes(":") && !spec.startsWith("node:")) continue;
      if (
        BUILTIN.has(spec) ||
        BUILTIN.has(packageOf(spec)) ||
        RUNTIME.has(packageOf(spec)) ||
        unalias(scopes, f, spec).length
      )
        continue;
      const name = packageOf(spec);
      if (declared.has(name) || seen.has(name) || name.startsWith(".") || posix.isAbsolute(name))
        continue;
      seen.add(name);
      counts.set(name, (counts.get(name) || 0) + 1);
    }
  }
  return [...counts].map(([name, files]) => ({ name, files })).sort((a, b) => b.files - a.files);
}
