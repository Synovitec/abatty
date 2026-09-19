/**
 * `abatty init`: the instrument for a repository, from the templates and the preset.
 *
 * Writes the harness (.claude/: settings, adoption.json, mcp.night.json, hooks, skill, agents,
 * the preset's rules), the tooling (.dependency-cruiser.cjs, knip.jsonc), the hook and the
 * scripts, and the day-0 documents that do not exist yet (CLAUDE.md, CHANGELOG.md, docs/README.md,
 * docs/STANDARDS_PROGRESS.md, docs/ADOPTION_DECISIONS.md). An existing file is KEPT and reported
 * (the repository's own edits are the point of `doctor`'s drift check), unless --force.
 * Dependencies are named, never installed: a dependency change is a decision.
 */
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CONFIG_FILE,
  LEGACY_CONFIG,
  dependencyNames,
  readJsonFile,
  readPackage,
  writeJsonFile,
} from "./repo.mjs";
import { SCHEMA_URL } from "./config.mjs";
import { PRIMARY, configuredAdapters, toMdc } from "../agents/index.mjs";
import { presetRules } from "../presets/index.mjs";
import { writeCi } from "../cli/ci.mjs";
import { LOCK, packageVersion, writeLock } from "./update.mjs";

export const TEMPLATES = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "templates");

/** @typedef {{ file: string, action: "written" | "kept" | "overwritten" | "merged" | "n/a", detail?: string }} InitEvent */

/** @param {unknown} v true for a JSON object, which merges; an array is a value and is kept whole. */
const isObject = (v) => Boolean(v) && typeof v === "object" && !Array.isArray(v);

/**
 * The defaults under the repository's own values, at every depth: a key the repository set wins,
 * a key it never set is added. Shallow was the bug - a repository that had written one key of
 * `files` lost the five the template names, and the harness self-test then failed on the state
 * file it could no longer find.
 * @param {any} base @param {any} own
 */
function mergeConfig(base, own) {
  if (own === undefined) return base;
  if (!isObject(base) || !isObject(own)) return own;
  const out = { ...base };
  for (const [k, v] of Object.entries(own)) out[k] = k in base ? mergeConfig(base[k], v) : v;
  return out;
}

/** @param {any} v @returns {any} the same object with its keys in one order, so equality does not read as a change. */
const ordered = (v) =>
  Array.isArray(v)
    ? v.map(ordered)
    : isObject(v)
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, ordered(v[k])]),
        )
      : v;

/** @param {any} a @param {any} b the two configs carry the same values, whatever order they are written in. */
const sameConfig = (a, b) => JSON.stringify(ordered(a)) === JSON.stringify(ordered(b));

/**
 * The executable bit on a file git must be able to run. git skips a hook that is not executable
 * and says so only as a hint, so a pre-push hook written 644 means the gate never runs and a red
 * push looks like a green one. Windows carries the bit in the index rather than the filesystem;
 * `git update-index --chmod=+x` is what records it there, and a failure is not fatal here because
 * the file may not be tracked yet.
 * @param {string} target
 */
function makeExecutable(target) {
  try {
    chmodSync(target, 0o755);
  } catch {
    /* a filesystem without modes; the index below is what git reads */
  }
  spawnSync("git", ["update-index", "--chmod=+x", "--", relative(dirname(target), target)], {
    cwd: dirname(target),
    stdio: "ignore",
  });
}

/** @param {string} dir @param {string} [base] @param {string[]} [acc] */
function walk(dir, base = dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, base, acc);
    else acc.push(relative(base, p).split("\\").join("/"));
  }
  return acc;
}

/**
 * @param {object} o
 * @param {string} o.repoDir
 * @param {import("../presets/index.mjs").Preset} o.preset
 * @param {boolean} [o.force]
 * @param {boolean} [o.dryRun]
 * @param {string[]} [o.agents] the adapters to write for (the config's `agents` when absent)
 * @param {string[]} [o.ci] the CI providers to generate for (the config's `ci.providers` when absent)
 * @param {string} [o.stage] the stage to record in the config (design, build, run)
 * @param {{ path: string, preset: import("../presets/index.mjs").Preset | null }[]} [o.workspaces] the workspaces with a preset: each gets its preset's scripts in its own package.json
 */
export function initRepo(o) {
  const { repoDir, preset, force = false, dryRun = false } = o;
  /** @type {InitEvent[]} */
  const events = [];
  const put = (
    /** @type {string} */ rel,
    /** @type {string} */ content,
    { merge, executable } = { merge: false, executable: false },
  ) => {
    const target = join(repoDir, rel);
    const exists = existsSync(target);
    if (exists && !force) {
      // A git hook that is not executable is silently skipped by git, so the mode is repaired
      // even on a file that is kept: that is how a repository pushed past a red gate for days.
      if (executable && !dryRun) makeExecutable(target);
      events.push({ file: rel, action: "kept" });
      return false;
    }
    if (!dryRun) {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, content);
      if (executable) makeExecutable(target);
    }
    events.push({ file: rel, action: exists ? "overwritten" : merge ? "merged" : "written" });
    return true;
  };
  const tpl = (/** @type {string} */ rel) => readFileSync(join(TEMPLATES, rel), "utf8");

  // 1. The harness: hooks, skill, agents, settings, the night's MCP config.
  for (const f of walk(join(TEMPLATES, "harness", "hooks")))
    put(`.claude/hooks/${f}`, tpl(`harness/hooks/${f}`));
  // The skill, in the open agent-skills format, at every configured adapter's skills folder.
  const skillText = tpl("skills/adopt-standards/SKILL.md");
  const skillAdapters = configuredAdapters(
    o.agents?.length
      ? { agents: o.agents }
      : readJsonFile(repoDir, CONFIG_FILE) || readJsonFile(repoDir, LEGACY_CONFIG),
  );
  for (const a of skillAdapters.adapters.length ? skillAdapters.adapters : [PRIMARY])
    if (a.skillsDir) put(`${a.skillsDir}/adopt-standards/SKILL.md`, skillText);
  for (const f of ["standards-reviewer.md", "standards-adopter.md"])
    put(`.claude/agents/${f}`, tpl(`harness/agents/${f}`));
  put(".claude/settings.json", tpl("harness/settings.project.json"));
  put(".claude/mcp.night.json", tpl("harness/mcp.night.json"));
  // Gated the way the catalog's rules are: a file about one library is not written where the
  // repository does not depend on it, and the skip is reported rather than silent.
  const rules = presetRules(preset, dependencyNames(repoDir));
  for (const r of rules) {
    if (!existsSync(join(TEMPLATES, "harness", "rules", r.file))) continue;
    if (r.applies) put(`.claude/rules/${r.file}`, tpl(`harness/rules/${r.file}`));
    else
      events.push({
        file: `.claude/rules/${r.file}`,
        action: "n/a",
        detail: `no ${r.needs.slice(0, 3).join(", ")} in this repository`,
      });
  }

  // 2. The config: abatty.config.json at the root, the template with the preset's commands and
  //    paths; a repository that still keeps it at the older place (.claude/adoption.json) has that
  //    file merged key by key (its own values win) until `abatty config --migrate` moves it. It is
  //    the file the hooks trust, so an existing value is never replaced.
  const base = JSON.parse(tpl("harness/adoption.json"));
  delete base.$comment;
  const legacy = readJsonFile(repoDir, LEGACY_CONFIG);
  const configRel = legacy && !readJsonFile(repoDir, CONFIG_FILE) ? LEGACY_CONFIG : CONFIG_FILE;
  const existing = readJsonFile(repoDir, configRel);
  const defaults = {
    ...mergeConfig(
      { ...(configRel === CONFIG_FILE ? { $schema: SCHEMA_URL } : {}), ...base },
      preset.adoption,
    ),
    stack: preset.id,
    // The version this repository follows, recorded where a human reads it; update moves it.
    abatty: packageVersion(),
    ...(o.stage ? { stage: o.stage } : {}),
  };
  const merged = mergeConfig(defaults, existing || {});
  if (!existing || force) {
    if (!dryRun) writeJsonFile(repoDir, configRel, { ...merged, stack: preset.id });
    events.push({ file: configRel, action: existing ? "overwritten" : "written" });
  } else if (!sameConfig(merged, existing)) {
    if (!dryRun) writeJsonFile(repoDir, configRel, merged);
    events.push({ file: configRel, action: "merged" });
  } else events.push({ file: configRel, action: "kept" });

  // 3. The tooling: the import graph and dead code.
  if (preset.tooling.dependencyCruiser)
    put(".dependency-cruiser.cjs", tpl("tooling/.dependency-cruiser.cjs"));
  if (preset.tooling.knip) put("knip.jsonc", tpl("tooling/knip.jsonc"));

  // 4. The pre-push hook that calls the gate, and the scripts.
  put(
    ".githooks/pre-commit",
    "#!/bin/sh\n# The secret scan over the staged files, the same implementation the gate and CI run. Installed by `npm run hooks:install`.\nnpx abatty secrets --staged\n",
    { merge: false, executable: true },
  );
  put(
    ".githooks/pre-push",
    "#!/bin/sh\n# One implementation, two callers: this hook and `npm run gate`. Installed by `npm run hooks:install`.\nnpm run -s gate\n",
    { merge: false, executable: true },
  );
  // The scrub refuses a message that names a tool; a repository that did not opt in gets a hook
  // that is a no-op, so the hook is the same file either way and `scrub.enabled` decides.
  put(
    ".githooks/commit-msg",
    '#!/bin/sh\n# Refuses a commit message that names a tool where scrub.enabled is on; a no-op otherwise.\nnpx abatty scrub --message "$1"\n',
    { merge: false, executable: true },
  );
  // A repository without a package (documents alone) gets a private one: `npm run gate` and
  // `npm run hooks:install` are how the instrument is called, whatever the stack.
  if (!existsSync(join(repoDir, "package.json"))) {
    if (!dryRun)
      writeJsonFile(repoDir, "package.json", {
        name: basename(repoDir),
        private: true,
        scripts: { ...preset.scripts },
      });
    events.push({ file: "package.json", action: "written" });
  }
  const pkg = readPackage(repoDir);
  if (existsSync(join(repoDir, "package.json"))) {
    const scripts = { ...(pkg.scripts || {}) };
    let added = 0;
    for (const [k, v] of Object.entries(preset.scripts))
      if (!(k in scripts) || force) {
        scripts[k] = v;
        added++;
      }
    if (added) {
      if (!dryRun) writeJsonFile(repoDir, "package.json", { ...pkg, scripts });
      events.push({ file: "package.json", action: "merged" });
    } else events.push({ file: "package.json", action: "kept" });
  }

  // 4b. A workspace with a preset of its own gets that preset's scripts in its own package.json,
  //     the gate's steps running there; the gate, the ratchet and the hooks stay at the root.
  for (const w of o.workspaces || []) {
    if (!w.preset) continue;
    const wp = readPackage(join(repoDir, w.path));
    const ws = { ...(wp.scripts || {}) };
    let n = 0;
    for (const [k, v] of Object.entries(w.preset.scripts))
      if (
        !["gate", "gate:fast", "standards", "standards:baseline", "hooks:install"].includes(k) &&
        (!(k in ws) || force)
      ) {
        ws[k] = v;
        n++;
      }
    if (n) {
      if (!dryRun) writeJsonFile(join(repoDir, w.path), "package.json", { ...wp, scripts: ws });
      events.push({ file: `${w.path}/package.json`, action: "merged" });
    } else events.push({ file: `${w.path}/package.json`, action: "kept" });
  }

  // 5. The ignore files.
  appendLines(repoDir, ".gitignore", [".claude/night/", ".abatty/"], events, dryRun);
  appendLines(
    repoDir,
    ".prettierignore",
    [".dependency-cruiser-known-violations.json", ".claude/night/"],
    events,
    dryRun,
  );

  // 6. Day-0 documents, only when absent. The context file goes to every configured adapter:
  //    the primary's name, and AGENTS.md for the others, the primary importing it when both
  //    exist so there is one source; a Cursor adapter gets the preset's rules as .mdc files.
  const configured = configuredAdapters(o.agents?.length ? { agents: o.agents } : merged);
  const adapters = configured.adapters.length ? configured.adapters : [PRIMARY];
  const others = adapters.filter((a) => a.id !== PRIMARY.id);
  // The interoperable file is written always, not only when another adapter asked for it. It
  // costs one file, and it is the only way an agent this repository never configured can read the
  // context; the primary's file imports it so there is one source rather than two copies that
  // drift. A rule that reads the context follows that import.
  const context = tpl("harness/agent-context.md.template");
  put("AGENTS.md", context);
  put(PRIMARY.contextFile, "@AGENTS.md\n");
  for (const a of others)
    if (a.rulesDir && a.rulesFormat === "mdc")
      for (const r of rules)
        if (r.applies && existsSync(join(TEMPLATES, "harness", "rules", r.file)))
          put(
            `${a.rulesDir}/${r.file.replace(/\.md$/, ".mdc")}`,
            toMdc(tpl(`harness/rules/${r.file}`)),
          );
  put(
    "CHANGELOG.md",
    "# Changelog\n\nKeep a Changelog, SemVer. Every commit that touches source, tests, scripts, CI, migrations or docs adds a line under Unreleased in the same commit (CHANGE.1, CHANGE.2).\n\n## [Unreleased]\n\n### Added\n\n- The engineering standard's instrument: harness, gate, import graph, dead code (`abatty init`).\n",
  );
  put(
    "docs/README.md",
    "# Documentation index\n\nEvery document under docs/ is listed here (DOC.3): what it is for, its category and status.\n\n| Document | What it is for | Category | Status |\n|---|---|---|---|\n| `STANDARDS_PROGRESS.md` | The standards scoreboard: numbers only, dated; one log entry per deliberate change of a floor | governance | living |\n| `ADOPTION_DECISIONS.md` | The decisions an unattended adoption night takes alone: date, phase, default taken, the alternative | governance | living |\n",
  );
  put(
    "docs/STANDARDS_PROGRESS.md",
    '---\ntitle: "Standards progress"\ndescription: "The scoreboard of the engineering standard on this repository: what each metric measures, the ratchet that holds it, the phases open, and the dated log of every deliberate change of a floor. Numbers only, never \'improved\'."\ncategory: governance\nstatus: living\naudience: ["developer", "agent"]\ntags: ["standards", "ratchet", "scoreboard"]\nrelated: ["./README.md", "./ADOPTION_DECISIONS.md"]\n---\n\n# Standards progress\n\n## Scoreboard\n\n| Metric | Day 0 | Now | Target | Held by | Rule |\n|---|---|---|---|---|---|\n\n## Phase status\n\n| # | Phase | Status |\n|---|---|---|\n\n## Log\n\n',
  );
  put(
    "docs/ADOPTION_DECISIONS.md",
    '---\ntitle: "Adoption decisions"\ndescription: "The decisions taken alone by the unattended adoption nights (/adopt-standards): date, phase, situation, the default taken, the alternative set aside, what the morning must re-read."\ncategory: governance\nstatus: living\naudience: ["developer", "agent"]\ntags: ["standards", "adoption", "decisions"]\nrelated: ["./README.md", "./STANDARDS_PROGRESS.md"]\n---\n\n# Adoption decisions\n\n',
  );

  // 6b. CI from the gate, for the providers the repository names (init --ci, or ci.providers).
  const providers = o.ci?.length ? o.ci : (merged.ci?.providers || []).map(String);
  if (providers.length && !dryRun)
    for (const e of writeCi({
      repoDir,
      preset,
      providers,
      base: String(merged.baseBranch || "main"),
    }))
      events.push({ file: e.file, action: e.action === "written" ? "written" : "kept" });

  // 7. The lock: the package version and the hash of every shipped file as installed, and the
  //    installed copies under .abatty/harness/<version>/ - what `abatty update` merges from.
  if (!dryRun) writeLock(repoDir, preset);
  events.push({ file: LOCK, action: "written" });

  const missingDeps = preset.devDependencies.filter(
    (d) => !(pkg.devDependencies || {})[d] && !(pkg.dependencies || {})[d],
  );
  return { events, missingDeps, preset };
}

/** @param {string} repoDir @param {string} rel @param {string[]} lines @param {InitEvent[]} events @param {boolean} dryRun */
function appendLines(repoDir, rel, lines, events, dryRun) {
  const target = join(repoDir, rel);
  const current = existsSync(target) ? readFileSync(target, "utf8") : "";
  const missing = lines.filter((l) => !current.split(/\r?\n/).includes(l));
  if (!missing.length) {
    events.push({ file: rel, action: "kept" });
    return;
  }
  if (!dryRun)
    writeFileSync(
      target,
      (current ? current.replace(/\s*$/, "\n") : "") + missing.join("\n") + "\n",
    );
  events.push({ file: rel, action: current ? "merged" : "written" });
}
