#!/usr/bin/env node
/**
 * abatty - the engineering standard as a command.
 *
 *   abatty [status] [dir] [--fresh]                                    the repository at a glance
 *   abatty init [dir] --stack <next|vite-react|node> [--force] [--dry-run]
 *   abatty measure [dir] [--out <file>] [--json] [--quiet]
 *   abatty gate [dir] [--fast] [--range <git-range>] [--base <branch>]
 *   abatty doctor [dir] [--strict] [--skip-self-test]
 *   abatty scrub [dir] [--fix] [--commits|--range <r>] [--prs] [--history] [--message <file>]
 *   abatty report [dir] [--json]                                       the JSON report under .abatty/reports/
 *   abatty dashboard [dir ...] [--out <file>] [--open]                 one HTML page over the reports
 *   abatty rules [dir] [--family <name>] [--level must|should] [--enforcement <e>] [--phase <n>] [--json|--md]   the rule catalog
 *   abatty explain <ID> [dir]                                          one rule, its reason, its finding here
 *   abatty ratchet [dir] [--range <r>|auto] [--json] [--controls]      the ratchet against the baseline
 *   abatty baseline [dir] [--reason <why>] [--dry-run]                 write today's numbers as the floor
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
import { pushRange, runGate } from "../src/core/gate.mjs";
import { dependencyNames, readAdoption, readJsonFile, repoRoot } from "../src/core/repo.mjs";
import { detectPreset, presetById, presets } from "../src/presets/index.mjs";
import {
  allowList,
  fixFiles,
  scanCommits,
  scanFiles,
  scanPullRequests,
} from "../src/core/scrub.mjs";
import { DEFAULT_MAP } from "../src/core/scrub-map.mjs";
import { allReports, buildReport, latestReport } from "../src/core/report.mjs";
import { renderDashboard } from "../src/ui/dashboard.mjs";
import {
  compare,
  failed,
  loadProbes,
  measureAll,
  ratchetSetup,
  readBaseline,
  scoreOf,
  writeBaseline,
} from "../src/ratchet/index.mjs";
import { runControls } from "../src/ratchet/controls.mjs";
import * as t from "../src/ui/term.mjs";

const argv = process.argv.slice(2);
const KNOWN = [
  "status",
  "init",
  "measure",
  "gate",
  "doctor",
  "scrub",
  "report",
  "dashboard",
  "rules",
  "explain",
  "ratchet",
  "baseline",
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
      t.kv(
        "no trace",
        r.scrub.lines === 0
          ? t.green("clean")
          : t.red(`${r.scrub.lines} line(s) name a tool`) + t.gray(" · abatty scrub"),
      ) + "\n",
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
    const r = initRepo({ repoDir: dir, preset, force: flag("--force"), dryRun: flag("--dry-run") });
    const adoption = readAdoption(dir);
    if (adoption && !flag("--dry-run") && adoption.stack !== preset.id) {
      writeFileSync(
        join(dir, ".claude", "adoption.json"),
        JSON.stringify({ ...adoption, stack: preset.id }, null, 2) + "\n",
      );
    }
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
      `  ${r.differs.length || r.missing.length ? t.glyph.warn : t.glyph.ok} drift: ${r.differs.length} file(s) differ from the shipped templates, ${r.missing.length} missing${r.differs.length ? t.gray(" · abatty init --force takes the package's version; or keep yours and say why in the decisions file") : ""}\n`,
    );
    if (r.missingScripts.length)
      out(
        `  ${t.glyph.warn} gate scripts absent from package.json: ${r.missingScripts.join(", ")}\n`,
      );
    out(
      `\n${r.ok ? t.glyph.ok + " " + t.green("doctor: ok") : t.glyph.fail + " " + t.red("doctor: NOT ok")}\n\n`,
    );
    process.exit(r.ok ? 0 : 1);
  }
  case "scrub": {
    if (opt("--message")) {
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
    out(`\n${t.banner(VERSION)}  ${t.bold("scrub")} ${t.gray("· no trace of the tools")}\n\n`);
    if (flag("--fix")) {
      const adoption = readAdoption(dir);
      const map = { ...DEFAULT_MAP, ...(adoption?.scrub?.map || {}) };
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
  case "ratchet": {
    // The ratchet: every probe over the repository, judged against the committed baseline.
    // --controls runs each probe's control cases on throwaway repositories instead.
    const { adoption, config, baselineRel } = ratchetSetup(dir);
    const { probes, problems } = await loadProbes(dir, config);
    if (!flag("--json")) {
      out(`\n${t.banner(VERSION)}  ${t.bold("ratchet")} ${t.gray("·")} ${dir}\n\n`);
      for (const p of problems) out(`  ${t.glyph.fail} ${t.red(p)}\n`);
    }
    if (flag("--controls")) {
      let bad = 0;
      for (const p of probes) {
        const results = runControls(p);
        const failing = results.filter((r) => !r.ok);
        bad += failing.length;
        out(
          `  ${failing.length ? t.glyph.fail : t.glyph.ok} ${t.bold(p.metric)} ${t.gray(`${results.length} control(s)${p.source && p.source !== "abatty" ? " · " + p.source : ""}`)}\n`,
        );
        for (const r of failing)
          out(
            `      ${t.red(`${r.name}: expected ${r.expect}, got ${r.got}`)}${r.detail ? t.gray(" · " + r.detail) : ""}\n`,
          );
      }
      out(
        `\n${bad || problems.length ? t.glyph.fail : t.glyph.ok} ${bad || problems.length ? t.red(`${bad} control(s) failing`) : t.green("every control holds, both directions")}\n\n`,
      );
      process.exit(bad || problems.length ? 1 : 0);
    }
    const baseline = readBaseline(dir, baselineRel);
    const rangeOpt = opt("--range");
    const base = opt("--base") || adoption?.baseBranch || "main";
    const range = rangeOpt === "auto" ? pushRange(dir, base) : rangeOpt;
    const ctx = buildContext(dir);
    const measurements = measureAll(probes, ctx, { config, range }, baseline);
    const verdicts = compare(measurements, baseline, config);
    const { score, axes } = scoreOf(measurements);
    if (flag("--json")) {
      out(
        JSON.stringify(
          { repo: dir, baseline: baseline ? baselineRel : null, range, score, axes, verdicts },
          null,
          2,
        ) + "\n",
      );
      process.exit(failed(verdicts) || problems.length ? 1 : 0);
    }
    out(
      `  ${t.gray(baseline ? `floor ${baselineRel} (${baseline.measuredAt})` : `no baseline at ${baselineRel} - every metric above zero fails until \`abatty baseline\` records the floor`)}${range ? t.gray(` · range ${range}`) : ""}\n\n`,
    );
    const mark = (/** @type {string} */ s) =>
      s === "ok" || s === "improved" ? t.glyph.ok : s === "skipped" ? t.glyph.skip : t.glyph.fail;
    for (const v of verdicts) {
      const word =
        v.status === "regressed"
          ? t.red("REGRESSED")
          : v.status === "hard-fail"
            ? t.red("HARD FAIL")
            : v.status === "scanned-zero"
              ? t.red("SCANNED ZERO")
              : v.status === "unbaselined"
                ? t.red("NO FLOOR")
                : v.status === "improved"
                  ? t.green("improved")
                  : v.status === "skipped"
                    ? t.gray("skipped")
                    : t.green("ok");
      out(
        `  ${mark(v.status)} ${t.bold(v.metric.padEnd(24))} ${String(v.value).padStart(5)}${v.floor !== null ? t.gray(` / ${v.floor}`) : t.gray("      ")}  ${t.gray(v.kind.padEnd(7))} ${word}${v.scanned ? t.gray(`  · ${v.scanned} scanned`) : ""}\n`,
      );
      for (const m of v.messages)
        out(
          `      ${v.status === "skipped" || v.status === "improved" ? t.gray(m) : t.yellow(m)}\n`,
        );
    }
    const red = failed(verdicts);
    out(
      `\n  ${t.gray("readability")} ${t.bold(String(score))}${t.gray("/100")} ${t.gray(
        Object.entries(axes)
          .map(([a, n]) => `${a} ${n}`)
          .join(" · "),
      )}\n`,
    );
    out(
      `\n${red || problems.length ? t.glyph.fail : t.glyph.ok} ${red || problems.length ? t.red("ratchet red") : t.green("ratchet green")} ${t.gray(`· ${verdicts.length} metric(s)`)}\n\n`,
    );
    process.exit(red || problems.length ? 1 : 0);
  }
  case "baseline": {
    // Today's numbers as the floor: zeros promoted to HARD, a HARD metric above zero refused, a
    // rise refused without --reason (and the reason belongs in the progress log too).
    const { adoption, config, baselineRel } = ratchetSetup(dir);
    const { probes, problems } = await loadProbes(dir, config);
    out(
      `\n${t.banner(VERSION)}  ${t.bold("baseline")} ${t.gray("·")} ${join(dir, baselineRel)}\n\n`,
    );
    for (const p of problems) out(`  ${t.glyph.fail} ${t.red(p)}\n`);
    if (problems.length) process.exit(1);
    const previous = readBaseline(dir, baselineRel);
    const base = opt("--base") || adoption?.baseBranch || "main";
    const ctx = buildContext(dir);
    const measurements = measureAll(probes, ctx, { config, range: pushRange(dir, base) }, previous);
    const r = writeBaseline({
      repoDir: dir,
      rel: baselineRel,
      measurements,
      config,
      previous,
      today: ctx.today,
      reason: opt("--reason"),
      dryRun: flag("--dry-run"),
    });
    for (const m of measurements) {
      if (m.skipped) continue;
      const hard = r.baseline.hard?.includes(m.metric);
      out(
        `  ${t.glyph.dot} ${t.bold(m.metric.padEnd(24))} ${String(m.value).padStart(5)}  ${t.gray(hard ? "hard" : "ratchet")}${r.promoted.includes(m.metric) ? t.green("  promoted to HARD (zero today)") : ""}${m.value > 0 ? t.gray(`  · ${Object.keys(m.debt).length} file(s) on the list`) : ""}\n`,
      );
    }
    for (const x of r.refusals) out(`\n  ${t.glyph.fail} ${t.red(x)}\n`);
    if (r.rises.length && r.ok)
      out(
        `\n  ${t.glyph.warn} ${t.yellow(`floor(s) raised with a reason: ${r.rises.join(", ")} - write the same reason in docs/STANDARDS_PROGRESS.md`)}\n`,
      );
    out(
      `\n${r.ok ? t.glyph.ok : t.glyph.fail} ${r.ok ? t.green(flag("--dry-run") ? "baseline computed (not written: --dry-run)" : "baseline written") : t.red("baseline refused; nothing written")} ${t.gray(`· readability ${r.baseline.score}/100`)}\n\n`,
    );
    process.exit(r.ok ? 0 : 1);
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
  ${t.bold("abatty scrub")} [dir] [--fix] [--commits|--range <r>] [--prs] [--history]  no trace of the tools: files, commit messages, pull requests
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
