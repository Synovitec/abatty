/**
 * The path aliases a TypeScript project resolves (`compilerOptions.paths`, from `baseUrl` or the
 * tsconfig's own folder), so the import graph reads `@/lib/price` as the file it names. Without
 * them a Next or Vite product, where nearly every import is an alias, had a graph with no edges:
 * `abatty mutate` found no test for any module it changed and judged nothing.
 *
 * Every tracked tsconfig.json counts for the files under its folder, the nearest one winning, so a
 * monorepo's `apps/web` keeps its own `@/`. `extends` is not followed: a project that keeps its
 * paths in a base config names them where they apply, or the graph reads those imports as absent.
 */
import { readFileSync } from "node:fs";
import { join, posix } from "node:path";

/** @typedef {{ dir: string, rules: { prefix: string, suffix: string, targets: string[], exact: boolean }[] }} AliasScope */

/**
 * JSON with the comments and trailing commas a tsconfig is allowed, read as JSON. Strings are
 * copied as they are, so a `//` inside a path is not taken for a comment.
 * @param {string} text @returns {unknown}
 */
export function parseJsonc(text) {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      const end = /"(?:[^"\\]|\\.)*"/y;
      end.lastIndex = i;
      const m = end.exec(text);
      const s = m ? m[0] : text.slice(i);
      out += s;
      i += s.length - 1;
    } else if (c === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      out += "\n";
    } else if (c === "/" && text[i + 1] === "*") {
      const close = text.indexOf("*/", i + 2);
      i = close < 0 ? text.length : close + 1;
    } else out += c;
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, "$1"));
}

/**
 * The alias scopes of the tracked tsconfig files, deepest folder first.
 * @param {string} repoDir @param {string[]} tracked @returns {AliasScope[]}
 */
export function aliasScopes(repoDir, tracked) {
  /** @type {AliasScope[]} */
  const scopes = [];
  for (const f of tracked.filter((t) => /(^|\/)tsconfig\.json$/.test(t))) {
    /** @type {{ paths?: Record<string, unknown>, baseUrl?: string } | undefined} */
    let opts;
    try {
      const cfg = /** @type {{ compilerOptions?: typeof opts } | null} */ (
        parseJsonc(readFileSync(join(repoDir, f), "utf8"))
      );
      opts = cfg?.compilerOptions;
    } catch {
      continue;
    }
    if (!opts?.paths || typeof opts.paths !== "object") continue;
    const dir = posix.dirname(f) === "." ? "" : posix.dirname(f);
    const base = posix.join(dir || ".", String(opts.baseUrl || "."));
    const rules = Object.entries(opts.paths).map(([key, to]) => {
      const [prefix = "", suffix = ""] = key.split("*");
      const targets = (Array.isArray(to) ? to : []).map((t) => posix.join(base, String(t)));
      return {
        prefix,
        suffix: key.includes("*") ? suffix : "",
        targets,
        exact: !key.includes("*"),
      };
    });
    scopes.push({ dir, rules });
  }
  return scopes.sort((a, b) => b.dir.length - a.dir.length);
}

/**
 * The candidate paths an aliased specifier names, written from `from`; empty when no alias of the
 * nearest tsconfig matches it.
 * @param {AliasScope[]} scopes @param {string} from @param {string} spec @returns {string[]}
 */
export function unalias(scopes, from, spec) {
  const scope = scopes.find((s) => !s.dir || from.startsWith(`${s.dir}/`));
  for (const rule of scope?.rules || []) {
    if (rule.exact) {
      if (spec === rule.prefix) return rule.targets;
      continue;
    }
    if (!spec.startsWith(rule.prefix) || !spec.endsWith(rule.suffix)) continue;
    const star = spec.slice(rule.prefix.length, spec.length - rule.suffix.length);
    return rule.targets.map((t) => posix.normalize(t.replace("*", star)));
  }
  return [];
}
