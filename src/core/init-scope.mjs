/**
 * What `init` installs, by the profile a repository follows. Under `minimal`, the default of a
 * repository with no config yet: the config, the scripts, the git hooks, the ignore files, the
 * tool configs the gate's steps need and the day-one workflow. The agent harness comes with an
 * agent asked for (`--agent`) or with `synovitec`; the standard's documents and its per-commit
 * changelog line come with `synovitec` alone. A repository whose config names no profile keeps
 * `synovitec`, as it was measured before, so an upgrade moves nobody (decision 0002, 1.0 scope).
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { CONFIG_FILE, LEGACY_CONFIG, readJsonFile } from "./repo.mjs";
import { profileNames } from "../profiles/index.mjs";

/**
 * The profiles `init` sets up and what they bring.
 * @param {string} repoDir @param {{ profile?: string, agents?: string[] }} o
 * @returns {{ profiles: string[], full: boolean, harness: boolean, name: boolean }} `full` is the
 * synovitec setup, `harness` the agent's files, `name` whether the config is told the profiles
 */
export function initScope(repoDir, o) {
  const existing = readJsonFile(repoDir, CONFIG_FILE) || readJsonFile(repoDir, LEGACY_CONFIG);
  const profiles = o.profile
    ? o.profile.split(/[\s,]+/).filter(Boolean)
    : existing
      ? profileNames(existing)
      : ["minimal"];
  const full = profiles.includes("synovitec");
  return {
    profiles,
    full,
    harness: full || Boolean(o.agents?.length),
    name: Boolean(o.profile) || !existing,
  };
}

/**
 * The preset's scripts and dev dependencies as the scope takes them. Under a profile without the
 * standard, no dead-code step: it is none of minimal's rules, and its zero-issue default turned an
 * existing codebase's first gate red, where the ratchet promises old debt never blocks a push.
 * TypeScript is installed only where the repository has a tsconfig: a plain JavaScript package
 * was given a compiler it never runs.
 * @param {{ full: boolean }} scope @param {string} repoDir
 * @param {{ scripts: Record<string, string>, devDependencies: string[], tooling: { knip: boolean } }} preset
 */
export function scopedTools(scope, repoDir, preset) {
  const knip = preset.tooling.knip && scope.full;
  const typed = scope.full || existsSync(join(repoDir, "tsconfig.json"));
  const scripts = Object.fromEntries(
    Object.entries(preset.scripts).filter(([k]) => knip || k !== "dead"),
  );
  const devDependencies = preset.devDependencies.filter(
    (d) => (knip || !/^knip(@|$)/.test(d)) && (typed || !/^typescript(@|$)/.test(d)),
  );
  return { knip, scripts, devDependencies };
}
