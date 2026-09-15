/**
 * The `profiles` command: the profiles this repository follows, what each brings, and the
 * problems loading them.
 */
import { readAdoption } from "../core/repo.mjs";
import { loadProfiles, profileNames } from "../profiles/index.mjs";
import * as t from "../ui/term.mjs";

/** @param {import("./ratchet.mjs").CliContext} c */
export async function profilesCommand(c) {
  const { dir, flag, out, err, VERSION } = c;
  const config = readAdoption(dir);
  const { profiles, problems } = await loadProfiles(dir, config);
  if (flag("--json")) {
    out(
      JSON.stringify(
        {
          named: profileNames(config),
          profiles: profiles.map((p) => ({
            id: p.id,
            name: p.name,
            source: p.source,
            rules: p.rules.length,
            phases: p.phases.length,
            presets: p.presets || [],
          })),
          problems,
        },
        null,
        2,
      ) + "\n",
    );
    return;
  }
  out(
    `\n${t.banner(VERSION)}  ${t.bold("profiles")} ${t.gray(`· ${profileNames(config).join(", ")}${config?.profiles === undefined ? " (the default; name them in the config → profiles)" : ""}`)}\n\n`,
  );
  for (const p of profiles) {
    out(
      `  ${t.glyph.ok} ${t.bold(p.id.padEnd(14))} ${p.name} ${t.gray(`· ${p.rules.length} rule(s), ${p.phases.length} phase(s)${p.presets?.length ? ", presets " + p.presets.join(" ") : ""} · ${p.source === "abatty" ? "built in" : p.source}`)}\n`,
    );
    if (p.description) out(`    ${t.gray(p.description)}\n`);
  }
  for (const p of problems) err(`  ${t.glyph.fail} ${p}\n`);
  out(
    `\n  ${t.gray("a profile is rules, phases, presets and harness rule files as one package: a built-in id, a file (./profiles/acme.mjs) or an installed package exporting `profile`")}\n\n`,
  );
}
