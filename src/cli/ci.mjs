/**
 * The `ci` command: the pipeline files generated from the preset's gate, the pull-request
 * template, the ruleset printed for import.
 */
import { EXIT } from "./exit.mjs";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { PROVIDERS } from "../ci/generate.mjs";
import { narrowFallbacks } from "../ci/fallback.mjs";
import { isGenerated, runsGate } from "../ci/hand-kept.mjs";
import { renderGithubActions } from "../ci/github.mjs";
import { renderWoodpecker } from "../ci/woodpecker.mjs";
import { renderPullRequestTemplate, renderRuleset } from "../ci/templates.mjs";
import { packageManager } from "../core/package-manager.mjs";
import { readPackage } from "../core/repo.mjs";
import * as t from "../ui/term.mjs";

/** The gate as a person here types it: the repository's manager, without the quiet flag. @param {import("../ci/generate.mjs").CiOptions} o */
function gateCommand(o) {
  if (!o.pm) return "npm run gate";
  return o.pm
    .run("gate", [])
    .filter((a) => a !== "-s" && a !== "--silent")
    .join(" ");
}

/** The files a provider gets. @param {string} provider @param {import("../presets/index.mjs").Preset} preset @param {import("../ci/generate.mjs").CiOptions} o */
export function ciFilesFor(provider, preset, o) {
  /** @type {[string, string][]} */
  const files = [];
  if (provider === "woodpecker")
    files.push([".woodpecker/checks.yaml", renderWoodpecker(preset, o)]);
  if (provider === "github") {
    files.push([".github/workflows/checks.yml", renderGithubActions(preset, o)]);
    files.push([".github/PULL_REQUEST_TEMPLATE.md", renderPullRequestTemplate(gateCommand(o))]);
  }
  return files;
}

/**
 * @typedef {"written" | "in step" | "behind" | "missing" | "kept" | "runs gate" | "not gate"} CiAction
 *   `kept`: a file this package did not write, left as it is, with the generated one beside it as
 *   `.abatty-new` where it adds something; `runs gate` and `not gate` judge a hand-kept pipeline
 *   by what it runs rather than by its text.
 */

/** The actions that leave the repository's CI short of the gate. */
const SHORT = new Set(["behind", "missing", "not gate"]);

/**
 * Write (or check) the CI files of the providers. Returns the events. A file this package did
 * not write is never overwritten: a hand-kept pipeline carries the repository's env, pins and
 * services, and one that runs the gate is the gate in CI whatever else it says.
 * @param {{ repoDir: string, preset: import("../presets/index.mjs").Preset, providers: string[], base: string, check?: boolean }} o
 */
export function writeCi(o) {
  /** @type {{ file: string, action: CiAction, detail?: string }[]} */
  const events = [];
  // The pipeline is the repository's: its scripts, its package manager. A template that named
  // scripts the package lacked and `npm ci` to a pnpm repository was red on its first run.
  const scripts = readPackage(o.repoDir).scripts || {};
  const repo = {
    base: o.base,
    scripts,
    pm: packageManager(o.repoDir),
    present: (/** @type {string} */ rel) => existsSync(join(o.repoDir, rel)),
  };
  for (const p of o.providers)
    for (const [rel, text] of ciFilesFor(p, o.preset, repo)) {
      const target = join(o.repoDir, rel);
      const current = existsSync(target) ? readFileSync(target, "utf8") : null;
      if (current !== null && current.trim() === text.trim()) {
        events.push({ file: rel, action: "in step" });
        continue;
      }
      if (current !== null && !isGenerated(current)) {
        events.push(handKept({ rel, target, current, text, scripts, check: o.check }));
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

/**
 * A file the repository keeps by hand. A pipeline is judged by whether it runs the gate; one
 * that does not gets the generated one beside it to merge from. A pull-request template is text
 * for people, so the repository's own is simply kept.
 * @param {{ rel: string, target: string, current: string, text: string, scripts: Record<string, string>, check?: boolean }} f
 * @returns {{ file: string, action: CiAction, detail?: string }}
 */
function handKept(f) {
  const pipeline = /\.ya?ml$/.test(f.rel);
  const gate = pipeline ? runsGate(f.current, f.scripts) : null;
  if (gate?.runs) return { file: f.rel, action: "runs gate", detail: `kept by hand; ${gate.how}` };
  if (f.check)
    return gate
      ? { file: f.rel, action: "not gate", detail: `kept by hand; ${gate.how}` }
      : { file: f.rel, action: "kept", detail: "kept by hand" };
  writeFileSync(`${f.target}.abatty-new`, f.text);
  return {
    file: f.rel,
    action: gate ? "not gate" : "kept",
    detail: `kept by hand${gate ? `; ${gate.how}` : ""}: the generated one is beside it as ${f.rel}.abatty-new`,
  };
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
  for (const e of events) out(eventLine(e));
  // A hand-written pipeline is not behind the generated one on purpose, but one that judges a
  // new branch by its last commit is judging less than the push, whatever else it does.
  const narrow = flag("--check") ? narrowFallbacks(dir) : [];
  for (const n of narrow)
    out(
      `  ${t.glyph.fail} ${t.gray("narrow".padEnd(9))} ${n.file}:${n.line} falls back to the last commit when the push has no before (a new branch): ${t.gray(n.text)}\n`,
    );
  if (narrow.length)
    out(
      t.gray(
        `    a new branch is then judged on one commit of many; --range auto (the fork from ${config?.baseBranch || "main"}) judges the branch\n`,
      ),
    );
  const short = events.filter((e) => SHORT.has(e.action));
  out(
    `\n${summary(short, flag("--check"))}${t.gray(" · --ruleset prints the organisation ruleset for import")}\n\n`,
  );
  return short.length || narrow.length ? EXIT.findings : EXIT.clean;
}

/**
 * The verdict line. A pipeline kept by hand is never overwritten, so it is not told to run
 * `abatty ci`: it is told to merge the generated one, or to run the gate itself.
 * @param {{ action: CiAction }[]} short @param {boolean} check
 */
function summary(short, check) {
  if (!short.length) return `${t.glyph.ok} ${t.green("CI is the gate")}`;
  const kept = short.filter((e) => e.action === "not gate").length;
  const generated = short.length - kept;
  const parts = [
    generated ? `${generated} generated file(s) behind the gate: run abatty ci` : "",
    kept
      ? `${kept} pipeline(s) kept by hand do not run the gate: make each run it, or merge the generated one (${check ? "abatty ci writes it beside yours as .abatty-new" : "beside yours as .abatty-new"})`
      : "",
  ].filter(Boolean);
  return `${t.glyph.fail} ${t.red(parts.join("; "))}`;
}

/** One file's line. @param {{ file: string, action: CiAction, detail?: string }} e */
function eventLine(e) {
  const glyph = SHORT.has(e.action)
    ? t.glyph.fail
    : e.action === "kept"
      ? t.glyph.warn
      : t.glyph.ok;
  return `  ${glyph} ${t.gray(e.action.padEnd(9))} ${e.file}${e.detail ? t.gray(` · ${e.detail}`) : ""}\n`;
}
