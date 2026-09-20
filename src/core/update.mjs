/**
 * `abatty update`: the harness brought to the package's version without losing the
 * repository's own edits - a three-way merge per file between the copy the package installed
 * (the base), the repository's copy (yours) and the package's copy now (theirs).
 *
 * `init` and `update` write `.claude/harness.lock.json` (the package version and the hash of
 * every shipped file as installed, formatting-blind) and keep the installed copies under
 * `.abatty/harness/<version>/` (ignored by git: the base of the next merge, on this machine).
 * Per file: untouched since the install → the new version; edited while the package did not
 * change it → yours, kept; both changed → `git merge-file`, and when the merge conflicts the
 * new version is written beside yours as `<file>.abatty-new` and nothing of yours is touched.
 * The config files are merged key by key (a key the template gained is added, a value you set
 * is never replaced) and the package scripts are added where absent, as `init` does.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { TEMPLATES, makeExecutable } from "./init.mjs";
import { normalise, shippedFiles } from "./doctor.mjs";
import { shimExecutable } from "./shim.mjs";
import {
  CONFIG_FILE,
  LEGACY_CONFIG,
  dependencyNames,
  readJsonFile,
  readPackage,
  writeJsonFile,
} from "./repo.mjs";
import { presetRules } from "../presets/index.mjs";
import { localToday } from "./today.mjs";

export const LOCK = ".claude/harness.lock.json";
export const BASE_DIR = ".abatty/harness";

/**
 * @typedef {{ abatty: string, installedAt: string, files: Record<string, string> }} Lock
 * @typedef {"in step" | "updated" | "added" | "kept" | "merged" | "conflict" | "overwritten"} UpdateAction
 * @typedef {{ file: string, action: UpdateAction, detail?: string }} UpdateEvent
 */

/** The package's own version. */
export function packageVersion() {
  return String(readJsonFile(join(TEMPLATES, ".."), "package.json")?.version || "0.0.0");
}

/** Formatting-blind hash of a text. @param {string} text */
export function hashOf(text) {
  return createHash("sha256").update(normalise(text)).digest("hex");
}

/**
 * The files the package installs and keeps in step: the shipped pairs plus the preset's rules
 * THAT APPLY to this repository. A rule file about a library the repository does not use is not
 * installed, so it is not managed either: without `deps` this listed it, `update` added it back
 * and `doctor` called it missing, which is the leak seen from the other side.
 * @param {import("../presets/index.mjs").Preset | null} preset @param {Set<string>} [deps]
 * @returns {[string, string][]}
 */
export function managedFiles(preset, deps = new Set()) {
  const pairs = shippedFiles();
  for (const r of presetRules(preset, deps))
    if (r.applies && existsSync(join(TEMPLATES, "harness", "rules", r.file)))
      pairs.push([`harness/rules/${r.file}`, `.claude/rules/${r.file}`]);
  return pairs;
}

/** The lock as the repository has it, or null. @param {string} repoDir @returns {Lock | null} */
export function readLock(repoDir) {
  try {
    const l = readJsonFile(repoDir, LOCK);
    return l && typeof l.abatty === "string" && l.files ? l : null;
  } catch {
    return null;
  }
}

/**
 * Record the package's version and, per managed file, the copy that is actually installed here -
 * the base of the next three-way merge. A file whose copy in the repository is the package's is
 * recorded at that hash, with the shipped text kept beside it as the base. A file that differs
 * (init keeps an existing file, and a repository edits its hooks) was NOT installed at this
 * version, so its earlier entry and its earlier base are carried over untouched; a file with no
 * earlier entry is left out, and `update` then has no ancestor to merge from and writes the
 * package's version beside it rather than over it. Recording the package's hash for every file
 * was the bug: a file the repository kept read as its own edit that the package never changed,
 * and `update` refused to deliver a real change to it for as long as the repository lived.
 * @param {string} repoDir @param {import("../presets/index.mjs").Preset | null} preset @param {string} [version]
 */
export function writeLock(repoDir, preset, version = packageVersion()) {
  /** @type {Record<string, string>} */
  const files = {};
  const previous = readLock(repoDir);
  for (const [tpl, rel] of managedFiles(preset, dependencyNames(repoDir))) {
    const text = readFileSync(join(TEMPLATES, tpl), "utf8");
    const target = join(repoDir, rel);
    const installed = existsSync(target) && hashOf(readFileSync(target, "utf8")) === hashOf(text);
    if (!installed) {
      const carried = previous?.files?.[rel];
      if (!carried) continue;
      files[rel] = carried;
      // The base is looked up under the lock's version, so the copy this file was installed from
      // moves with the entry that names it.
      const was = join(repoDir, BASE_DIR, previous.abatty, rel);
      const base = join(repoDir, BASE_DIR, version, rel);
      if (existsSync(was) && !existsSync(base)) {
        mkdirSync(dirname(base), { recursive: true });
        writeFileSync(base, readFileSync(was, "utf8"));
      }
      continue;
    }
    files[rel] = hashOf(text);
    const base = join(repoDir, BASE_DIR, version, rel);
    mkdirSync(dirname(base), { recursive: true });
    writeFileSync(base, text);
  }
  /** @type {Lock} */
  const lock = { abatty: version, installedAt: localToday(), files };
  writeJsonFile(repoDir, LOCK, lock);
  return lock;
}

/**
 * Three-way merge with git: yours, the base, theirs. Returns the merged text and the number of
 * conflicts (0 is clean), or null when git could not merge at all.
 * @param {string} ours @param {string} base @param {string} theirs
 */
export function mergeFile(ours, base, theirs) {
  const dir = mkdtempSync(join(tmpdir(), "abatty-merge-"));
  try {
    const p = (/** @type {string} */ n, /** @type {string} */ t) => {
      const f = join(dir, n);
      writeFileSync(f, t);
      return f;
    };
    const r = spawnSync(
      "git",
      [
        "merge-file",
        "-p",
        "-L",
        "yours",
        "-L",
        "installed",
        "-L",
        "abatty",
        p("ours", ours),
        p("base", base),
        p("theirs", theirs),
      ],
      { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
    );
    if (r.status === null || r.status < 0 || r.status === 255) return null;
    return { text: r.stdout, conflicts: r.status };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Add to `target` every key `source` has and it lacks, recursively for plain objects; a value
 * the target has is never replaced. Returns the keys added, dotted.
 * @param {Record<string, any>} target @param {Record<string, any>} source @param {string} [prefix]
 */
export function addMissingKeys(target, source, prefix = "") {
  /** @type {string[]} */
  const added = [];
  for (const [k, v] of Object.entries(source)) {
    if (k.startsWith("$")) continue;
    if (!(k in target)) {
      target[k] = v;
      added.push(prefix + k);
    } else if (isObject(v) && isObject(target[k]))
      added.push(...addMissingKeys(target[k], v, `${prefix}${k}.`));
  }
  return added;
}
/** @param {unknown} v */
const isObject = (v) => Boolean(v) && typeof v === "object" && !Array.isArray(v);

/**
 * Update the harness. Returns the events, the version the repository had and the one it has now.
 * @param {{ repoDir: string, preset: import("../presets/index.mjs").Preset | null, force?: boolean, dryRun?: boolean, version?: string }} o
 */
export function updateRepo(o) {
  const { repoDir, preset, force = false, dryRun = false } = o;
  const version = o.version || packageVersion();
  const lock = readLock(repoDir);
  /** @type {UpdateEvent[]} */
  const events = [];
  /** @param {string} rel @param {string} text */
  const write = (rel, text) => {
    if (dryRun) return;
    mkdirSync(dirname(join(repoDir, rel)), { recursive: true });
    writeFileSync(join(repoDir, rel), text);
    if (shimExecutable(rel)) makeExecutable(join(repoDir, rel));
  };

  for (const [tpl, rel] of managedFiles(preset, dependencyNames(repoDir))) {
    const theirs = readFileSync(join(TEMPLATES, tpl), "utf8");
    const target = join(repoDir, rel);
    if (!existsSync(target)) {
      write(rel, theirs);
      events.push({ file: rel, action: "added" });
      continue;
    }
    const ours = readFileSync(target, "utf8");
    const hOurs = hashOf(ours);
    const hTheirs = hashOf(theirs);
    const hBase = lock?.files?.[rel];
    if (hOurs === hTheirs) {
      events.push({ file: rel, action: "in step" });
      continue;
    }
    if (force) {
      write(rel, theirs);
      events.push({ file: rel, action: "overwritten" });
      continue;
    }
    if (hBase && hOurs === hBase) {
      write(rel, theirs);
      events.push({ file: rel, action: "updated" });
      continue;
    }
    if (hBase && hTheirs === hBase) {
      events.push({
        file: rel,
        action: "kept",
        detail: "your edit; the package did not change this file",
      });
      continue;
    }
    // Both changed (or no lock): the three-way merge, when the installed copy is on this machine.
    const basePath = lock ? join(repoDir, BASE_DIR, lock.abatty, rel) : "";
    const base = basePath && existsSync(basePath) ? readFileSync(basePath, "utf8") : null;
    const merged = base !== null ? mergeFile(ours, base, theirs) : null;
    if (merged && merged.conflicts === 0) {
      write(rel, merged.text);
      events.push({
        file: rel,
        action: "merged",
        detail: "your edit and the package's change, both kept",
      });
      continue;
    }
    write(`${rel}.abatty-new`, theirs);
    events.push({
      file: rel,
      action: "conflict",
      detail:
        base === null
          ? `edited here and changed by the package, and the installed copy is not on this machine (${BASE_DIR}/${lock?.abatty || "?"}) to merge from: the new version is beside yours as ${rel}.abatty-new`
          : `your edit and the package's change touch the same lines: the new version is beside yours as ${rel}.abatty-new; merge by hand, then delete it`,
    });
  }

  // The config the hooks trust: keys the template gained are added, values you set are never replaced.
  const adoptionRel = existsSync(join(repoDir, CONFIG_FILE)) ? CONFIG_FILE : LEGACY_CONFIG;
  const template = JSON.parse(readFileSync(join(TEMPLATES, "harness/adoption.json"), "utf8"));
  const adoption = readJsonFile(repoDir, adoptionRel);
  if (adoption) {
    const added = addMissingKeys(adoption, template);
    // The version pin the config carries follows the package: the one human-readable record
    // of what this repository adopted.
    const pinned = adoption.abatty !== version;
    if (pinned) adoption.abatty = version;
    if (added.length || pinned) {
      if (!dryRun) writeJsonFile(repoDir, adoptionRel, adoption);
      events.push({
        file: adoptionRel,
        action: "merged",
        detail: [added.length ? `added ${added.join(", ")}` : "", pinned ? `abatty ${version}` : ""]
          .filter(Boolean)
          .join("; "),
      });
    } else events.push({ file: adoptionRel, action: "in step" });
  }
  // The scripts, as init adds them: absent ones only.
  if (preset && existsSync(join(repoDir, "package.json"))) {
    const pkg = readPackage(repoDir);
    const scripts = { ...(pkg.scripts || {}) };
    const added = Object.entries(preset.scripts).filter(([k]) => !(k in scripts));
    for (const [k, v] of added) scripts[k] = v;
    if (added.length) {
      if (!dryRun) writeJsonFile(repoDir, "package.json", { ...pkg, scripts });
      events.push({
        file: "package.json",
        action: "merged",
        detail: `added ${added.map(([k]) => k).join(", ")}`,
      });
    } else events.push({ file: "package.json", action: "in step" });
  }
  if (!dryRun) writeLock(repoDir, preset, version);
  return {
    events,
    from: lock?.abatty || null,
    to: version,
    conflicts: events.filter((e) => e.action === "conflict").length,
  };
}
