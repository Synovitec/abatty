/**
 * The `ci` command: the pipeline files generated from the preset's gate, the pull-request
 * template, the ruleset printed for import.
 */
import { EXIT } from "./exit.mjs";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { PROVIDERS, renderGithubActions, renderWoodpecker } from "../ci/generate.mjs";
import { renderPullRequestTemplate, renderRuleset } from "../ci/templates.mjs";
import * as t from "../ui/term.mjs";

/** The files a provider gets. @param {string} provider @param {import("../presets/index.mjs").Preset} preset @param {{ base?: string }} o */
export function ciFilesFor(provider, preset, o) {
  /** @type {[string, string][]} */
  const files = [];
  if (provider === "woodpecker")
    files.push([".woodpecker/checks.yaml", renderWoodpecker(preset, o)]);
  if (provider === "github") {
    files.push([".github/workflows/checks.yml", renderGithubActions(preset, o)]);
    files.push([".github/PULL_REQUEST_TEMPLATE.md", renderPullRequestTemplate()]);
  }
  return files;
}

/**
 * Write (or check) the CI files of the providers. Returns the events.
 * @param {{ repoDir: string, preset: import("../presets/index.mjs").Preset, providers: string[], base: string, check?: boolean }} o
 */
export function writeCi(o) {
  /** @type {{ file: string, action: "written" | "in step" | "behind" | "missing" }[]} */
  const events = [];
  for (const p of o.providers)
    for (const [rel, text] of ciFilesFor(p, o.preset, { base: o.base })) {
      const target = join(o.repoDir, rel);
      const current = existsSync(target) ? readFileSync(target, "utf8") : null;
      if (current !== null && current.trim() === text.trim()) {
        events.push({ file: rel, action: "in step" });
        continue;
      }
      if (o.check) {
        events.push({ file: rel, action: current === null ? "missing" : "behind" });
        continue;
      }
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, text);
      events.push({ file: rel, action: "written" });
    }
  return events;
}

/** @param {import("./ratchet.mjs").CliContext & { preset: import("../presets/index.mjs").Preset | null, config: Record<string, any> | null }} c */
export function ciCommand(c) {
  const { dir, opt, flag, out, err, VERSION, preset, config } = c;
  if (flag("--ruleset")) {
    out(renderRuleset({ checks: ["checks"] }) + "\n");
    return EXIT.clean;
  }
  if (!preset) {
    err(`${t.glyph.fail} no preset: pass --stack, or set stack in the config\n`);
    return EXIT.input;
  }
  const named = opt("--provider")
    ? opt("--provider")
        .split(/[\s,]+/)
        .filter(Boolean)
    : /** @type {any[]} */ (config?.ci?.providers || []).map((p) => String(p));
  const providers = named.length ? named : ["github"];
  const unknown = providers.filter((p) => !PROVIDERS.includes(p));
  if (unknown.length) {
    err(
      `${t.glyph.fail} unknown provider(s): ${unknown.join(", ")} (known: ${PROVIDERS.join(", ")})\n`,
    );
    return EXIT.input;
  }
  const events = writeCi({
    repoDir: dir,
    preset,
    providers,
    base: String(config?.baseBranch || "main"),
    check: flag("--check"),
  });
  out(
    `\n${t.banner(VERSION)}  ${t.bold("ci")} ${t.gray(`· ${preset.id} · ${providers.join(", ")}${flag("--check") ? " · check" : ""}`)}\n\n`,
  );
  for (const e of events)
    out(
      `  ${e.action === "in step" || e.action === "written" ? t.glyph.ok : t.glyph.fail} ${t.gray(e.action.padEnd(8))} ${e.file}\n`,
    );
  const behind = events.filter((e) => e.action === "behind" || e.action === "missing").length;
  out(
    `\n${behind ? t.glyph.fail + " " + t.red(`${behind} file(s) behind the gate: run abatty ci`) : t.glyph.ok + " " + t.green("CI is the gate")}${flag("--ruleset") ? "" : t.gray(" · --ruleset prints the organisation ruleset for import")}\n\n`,
  );
  return behind ? EXIT.findings : EXIT.clean;
}
