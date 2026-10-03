/**
 * `init` and `update`: what the package writes into a repository the first time, and how it is
 * brought to the package's version afterwards without losing the repository's own edits.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { detectWorkspaces } from "../presets/workspaces.mjs";
import { initRepo } from "../core/init.mjs";
import { updateRepo } from "../core/update.mjs";
import { EXIT } from "./exit.mjs";
import { readAdoption, readJsonFile } from "../core/repo.mjs";
import { managerFor } from "../core/package-manager.mjs";
import * as t from "../ui/term.mjs";
import { stalePatchNote, stalePatches } from "../core/patches.mjs";
import { harnessLintHint, harnessLintSays } from "../core/harness-lint.mjs";
import { contextState } from "../core/context-file.mjs";
import { ratchetSetup } from "../ratchet/index.mjs";
import { DAY_ONE, ciGate, ciSays } from "../ci/day-one.mjs";

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
  // Once, as one command: this filesystem keeps no executable bit, and git skips a hook without it.
  if (r.notExecutable.length)
    out(
      `  ${n++}. git add --chmod=+x ${r.notExecutable.join(" ")}  ${t.gray("· this filesystem keeps no executable bit, and git runs a hook only with it")}\n`,
    );
  out(`  ${n++}. ${pm.run("hooks:install").join(" ")}\n`);
  // The steps are what THIS init wrote, not what a JavaScript one would have. A python or a
  // documents repository was being told to fill a dependency-cruiser config it has no reason to
  // own and no copy of, which is the first thing its reader would go looking for and not find.
  const wrote = (/** @type {string} */ f) =>
    r.events.some((e) => e.file === f && e.action !== "n/a");
  const graph = wrote(".dependency-cruiser.cjs");
  // The context step names the file that holds the context, and only asks to fill it when
  // something is left to fill: a repository's own file is kept, and AGENTS.md points at it.
  const ctx = contextState(dir);
  const fill = ctx.placeholders
    ? `Fill ${ctx.file} (${ctx.placeholders} placeholder(s) in <>)`
    : ctx.own
      ? `${ctx.file} is this repository's own and was kept; AGENTS.md points at it`
      : "";
  // Two steps, not one sentence: "was kept, then .dependency-cruiser.cjs" read as one thing, and
  // a repository's own context file has no §3 to point at; the template's boundary map does.
  if (fill) out(`  ${n++}. ${fill}\n`);
  if (graph)
    out(
      `  ${n++}. Edit .dependency-cruiser.cjs: one rule per ${ctx.own ? "boundary this repository forbids" : `arrow of ${ctx.file} §3`}\n`,
    );
  if (graph)
    out(
      // Every repository, not only an existing one: without the file the graph step cannot start.
      `  ${n++}. ${pm.exec("depcruise").join(" ")} src --config .dependency-cruiser.cjs --baseline (once, and commit the file)${wrote("knip.jsonc") ? "; knip at today's count (every section it prints added up: files, dependencies, unlisted, binaries, exports, types; the last section alone is not the total)" : ""}\n`,
    );
  const lint = harnessLintHint(dir);
  if (lint) out(`  ${n++}. ${harnessLintSays(lint)}\n`);
  // A step the gate will skip for want of its config, said here: init writes .prettierignore and
  // no prettier config, and the gate's "no .prettierrc" read as init forgetting its own file.
  // The config is the repository's decision to hold formatting, so it is named, not written.
  for (const s of preset.gate.always)
    if (s.requires && !s.requires.some((f) => existsSync(join(dir, f))))
      out(
        `  ${n++}. ${t.gray(`the gate skips ${s.label} until a ${s.requires[0]} (or ${s.requires.slice(1, 3).join(", ")}) exists: add one when this repository holds it${s.label === "format" ? `, then ${pm.exec("prettier").join(" ")} --write . once, so the files init wrote take its style` : ""}`)}\n`,
      );
  // A gate step whose script only the repository can write (the changed lines' coverage runs on
  // its own runner), named here: doctor said it was absent and init had said nothing.
  const scripts = readJsonFile(dir, "package.json")?.scripts || {};
  for (const s of preset.gate.always)
    if (s.script && ![s.script, ...(s.alternatives || [])].some((k) => k in scripts))
      out(
        `  ${n++}. ${t.gray(`the gate skips ${s.label} until package.json has a "${s.script}" script, run on this repository's own runner`)}\n`,
      );
  // CI from the first day: the workflow init just wrote is committed with the rest, and where it
  // wrote none (another forge) the gap is named rather than left for a hand run to find.
  if (wrote(DAY_ONE))
    out(
      `  ${n++}. Commit ${DAY_ONE} with the rest  ${t.gray("· from then on every push runs the fast gate, the audit and the secret scan included")}\n`,
    );
  else {
    const ci = ciGate(dir);
    if (ci.state === "none" || ci.state === "no-gate") out(`  ${n++}. ${ciSays(ci)}\n`);
  }
  // The ratchet's floor: init writes none, and the first gate read NO FLOOR on every finding.
  if (!existsSync(join(dir, ratchetSetup(dir).baselineRel)))
    out(
      `  ${n++}. ${pm.run("standards:baseline").join(" ")}  ${t.gray("· today's numbers as the floor, once the steps above are done; until then the ratchet has none")}\n`,
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
  // A dry run's verdict is what a run would do: "brought to" and "merge the .abatty-new files"
  // read as done, on a run that wrote nothing.
  const dry = flag("--dry-run");
  const verdict = r.conflicts
    ? t.red(
        dry
          ? `${r.conflicts} conflict(s): a run would put the new version beside yours as .abatty-new to merge by hand`
          : `${r.conflicts} conflict(s): merge the .abatty-new file(s) by hand, then delete them`,
      )
    : t.green(
        !changed
          ? `in step with ${r.to}`
          : dry
            ? `${changed} file(s) would be brought to ${r.to}`
            : `${changed} file(s) brought to ${r.to}`,
      );
  out(
    `\n${r.conflicts ? t.glyph.fail : t.glyph.ok} ${verdict}${dry ? t.gray(" · nothing written") : ""}\n\n`,
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
