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
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { readJsonFile, readPackage, writeJsonFile } from "./repo.mjs";

export const TEMPLATES = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "templates");

/** @typedef {{ file: string, action: "written" | "kept" | "overwritten" | "merged" }} InitEvent */

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
 */
export function initRepo(o) {
  const { repoDir, preset, force = false, dryRun = false } = o;
  /** @type {InitEvent[]} */
  const events = [];
  const put = (
    /** @type {string} */ rel,
    /** @type {string} */ content,
    { merge } = { merge: false },
  ) => {
    const target = join(repoDir, rel);
    const exists = existsSync(target);
    if (exists && !force) {
      events.push({ file: rel, action: "kept" });
      return false;
    }
    if (!dryRun) {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, content);
    }
    events.push({ file: rel, action: exists ? "overwritten" : merge ? "merged" : "written" });
    return true;
  };
  const tpl = (/** @type {string} */ rel) => readFileSync(join(TEMPLATES, rel), "utf8");

  // 1. The harness: hooks, skill, agents, settings, the night's MCP config.
  for (const f of walk(join(TEMPLATES, "harness", "hooks")))
    put(`.claude/hooks/${f}`, tpl(`harness/hooks/${f}`));
  put(".claude/skills/adopt-standards/SKILL.md", tpl("harness/skills/adopt-standards/SKILL.md"));
  for (const f of ["standards-reviewer.md", "standards-adopter.md"])
    put(`.claude/agents/${f}`, tpl(`harness/agents/${f}`));
  put(".claude/settings.json", tpl("harness/settings.project.json"));
  put(".claude/mcp.night.json", tpl("harness/mcp.night.json"));
  for (const r of preset.rules)
    if (existsSync(join(TEMPLATES, "harness", "rules", r)))
      put(`.claude/rules/${r}`, tpl(`harness/rules/${r}`));

  // 2. adoption.json: the template with the preset's commands and paths; an existing one is
  //    merged key by key (the repository's own values win), because it is the file the hooks trust.
  const base = JSON.parse(tpl("harness/adoption.json"));
  delete base.$comment;
  const existing = readJsonFile(repoDir, ".claude/adoption.json");
  const merged = {
    ...base,
    ...preset.adoption,
    ...(existing || {}),
    commands: {
      ...base.commands,
      ...(preset.adoption.commands || {}),
      ...(existing?.commands || {}),
    },
  };
  if (!existing || force) {
    if (!dryRun) writeJsonFile(repoDir, ".claude/adoption.json", merged);
    events.push({ file: ".claude/adoption.json", action: existing ? "overwritten" : "written" });
  } else {
    const keys = Object.keys(merged).filter((k) => !(k in existing));
    if (keys.length) {
      if (!dryRun) writeJsonFile(repoDir, ".claude/adoption.json", merged);
      events.push({ file: ".claude/adoption.json", action: "merged" });
    } else events.push({ file: ".claude/adoption.json", action: "kept" });
  }

  // 3. The tooling: the import graph and dead code.
  if (preset.tooling.dependencyCruiser)
    put(".dependency-cruiser.cjs", tpl("tooling/.dependency-cruiser.cjs"));
  if (preset.tooling.knip) put("knip.jsonc", tpl("tooling/knip.jsonc"));

  // 4. The pre-push hook that calls the gate, and the scripts.
  put(
    ".githooks/pre-push",
    "#!/bin/sh\n# One implementation, two callers: this hook and `npm run gate`. Installed by `npm run hooks:install`.\nnpm run -s gate\n",
  );
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

  // 5. The ignore files.
  appendLines(repoDir, ".gitignore", [".claude/night/"], events, dryRun);
  appendLines(
    repoDir,
    ".prettierignore",
    [".dependency-cruiser-known-violations.json", ".claude/night/"],
    events,
    dryRun,
  );

  // 6. Day-0 documents, only when absent.
  put("CLAUDE.md", tpl("harness/agent-context.md.template"));
  put(
    "CHANGELOG.md",
    "# Changelog\n\nKeep a Changelog, SemVer. Every commit that touches source, tests, scripts, CI, migrations or docs adds a line under Unreleased in the same commit (CHANGE-1, CHANGE-2).\n\n## [Unreleased]\n\n### Added\n\n- The engineering standard's instrument: harness, gate, import graph, dead code (`abatty init`).\n",
  );
  put(
    "docs/README.md",
    "# Documentation index\n\nEvery document under docs/ is listed here (DOC-3): what it is for, its category and status.\n\n| Document | What it is for | Category | Status |\n|---|---|---|---|\n| `STANDARDS_PROGRESS.md` | The standards scoreboard: numbers only, dated; one log entry per deliberate change of a floor | governance | living |\n| `ADOPTION_DECISIONS.md` | The decisions an unattended adoption night takes alone: date, phase, default taken, the alternative | governance | living |\n",
  );
  put(
    "docs/STANDARDS_PROGRESS.md",
    '---\ntitle: "Standards progress"\ndescription: "The scoreboard of the engineering standard on this repository: what each metric measures, the ratchet that holds it, the phases open, and the dated log of every deliberate change of a floor. Numbers only, never \'improved\'."\ncategory: governance\nstatus: living\naudience: ["developer", "agent"]\ntags: ["standards", "ratchet", "scoreboard"]\nrelated: ["./README.md", "./ADOPTION_DECISIONS.md"]\n---\n\n# Standards progress\n\n## Scoreboard\n\n| Metric | Day 0 | Now | Target | Held by | Rule |\n|---|---|---|---|---|---|\n\n## Phase status\n\n| # | Phase | Status |\n|---|---|---|\n\n## Log\n\n',
  );
  put(
    "docs/ADOPTION_DECISIONS.md",
    '---\ntitle: "Adoption decisions"\ndescription: "The decisions taken alone by the unattended adoption nights (/adopt-standards): date, phase, situation, the default taken, the alternative set aside, what the morning must re-read."\ncategory: governance\nstatus: living\naudience: ["developer", "agent"]\ntags: ["standards", "adoption", "decisions"]\nrelated: ["./README.md", "./STANDARDS_PROGRESS.md"]\n---\n\n# Adoption decisions\n\n',
  );

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
