#!/usr/bin/env node
/**
 * abatty - the engineering standard as a command.
 *
 *   abatty [status] [dir] [--fresh]                                    the repository at a glance
 *   abatty init [dir] --stack <next|astro|vite-react|node> [--stage design|build|run] [--agent <id,id>] [--force] [--dry-run]
 *   abatty agents [dir]                                                the agent adapters: what each gives, what this repository loses
 *   abatty mcp [dir]                                                   the MCP server over stdio: measure, ratchet, gate, scrub, report, explain as tools
 *   abatty night-report [dir] [--date YYYY-MM-DD] [--json] [--out <file>]   the night's facts and the lessons they propose
 *   abatty secrets [dir] [--staged|--range <r>] [--json]                the secret scan: the tree, the staged files (pre-commit), a range (CI)
 *   abatty ci [dir] [--provider woodpecker,github] [--check] [--ruleset]  CI generated from the gate; the PR template; the ruleset printed
 *   abatty serve [--port 8787] [--data <dir>] [--token <t>|--no-auth]   the dashboard hosted: CI posts reports, one page over every repository
 *   abatty publish [dir] --to <url> [--token <t>]                       post this repository's newest report to a service (the CI step)
 *   abatty measure [dir] [--out <file>] [--json] [--quiet]
 *   abatty gate [dir] [--fast] [--range <git-range>] [--base <branch>]
 *   abatty doctor [dir] [--strict] [--skip-self-test] [--controls]      the harness in step; --controls plants a violation per gate step and reports a step that stays green as absent
 *   abatty update [dir] [--force] [--dry-run]                          the harness to the package's version, your edits kept
 *   abatty config [dir] [--json] [--migrate] [--dry-run]                the one config: its files, its problems against the schema
 *   abatty scrub [dir] [--fix] [--commits|--range <r>] [--prs] [--history] [--message <file>]
 *   abatty report [dir] [--json]                                       the JSON report under .abatty/reports/
 *   abatty dashboard [dir ...] [--out <file>] [--open]                 one HTML page over the reports
 *   abatty rules [dir] [--family <name>] [--level must|should] [--enforcement <e>] [--phase <n>] [--json|--md]   the rule catalog
 *   abatty explain <ID> [dir]                                          one rule, its reason, its finding here
 *   abatty ratchet [dir] [--range <r>|auto] [--json] [--controls]      the ratchet against the baseline
 *   abatty baseline [dir] [--reason <why>] [--dry-run]                 write today's numbers as the floor
 *   abatty night [dir] [--until HH:MM|+Nmin] [--max-cost <usd>] [--phases "0 1"] [--model] [--effort] [--mode auto|dontAsk] [--no-push] [--skip-canary] [--canary-only] [--agent <cmd>] [--sandbox auto|required|off] [--max-sessions N] [--max-tokens N] [--resume]
 *   abatty profiles [dir] [--json]                                    the profiles this repository follows: rules, phases, presets as one package
 *   abatty presets · abatty version
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { dependencyNames, readAdoption, readJsonFile, repoRoot } from "../src/core/repo.mjs";
import { EXIT, EXIT_CODES } from "../src/cli/exit.mjs";
import * as t from "../src/ui/term.mjs";

const argv = process.argv.slice(2);
const KNOWN = [
  "status",
  "init",
  "measure",
  "gate",
  "doctor",
  "update",
  "config",
  "agents",
  "mcp",
  "night-report",
  "serve",
  "publish",
  "ci",
  "secrets",
  "scrub",
  "report",
  "dashboard",
  "rules",
  "explain",
  "check",
  "fix",
  "ratchet",
  "baseline",
  "night",
  "presets",
  "profiles",
  "version",
  "help",
  "--help",
  "-h",
];
const named = Boolean(argv[0] && KNOWN.includes(argv[0]));
const command = named ? String(argv[0]) : "status";
const rest = named ? argv.slice(1) : argv;
const flag = (/** @type {string} */ name) => rest.includes(name);
const opt = (/** @type {string} */ name) => {
  const i = rest.indexOf(name);
  const v = i >= 0 ? rest[i + 1] : undefined;
  return v && !v.startsWith("--") ? v : "";
};
const VALUE_FLAGS = [
  "--stack",
  "--out",
  "--range",
  "--base",
  "--message",
  "--family",
  "--level",
  "--phase",
  "--reason",
  "--enforcement",
  "--until",
  "--max-cost",
  "--phases",
  "--model",
  "--effort",
  "--mode",
  "--agent",
  "--date",
  "--port",
  "--data",
  "--token",
  "--to",
  "--provider",
  "--ci",
];
const positional = rest.filter(
  (a, i) => !a.startsWith("--") && !(i > 0 && VALUE_FLAGS.includes(rest[i - 1] || "")),
);
// `explain <ID> [dir]` and `check <ID> [dir]` take the rule first; every other command takes
// the directory first.
const dirArg = command === "explain" || command === "check" ? positional[1] : positional[0];
const dir = repoRoot(dirArg || process.cwd());
const out = (/** @type {string} */ s) => process.stdout.write(s);
const err = (/** @type {string} */ s) => process.stderr.write(s);
const VERSION = String(
  readJsonFile(resolve(dirname(fileURLToPath(import.meta.url)), ".."), "package.json")?.version ||
    "",
);

/** The preset: --stack, else the one adoption.json names, else detected from the dependencies. @param {boolean} required */
async function choosePreset(required) {
  const { detectPreset, presetById, presets } = await import("../src/presets/index.mjs");
  const { buildContext } = await import("../src/rules/context.mjs");
  const id = opt("--stack") || readAdoption(dir)?.stack;
  // A repository with no package and no sources is documents: the docs preset, never detected
  // from dependencies since there are none.
  const p = id
    ? presetById(id)
    : detectPreset(dependencyNames(dir), buildContext(dir).files) ||
      (!existsSync(join(dir, "package.json")) && buildContext(dir).stack.docsOnly
        ? presetById("docs")
        : null);
  if (!p && required) {
    err(
      `${t.glyph.fail} no preset: pass --stack <${presets.map((x) => x.id).join("|")}> (none detected from ${join(dir, "package.json")})\n`,
    );
    process.exit(2);
  }
  if (id && !p) {
    err(`${t.glyph.fail} unknown stack "${id}"; known: ${presets.map((x) => x.id).join(", ")}\n`);
    process.exit(2);
  }
  return p;
}

/** Open a file with the desktop's default handler. @param {string} file */
function openFile(file) {
  if (process.platform === "win32")
    spawnSync("cmd", ["/c", "start", "", file], { stdio: "ignore" });
  else spawnSync(process.platform === "darwin" ? "open" : "xdg-open", [file], { stdio: "ignore" });
}

/** What every command screen is handed: the repository, the flags, the two streams, the version. */
const ctx = { dir, opt, flag, out, err, VERSION };

switch (command) {
  case "status": {
    const { statusCommand } = await import("../src/cli/status.mjs");
    await statusCommand({ dir, opt, flag, out, err, VERSION }, await choosePreset(false));
    break;
  }
  case "init": {
    const preset = await choosePreset(true);
    if (!preset) break;
    const { initCommand } = await import("../src/cli/setup.mjs");
    await initCommand(ctx, preset);
    break;
  }
  case "update": {
    const { updateCommand } = await import("../src/cli/setup.mjs");
    await updateCommand(ctx, await choosePreset(false));
    break;
  }
  case "config": {
    const { configCommand } = await import("../src/cli/settings.mjs");
    await configCommand(ctx);
    break;
  }
  case "agents": {
    const { agentsCommand } = await import("../src/cli/settings.mjs");
    await agentsCommand(ctx);
    break;
  }
  case "mcp": {
    const { serve } = await import("../src/mcp/server.mjs");
    // The MCP server over stdio, scoped to this repository; it returns only when stdin closes.
    serve(dir);
    await new Promise(() => {});
    break;
  }
  case "night-report": {
    const { nightReportCommand } = await import("../src/cli/night.mjs");
    await nightReportCommand({ dir, opt, flag, out, err, VERSION });
    break;
  }
  case "serve":
  case "publish": {
    const { hostedCommand } = await import("../src/cli/hosted.mjs");
    await hostedCommand(command, { dir, opt, flag, out, err, VERSION });
    break;
  }
  case "ci": {
    const { ciCommand } = await import("../src/cli/ci.mjs");
    process.exit(
      ciCommand({
        dir,
        opt,
        flag,
        out,
        err,
        VERSION,
        preset: await choosePreset(false),
        config: readAdoption(dir),
      }),
    );
  }
  case "secrets": {
    const { secretsCommand } = await import("../src/cli/secrets.mjs");
    process.exit(secretsCommand({ dir, opt, flag, out, err, VERSION }));
  }
  case "measure": {
    const { measureCommand } = await import("../src/cli/measure.mjs");
    await measureCommand(ctx);
    break;
  }
  case "gate": {
    const preset = await choosePreset(true);
    if (!preset) break;
    const { gateCommand } = await import("../src/cli/verdict.mjs");
    await gateCommand(ctx, preset);
    break;
  }
  case "doctor": {
    const { doctorCommand } = await import("../src/cli/verdict.mjs");
    await doctorCommand(ctx, await choosePreset(false));
    break;
  }
  case "scrub": {
    const { scrubCommand } = await import("../src/cli/scrub.mjs");
    await scrubCommand(ctx);
    break;
  }
  case "report": {
    const { reportCommand } = await import("../src/cli/report.mjs");
    await reportCommand(ctx);
    break;
  }
  case "dashboard": {
    const { dashboardCommand } = await import("../src/cli/report.mjs");
    await dashboardCommand(ctx, positional);
    break;
  }
  case "rules": {
    const { rulesCommand } = await import("../src/cli/catalog.mjs");
    await rulesCommand(ctx);
    break;
  }
  case "fix": {
    const { fixCommand } = await import("../src/cli/fix.mjs");
    await fixCommand(ctx);
    break;
  }
  case "check": {
    const { checkCommand } = await import("../src/cli/catalog.mjs");
    await checkCommand(ctx, String(positional[0] || ""));
    break;
  }
  case "explain": {
    const { explainCommand } = await import("../src/cli/catalog.mjs");
    await explainCommand(ctx, String(positional[0] || ""));
    break;
  }
  case "ratchet":
  case "baseline": {
    const { ratchetCommand } = await import("../src/cli/ratchet.mjs");
    await ratchetCommand(command, { dir, opt, flag, out, err, VERSION });
    break;
  }
  case "night": {
    const { nightCommand } = await import("../src/cli/night.mjs");
    nightCommand({ dir, opt, flag, out, err, VERSION });
    break;
  }
  case "profiles": {
    const { profilesCommand } = await import("../src/cli/catalog.mjs");
    await profilesCommand({ dir, opt, flag, out, err, VERSION });
    break;
  }
  case "presets": {
    const { presets } = await import("../src/presets/index.mjs");
    out(`\n${t.banner(VERSION)}  ${t.bold("presets")}\n\n`);
    for (const p of presets)
      out(
        `  ${p.proven ? t.glyph.ok : t.glyph.warn} ${t.bold(p.id.padEnd(11))} ${p.name}${p.proven ? t.gray(` · proven by ${p.proven}`) : t.yellow(" · not yet proven by a repository")}\n`,
      );
    out("\n");
    break;
  }
  case "version": {
    out(`abatty ${VERSION}\n`);
    break;
  }
  default: {
    const { presets } = await import("../src/presets/index.mjs");
    out(`
${t.banner(VERSION)}  ${t.gray("the engineering standard as a command")}

  ${t.bold("abatty")} [status] [dir] [--fresh]                                    the repository at a glance
  ${t.bold("abatty init")} [dir] --stack <${presets.map((p) => p.id).join("|")}> [--force] [--dry-run]   the instrument, from the templates and the preset
  ${t.bold("abatty measure")} [dir] [--out <file>] [--json] [--sarif] [--quiet]  the gap analysis: score, every check, next steps by phase
  ${t.bold("abatty gate")} [dir] [--fast] [--range <git-range>] [--base <b>]     the path-aware gate the pre-push hook and the night run
  ${t.bold("abatty doctor")} [dir] [--strict] [--skip-self-test]                  the harness self-test and the drift against the package
  ${t.bold("abatty scrub")} [dir] [--fix] [--commits|--range <r>] [--prs] [--history]  no trace of the tools (opt-in, scrub.enabled): files, commit messages, pull requests
  ${t.bold("abatty scrub")} --message <file>                                     the commit-msg hook: refuse a message that names one
  ${t.bold("abatty report")} [dir] [--json]                                     the JSON report under .abatty/reports/
  ${t.bold("abatty dashboard")} [dir ...] [--out <file>] [--open]               one HTML page over the reports, light and dark
  ${t.bold("abatty rules")} [dir] [--family <f>] [--level must|should] [--phase <n>] [--json|--md]  the rule catalog: what must hold, why, what insures it
  ${t.bold("abatty explain")} <ID> [dir]                                       one rule, its reason, and its finding in this repository
  ${t.bold("abatty fix")} [dir] [--phase <n>] [--write]                        what a phase asks for that a machine can write; the plan unless --write
  ${t.bold("abatty check")} <ID> [dir] [--json]                                 one rule and an exit code: 0 it holds, 3 it does not (what a finding\u0027s verify names)
  ${t.bold("abatty presets")}                                                    the stacks, and which repository proved each
  ${t.bold("abatty version")}

  ${t.gray("exit codes")}  ${EXIT_CODES.map(([c, w]) => `${c} ${w}`).join("  ·  ")}
  ${t.gray("3 is the one that matters: a gate that found something did not fail, it worked. 4 is the instrument.")}

`);
  }
}
