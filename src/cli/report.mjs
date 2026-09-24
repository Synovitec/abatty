/**
 * `report` and `dashboard`: the JSON reading on disk, and one HTML page over the readings of
 * one repository or many.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { allReports, buildReport } from "../core/report.mjs";
import { dayRows, movedFindings, previousReading } from "../core/day.mjs";
import { PREDICATE_TYPE, attestation } from "../core/attest.mjs";
import { renderEvidence } from "../ui/evidence.mjs";
import { mappingShape } from "../profiles/cra-requirements.mjs";
import { mergePortalEntity, portalFacts } from "../ui/portal.mjs";
import { existsSync, readFileSync } from "node:fs";
import { dashboardFromEnv } from "../core/env.mjs";
import { git } from "../core/repo.mjs";
import { EXIT } from "./exit.mjs";
import { repoRoot } from "../core/repo.mjs";
import { renderDashboard } from "../ui/dashboard.mjs";
import * as t from "../ui/term.mjs";

/** Open a file with the desktop's default handler. @param {string} file */
function openFile(file) {
  if (process.platform === "win32")
    spawnSync("cmd", ["/c", "start", "", file], { stdio: "ignore" });
  else spawnSync(process.platform === "darwin" ? "open" : "xdg-open", [file], { stdio: "ignore" });
}

/**
 * @param {import("./ratchet.mjs").CliContext} cx
 */
export async function reportCommand(cx) {
  const { dir, opt, flag, out, err, VERSION } = cx;
  const r = await buildReport(dir, { abattyVersion: VERSION });
  if (flag("--json")) out(JSON.stringify(r, null, 2) + "\n");
  else {
    const all = allReports(dir);
    out(
      `${t.glyph.ok} report written: .abatty/reports/${r.date}.json ${t.gray(`· score ${r.score}/100 · ${all.length} reading(s)`)}\n`,
    );
    const before = previousReading(all, r.date);
    out(
      t.heading(
        "The day",
        before ? `${r.date} beside ${before.date}` : `${r.date}, the first reading`,
      ),
    );
    const mark = {
      better: t.green("▲ better"),
      worse: t.red("▼ worse"),
      same: t.gray("="),
      new: t.gray("new"),
    };
    out(
      t.table(
        [
          ["", before ? before.date : "", r.date, ""],
          ...dayRows(r, before).map((x) => [x.label, x.before, x.now, mark[x.change]]),
        ],
        { align: ["l", "r", "r", "l"] },
      ) + "\n",
    );
    for (const m of movedFindings(r, before)) {
      const glyph = { better: t.glyph.ok, worse: t.glyph.fail, same: t.glyph.skip }[m.change];
      const to = { better: t.green(m.to), worse: t.red(m.to), same: m.to }[m.change];
      out(`  ${glyph} ${m.id} ${t.gray(`${m.from} → `)}${to}\n`);
    }
    out("\n");
    // Said every time there is one: the owner is a string the raiser typed. The approval that is
    // not is the forge's, read by `abatty raises --require-review` in the pipeline, which this
    // machine cannot see, so the row stays unverified here and says where it is verified.
    for (const f of r.floors.raised)
      out(
        `  ${t.glyph.warn} floor raised ${t.yellow("(unverified)")} ${f.metric}${f.file ? ` ${f.file}` : ""} ${f.was} → ${f.now} on ${f.at} by ${f.owner || "nobody named"}: ${f.reason || "no reason recorded"}\n`,
      );
  }
  return;
}

/**
 * `abatty attest`: the conformance statement, ready to sign.
 *
 * It prints the statement and nothing else when `--json`, so a pipeline can pipe it straight
 * into whatever signs and stores it: this package does not sign, because the signing ecosystem
 * and the identity that backs a signature belong to the pipeline, not to a measurement tool that
 * would have to be trusted with a key.
 * @param {import("./ratchet.mjs").CliContext} cx
 */
export async function attestCommand(cx) {
  const { dir, opt, flag, out, VERSION } = cx;
  const report = await buildReport(dir, { abattyVersion: VERSION });
  const statement = attestation({ repoDir: dir, report, version: VERSION });
  const text = JSON.stringify(statement, null, 2) + "\n";
  const to = opt("--out");
  if (to) {
    mkdirSync(dirname(resolve(dir, to)), { recursive: true });
    writeFileSync(resolve(dir, to), text);
  }
  if (flag("--json") || !to) out(to && flag("--json") ? text : to ? "" : text);
  if (to && !flag("--json")) {
    const p = /** @type {any} */ (statement).predicate;
    out(
      `${t.glyph.ok} attestation written: ${to} ${t.gray(`· ${PREDICATE_TYPE} · score ${p.score}/100 · ${p.conformance.length} rule(s) · ${p.waivers.length} waiver(s) · controls ${p.controls.ran ? p.controls.provenRed + " step(s) proven red" : "never run"}`)}\n`,
    );
  }
  return p0(statement);
}

/** A statement whose controls never ran is written and reported, never passed off as complete. @param {any} statement */
function p0(statement) {
  return statement.predicate.controls.ran ? EXIT.clean : EXIT.findings;
}

/**
 * `abatty evidence`: the requirement mapping as a document for a person, with the requirements
 * nothing bears on listed first. The counterpart of `attest`, which is the same facts for a
 * machine. Neither is a conformity assessment and both say so.
 * @param {import("./ratchet.mjs").CliContext} cx
 */
export async function evidenceCommand(cx) {
  const { dir, opt, out, VERSION } = cx;
  const report = await buildReport(dir, { abattyVersion: VERSION });
  const md = renderEvidence({
    findings: report.findings,
    name: report.name || report.repo,
    date: report.date,
    commit: git(dir, "rev-parse", "HEAD"),
    version: VERSION,
    score: report.score,
  });
  const to = opt("--out");
  if (!to) {
    out(md);
    return EXIT.clean;
  }
  mkdirSync(dirname(resolve(dir, to)), { recursive: true });
  writeFileSync(resolve(dir, to), md);
  const shape = mappingShape();
  out(
    `${t.glyph.ok} evidence written: ${to} ${t.gray(`· ${shape.total} requirement(s), ${shape.withoutRules} with no rule behind them · a mapping, never a conformity assessment`)}\n`,
  );
  return EXIT.clean;
}

/**
 * `abatty portal`: the conformance in the catalogue's own entity descriptor, so a developer
 * portal ingests it with nothing installed. Merges into an existing descriptor rather than
 * taking it over: the file is somebody's, with an owner and a lifecycle nothing here knows.
 * @param {import("./ratchet.mjs").CliContext} cx
 */
export async function portalCommand(cx) {
  const { dir, opt, flag, out, VERSION } = cx;
  const report = await buildReport(dir, { abattyVersion: VERSION });
  const to = opt("--out") || "catalog-info.yaml";
  const target = resolve(dir, to);
  const facts = portalFacts({
    name: report.name || report.repo,
    score: report.score,
    phase: report.phase?.id ? String(report.phase.id) : undefined,
    applicable: report.applicable,
    date: report.date,
    dashboard: opt("--dashboard") || dashboardFromEnv(),
  });
  const existing = existsSync(target) ? readFileSync(target, "utf8") : null;
  const r = mergePortalEntity(
    existing,
    {
      name: report.name || report.repo,
      description: `Measured against the engineering standard: ${report.score}/100 over ${report.applicable} applicable check(s) on ${report.date}.`,
    },
    facts,
  );
  if (flag("--dry-run")) {
    out(r.text);
    return EXIT.clean;
  }
  if (existing && !r.replaced.length && !r.added.length) {
    out(
      `${t.glyph.warn} ${to} has no annotations block and no metadata to add one to: left untouched\n`,
    );
    return EXIT.findings;
  }
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, r.text);
  out(
    `${t.glyph.ok} ${r.created ? "written" : "merged"}: ${to} ${t.gray(`· ${r.replaced.length} annotation(s) rewritten, ${r.added.length} added${r.created ? " · fill in the owner: nothing here knows who owns your repository" : " · the rest of the file is untouched"}`)}\n`,
  );
  return EXIT.clean;
}

/**
 * @param {import("./ratchet.mjs").CliContext} cx @param {string[]} [positional] the repositories named on the command line
 */
export async function dashboardCommand(cx, positional = []) {
  const { dir, opt, flag, out, err, VERSION } = cx;
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
  return;
}
