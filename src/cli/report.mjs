/**
 * `report` and `dashboard`: the JSON reading on disk, and one HTML page over the readings of
 * one repository or many.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { allReports, buildReport } from "../core/report.mjs";
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
  else
    out(
      `${t.glyph.ok} report written: .abatty/reports/${r.date}.json ${t.gray(`· score ${r.score}/100 · ${allReports(dir).length} reading(s)`)}\n`,
    );
  return;
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
