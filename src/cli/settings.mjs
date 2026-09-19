/**
 * `config` and `agents`: the one configuration file read and validated, and the agent adapters
 * this repository named with what each of them gives and costs.
 */
import { join } from "node:path";
import { ADAPTERS, configuredAdapters, lostGuarantees, surfaceCover } from "../agents/index.mjs";
import {
  CONFIG_FILE,
  LEGACY_CONFIG,
  configFiles,
  configProblems,
  migrateConfig,
  readConfig,
} from "../core/config.mjs";
import { existsSync } from "node:fs";
import { EXIT } from "./exit.mjs";
import { readAdoption } from "../core/repo.mjs";
import * as t from "../ui/term.mjs";

/**
 * @param {import("./ratchet.mjs").CliContext} cx
 */
export async function configCommand(cx) {
  const { dir, opt, flag, out, err, VERSION } = cx;
  // The one config: which files carry it, what it resolves to, what the schema refuses.
  const files = configFiles(dir);
  const problems = configProblems(dir);
  if (flag("--migrate")) {
    const m = migrateConfig(dir, { dryRun: flag("--dry-run") });
    out(
      `\n${t.banner(VERSION)}  ${t.bold("config")} ${t.gray("· migrate")}\n\n  ${m.moved ? t.glyph.ok : t.glyph.skip} ${m.reason}${flag("--dry-run") ? t.gray(" · dry run") : ""}\n\n`,
    );
    process.exit(0);
  }
  if (flag("--json")) {
    out(JSON.stringify({ files, problems, config: readConfig(dir) }, null, 2) + "\n");
    process.exit(problems.length ? EXIT.input : EXIT.clean);
  }
  out(`\n${t.banner(VERSION)}  ${t.bold("config")} ${t.gray("·")} ${dir}\n\n`);
  out(
    `  ${t.gray("files:")} ${files.length ? files.join(t.gray(" over ")) : t.yellow("none (abatty init writes " + CONFIG_FILE + ")")}\n`,
  );
  if (files.length === 1 && files[0] === LEGACY_CONFIG)
    out(
      `  ${t.glyph.warn} ${t.yellow(`the older place; abatty config --migrate moves it to ${CONFIG_FILE}`)}\n`,
    );
  for (const p of problems) out(`  ${t.glyph.fail} ${t.red(p)}\n`);
  const c = readConfig(dir) || {};
  out(
    `\n  ${t.gray("stack")} ${c.stack || "-"}  ${t.gray("base")} ${c.baseBranch || "main"}  ${t.gray("gate")} ${c.commands?.gate || "-"}  ${t.gray("phases")} ${(c.phases || []).join(" ") || "-"}\n`,
  );
  out(
    `  ${t.gray("scrub")} ${c.scrub?.enabled ? "on" : "off (provenance kept)"}  ${t.gray("baseline")} ${c.files?.baseline || "scripts/ci/standards-baseline.json"}\n`,
  );
  out(
    `\n${problems.length ? t.glyph.fail + " " + t.red(`${problems.length} problem(s) against the schema`) : t.glyph.ok + " " + t.green("valid against the schema")} ${t.gray("· --json for the resolved config")}\n\n`,
  );
  process.exit(problems.length ? EXIT.input : EXIT.clean);
}

/**
 * @param {import("./ratchet.mjs").CliContext} cx
 */
export async function agentsCommand(cx) {
  const { dir, opt, flag, out, err, VERSION } = cx;
  // The adapters: what each gives, and what this repository loses with the ones it named.
  const { adapters, unknown } = configuredAdapters(readAdoption(dir));
  out(`\n${t.banner(VERSION)}  ${t.bold("agents")} ${t.gray("·")} ${dir}\n\n`);
  for (const a of ADAPTERS) {
    const on = adapters.some((x) => x.id === a.id);
    out(
      `  ${on ? t.glyph.ok : t.glyph.skip} ${t.bold(a.id.padEnd(10))} ${a.name}\n      ${t.gray(`context ${a.contextFile} · rules ${a.rulesDir ? a.rulesDir + " (" + a.rulesFormat + ")" : "none"} · hooks ${a.hooks.protocol} · headless ${a.headless ? "yes" : "no"}`)}\n`,
    );
    const lost = lostGuarantees(a);
    if (lost.length) out(`      ${t.yellow("without: " + lost.join("; "))}\n`);
  }
  for (const u of unknown)
    out(`  ${t.glyph.fail} ${t.red(`unknown adapter in the config: ${u}`)}\n`);
  // Which surfaces are actually covered, rather than which were named: an adapter whose file was
  // never written is a repository that believes it is covered while the agent reads nothing.
  const cover = surfaceCover((p) => existsSync(join(dir, p)));
  out(`\n  ${t.gray("the files an agent would read")}\n`);
  for (const c of cover)
    out(
      `  ${c.covered ? t.glyph.ok : t.glyph.skip} ${t.gray(c.contextFile.padEnd(12))} ${c.covered ? t.green("written") : t.gray("absent")} ${t.gray("· " + c.name)}\n`,
    );

  out(
    `\n  ${t.gray(`this repository: ${adapters.map((a) => a.id).join(", ") || "none"} (config → agents)${adapters.some((a) => a.guarantees.night) ? "" : " · no adapter with hooks: no night, the gate and CI by day"}`)}\n\n`,
  );
  process.exit(unknown.length ? EXIT.input : EXIT.clean);
}
