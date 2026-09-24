/**
 * `abatty mutate`: the diff-scoped mutation run on the screen. A report, not a gate step by
 * default: each mutant runs part of the suite, and a survivor is a prompt to write the test that
 * would notice it. `--strict` makes a survivor fail the run, for a pipeline that wants it to.
 */
import { EXIT } from "./exit.mjs";
import { git, readAdoption } from "../core/repo.mjs";
import { runMutants } from "../core/mutate.mjs";
import * as t from "../ui/term.mjs";

/**
 * The commit the changed lines are read from. `a...b` is the merge base of the two, as git reads
 * it; `a..b` is `a`; with no range, the fork from the base branch, since the upstream of a branch
 * already pushed is HEAD itself, and diffing from it found nothing to mutate.
 * @param {string} dir @param {string} range @param {string} baseBranch
 */
function baseOf(dir, range, baseBranch) {
  if (range.includes("...")) {
    const [a = "", b = ""] = range.split("...");
    return git(dir, "merge-base", a || "HEAD", b || "HEAD") || a || "HEAD";
  }
  if (range) return range.split("..")[0] || "HEAD";
  return (
    git(dir, "merge-base", `origin/${baseBranch}`, "HEAD") ||
    git(dir, "merge-base", baseBranch, "HEAD") ||
    "HEAD"
  );
}

/** @param {import("./ratchet.mjs").CliContext} cx @returns {number} */
export function mutateCommand(cx) {
  const { dir, opt, flag, out, VERSION } = cx;
  const config = readAdoption(dir) || {};
  const base = baseOf(dir, opt("--range") || "", String(config.baseBranch || "main"));
  const command = String(config.mutation?.command || "node --test {files}");
  out(
    `\n${t.banner(VERSION)}  ${t.bold("mutate")} ${t.gray(`· the lines changed since ${base.slice(0, 12)} · ${command}`)}\n\n`,
  );
  const run = runMutants({
    repoDir: dir,
    base,
    command,
    max: Number(opt("--max") || config.mutation?.max || 20),
    timeoutMs: Number(opt("--timeout") || config.mutation?.timeoutSeconds || 120) * 1000,
    log: (s) => out(t.gray(s)),
  });
  if (run.restored)
    out(
      `  ${t.glyph.warn} ${run.restored} put back: an earlier run was killed with a mutant in it\n`,
    );
  const mutants = run.mutants;
  const by = (/** @type {string} */ o) => mutants.filter((m) => m.outcome === o);
  const survived = by("survived");
  const red = by("tests red");
  out("\n");
  for (const m of survived)
    out(
      `  ${t.glyph.fail} ${t.bold(`${m.file}:${m.line}`)} ${t.yellow(m.operator)} ${t.gray("survived: no test noticed; write the one that would")}\n`,
    );
  for (const m of red)
    out(
      `  ${t.glyph.fail} ${t.bold(m.file)} ${t.gray("its tests fail, or the command cannot run, with no mutant in it: nothing about this file was judged")}\n`,
    );
  for (const m of by("no test"))
    out(
      `  ${t.glyph.warn} ${t.bold(`${m.file}:${m.line}`)} ${t.gray("no test reaches this module")}\n`,
    );
  for (const m of by("timeout"))
    out(
      `  ${t.glyph.warn} ${t.bold(`${m.file}:${m.line}`)} ${t.gray("the tests did not finish in time")}\n`,
    );
  if (run.interrupted) out(`  ${t.glyph.warn} interrupted: every file is as it was\n`);
  const bad = survived.length + red.length;
  out(
    `\n${bad ? t.glyph.fail : t.glyph.ok} ${mutants.length} mutant(s): ${by("killed").length} killed, ${survived.length} survived, ${by("no test").length} with no test, ${by("timeout").length} timed out${red.length ? `, ${red.length} file(s) whose tests were red before any mutant` : ""}\n\n`,
  );
  if (run.interrupted) return EXIT.error;
  return flag("--strict") && bad ? EXIT.findings : EXIT.clean;
}
