/**
 * `init` and `update`: what the package writes into a repository the first time, and how it is
 * brought to the package's version afterwards without losing the repository's own edits.
 */
import { join } from "node:path";
import { detectWorkspaces } from "../presets/workspaces.mjs";
import { initRepo } from "../core/init.mjs";
import { updateRepo } from "../core/update.mjs";
import { EXIT } from "./exit.mjs";
import { readAdoption } from "../core/repo.mjs";
import * as t from "../ui/term.mjs";

/**
 * @param {import("./ratchet.mjs").CliContext} cx @param {import("../presets/index.mjs").Preset} preset
 */
export async function initCommand(cx, preset) {
  const { dir, opt, flag, out, err, VERSION } = cx;
  const r = initRepo({
    repoDir: dir,
    preset,
    force: flag("--force"),
    dryRun: flag("--dry-run"),
    stage: opt("--stage") || undefined,
    workspaces: detectWorkspaces(dir, readAdoption(dir)),
    agents: opt("--agent")
      ? opt("--agent")
          .split(/[\s,]+/)
          .filter(Boolean)
      : [],
    ci: opt("--ci")
      ? opt("--ci")
          .split(/[\s,]+/)
          .filter(Boolean)
      : [],
  });
  out(
    `\n${t.banner(VERSION)}  ${t.bold("init")} ${t.gray("·")} ${preset.name}${preset.proven ? t.gray(` · proven by ${preset.proven}`) : t.yellow(" · not yet proven by a repository: the first one names what is wrong")}${flag("--dry-run") ? t.gray(" · dry run") : ""}\n\n`,
  );
  for (const e of r.events)
    out(
      `  ${e.action === "kept" || e.action === "n/a" ? t.glyph.skip : e.action === "merged" ? t.glyph.warn : t.glyph.ok} ${t.gray(e.action.padEnd(11))} ${e.file}${e.detail ? t.gray(" · " + e.detail) : ""}\n`,
    );
  out(t.heading("By hand, in this order"));
  let n = 1;
  if (r.missingDeps.length) out(`  ${n++}. npm i -D ${r.missingDeps.join(" ")}\n`);
  out(`  ${n++}. npm run hooks:install\n`);
  // The steps are what THIS init wrote, not what a JavaScript one would have. A python or a
  // documents repository was being told to fill a dependency-cruiser config it has no reason to
  // own and no copy of, which is the first thing its reader would go looking for and not find.
  const wrote = (/** @type {string} */ f) =>
    r.events.some((e) => e.file === f && e.action !== "n/a");
  const graph = wrote(".dependency-cruiser.cjs");
  out(
    `  ${n++}. Fill CLAUDE.md (the placeholders in <>)${graph ? ", then .dependency-cruiser.cjs: one rule per arrow of CLAUDE.md §3" : ""}\n`,
  );
  if (graph)
    out(
      `  ${n++}. On an existing repository: npx depcruise src --config .dependency-cruiser.cjs --baseline (once)${wrote("knip.jsonc") ? "; knip at today's count" : ""}\n`,
    );
  out(`  ${n++}. abatty doctor · abatty measure · npm run gate\n\n`);
  return;
}

/**
 * @param {import("./ratchet.mjs").CliContext} cx @param {import("../presets/index.mjs").Preset | null} preset
 */
export async function updateCommand(cx, preset) {
  const { dir, opt, flag, out, err, VERSION } = cx;
  // The harness to the package's version, the repository's own edits kept: a three-way merge
  // per file against the installed copy; a conflict leaves the new version beside yours.
  const r = updateRepo({
    repoDir: dir,
    preset,
    force: flag("--force"),
    dryRun: flag("--dry-run"),
  });
  out(
    `\n${t.banner(VERSION)}  ${t.bold("update")} ${t.gray(`· ${r.from ? "from " + r.from : "no lock"} → ${r.to}`)}${flag("--dry-run") ? t.gray(" · dry run") : ""}\n\n`,
  );
  for (const e of r.events) {
    if (e.action === "in step") continue;
    const g =
      e.action === "conflict"
        ? t.glyph.fail
        : e.action === "kept"
          ? t.glyph.skip
          : e.action === "merged"
            ? t.glyph.warn
            : t.glyph.ok;
    out(
      `  ${g} ${t.gray(e.action.padEnd(11))} ${e.file}${e.detail ? t.gray("  · " + e.detail) : ""}\n`,
    );
  }
  const changed = r.events.filter((e) => e.action !== "in step" && e.action !== "kept").length;
  out(
    `\n${r.conflicts ? t.glyph.fail : t.glyph.ok} ${r.conflicts ? t.red(`${r.conflicts} conflict(s): merge the .abatty-new file(s) by hand, then delete them`) : t.green(changed ? `${changed} file(s) brought to ${r.to}` : `in step with ${r.to}`)}${flag("--dry-run") ? t.gray(" · nothing written") : ""}\n\n`,
  );
  process.exit(r.conflicts ? EXIT.findings : EXIT.clean);
}
