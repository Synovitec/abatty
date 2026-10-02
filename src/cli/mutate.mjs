/**
 * `abatty mutate`: the diff-scoped mutation run on the screen. Not a gate step: each mutant runs
 * part of the suite, and a survivor is a prompt to write the test that would notice it. A survivor
 * exits 3 as every other finding does; it exited 0 unless `--strict` was passed, so a script that
 * ran it learnt nothing. `--strict` is still accepted and changes nothing.
 */
import { EXIT } from "./exit.mjs";
import { git, readAdoption } from "../core/repo.mjs";
import { runMutants } from "../core/mutate.mjs";
import { testFilesCommand } from "../core/test-runner.mjs";
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

/**
 * The end of a range, or "" for none (the working tree). `a..b` and `a...b` both end at `b`; the
 * end was read and dropped, so `--range A..B` mutated everything up to the working tree.
 * @param {string} range
 */
const headOf = (range) => (range.includes("..") ? range.split(/\.\.\.?/)[1] || "" : "");

/**
 * Why the run cannot start, or "": a range ending at a commit not checked out (the mutants are
 * planted in the working tree, so its lines are the only ones that can be), or no command.
 * @param {string} dir @param {string} head @param {string} command
 */
function refusal(dir, head, command) {
  if (head && git(dir, "rev-parse", head) !== git(dir, "rev-parse", "HEAD"))
    return `the range ends at ${head}, which is not checked out. The mutants are planted in the working tree; check out ${head} first, or end the range at HEAD`;
  if (!command)
    return "no unit runner is named by the test script, a workspace's, or an installed vitest or jest. Set mutation.command in abatty.config.json, with {files} where the test files go";
  return "";
}

/** @param {import("./ratchet.mjs").CliContext} cx @returns {number} */
export function mutateCommand(cx) {
  const { dir, opt, out, VERSION } = cx;
  const config = readAdoption(dir) || {};
  const range = opt("--range") || "";
  const base = baseOf(dir, range, String(config.baseBranch || "main"));
  const head = headOf(range);
  const command = String(config.mutation?.command || testFilesCommand(dir));
  const refused = refusal(dir, head, command);
  if (refused) {
    out(`${t.glyph.fail} mutate: ${refused}\n`);
    return EXIT.input;
  }
  out(
    `\n${t.banner(VERSION)}  ${t.bold("mutate")} ${t.gray(`· the lines changed since ${base.slice(0, 12)}${head ? ` up to ${head}` : ""} · ${command}`)}\n\n`,
  );
  const run = runMutants({
    repoDir: dir,
    base,
    head,
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
  for (const f of run.edited)
    out(
      `  ${t.glyph.warn} ${t.bold(f)} ${t.gray(`edited since ${head}: its lines are not the range's, so it was left alone`)}\n`,
    );
  if (run.interrupted) out(`  ${t.glyph.warn} interrupted: every file is as it was\n`);
  const bad = survived.length + red.length;
  out(
    `\n${bad ? t.glyph.fail : t.glyph.ok} ${mutants.length} mutant(s): ${by("killed").length} killed, ${survived.length} survived, ${by("no test").length} with no test, ${by("timeout").length} timed out${red.length ? `, ${red.length} file(s) whose tests were red before any mutant` : ""}\n\n`,
  );
  if (run.interrupted) return EXIT.error;
  return bad ? EXIT.findings : EXIT.clean;
}
