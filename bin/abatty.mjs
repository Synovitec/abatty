#!/usr/bin/env node
/**
 * abatty - the engineering standard as a command.
 *
 *   abatty init [dir] --stack <next|vite-react|node> [--force] [--dry-run]
 *   abatty measure [dir] [--out <file>] [--json] [--quiet]
 *   abatty gate [dir] [--fast] [--range <git-range>] [--base <branch>]
 *   abatty doctor [dir] [--strict] [--skip-self-test] [--templates-only]
 *   abatty presets
 *   abatty version
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { analyze, renderMarkdown, renderSummary } from "../src/core/gap-analysis.mjs";
import { initRepo } from "../src/core/init.mjs";
import { doctor } from "../src/core/doctor.mjs";
import { runGate } from "../src/core/gate.mjs";
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

const argv = process.argv.slice(2);
const command = argv[0] || "help";
const rest = argv.slice(1);
const flag = (/** @type {string} */ name) => rest.includes(name);
const opt = (/** @type {string} */ name) => {
  const i = rest.indexOf(name);
  const v = i >= 0 ? rest[i + 1] : undefined;
  return v && !v.startsWith("--") ? v : "";
};
const positional = rest.filter(
  (a, i) =>
    !a.startsWith("--") &&
    !(i > 0 && ["--stack", "--out", "--range", "--base", "--message"].includes(rest[i - 1] || "")),
);
const dir = repoRoot(positional[0] || process.cwd());
const out = (/** @type {string} */ s) => process.stdout.write(s);
const err = (/** @type {string} */ s) => process.stderr.write(s);

/** The preset: --stack, else the one adoption.json names, else detected from the dependencies. */
/** @param {boolean} required */
function choosePreset(required) {
  const id = opt("--stack") || readAdoption(dir)?.stack;
  const p = id ? presetById(id) : detectPreset(dependencyNames(dir));
  if (!p && required) {
    err(
      `no preset: pass --stack <${presets.map((x) => x.id).join("|")}> (none detected from ${join(dir, "package.json")})\n`,
    );
    process.exit(2);
  }
  if (id && !p) {
    err(`unknown stack "${id}"; known: ${presets.map((x) => x.id).join(", ")}\n`);
    process.exit(2);
  }
  return p;
}

switch (command) {
  case "init": {
    const preset = choosePreset(true);
    if (!preset) break;
    const r = initRepo({ repoDir: dir, preset, force: flag("--force"), dryRun: flag("--dry-run") });
    const adoption = readAdoption(dir);
    if (adoption && !flag("--dry-run") && adoption.stack !== preset.id) {
      // The preset is recorded so later commands need no --stack.
      writeFileSync(
        join(dir, ".claude", "adoption.json"),
        JSON.stringify({ ...adoption, stack: preset.id }, null, 2) + "\n",
      );
    }
    out(
      `abatty init · ${preset.name}${preset.proven ? ` · proven by ${preset.proven}` : " · NOT YET PROVEN BY A REPOSITORY: the first one names what is wrong"}${flag("--dry-run") ? " · dry run" : ""}\n\n`,
    );
    for (const e of r.events) out(`  ${e.action.padEnd(11)} ${e.file}\n`);
    out("\nBy hand, in this order:\n");
    if (r.missingDeps.length) out(`  1. npm i -D ${r.missingDeps.join(" ")}\n`);
    out(
      `  2. npm run hooks:install\n  3. Fill CLAUDE.md (the placeholders in <>), then edit .dependency-cruiser.cjs: one rule per arrow of CLAUDE.md §3\n  4. On an existing repository: npx depcruise src --config .dependency-cruiser.cjs --baseline (once), knip's --max-issues at today's count\n  5. abatty doctor, then abatty measure, then npm run gate\n`,
    );
    break;
  }
  case "measure": {
    const r = analyze(dir);
    if (flag("--json")) {
      out(JSON.stringify(r, null, 2) + "\n");
      break;
    }
    const target = resolve(dir, opt("--out") || join("docs", `GAP_ANALYSIS_${r.date}.md`));
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, renderMarkdown(r));
    if (!flag("--quiet"))
      out("\n" + renderSummary(r, relative(dir, target).split("\\").join("/")) + "\n");
    else
      out(
        `Score ${r.score}/100 over ${r.applicable} applicable checks · ${relative(dir, target)}\n`,
      );
    break;
  }
  case "gate": {
    const preset = choosePreset(true);
    if (!preset) break;
    const base = opt("--base") || readAdoption(dir)?.baseBranch || "main";
    const r = runGate({ repoDir: dir, preset, fast: flag("--fast"), range: opt("--range"), base });
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
    out(
      r.selfTest.output
        .split("\n")
        .filter((l) => /FAIL|harness ok|failure|skipped/.test(l))
        .join("\n") + "\n",
    );
    for (const d of r.drift) if (d.state !== "in step") out(`  ${d.state.padEnd(8)} ${d.file}\n`);
    out(
      `  drift: ${r.differs.length} file(s) differ from the shipped templates, ${r.missing.length} missing${r.differs.length ? " (run `abatty init --force` to take the package's version, or keep yours and say why in the decisions file)" : ""}\n`,
    );
    if (r.missingScripts.length)
      out(`  gate scripts absent from package.json: ${r.missingScripts.join(", ")}\n`);
    out(r.ok ? "doctor: ok\n" : "doctor: NOT ok\n");
    process.exit(r.ok ? 0 : 1);
  }
  case "scrub": {
    // --message <file>: the commit-msg hook. One line of output and exit 1 when the message names
    // a tool; nothing and exit 0 otherwise.
    if (opt("--message")) {
      const { FORBIDDEN, onlyRequiredPaths } = await import("../src/core/vocabulary.mjs");
      const text = readFileSync(opt("--message"), "utf8");
      const said = text
        .split(/\r?\n/)
        .find((l) => !l.startsWith("#") && FORBIDDEN.test(l) && !onlyRequiredPaths(l));
      if (said) {
        err(
          `commit message names a tool: ${said.trim().slice(0, 100)}\nsay it without the name (abatty scrub)\n`,
        );
        process.exit(1);
      }
      process.exit(0);
    }
    // No trace of the tools: files, commit messages, pull requests. `check` (default) finds and
    // exits 1 on a finding; `--fix` rewrites the files by the word map; `--history` prints the
    // filter-repo command for the commit messages and never runs it; `--prs` reads GitHub.
    const allow = allowList(dir);
    if (flag("--fix")) {
      const adoption = readAdoption(dir);
      const map = { ...DEFAULT_MAP, ...(adoption?.scrub?.map || {}) };
      const changed = fixFiles(dir, map, { allow, dryRun: flag("--dry-run") });
      out(
        `scrub --fix: ${changed.length} file(s) rewritten by the word map${flag("--dry-run") ? " (dry run)" : ""}\n`,
      );
      for (const f of changed) out(`  ${f}\n`);
    }
    const files = scanFiles(dir, { allow });
    const range = opt("--range");
    const commits = flag("--commits") || range ? scanCommits(dir, range) : [];
    const prs = flag("--prs") ? scanPullRequests(dir) : { ok: true, findings: [], error: "" };
    const all = [...files, ...commits, ...prs.findings];
    for (const f of all)
      out(`  ${f.kind.padEnd(6)} ${f.where}${f.line ? ":" + f.line : ""}  ${f.text}\n`);
    if (!prs.ok) out(`  pull requests not read: ${prs.error}\n`);
    out(
      `scrub: ${files.length} line(s) in files${flag("--commits") || range ? `, ${commits.length} in commit messages${range ? " (" + range + ")" : ""}` : ""}${flag("--prs") ? `, ${prs.findings.length} in pull requests` : ""}${allow.length ? ` · allowed paths: ${allow.join(", ")}` : ""}\n`,
    );
    if (flag("--history"))
      out(
        `\nTo rewrite the commit messages (a deliberate step, from a fresh clone, then a force-push and the hosting provider's purge request):\n  git filter-repo --message-callback "$(node -e \"import('abatty/scrub-map').then(m=>process.stdout.write(m.filterRepoCallback()))\")"\n`,
      );
    process.exit(all.length ? 1 : 0);
  }
  case "presets": {
    for (const p of presets)
      out(
        `  ${p.id.padEnd(11)} ${p.name}${p.proven ? ` · proven by ${p.proven}` : " · not yet proven by a repository"}\n`,
      );
    break;
  }
  case "version": {
    const pkg = readJsonFile(
      resolve(dirname(fileURLToPath(import.meta.url)), ".."),
      "package.json",
    );
    out(`${pkg?.name} ${pkg?.version}\n`);
    break;
  }
  default: {
    out(`abatty - the engineering standard as a command

  abatty init [dir] --stack <${presets.map((p) => p.id).join("|")}> [--force] [--dry-run]   the instrument, from the templates and the preset
  abatty measure [dir] [--out <file>] [--json] [--quiet]           the gap analysis: score, every check, next steps by phase
  abatty gate [dir] [--fast] [--range <git-range>] [--base <b>]     the path-aware gate the pre-push hook and the night run
  abatty doctor [dir] [--strict] [--skip-self-test]                  the harness self-test and the drift against the package
  abatty presets                                                     the stacks, and which repository proved each
  abatty scrub [dir] [--fix] [--commits|--range <r>] [--prs] [--history]  no trace of the tools: files, commit messages, pull requests
  abatty scrub --message <file>                                         the commit-msg hook: refuse a message that names one
  abatty version
`);
  }
}
