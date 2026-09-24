/**
 * The one configuration of a repository: `abatty.config.json` at the root, a tool-neutral name
 * any agent can read, validated against the schema the package ships (`schema/`). The older
 * place, `.claude/adoption.json`, is still read; the root file wins key by key, and `abatty
 * config --migrate` moves the older file to the root. The hooks read the same file (their
 * `configPath()` prefers the root), so there is one config, not two.
 */
import { existsSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CONFIG_FILE,
  LEGACY_CONFIG,
  parseJson,
  readConfig,
  readJsonFile,
  writeJsonFile,
} from "./repo.mjs";

export { CONFIG_FILE, LEGACY_CONFIG, readConfig };
/** The `$schema` a written config names, so an editor validates it without the package installed. */
export const SCHEMA_URL = "https://abatty.io/schema/abatty.config.json";
/** The schema the package ships, the one `abatty config` validates against: the same file the URL serves. */
export const SCHEMA_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "schema",
  "abatty.config.schema.json",
);

/** The schema as the package ships it. @returns {any} */
export function schema() {
  return parseJson(readFileSync(SCHEMA_PATH, "utf8"));
}

/** Which config files the repository has. @param {string} repoDir */
export function configFiles(repoDir) {
  return [CONFIG_FILE, LEGACY_CONFIG].filter((f) => existsSync(join(repoDir, f)));
}

/**
 * Validate a value against the subset of JSON Schema the package's schema uses: type (with
 * arrays of types), properties, additionalProperties (false or a schema), patternProperties,
 * required, items, enum, minimum, maximum. Returns the problems as "path: what".
 * @param {any} value @param {any} [sch] @param {string} [path]
 * @returns {string[]}
 */
export function validateConfig(value, sch = schema(), path = "") {
  /** @type {string[]} */
  const problems = [];
  const at = path || "(root)";
  const typeOf = (/** @type {any} */ v) =>
    v === null ? "null" : Array.isArray(v) ? "array" : Number.isInteger(v) ? "integer" : typeof v;
  if (sch.type) {
    const types = Array.isArray(sch.type) ? sch.type : [sch.type];
    const t = typeOf(value);
    const ok = types.some(
      (/** @type {string} */ x) => x === t || (x === "number" && t === "integer"),
    );
    if (!ok) return [`${at}: expected ${types.join(" or ")}, got ${t}`];
  }
  if (sch.enum && !sch.enum.includes(value))
    problems.push(`${at}: expected one of ${sch.enum.join(", ")}`);
  if (typeof value === "number") {
    if (typeof sch.minimum === "number" && value < sch.minimum)
      problems.push(`${at}: below ${sch.minimum}`);
    if (typeof sch.maximum === "number" && value > sch.maximum)
      problems.push(`${at}: above ${sch.maximum}`);
  }
  if (Array.isArray(value) && sch.items)
    value.forEach((v, i) => problems.push(...validateConfig(v, sch.items, `${path}[${i}]`)));
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const k of sch.required || []) if (!(k in value)) problems.push(`${at}: missing ${k}`);
    const patterns = Object.entries(sch.patternProperties || {}).map(([p, s]) => [
      new RegExp(p),
      s,
    ]);
    for (const [k, v] of Object.entries(value)) {
      const sub = sch.properties?.[k];
      const pat = patterns.find(([re]) => /** @type {RegExp} */ (re).test(k));
      const child = path ? `${path}.${k}` : k;
      if (sub) problems.push(...validateConfig(v, sub, child));
      else if (pat) problems.push(...validateConfig(v, pat[1], child));
      else if (sch.additionalProperties === false) problems.push(`${child}: not a known key`);
      else if (sch.additionalProperties && typeof sch.additionalProperties === "object")
        problems.push(...validateConfig(v, sch.additionalProperties, child));
    }
  }
  return problems;
}

/** The problems of the repository's config files, each validated on its own. @param {string} repoDir */
export function configProblems(repoDir) {
  /** @type {string[]} */
  const problems = [];
  for (const f of configFiles(repoDir)) {
    try {
      const v = readJsonFile(repoDir, f);
      problems.push(...validateConfig(v).map((p) => `${f} · ${p}`));
    } catch (e) {
      problems.push(`${f} · not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return problems;
}

/**
 * Move `.claude/adoption.json` to the root as `abatty.config.json` (merged over an existing root
 * file, the root's values winning), with the `$schema` line. Returns what happened.
 * @param {string} repoDir @param {{ dryRun?: boolean }} [o]
 */
export function migrateConfig(repoDir, o = {}) {
  const legacy = readJsonFile(repoDir, LEGACY_CONFIG);
  if (!legacy) return { moved: false, reason: `no ${LEGACY_CONFIG} to move` };
  const root = readJsonFile(repoDir, CONFIG_FILE) || {};
  const merged = { $schema: SCHEMA_URL, ...legacy, ...root };
  delete merged.$comment;
  if (!o.dryRun) {
    writeJsonFile(repoDir, CONFIG_FILE, merged);
    rmSync(join(repoDir, LEGACY_CONFIG));
  }
  return {
    moved: true,
    reason: `${LEGACY_CONFIG} → ${CONFIG_FILE}${root && Object.keys(root).length ? " (merged over the root file, its values kept)" : ""}; commit both, the hooks read the root file from here on`,
  };
}
