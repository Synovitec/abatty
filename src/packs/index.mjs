/**
 * Language packs: what a language's tooling is, so the rules keep the same words across
 * languages. A pack names the source extensions, the test-file shape, the manifest, and the
 * tools a rule looks for (the formatter, the linter, the typecheck, the dead-code tool, the
 * test runner) as config files, scripts and dependencies. The context detects the packs of a
 * tree from its files; a rule about "the linter" asks each pack for its linter.
 *
 * JavaScript is the pack the package was built on; Python is the first beyond it, real only
 * when a named repository has run it (the preset says so).
 */

/**
 * @typedef {{ name: string, configs: RegExp, script: RegExp, deps?: string[] }} Tool a tool is found by a config file, a script, or a dependency
 * @typedef {{
 *   id: string,
 *   name: string,
 *   extensions: string[],
 *   source: RegExp,
 *   test: RegExp,
 *   manifest: RegExp,
 *   tools: { formatter: Tool, linter: Tool, typecheck: Tool, dead: Tool, test: Tool },
 * }} Pack
 */

/** @type {Pack} */
export const javascript = {
  id: "javascript",
  name: "JavaScript / TypeScript",
  extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"],
  source: /\.(ts|tsx|js|jsx|mjs|cjs)$/,
  test: /\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs)$/,
  manifest: /^package\.json$/,
  tools: {
    formatter: {
      name: "prettier",
      configs: /(^|\/)\.prettierrc(\.\w+)?$|(^|\/)prettier\.config\./,
      script: /prettier|format/,
      deps: ["prettier"],
    },
    linter: {
      name: "eslint",
      configs: /(^|\/)eslint\.config\.(js|mjs|cjs|ts)$/,
      script: /^lint$|eslint/,
      deps: ["eslint"],
    },
    typecheck: {
      name: "tsc",
      configs: /(^|\/)tsconfig(\.\w+)?\.json$/,
      script: /^type-?check$|tsc --noEmit/,
      deps: ["typescript"],
    },
    dead: {
      name: "knip",
      configs: /(^|\/)knip\.(json|jsonc|ts|js|mjs)$/,
      script: /\bknip\b/,
      deps: ["knip"],
    },
    test: {
      // The platform's own runner counts: `node --test` needs no dependency and no config file,
      // so a repository that uses it has a runner and the rule must read it as one.
      name: "vitest, jest or node --test",
      configs: /(^|\/)(vitest|jest)\.config\.(ts|js|mjs|mts|cjs)$/,
      script: /^test$/,
      deps: ["vitest", "jest"],
    },
  },
};

/** @type {Pack} */
export const python = {
  id: "python",
  name: "Python",
  extensions: [".py", ".pyi"],
  source: /\.pyi?$/,
  test: /(^|\/)(test_[^/]*\.py|[^/]*_test\.py)$/,
  manifest: /^(pyproject\.toml|requirements\.txt|setup\.py|setup\.cfg|Pipfile)$/,
  tools: {
    formatter: {
      name: "ruff format or black",
      configs: /^(ruff\.toml|\.ruff\.toml|pyproject\.toml)$/,
      script: /ruff format|black/,
    },
    linter: {
      name: "ruff",
      configs: /^(ruff\.toml|\.ruff\.toml|pyproject\.toml|\.flake8|setup\.cfg)$/,
      script: /ruff check|flake8|pylint/,
    },
    typecheck: {
      name: "mypy or pyright",
      configs: /^(mypy\.ini|\.mypy\.ini|pyrightconfig\.json|pyproject\.toml)$/,
      script: /mypy|pyright/,
    },
    dead: { name: "vulture", configs: /^(vulture\.toml|pyproject\.toml)$/, script: /vulture/ },
    test: {
      name: "pytest",
      configs: /^(pytest\.ini|conftest\.py|tox\.ini|pyproject\.toml)$/,
      script: /pytest/,
    },
  },
};

/** @type {Pack[]} */
export const PACKS = [javascript, python];

/** @param {string} id */
export function packById(id) {
  return PACKS.find((p) => p.id === id) || null;
}

/**
 * The packs a tree carries: a pack is present when a source file of its extensions or its
 * manifest is in the tree. JavaScript first, so a repository with a build script beside its
 * Python keeps reading as both.
 * @param {(re: RegExp) => string[]} files
 */
export function detectPacks(files) {
  return PACKS.filter((p) => files(p.source).length > 0 || files(p.manifest).length > 0);
}

/**
 * Whether a pack's tool is present in a repository: the config file, the script, or the
 * dependency; the evidence names which. For pyproject.toml the section is checked, since
 * the file exists for every Python project.
 * @param {import("../rules/context.mjs").RepoContext} c @param {Pack} pack @param {keyof Pack["tools"]} tool
 * @returns {{ present: boolean, evidence: string }}
 */
export function toolOf(c, pack, tool) {
  const t = pack.tools[tool];
  const names = t.name.split(/ or |\s+/).filter((w) => w !== "format");
  const config = c.files(t.configs).find((f) => {
    if (!/pyproject\.toml$/.test(f)) return true;
    return new RegExp(`^\\[tool\\.(${names.join("|")})`, "m").test(c.read(f));
  });
  const script = c.script(t.script);
  const dep = (t.deps || []).find((d) => c.has(d));
  const present = Boolean(config || script || dep);
  return {
    present,
    evidence: config || (script ? `\`${script[0]}\`` : dep ? `${dep} dependency` : `no ${t.name}`),
  };
}
