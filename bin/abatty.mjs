#!/usr/bin/env node
/**
 * abatty - the engineering standard as a command.
 *
 *   abatty [status] [dir] [--fresh]                                    the repository at a glance
 *   abatty init [dir] --stack <next|astro|vite-react|node> [--agent <id,id>] [--force] [--dry-run]
 *   abatty agents [dir]                                                the agent adapters: what each gives, what this repository loses
 *   abatty mcp [dir]                                                   the MCP server over stdio: measure, ratchet, gate, scrub, report, explain as tools
 *   abatty night-report [dir] [--date YYYY-MM-DD] [--json] [--out <file>]   the night's facts and the lessons they propose
 *   abatty secrets [dir] [--staged|--range <r>] [--json]                the secret scan: the tree, the staged files (pre-commit), a range (CI)
 *   abatty ci [dir] [--provider woodpecker,github] [--check] [--ruleset]  CI generated from the gate; the PR template; the ruleset printed
 *   abatty serve [--port 8787] [--data <dir>] [--token <t>|--no-auth]   the dashboard hosted: CI posts reports, one page over every repository
 *   abatty publish [dir] --to <url> [--token <t>]                       post this repository's newest report to a service (the CI step)
 *   abatty measure [dir] [--out <file>] [--json] [--quiet]
 *   abatty gate [dir] [--fast] [--range <git-range>] [--base <branch>]
 *   abatty doctor [dir] [--strict] [--skip-self-test]
 *   abatty update [dir] [--force] [--dry-run]                          the harness to the package's version, your edits kept
 *   abatty config [dir] [--json] [--migrate] [--dry-run]                the one config: its files, its problems against the schema
 *   abatty scrub [dir] [--fix] [--commits|--range <r>] [--prs] [--history] [--message <file>]
 *   abatty report [dir] [--json]                                       the JSON report under .abatty/reports/
 *   abatty dashboard [dir ...] [--out <file>] [--open]                 one HTML page over the reports
 *   abatty rules [dir] [--family <name>] [--level must|should] [--enforcement <e>] [--phase <n>] [--json|--md]   the rule catalog
 *   abatty explain <ID> [dir]                                          one rule, its reason, its finding here
 *   abatty ratchet [dir] [--range <r>|auto] [--json] [--controls]      the ratchet against the baseline
 *   abatty baseline [dir] [--reason <why>] [--dry-run]                 write today's numbers as the floor
 *   abatty night [dir] [--until HH:MM|+Nmin] [--max-cost <usd>] [--phases "0 1"] [--model] [--effort] [--mode auto|dontAsk] [--no-push] [--skip-canary] [--canary-only] [--agent <cmd>]
 *   abatty presets · abatty version
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { renderMarkdown, stdIds } from "../src/core/gap-analysis.mjs";
import { FAMILIES, loadCatalog, ruleById, runCatalog } from "../src/rules/index.mjs";
import { buildContext } from "../src/rules/context.mjs";
import { renderCatalogMarkdown } from "../src/ui/catalog.mjs";
import { initRepo } from "../src/core/init.mjs";
import { doctor } from "../src/core/doctor.mjs";
import { updateRepo } from "../src/core/update.mjs";
import { ADAPTERS, configuredAdapters, lostGuarantees } from "../src/agents/index.mjs";
import { serve } from "../src/mcp/server.mjs";
import { hostedCommand } from "../src/cli/hosted.mjs";
import { ciCommand } from "../src/cli/ci.mjs";
import { secretsCommand } from "../src/cli/secrets.mjs";
import {
  CONFIG_FILE,
  LEGACY_CONFIG,
  configFiles,
  configProblems,
  migrateConfig,
  readConfig,
} from "../src/core/config.mjs";
import { runGate } from "../src/core/gate.mjs";
import { dependencyNames, readAdoption, readJsonFile, repoRoot } from "../src/core/repo.mjs";
import { detectPreset, presetById, presets } from "../src/presets/index.mjs";
import {
  allowList,
  fixFiles,
  scanCommits,
  scanFiles,
  scanPullRequests,
  scrubConfig,
} from "../src/core/scrub.mjs";
import { DEFAULT_MAP } from "../src/core/scrub-map.mjs";
import { allReports, buildReport, latestReport } from "../src/core/report.mjs";
import { renderDashboard } from "../src/ui/dashboard.mjs";
import { ratchetCommand } from "../src/cli/ratchet.mjs";
import { nightCommand, nightReportCommand } from "../src/cli/night.mjs";
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
  "ratchet",
  "baseline",
  "night",
  "presets",
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
// `explain <ID> [dir]` takes the rule first; every other command takes the directory first.
const dirArg = command === "explain" ? positional[1] : positional[0];
const dir = repoRoot(dirArg || process.cwd());
const out = (/** @type {string} */ s) => process.stdout.write(s);
const err = (/** @type {string} */ s) => process.stderr.write(s);
const VERSION = String(
  readJsonFile(resolve(dirname(fileURLToPath(import.meta.url)), ".."), "package.json")?.version ||
    "",
);

/** The preset: --stack, else the one adoption.json names, else detected from the dependencies. @param {boolean} required */
function choosePreset(required) {
  const id = opt("--stack") || readAdoption(dir)?.stack;
  const p = id ? presetById(id) : detectPreset(dependencyNames(dir));
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

/**
 * The enforced share for a screen: how much of what the repository has is held by a machine.
 * @param {import("../src/core/gap-analysis.mjs").Enforced | undefined} e
 */
function enforcedLine(e) {
  if (!e || e.share === null) return `  ${t.gray("enforced: nothing present yet")}`;
  const colour = e.share >= 90 ? t.green : e.share >= 70 ? t.yellow : t.red;
  return `  ${t.bar(e.share)}  ${t.bold(colour(e.share + "%"))} ${t.gray(`of ${e.total} present rules held by a machine · ${e.hard} hard · ${e.ratchet} ratchet · ${e.review} review · ${e.prose} prose${e.promotable.length ? " · next up a level: " + e.promotable.slice(0, 3).join(", ") : ""}`)}`;
}

/** Phase "0" sorts first, "A.1 / 0" by its number, "-" last. @param {string} p */
const phaseOrder = (p) => {
  const m = String(p).match(/\d+/);
  return m ? Number(m[0]) : 99;
};
/** The next steps of a report, in plan order. @param {import("../src/core/report.mjs").Report} r @param {number} n */
const nextSteps = (r, n) =>
  r.findings
    .filter((f) => f.status === "missing" || f.status === "partial")
    // Plan order, and within a phase the must rules before the should ones.
    .sort(
      (a, b) =>
        phaseOrder(a.phase) - phaseOrder(b.phase) ||
        (a.level === "should" ? 1 : 0) - (b.level === "should" ? 1 : 0),
    )
    .slice(0, n);

switch (command) {
  case "status": {
    // The repository at a glance: the newest report (measured now when there is none, or on
    // --fresh), the harness, the nights, what to do next.
    const known = latestReport(dir);
    const fresh = flag("--fresh") || !known;
    const r = fresh || !known ? await buildReport(dir, { abattyVersion: VERSION }) : known;
    const present = r.findings.filter((f) => f.status === "present").length;
    const partial = r.findings.filter((f) => f.status === "partial").length;
    const missing = r.findings.filter((f) => f.status === "missing").length;
    const preset = choosePreset(false);
    out(
      `\n${t.banner(VERSION)}  ${t.bold(r.name)} ${t.gray(`${r.branch} @ ${r.commit}`)}  ${t.gray(fresh ? "measured now" : `reading of ${r.date} · --fresh to measure`)}\n\n`,
    );
    out(
      `  ${t.bar(r.score)}  ${t.bold(String(r.score))}${t.gray("/100")}  ${t.gray(`${r.applicable} checks · `)}${t.green(present + " present")} ${t.gray("·")} ${t.yellow(partial + " partial")} ${t.gray("·")} ${t.red(missing + " missing")}\n\n`,
    );
    out(enforcedLine(r.enforced) + "\n\n");
    out(
      t.table(
        [
          ["family", "", "present", "partial", "missing"],
          ...r.families.map((f) => [
            f.name,
            t.stacked(f.present, f.partial, f.missing, 16),
            String(f.present),
            String(f.partial),
            String(f.missing),
          ]),
        ],
        { align: ["l", "l", "r", "r", "r"] },
      ) + "\n",
    );
    out(t.heading("Harness"));
    out(
      t.kv(
        "stack",
        preset
          ? `${preset.name}${preset.proven ? "" : t.yellow(" (unproven preset)")}`
          : t.yellow("none detected"),
      ) + "\n",
    );
    out(
      t.kv(
        "hooks",
        r.harness.present
          ? r.harness.drift || r.harness.missing
            ? t.status("differs") +
              t.gray(` · ${r.harness.drift} differ, ${r.harness.missing} missing`)
            : t.status("in step")
          : t.status("missing") + t.gray(" · abatty init"),
      ) + "\n",
    );
    out(
      r.scrub.enabled
        ? t.kv(
            "no trace",
            r.scrub.lines === 0
              ? t.green("clean")
              : t.red(`${r.scrub.lines} line(s) name a tool`) + t.gray(" · abatty scrub"),
          ) + "\n"
        : t.kv("provenance", t.green("kept") + t.gray(" · the scrub is off (scrub.enabled)")) +
            "\n",
    );
    const state = /** @type {{ phases?: { status?: string }[] } | null} */ (r.night.state);
    const phases = Array.isArray(state?.phases) ? state.phases : [];
    out(
      t.kv(
        "nights",
        phases.length
          ? `${phases.filter((p) => p.status === "done").length}/${phases.length} phases done · ${r.night.decisions} decision(s)${r.night.lastReport ? " · " + r.night.lastReport : ""}`
          : t.gray("none yet"),
      ) + "\n",
    );
    if (r.waived) out(t.kv("waived", `${r.waived} rule(s) set aside with a reason`) + "\n");
    for (const p of r.problems || []) out(`  ${t.glyph.warn} ${t.yellow(p)}\n`);
    const next = nextSteps(r, 5);
    if (next.length) {
      out(t.heading("Next", "in plan order, must before should · abatty explain <ID>"));
      for (const f of next)
        out(
          `  ${t.gray("phase " + String(f.phase).padEnd(4))} ${t.bold(f.id)} ${t.gray((f.level || "").padEnd(6))} ${t.gray(f.next.slice(0, 84))}\n`,
        );
    }
    out(`\n${t.gray("abatty measure · gate · doctor · scrub · dashboard --open · help")}\n\n`);
    break;
  }
  case "init": {
    const preset = choosePreset(true);
    if (!preset) break;
    const r = initRepo({
      repoDir: dir,
      preset,
      force: flag("--force"),
      dryRun: flag("--dry-run"),
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
        `  ${e.action === "kept" ? t.glyph.skip : e.action === "merged" ? t.glyph.warn : t.glyph.ok} ${t.gray(e.action.padEnd(11))} ${e.file}\n`,
      );
    out(t.heading("By hand, in this order"));
    let n = 1;
    if (r.missingDeps.length) out(`  ${n++}. npm i -D ${r.missingDeps.join(" ")}\n`);
    out(
      `  ${n++}. npm run hooks:install\n  ${n++}. Fill CLAUDE.md (the placeholders in <>), then .dependency-cruiser.cjs: one rule per arrow of CLAUDE.md §3\n  ${n++}. On an existing repository: npx depcruise src --config .dependency-cruiser.cjs --baseline (once); knip at today's count\n  ${n++}. abatty doctor · abatty measure · npm run gate\n\n`,
    );
    break;
  }
  case "update": {
    // The harness to the package's version, the repository's own edits kept: a three-way merge
    // per file against the installed copy; a conflict leaves the new version beside yours.
    const preset = choosePreset(false);
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
    process.exit(r.conflicts ? 1 : 0);
  }
  case "config": {
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
      process.exit(problems.length ? 1 : 0);
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
    process.exit(problems.length ? 1 : 0);
  }
  case "agents": {
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
    out(
      `\n  ${t.gray(`this repository: ${adapters.map((a) => a.id).join(", ") || "none"} (config → agents)${adapters.some((a) => a.guarantees.night) ? "" : " · no adapter with hooks: no night, the gate and CI by day"}`)}\n\n`,
    );
    process.exit(unknown.length ? 1 : 0);
  }
  case "mcp": {
    // The MCP server over stdio, scoped to this repository; it returns only when stdin closes.
    serve(dir);
    await new Promise(() => {});
    break;
  }
  case "night-report": {
    await nightReportCommand({ dir, opt, flag, out, err, VERSION });
    break;
  }
  case "serve":
  case "publish": {
    await hostedCommand(command, { dir, opt, flag, out, err, VERSION });
    break;
  }
  case "ci": {
    process.exit(
      ciCommand({
        dir,
        opt,
        flag,
        out,
        err,
        VERSION,
        preset: choosePreset(false),
        config: readAdoption(dir),
      }),
    );
  }
  case "secrets": {
    process.exit(secretsCommand({ dir, opt, flag, out, err, VERSION }));
  }
  case "measure": {
    const r = await buildReport(dir, { abattyVersion: VERSION });
    for (const p of r.problems) err(`${t.glyph.warn} ${p}\n`);
    if (flag("--json")) {
      out(JSON.stringify(r, null, 2) + "\n");
      break;
    }
    const md = renderMarkdown({ ...r, families: r.families.map((f) => f.name) });
    const target = resolve(dir, opt("--out") || join("docs", `GAP_ANALYSIS_${r.date}.md`));
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, md);
    const rel = relative(dir, target).split("\\").join("/");
    if (flag("--quiet")) {
      out(`Score ${r.score}/100 over ${r.applicable} applicable checks · ${rel}\n`);
      break;
    }
    out(
      `\n${t.banner(VERSION)}  ${t.bold("measure")} ${t.gray("·")} ${r.name} ${t.gray(r.date)}\n\n`,
    );
    out(
      `  ${t.bar(r.score)}  ${t.bold(String(r.score))}${t.gray("/100")} ${t.gray(`over ${r.applicable} applicable checks`)}\n\n`,
    );
    out(enforcedLine(r.enforced) + "\n\n");
    out(
      t.table(
        [
          ["family", "", "present", "partial", "missing", "n/a"],
          ...r.families.map((f) => [
            f.name,
            t.stacked(f.present, f.partial, f.missing, 16),
            String(f.present),
            String(f.partial),
            String(f.missing),
            String(f.na),
          ]),
        ],
        { align: ["l", "l", "r", "r", "r", "r"] },
      ) + "\n",
    );
    out(
      `\n  ${t.gray(`${nextSteps(r, 999).length} next step(s) · report: `)}${rel}${t.gray(" · JSON: .abatty/reports/" + r.date + ".json")}\n\n`,
    );
    break;
  }
  case "gate": {
    const preset = choosePreset(true);
    if (!preset) break;
    const base = opt("--base") || readAdoption(dir)?.baseBranch || "main";
    const t0 = Date.now();
    const r = runGate({
      repoDir: dir,
      preset,
      fast: flag("--fast"),
      range: opt("--range"),
      base,
      log: (line) => {
        const l = line.replace(/^\n/, "");
        if (l.startsWith("▶ ")) out(`\n${t.glyph.run} ${t.bold(l.slice(2))}\n`);
        else if (l.startsWith("✗ ")) out(`\n${t.glyph.fail} ${t.red(l.slice(2))}\n`);
        else if (l.startsWith("· DEFERRED")) out(`\n${t.glyph.defer} ${t.yellow(l.slice(2))}\n`);
        else if (l.startsWith("· ")) out(`${t.glyph.skip} ${t.gray(l.slice(2))}\n`);
        else if (l.startsWith("Gate ·"))
          out(`\n${t.banner(VERSION)}  ${t.bold("gate")} ${t.gray(l.slice(5))}\n`);
        else out(`${t.gray(l)}\n`);
      },
    });
    const ran = r.events.filter((e) => e.outcome === "ok" || e.outcome === "failed");
    out(
      `\n${r.ok ? t.glyph.ok : t.glyph.fail} ${r.ok ? t.green("gate green") : t.red("gate red")} ${t.gray(`· ${ran.length} step(s) in ${t.duration(Date.now() - t0)}`)}${r.events.some((e) => e.outcome === "deferred") ? t.yellow(" · a suite deferred to CI") : ""}\n`,
    );
    for (const e of r.events)
      out(
        `  ${e.outcome === "ok" ? t.glyph.ok : e.outcome === "failed" ? t.glyph.fail : e.outcome === "deferred" ? t.glyph.defer : t.glyph.skip} ${e.outcome === "skipped" ? t.gray(e.label) : e.label}${e.ms ? t.gray("  " + t.duration(e.ms)) : ""}${e.detail ? t.gray("  · " + e.detail) : ""}\n`,
      );
    out("\n");
    process.exit(r.ok ? 0 : 1);
  }
  case "doctor": {
    const preset = choosePreset(false);
    const r = doctor({
      repoDir: dir,
      preset,
      strict: flag("--strict"),
      skipSelfTest: flag("--skip-self-test"),
    });
    out(`\n${t.banner(VERSION)}  ${t.bold("doctor")} ${t.gray("·")} ${dir}\n\n`);
    for (const l of r.selfTest.output
      .split("\n")
      .filter((x) => /FAIL|harness ok|failure|skipped/.test(x))) {
      out(
        `  ${/FAIL|failure/.test(l) ? t.glyph.fail + " " + t.red(l.replace(/^\s*FAIL\s*/, "")) : t.glyph.ok + " " + l.trim()}\n`,
      );
    }
    for (const d of r.drift)
      if (d.state !== "in step") out(`  ${t.glyph.warn} ${t.status(d.state)}  ${d.file}\n`);
    out(
      `  ${r.differs.length || r.missing.length ? t.glyph.warn : t.glyph.ok} drift: ${r.differs.length} file(s) differ from the shipped templates, ${r.missing.length} missing${r.differs.length ? t.gray(" · abatty update merges the package's version with your edits; or keep yours and say why in the decisions file") : ""}\n`,
    );
    if (r.missingScripts.length)
      out(
        `  ${t.glyph.warn} gate scripts absent from package.json: ${r.missingScripts.join(", ")}\n`,
      );
    for (const p of r.config.problems) out(`  ${t.glyph.fail} ${t.red("config: " + p)}\n`);
    if (r.config.files.length === 1 && r.config.files[0] === LEGACY_CONFIG)
      out(
        `  ${t.glyph.warn} the config is at the older place (${LEGACY_CONFIG}); abatty config --migrate moves it to ${CONFIG_FILE}\n`,
      );
    if (r.installed && r.installed !== r.packageVersion)
      out(
        `  ${t.glyph.warn} harness installed by abatty ${r.installed}, the package is ${r.packageVersion} · abatty update\n`,
      );
    else if (!r.installed && r.drift.some((d) => d.state !== "missing"))
      out(
        `  ${t.glyph.warn} no harness lock (.claude/harness.lock.json): abatty update writes it and merges from here on\n`,
      );
    out(
      `\n${r.ok ? t.glyph.ok + " " + t.green("doctor: ok") : t.glyph.fail + " " + t.red("doctor: NOT ok")}\n\n`,
    );
    process.exit(r.ok ? 0 : 1);
  }
  case "scrub": {
    if (opt("--message")) {
      // The commit-msg hook: a no-op unless the repository opted into the scrub.
      if (!scrubConfig(dir).enabled) process.exit(0);
      const { FORBIDDEN, onlyRequiredPaths } = await import("../src/core/vocabulary.mjs");
      const text = readFileSync(opt("--message"), "utf8");
      const said = text
        .split(/\r?\n/)
        .find((l) => !l.startsWith("#") && FORBIDDEN.test(l) && !onlyRequiredPaths(l));
      if (said) {
        err(
          `${t.glyph.fail} commit message names a tool: ${said.trim().slice(0, 100)}\n  say it without the name (abatty scrub)\n`,
        );
        process.exit(1);
      }
      process.exit(0);
    }
    const allow = allowList(dir);
    const sc = scrubConfig(dir);
    out(
      `\n${t.banner(VERSION)}  ${t.bold("scrub")} ${t.gray("· no trace of the tools")}${sc.enabled ? "" : t.yellow("  · off in this repository (scrub.enabled): provenance is the default; the scan runs because you asked")}\n\n`,
    );
    if (flag("--fix")) {
      const map = { ...DEFAULT_MAP, ...sc.map };
      const changed = fixFiles(dir, map, { allow, dryRun: flag("--dry-run") });
      out(
        `  ${t.glyph.ok} --fix: ${changed.length} file(s) rewritten by the word map${flag("--dry-run") ? t.gray(" (dry run)") : ""}\n`,
      );
      for (const f of changed) out(`    ${t.gray(f)}\n`);
    }
    const files = scanFiles(dir, { allow });
    const range = opt("--range");
    const commits = flag("--commits") || range ? scanCommits(dir, range) : [];
    const prs = flag("--prs") ? scanPullRequests(dir) : { ok: true, findings: [], error: "" };
    const all = [...files, ...commits, ...prs.findings];
    for (const f of all)
      out(
        `  ${t.glyph.fail} ${t.gray(f.kind.padEnd(6))} ${f.where}${f.line ? t.gray(":" + f.line) : ""}  ${f.text}\n`,
      );
    if (!prs.ok) out(`  ${t.glyph.warn} pull requests not read: ${prs.error}\n`);
    const count = (/** @type {number} */ n) => (n ? t.red(String(n)) : t.green("0"));
    out(
      `\n  ${all.length ? t.glyph.fail : t.glyph.ok} files ${count(files.length)}${flag("--commits") || range ? ` · commit messages ${count(commits.length)}${range ? t.gray(" (" + range + ")") : ""}` : ""}${flag("--prs") ? ` · pull requests ${count(prs.findings.length)}` : ""}${allow.length ? t.gray(` · allowed paths: ${allow.join(", ")}`) : ""}\n`,
    );
    if (flag("--history"))
      out(
        `\n${t.gray("To rewrite the commit messages (a deliberate step, from a fresh clone, then a force-push and the hosting provider's purge request):")}\n  git filter-repo --message-callback "$(node -e \"import('abatty/scrub-map').then(m=>process.stdout.write(m.filterRepoCallback()))\")"\n`,
      );
    out("\n");
    process.exit(all.length ? 1 : 0);
  }
  case "report": {
    const r = await buildReport(dir, { abattyVersion: VERSION });
    if (flag("--json")) out(JSON.stringify(r, null, 2) + "\n");
    else
      out(
        `${t.glyph.ok} report written: .abatty/reports/${r.date}.json ${t.gray(`· score ${r.score}/100 · ${allReports(dir).length} reading(s)`)}\n`,
      );
    break;
  }
  case "dashboard": {
    // Every positional is a repository; none means the current one. A repository with no report
    // yet is measured now, so the first run shows something.
    const dirs = positional.length ? positional.map((p) => repoRoot(p)) : [dir];
    const repos = [];
    for (const d of dirs) {
      let reports = allReports(d);
      if (!reports.length) reports = [await buildReport(d, { abattyVersion: VERSION })];
      repos.push({ name: reports.at(-1)?.name || d, reports });
    }
    const target = resolve(dirs[0] || dir, opt("--out") || join(".abatty", "dashboard.html"));
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, renderDashboard(repos, { abattyVersion: VERSION }));
    out(
      `${t.glyph.ok} dashboard: ${target} ${t.gray(`· ${repos.length} repositor${repos.length === 1 ? "y" : "ies"}`)}\n`,
    );
    if (flag("--open")) openFile(target);
    break;
  }
  case "rules": {
    // The catalog as this repository sees it: the built-in rules, its own rules file, its
    // waivers. Outside a repository the built-in catalog alone.
    const catalog = await loadCatalog(dir);
    for (const p of catalog.problems) err(`${t.glyph.warn} ${p}\n`);
    const family = opt("--family").toLowerCase();
    const level = opt("--level").toLowerCase();
    // --enforcement hard|ratchet|review|prose: what insures the rule once present; review and
    // prose are the rules a night moves up a level.
    const enforcement = opt("--enforcement").toLowerCase();
    // --phase N: the rules the plan's phase N installs; a rule's phase may name several ("7 / 8").
    const phase = opt("--phase");
    const list = catalog.rules.filter(
      (r) =>
        (!family || r.family.toLowerCase() === family) &&
        (!level || r.level === level) &&
        (!enforcement || r.enforcement === enforcement) &&
        (!phase || r.phase.split(/\s*\/\s*/).includes(phase)),
    );
    if (flag("--json")) {
      out(
        JSON.stringify(
          list.map(({ check, ...r }) => r),
          null,
          2,
        ) + "\n",
      );
      break;
    }
    if (flag("--md")) {
      out(renderCatalogMarkdown(list));
      break;
    }
    out(
      `\n${t.banner(VERSION)}  ${t.bold("rules")} ${t.gray(`· ${list.length} of ${catalog.rules.length}${catalog.localFile ? " · " + catalog.localFile : ""}`)}\n\n`,
    );
    for (const fam of FAMILIES.filter((f) => list.some((r) => r.family === f))) {
      out(t.heading(fam));
      for (const r of list.filter((x) => x.family === fam))
        out(
          `  ${r.waived ? t.glyph.skip : r.level === "must" ? t.glyph.ok : t.glyph.warn} ${t.bold(r.id.padEnd(22))} ${t.gray(r.level.padEnd(7))} ${t.gray(r.enforcement.padEnd(8))} ${t.gray(("phase " + r.phase).padEnd(12))} ${r.waived ? t.gray(r.title + " · waived") : stdIds(r.title)}${r.source && r.source !== "abatty" ? t.gray(" · " + r.source) : ""}\n`,
        );
    }
    const counts = ["hard", "ratchet", "review", "prose"].map(
      (e) => `${list.filter((r) => r.enforcement === e).length} ${e}`,
    );
    out(
      `\n  ${t.gray(`${list.filter((r) => r.level === "must").length} must · ${list.filter((r) => r.level === "should").length} should · insured by: ${counts.join(", ")} · abatty explain <ID>`)}\n\n`,
    );
    break;
  }
  case "explain": {
    const id = positional[0] || "";
    const catalog = await loadCatalog(dir);
    const rule = id ? ruleById(id, catalog.rules) : null;
    if (!rule) {
      err(
        `${t.glyph.fail} ${id ? `no rule ${id}` : "abatty explain <ID>"}; abatty rules lists the catalog\n`,
      );
      process.exit(2);
    }
    const finding = runCatalog(buildContext(dir), [rule])[0];
    out(`\n${t.banner(VERSION)}  ${t.bold(rule.id)} ${t.gray("·")} ${stdIds(rule.title)}\n\n`);
    out(t.kv("family", rule.family) + "\n");
    out(t.kv("level", rule.level === "must" ? t.bold("must") : "should") + "\n");
    out(
      t.kv(
        "insured by",
        `${rule.enforcement}${t.gray(rule.enforcement === "hard" ? " · a machine refuses the work" : rule.enforcement === "ratchet" ? " · a number that may only fall" : rule.enforcement === "review" ? " · the reviewer's checklist" : " · written, checked by nothing yet")}`,
      ) + "\n",
    );
    if (rule.standard?.length) out(t.kv("standard", stdIds(rule.standard.join(", "))) + "\n");
    out(t.kv("phase", rule.phase) + "\n");
    if (rule.source && rule.source !== "abatty") out(t.kv("source", rule.source) + "\n");
    out(t.heading("Why"));
    out(`  ${rule.why}\n`);
    out(t.heading("Here", finding ? `${dir}` : ""));
    if (finding) {
      out(t.kv("status", t.status(finding.status)) + "\n");
      out(t.kv("evidence", stdIds(finding.evidence)) + "\n");
      if (finding.status === "missing" || finding.status === "partial")
        out(t.kv("next", stdIds(finding.next)) + "\n");
    }
    out("\n");
    break;
  }
  case "ratchet":
  case "baseline": {
    await ratchetCommand(command, { dir, opt, flag, out, err, VERSION });
    break;
  }
  case "night": {
    nightCommand({ dir, opt, flag, out, err, VERSION });
    break;
  }
  case "presets": {
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
    out(`
${t.banner(VERSION)}  ${t.gray("the engineering standard as a command")}

  ${t.bold("abatty")} [status] [dir] [--fresh]                                    the repository at a glance
  ${t.bold("abatty init")} [dir] --stack <${presets.map((p) => p.id).join("|")}> [--force] [--dry-run]   the instrument, from the templates and the preset
  ${t.bold("abatty measure")} [dir] [--out <file>] [--json] [--quiet]           the gap analysis: score, every check, next steps by phase
  ${t.bold("abatty gate")} [dir] [--fast] [--range <git-range>] [--base <b>]     the path-aware gate the pre-push hook and the night run
  ${t.bold("abatty doctor")} [dir] [--strict] [--skip-self-test]                  the harness self-test and the drift against the package
  ${t.bold("abatty scrub")} [dir] [--fix] [--commits|--range <r>] [--prs] [--history]  no trace of the tools (opt-in, scrub.enabled): files, commit messages, pull requests
  ${t.bold("abatty scrub")} --message <file>                                     the commit-msg hook: refuse a message that names one
  ${t.bold("abatty report")} [dir] [--json]                                     the JSON report under .abatty/reports/
  ${t.bold("abatty dashboard")} [dir ...] [--out <file>] [--open]               one HTML page over the reports, light and dark
  ${t.bold("abatty rules")} [dir] [--family <f>] [--level must|should] [--phase <n>] [--json|--md]  the rule catalog: what must hold, why, what insures it
  ${t.bold("abatty explain")} <ID> [dir]                                       one rule, its reason, and its finding in this repository
  ${t.bold("abatty presets")}                                                    the stacks, and which repository proved each
  ${t.bold("abatty version")}

`);
  }
}
