/**
 * `init` and `update`: what the package writes into a repository the first time, and how it is
 * brought to the package's version afterwards without losing the repository's own edits.
 */
import { join } from "node:path";
import { detectWorkspaces } from "../presets/workspaces.mjs";
import { initRepo } from "../core/init.mjs";
import { updateRepo } from "../core/update.mjs";
import { EXIT } from "./exit.mjs";
import { readAdoption, readJsonFile } from "../core/repo.mjs";
import { managerFor } from "../core/package-manager.mjs";
import * as t from "../ui/term.mjs";
import { stalePatchNote, stalePatches } from "../core/patches.mjs";

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
  // In the manager the repository committed: a bun-only repository was told to run npm.
  const pm = managerFor(dir);
  const addDev = { npm: "npm i -D", pnpm: "pnpm add -D", yarn: "yarn add -D", bun: "bun add -d" }[
    pm.id
  ];
  if (r.missingDeps.length) out(`  ${n++}. ${addDev} ${r.missingDeps.join(" ")}\n`);
  out(`  ${n++}. ${pm.run("hooks:install").join(" ")}\n`);
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
      `  ${n++}. On an existing repository: ${pm.exec("depcruise").join(" ")} src --config .dependency-cruiser.cjs --baseline (once)${wrote("knip.jsonc") ? "; knip at today's count" : ""}\n`,
    );
  out(`  ${n++}. abatty doctor · abatty measure · ${pm.run("gate").join(" ")}\n\n`);
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
    // A dry run writes nothing, and says so per file as the migration's lines do: "updated" on a
    // dry run read as a file changed.
    const verb = { added: "add", updated: "update", overwritten: "overwrite", merged: "merge" };
    const action =
      flag("--dry-run") && e.action in verb
        ? `would ${verb[/** @type {keyof typeof verb} */ (e.action)]}`
        : e.action;
    out(
      `  ${g} ${t.gray(action.padEnd(11))} ${e.file}${e.detail ? t.gray("  · " + e.detail) : ""}\n`,
    );
  }
  for (const p of stalePatches(dir, VERSION))
    out(
      `  ${t.glyph.warn} ${t.yellow(stalePatchNote(p, VERSION).says)}${t.gray(` · ${stalePatchNote(p, VERSION).fix}`)}
`,
    );
  // The floors a new probe definition made incomparable, rewritten under it: the step the
  // release notes used to ask for by hand.
  const { migrateRedefined } = await import("../ratchet/migrate.mjs");
  const migrations = await migrateRedefined(dir, { dryRun: flag("--dry-run") });
  for (const m of migrations)
    out(
      m.written
        ? `  ${t.glyph.ok} ${t.gray((flag("--dry-run") ? "would migrate" : "migrated").padEnd(11))} ${m.metric}  ${t.gray(`· floor ${flag("--dry-run") ? "to be rewritten" : "rewritten"} under definition ${m.version}: ${m.was} → ${m.now} (a redefinition, not a raise)`)}\n`
        : `  ${t.glyph.warn} ${t.gray("redefined".padEnd(11))} ${m.metric}  ${t.gray(`· ${m.now} under definition ${m.version}: ${m.why}`)}\n`,
    );
  const changed = r.events.filter((e) => e.action !== "in step" && e.action !== "kept").length;
  out(
    `\n${r.conflicts ? t.glyph.fail : t.glyph.ok} ${r.conflicts ? t.red(`${r.conflicts} conflict(s): merge the .abatty-new file(s) by hand, then delete them`) : t.green(changed ? `${changed} file(s) brought to ${r.to}` : `in step with ${r.to}`)}${flag("--dry-run") ? t.gray(" · nothing written") : ""}\n\n`,
  );
  // Controls an older minor planted are no proof to this one, and the next night is refused until
  // they run again: said here, where the upgrade happens, not at the night's pre-flight.
  const { CONTROLS_FILE, currentControls } = await import("../core/step-controls.mjs");
  const recorded = readJsonFile(dir, CONTROLS_FILE);
  if (recorded && !currentControls(recorded))
    out(
      `  ${t.glyph.warn} ${t.gray("controls".padEnd(11))} ${CONTROLS_FILE}  ${t.gray(`· planted by abatty ${recorded.abatty || "(unrecorded)"}: a night is refused until \`abatty doctor --controls\` runs again`)}\n`,
    );
  // A redefined HARD check that now counts above zero turns the gate red on the next push. An
  // update that said "success" there sent an adopter's replay into a red gate it was not told of.
  const red = migrations.filter((m) => !m.written).map((m) => m.metric);
  if (red.length)
    out(
      `${t.glyph.fail} ${t.red(`the gate is red from here: ${red.join(", ")} redefined, HARD and above zero`)}${t.gray(" · `abatty ratchet` names the findings; fix them, or decide by hand")}\n\n`,
    );
  process.exit(r.conflicts || red.length ? EXIT.findings : EXIT.clean);
}
