/**
 * `abatty validate`: the rules of this repository's own ratchet, checked against its history.
 * A `why` is an argument; this is the only evidence a repository can produce on its own.
 */
import { EXIT } from "./exit.mjs";
import { buildContext } from "../rules/context.mjs";
import { loadProbes, measureAll } from "../ratchet/index.mjs";
import { baselinePath, resolveConfig } from "../ratchet/config.mjs";
import { readAdoption } from "../core/repo.mjs";
import { CAVEATS, fixHistory, probeAgainstHistory } from "../core/validate.mjs";
import * as t from "../ui/term.mjs";

/** @param {import("./ratchet.mjs").CliContext} cx */
export async function validateCommand(cx) {
  const { dir, opt, flag, out, err, VERSION } = cx;
  const adoption = readAdoption(dir);
  const config = resolveConfig(adoption);
  const { probes, problems } = await loadProbes(dir, config);
  if (problems.length) {
    for (const p of problems) err(`${p}\n`);
    return EXIT.input;
  }
  const ctx = buildContext(dir);
  const since = opt("--since");
  const range = since ? `${since}..HEAD` : "";
  const history = fixHistory(ctx.git, range);
  if (!history.commits) {
    err("no commits to read\n");
    return EXIT.input;
  }
  const measured = measureAll(probes, ctx, { config, range: "" }, null);
  // Only the probes whose findings are FILES of this repository: a probe about a commit range or
  // about one document has no per-file population to compare, and forcing one would invent a
  // number. A probe that scanned nothing is left out for the same reason.
  const rows = measured
    .filter((m) => !m.skipped && m.findings.some((f) => ctx.sourceFiles.includes(f.path)))
    .map((m) =>
      probeAgainstHistory(
        { metric: m.metric, findings: m.findings, scanned: ctx.sourceFiles },
        history,
      ),
    );

  if (flag("--json")) {
    out(
      JSON.stringify(
        {
          repo: ctx.name,
          commits: history.commits,
          fixes: history.fixes,
          range: range || "the whole history",
          caveats: CAVEATS,
          probes: rows,
        },
        null,
        2,
      ) + "\n",
    );
    return EXIT.clean;
  }

  out(
    `\n${t.banner(VERSION)}  ${t.bold("validate")} ${t.gray(`· ${ctx.name} · ${history.commits} commit(s), ${history.fixes} of them fixing something · ${range || "the whole history"}`)}\n\n`,
  );
  if (!rows.length) {
    out(`  ${t.gray("no probe reports a file of this repository: nothing to correlate")}\n\n`);
    return EXIT.clean;
  }
  out(
    `  ${t.gray("metric".padEnd(24))} ${t.gray("breaking it".padEnd(22))} ${t.gray("not breaking it".padEnd(22))} ${t.gray("lift")}\n`,
  );
  for (const r of rows) {
    const v = `${r.violating.everFixed}/${r.violating.files} fixed (${r.violating.rate}%)`;
    const c = `${r.clean.everFixed}/${r.clean.files} fixed (${r.clean.rate}%)`;
    const lift =
      r.lift === null
        ? t.gray("too few")
        : r.lift > 0
          ? t.green(`+${r.lift}`)
          : t.red(String(r.lift));
    out(`  ${t.bold(r.metric.padEnd(24))} ${v.padEnd(22)} ${c.padEnd(22)} ${lift}\n`);
    out(
      `  ${t.gray(" ".repeat(24))} ${t.gray(`${r.violating.churn} commits/file`.padEnd(22))} ${t.gray(`${r.clean.churn} commits/file`.padEnd(22))} ${t.gray(r.verdict)}\n`,
    );
  }
  out(`\n  ${t.bold("What this is not")}\n`);
  for (const c of CAVEATS) out(`  ${t.gray("· " + c)}\n`);
  out("\n");
  return EXIT.clean;
}
