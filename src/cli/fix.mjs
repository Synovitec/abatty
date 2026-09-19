/**
 * The `fix` command: what a phase asks for that a machine can write, written. The plan is shown
 * and nothing is touched unless `--write` says so, because a tool that edits a repository on the
 * strength of a verb is a tool people stop running.
 */
import { buildReport } from "../core/report.mjs";
import { applyFix, planFix } from "../core/fix.mjs";
import { EXIT } from "./exit.mjs";
import * as t from "../ui/term.mjs";

/**
 * @param {import("./ratchet.mjs").CliContext} cx
 */
export async function fixCommand(cx) {
  const { dir, opt, flag, out, err, VERSION } = cx;
  const phase = opt("--phase") || "A.1";
  const r = await buildReport(dir, { abattyVersion: VERSION, write: false });
  const steps = planFix({
    repoDir: dir,
    findings: r.findings,
    phase,
    name: r.name,
    date: r.date,
  });
  out(`\n${t.banner(VERSION)}  ${t.bold("fix")} ${t.gray(`· phase ${phase} · ${dir}`)}\n\n`);
  if (!steps.length) {
    out(
      `  ${t.glyph.ok} ${t.green("nothing to write")} ${t.gray(`· phase ${phase} has no open rule this can write, which is not the same as no open rule`)}\n\n`,
    );
    return;
  }
  for (const s of steps)
    out(
      `  ${s.action === "write" ? t.glyph.run : t.glyph.skip} ${t.bold(s.rule.padEnd(18))} ${s.path}${s.action === "held" ? t.gray(" · the file is already there") : ""}\n      ${t.gray(s.why)}\n`,
    );
  const writable = steps.filter((s) => s.action === "write");
  if (!flag("--write")) {
    out(
      `\n  ${t.gray(`${writable.length} file(s) would be written, and the index row with them. Nothing was touched.`)}\n  ${t.gray("abatty fix --phase " + phase + " --write")}\n\n`,
    );
    // Not an error: a plan that changed nothing is the command working.
    return;
  }
  const written = applyFix(dir, steps);
  for (const p of written) out(`  ${t.glyph.ok} ${t.green("written")} ${p}\n`);
  out(
    `\n  ${t.gray(`${written.length} file(s). What is inside them is yours: the placeholders are the questions, not the answers.`)}\n\n`,
  );
  if (!written.length) err(`${t.glyph.warn} nothing was written\n`);
  process.exit(written.length ? EXIT.clean : EXIT.findings);
}
