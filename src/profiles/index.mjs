/**
 * Profiles: a standard as a package. A profile carries rules, the phases of its adoption
 * plan, the presets it ships (by id), the harness rule files it installs and the documents it
 * points at. The built-in profile, `synovitec`, is the standard the package was built on. A
 * repository names one or several in `profiles` (`["synovitec"]` when absent): a built-in id,
 * a file (`./profiles/acme.mjs`) or a package (`@acme/abatty-profile`) exporting `profile`.
 * The rules of every named profile are one catalog, the repository's own rules file on top,
 * and a client project that names only its own profile carries only its own standard.
 */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { validate } from "../rules/index.mjs";
import { synovitec } from "./synovitec.mjs";

/**
 * @typedef {import("../rules/index.mjs").Rule} Rule
 * @typedef {{ id: string, title: string, size?: string, blocksOn?: string[], exit?: string }} Phase
 * @typedef {{
 *   id: string,
 *   name: string,
 *   description?: string,
 *   rules: Rule[],
 *   phases: Phase[],
 *   presets?: string[],
 *   harnessRules?: string[],
 *   standard?: { document?: string, plan?: string },
 *   source?: string,
 * }} Profile
 */

/** The built-in profiles. @type {Profile[]} */
export const PROFILES = [synovitec];
export const DEFAULT_PROFILES = ["synovitec"];

/** @param {string} id */
export function profileById(id) {
  return PROFILES.find((p) => p.id === id) || null;
}

/** The problems a profile has, as messages; none for a well-formed one. @param {any} p */
export function validateProfile(p) {
  /** @type {string[]} */
  const problems = [];
  if (!p || typeof p !== "object") return ["a profile is not an object"];
  if (!/^[a-z0-9][a-z0-9-]*$/.test(String(p.id || "")))
    problems.push("id must be lowercase letters, digits and dashes");
  if (typeof p.name !== "string" || !p.name) problems.push("name must be a non-empty string");
  if (!Array.isArray(p.rules)) problems.push("rules must be an array");
  else problems.push(...validate(p.rules));
  if (!Array.isArray(p.phases)) problems.push("phases must be an array");
  else
    for (const ph of p.phases)
      if (!ph || typeof ph.id !== "string" || !ph.id || typeof ph.title !== "string")
        problems.push("every phase has an id and a title");
  for (const k of ["presets", "harnessRules"])
    if (p[k] !== undefined && !Array.isArray(p[k])) problems.push(`${k} must be an array`);
  return problems;
}

/**
 * The names a config gives, normalised: strings, the default when absent.
 * @param {any} config @returns {string[]}
 */
export function profileNames(config) {
  const v = config?.profiles;
  if (v === undefined || v === null) return DEFAULT_PROFILES;
  return (Array.isArray(v) ? v : [v]).map(String).filter(Boolean);
}

/**
 * Load one profile by name: a built-in id, a file relative to the repository, or a package
 * resolved from the repository's node_modules.
 * @param {string} repoDir @param {string} name
 * @returns {Promise<{ profile: Profile | null, problem: string }>}
 */
export async function loadProfile(repoDir, name) {
  const builtIn = profileById(name);
  if (builtIn) return { profile: { ...builtIn, source: "abatty" }, problem: "" };
  let file = "";
  if (/^[./\\]|^[A-Za-z]:[\\/]/.test(name)) {
    file = resolve(repoDir, name);
    if (!existsSync(file)) return { profile: null, problem: `profiles: ${name} not found` };
  } else {
    try {
      file = createRequire(join(resolve(repoDir), "package.json")).resolve(name);
    } catch {
      return {
        profile: null,
        problem: `profiles: ${name} is neither a built-in profile (${PROFILES.map((p) => p.id).join(", ")}), a file, nor an installed package`,
      };
    }
  }
  try {
    const mod = await import(pathToFileURL(file).href + `?t=${Date.now()}`);
    const p = mod.profile || mod.default;
    const problems = validateProfile(p);
    if (problems.length)
      return { profile: null, problem: `profiles: ${name}: ${problems.join("; ")}` };
    return { profile: { ...p, source: name }, problem: "" };
  } catch (e) {
    return {
      profile: null,
      problem: `profiles: ${name}: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

/**
 * The profiles a repository names, loaded and checked against each other: an id or a rule id
 * that two profiles share is a problem, and the later one loses the rule.
 * @param {string} repoDir @param {any} config
 * @returns {Promise<{ profiles: Profile[], problems: string[] }>}
 */
export async function loadProfiles(repoDir, config) {
  /** @type {Profile[]} */
  const profiles = [];
  /** @type {string[]} */
  const problems = [];
  const ruleOwner = new Map();
  for (const name of profileNames(config)) {
    const r = await loadProfile(repoDir, name);
    if (!r.profile) {
      problems.push(r.problem);
      continue;
    }
    if (profiles.some((p) => p.id === r.profile?.id)) {
      problems.push(`profiles: ${r.profile.id} is named twice`);
      continue;
    }
    const rules = r.profile.rules.filter((rule) => {
      const owner = ruleOwner.get(rule.id);
      if (owner) {
        problems.push(
          `profiles: ${rule.id} is a rule of ${owner} already; ${r.profile?.id} does not redefine it`,
        );
        return false;
      }
      ruleOwner.set(rule.id, r.profile?.id);
      return true;
    });
    profiles.push({ ...r.profile, rules });
  }
  return { profiles, problems };
}

/**
 * One catalog from the loaded profiles: every rule with its source (the package's name for
 * the built-in profile, `profile:<id>` for another).
 * @param {Profile[]} profiles @returns {Rule[]}
 */
export function catalogOf(profiles) {
  return profiles.flatMap((p) =>
    p.rules.map((r) => ({ source: p.source === "abatty" ? "abatty" : `profile:${p.id}`, ...r })),
  );
}

/** The phases of the loaded profiles, in order, the first profile's id winning a clash. @param {Profile[]} profiles */
export function phasesOf(profiles) {
  /** @type {Phase[]} */
  const out = [];
  for (const p of profiles)
    for (const ph of p.phases) if (!out.some((x) => x.id === ph.id)) out.push(ph);
  return out;
}
