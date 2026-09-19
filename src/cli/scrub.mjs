/**
 * The `scrub` command: no trace of the tools, over the files, the commit messages, the pull
 * requests and the history, and the commit-msg hook that refuses a message naming one.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_MAP } from "../core/scrub-map.mjs";
import { FORBIDDEN, onlyRequiredPaths } from "../core/vocabulary.mjs";
import {
  allowList,
  fixFiles,
  scanCommits,
  scanFiles,
  scanPullRequests,
  scrubConfig,
} from "../core/scrub.mjs";
import { EXIT } from "./exit.mjs";
import * as t from "../ui/term.mjs";

/**
 * @param {import("./ratchet.mjs").CliContext} cx
 */
export async function scrubCommand(cx) {
  const { dir, opt, flag, out, err, VERSION } = cx;
  if (opt("--message")) {
    // The commit-msg hook: a no-op unless the repository opted into the scrub.
    if (!scrubConfig(dir).enabled) process.exit(0);
    const text = readFileSync(opt("--message"), "utf8");
    const said = text
      .split(/\r?\n/)
      .find((l) => !l.startsWith("#") && FORBIDDEN.test(l) && !onlyRequiredPaths(l));
    if (said) {
      err(
        `${t.glyph.fail} commit message names a tool: ${said.trim().slice(0, 100)}\n  say it without the name (abatty scrub)\n`,
      );
      process.exit(EXIT.findings);
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
  process.exit(all.length ? EXIT.findings : EXIT.clean);
}
