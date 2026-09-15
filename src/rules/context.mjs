/**
 * The context a rule reads: the repository's files as git keeps them, its package, its
 * dependencies, its configs, its history - read once, shared by every check of the catalog. A
 * rule never touches the filesystem directly; it asks the context, so a check is a pure function
 * of this object and a fixture can stand in for a repository in the tests.
 *
 * Nothing of the repository is executed: the context reads files and runs git, no more.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join, relative, resolve, sep } from "node:path";
import { readAdoption } from "../core/repo.mjs";

const IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "coverage",
  "generated",
  "out",
  ".turbo",
  "vendor",
  "server-dist",
  "test-results",
  "playwright-report",
]);
// Inside the agent's folder only the harness folders are read: worktrees hold whole checkouts,
// projects and agent-memory hold transcripts, night holds run state. None of it is the repository.
const AGENT_DIRS = new Set(["hooks", "rules", "skills", "agents", "commands"]);
const AGENT_ROOT = ".claude";
const SOURCE_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

/**
 * @typedef {object} RepoContext
 * @property {string} repo the absolute root
 * @property {string} name the folder name (package.json's name wins in the report)
 * @property {string} today YYYY-MM-DD
 * @property {string} agentRoot the agent's settings folder name, relative to the root
 * @property {string[]} allFiles every kept file, repository-relative, forward slashes
 * @property {(re: RegExp) => string[]} files the kept files whose path matches
 * @property {(re: RegExp) => string | undefined} firstFile the first of those
 * @property {(p: string) => boolean} exists
 * @property {(p: string) => string} read the file's text, "" when unreadable
 * @property {(p: string) => any} readJson the parsed JSON, null when unreadable or invalid
 * @property {(...args: string[]) => string} git trimmed stdout, "" on failure
 * @property {(text: string) => number} codeLines lines that are neither blank nor a full-line comment
 * @property {Set<string>} deps every dependency name of the root and first-level workspaces
 * @property {(dep: string) => boolean} has
 * @property {Record<string, any>} pkg the root package.json, {} when absent
 * @property {Record<string, string>} scripts its scripts
 * @property {(re: RegExp) => [string, string] | undefined} script the first script whose name or command matches
 * @property {string[]} eslintFiles
 * @property {string} eslintText every ESLint flat config, joined
 * @property {string} tsconfigText every tsconfig, joined
 * @property {string[]} ciFiles the CI pipelines (Woodpecker, GitHub Actions)
 * @property {string} ciText
 * @property {string[]} ghWorkflows the GitHub workflows
 * @property {string[]} sourceFiles source files outside the agent folder, migrations and tests
 * @property {string[]} docFiles the Markdown files under docs/
 * @property {string[]} tsSources
 * @property {string[]} jsSources
 * @property {boolean} isTs more TypeScript than JavaScript sources
 * @property {string | null} contextFile the agent's context file at the root or in its folder
 * @property {Record<string, any> | null} adoption the repository's adoption config
 */

/**
 * Build the context of a repository. @param {string} repoDir @param {{ today?: string }} [o]
 * @returns {RepoContext}
 */
export function buildContext(repoDir, o = {}) {
  const REPO = resolve(repoDir);
  const today = o.today || new Date().toISOString().slice(0, 10);

  /** @param {string} p */
  const exists = (p) => existsSync(join(REPO, p));
  /** @param {string} p */
  const read = (p) => {
    try {
      return readFileSync(join(REPO, p), "utf8");
    } catch {
      return "";
    }
  };
  /** @param {string} p @returns {any} */
  const readJson = (p) => {
    try {
      return JSON.parse(read(p));
    } catch {
      return null;
    }
  };
  /** @param {string} p */
  const rel = (p) => relative(REPO, p).split(sep).join("/");

  /** Recursive walk with the ignore list. @param {string} dir @param {string[]} acc @param {number} depth */
  function walk(dir = REPO, acc = [], depth = 0) {
    /** @type {import("node:fs").Dirent[]} */
    let entries = [];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return acc;
    }
    const inAgentRoot = depth === 1 && basename(dir) === AGENT_ROOT;
    for (const e of entries) {
      if (e.isDirectory()) {
        if (inAgentRoot && !AGENT_DIRS.has(e.name)) continue;
        if (!IGNORE_DIRS.has(e.name) && depth < 12) walk(join(dir, e.name), acc, depth + 1);
      } else {
        acc.push(rel(join(dir, e.name)));
      }
    }
    return acc;
  }

  /**
   * The files git would keep: tracked plus untracked-but-not-ignored, so an ignored scratch
   * folder beside the source (a build report, a download) is not read as the repository. Outside
   * a git repository the walk stands in. The agent-folder and ignore rules apply to both.
   */
  function gitKept() {
    try {
      const out = execFileSync(
        "git",
        ["ls-files", "--cached", "--others", "--exclude-standard", "--deduplicate", "-z"],
        {
          cwd: REPO,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
          maxBuffer: 64 * 1024 * 1024,
        },
      );
      const list = out.split("\0").filter(Boolean);
      return list.length ? list : null;
    } catch {
      return null;
    }
  }
  const kept = gitKept();
  const allFiles = kept
    ? kept.filter((f) => {
        const parts = f.split("/");
        return (
          !parts.slice(0, -1).some((d) => IGNORE_DIRS.has(d)) &&
          !(parts[0] === AGENT_ROOT && parts.length > 2 && !AGENT_DIRS.has(parts[1] || ""))
        );
      })
    : walk();
  /** @param {RegExp} re */
  const files = (re) => allFiles.filter((f) => re.test(f));
  /** @param {RegExp} re */
  const firstFile = (re) => files(re)[0];

  /** @param {string[]} args */
  function git(...args) {
    try {
      return execFileSync("git", args, {
        cwd: REPO,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        maxBuffer: 32 * 1024 * 1024,
      }).trim();
    } catch {
      return "";
    }
  }

  /** Code lines: blank lines and full-line comments removed; a rough but stable measure. @param {string} text */
  function codeLines(text) {
    return text.split(/\r?\n/).filter((l) => {
      const t = l.trim();
      return t && !t.startsWith("//") && !t.startsWith("/*") && !t.startsWith("*") && t !== "*/";
    }).length;
  }

  /** @type {Set<string>} */
  const deps = new Set();
  /** @param {Record<string, any> | null} pkg */
  const collect = (pkg) => {
    if (!pkg) return;
    for (const k of ["dependencies", "devDependencies", "peerDependencies"])
      for (const d of Object.keys(pkg[k] || {})) deps.add(d);
  };
  collect(readJson("package.json"));
  for (const p of files(/^(apps|packages|services)\/[^/]+\/package\.json$/)) collect(readJson(p));
  /** @param {string} dep */
  const has = (dep) => deps.has(dep);
  const pkg = readJson("package.json") || {};
  /** @type {Record<string, string>} */
  const scripts = pkg.scripts || {};
  /** @param {RegExp} re */
  const script = (re) => Object.entries(scripts).find(([k, v]) => re.test(k) || re.test(v));

  const eslintFiles = files(/(^|\/)eslint\.config\.(js|mjs|cjs|ts)$/);
  const ciFiles = files(/^\.woodpecker(\/.*\.ya?ml|\.ya?ml)$|^\.github\/workflows\/.*\.ya?ml$/);
  const sourceFiles = allFiles.filter(
    (f) =>
      SOURCE_EXT.has(f.slice(f.lastIndexOf("."))) &&
      !f.startsWith(AGENT_ROOT + "/") &&
      !/(^|\/)(migrations|seeders|drizzle|prisma\/migrations)\//.test(f) &&
      !/\.(test|spec)\./.test(f),
  );
  // A generated .d.ts is not a TypeScript source: a JavaScript repository that emits declarations
  // for its models is still read as JavaScript (checkJs), not held to the strict flags.
  const tsSources = sourceFiles.filter((f) => /\.tsx?$/.test(f) && !/\.d\.ts$/.test(f));
  const jsSources = sourceFiles.filter((f) => /\.(js|jsx|mjs|cjs)$/.test(f));
  // The agent's context file: the primary's at the root or in its folder, else the open
  // AGENTS.md convention another adapter reads.
  const contextName = "CLAUDE.md";
  const contextFile = exists(contextName)
    ? contextName
    : exists(`${AGENT_ROOT}/${contextName}`)
      ? `${AGENT_ROOT}/${contextName}`
      : exists("AGENTS.md")
        ? "AGENTS.md"
        : null;

  return {
    repo: REPO,
    name: basename(REPO),
    today,
    agentRoot: AGENT_ROOT,
    allFiles,
    files,
    firstFile,
    exists,
    read,
    readJson,
    git,
    codeLines,
    deps,
    has,
    pkg,
    scripts,
    script,
    eslintFiles,
    eslintText: eslintFiles.map(read).join("\n"),
    tsconfigText: files(/(^|\/)tsconfig(\.base)?\.json$/)
      .map(read)
      .join("\n"),
    ciFiles,
    ciText: ciFiles.map(read).join("\n"),
    ghWorkflows: files(/^\.github\/workflows\/.*\.ya?ml$/),
    sourceFiles,
    docFiles: files(/^docs\/.*\.md$/),
    tsSources,
    jsSources,
    isTs: tsSources.length > jsSources.length,
    contextFile,
    adoption: readAdoption(REPO),
  };
}
