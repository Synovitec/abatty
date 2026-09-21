/**
 * The package manager a repository uses, read from what it committed: the `packageManager`
 * field first, the lockfile otherwise. Everything that speaks to it (the audit the gate runs,
 * the install and audit steps `abatty ci` writes, the frozen-install rule) asks here rather than
 * assuming npm. The assumption was the second kind of defect an outside trial reported: a
 * pnpm + Windows team got `npm ci` in its pipeline and an audit that quietly did not run.
 *
 * What is wired is what was watched: npm, pnpm and bun were each run against a package with a
 * known advisory and their JSON read (`src/core/audit.mjs` parses the three shapes). yarn's
 * audit is named for CI and deferred by the gate until somebody has watched it too; a manager
 * this module does not recognise is reported, never guessed.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readPackage } from "./repo.mjs";

/**
 * @typedef {"npm" | "pnpm" | "yarn" | "bun"} PackageManagerId
 * @typedef {{
 *   id: PackageManagerId,
 *   lockfile: string,
 *   install: string[],
 *   run: (script: string) => string[],
 *   exec: (tool: string) => string[],
 *   audit: ((level: string) => { check: string[], json: string[] }) | null,
 *   auditCommand: string,
 * }} PackageManager
 */

/** The lockfiles, in the order a repository that carries two is read (the more specific first). */
const LOCKFILES = /** @type {[string, PackageManagerId][]} */ ([
  ["pnpm-lock.yaml", "pnpm"],
  ["bun.lock", "bun"],
  ["bun.lockb", "bun"],
  ["yarn.lock", "yarn"],
  ["npm-shrinkwrap.json", "npm"],
  ["package-lock.json", "npm"],
]);

/** yarn 1 and yarn berry differ in every command that matters here; the lockfile's first line says which. @param {string} repoDir */
function yarnIsBerry(repoDir) {
  try {
    return /__metadata/.test(readFileSync(join(repoDir, "yarn.lock"), "utf8").slice(0, 2048));
  } catch {
    return false;
  }
}

/**
 * The package manager of a repository, or null when nothing it committed names one: no
 * `packageManager` field and no lockfile.
 * @param {string} repoDir @returns {PackageManager | null}
 */
export function packageManager(repoDir) {
  const declared = String(readPackage(repoDir).packageManager || "").match(/^(npm|pnpm|yarn|bun)@/);
  const lock = LOCKFILES.find(([f]) => existsSync(join(repoDir, f)));
  const id = /** @type {PackageManagerId | null} */ (
    declared ? declared[1] : lock ? lock[1] : null
  );
  if (!id) return null;
  const lockfile = (LOCKFILES.find(([f, m]) => m === id && existsSync(join(repoDir, f))) || [
    LOCKFILES.find(([, m]) => m === id)?.[0] || "",
  ])[0];
  return { ...MANAGERS[id](repoDir), id, lockfile };
}

/** @type {Record<PackageManagerId, (repoDir: string) => Omit<PackageManager, "id" | "lockfile">>} */
const MANAGERS = {
  npm: () => ({
    install: ["npm", "ci"],
    run: (s) => ["npm", "run", "-s", s],
    exec: (t) => ["npx", t],
    audit: (level) => ({
      check: ["npm", "audit", `--audit-level=${level}`, "--omit=dev"],
      json: ["npm", "audit", "--json", "--omit=dev"],
    }),
    auditCommand: "npm audit --audit-level=high --omit=dev",
  }),
  pnpm: () => ({
    install: ["pnpm", "install", "--frozen-lockfile"],
    run: (s) => ["pnpm", "run", "-s", s],
    exec: (t) => ["pnpm", "exec", t],
    audit: (level) => ({
      check: ["pnpm", "audit", `--audit-level=${level}`, "--prod"],
      json: ["pnpm", "audit", "--json", "--prod"],
    }),
    auditCommand: "pnpm audit --audit-level=high --prod",
  }),
  bun: () => ({
    install: ["bun", "install", "--frozen-lockfile"],
    run: (s) => ["bun", "run", "--silent", s],
    exec: (t) => ["bunx", t],
    audit: (level) => ({
      check: ["bun", "audit", `--audit-level=${level}`, "--prod"],
      json: ["bun", "audit", "--json", "--prod"],
    }),
    auditCommand: "bun audit --audit-level=high --prod",
  }),
  yarn: (repoDir) =>
    yarnIsBerry(repoDir)
      ? {
          install: ["yarn", "install", "--immutable"],
          run: (s) => ["yarn", "run", s],
          exec: (t) => ["yarn", "exec", t],
          audit: null,
          auditCommand: "yarn npm audit --environment production --severity high",
        }
      : {
          install: ["yarn", "install", "--frozen-lockfile"],
          run: (s) => ["yarn", "run", "-s", s],
          exec: (t) => ["yarn", "exec", t],
          audit: null,
          auditCommand: "yarn audit --groups dependencies --level high",
        },
};
