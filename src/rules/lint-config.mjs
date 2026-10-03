/**
 * The text of a repository's lint configuration, the modules it imports included. A monorepo
 * keeps its rules in a shared package (`@acme/eslint-config`) that each workspace's
 * `eslint.config.js` imports in one line, and the rules that read the configuration for
 * `no-console` or `max-lines` found the line and not the rules: four musts read missing.
 */
import { posix } from "node:path";

const EXTENSIONS = ["", ".js", ".mjs", ".cjs", ".ts", "/index.js", "/index.mjs", "/index.ts"];

/**
 * The lint files and every module they import that lives in this tree, read as one text: a
 * relative import, or a workspace package by its name, two levels deep.
 * @param {string[]} lintFiles @param {(f: string) => string} read
 * @param {(re: RegExp) => string[]} files the tracked files matching a pattern
 * @returns {string}
 */
export function lintConfigText(lintFiles, read, files) {
  const tracked = new Set(files(/\.(js|mjs|cjs|ts|json)$/));
  const workspaces = workspaceEntries(files, read);
  const seen = new Set();
  /** @type {string[]} */
  const texts = [];
  /** @param {string} file @param {number} depth */
  const visit = (file, depth) => {
    if (seen.has(file)) return;
    seen.add(file);
    const text = read(file);
    texts.push(text);
    if (depth >= 2) return;
    for (const m of text.matchAll(/(?:from\s+|require\(\s*|import\(\s*)["']([^"']+)["']/g)) {
      const spec = String(m[1]);
      const target = spec.startsWith(".")
        ? EXTENSIONS.map((e) => posix.join(posix.dirname(file), spec) + e).find((f) =>
            tracked.has(f),
          )
        : workspaces.get(spec);
      if (target) visit(target, depth + 1);
    }
  };
  for (const f of lintFiles) visit(f, 0);
  return texts.join("\n");
}

/**
 * Each workspace package's name and the file it loads as, from its manifest's `main` or
 * `exports["."]`, else an index file.
 * @param {(re: RegExp) => string[]} files @param {(f: string) => string} read
 * @returns {Map<string, string>}
 */
function workspaceEntries(files, read) {
  /** @type {Map<string, string>} */
  const out = new Map();
  for (const manifest of files(/(^|\/)package\.json$/)) {
    if (manifest === "package.json" || manifest.includes("node_modules/")) continue;
    let pkg;
    try {
      pkg = JSON.parse(read(manifest));
    } catch {
      continue;
    }
    if (!pkg?.name) continue;
    const dir = posix.dirname(manifest);
    const dot = typeof pkg.exports === "string" ? pkg.exports : pkg.exports?.["."];
    const entry = String(
      (typeof dot === "string" ? dot : dot?.import || dot?.default) || pkg.main || "index.js",
    );
    out.set(String(pkg.name), posix.join(dir, entry));
  }
  return out;
}
