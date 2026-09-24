/**
 * `abatty mutate`: the diff-scoped mutation run on the screen. A report, not a gate step by
 * default: each mutant runs part of the suite, and a survivor is a prompt to write the test that
 * would notice it. `--strict` makes a survivor fail the run, for a pipeline that wants it to.
 */
import { EXIT } from "./exit.mjs";
import { pushRange } from "../core/range.mjs";
import { readAdoption } from "../core/repo.mjs";
import { runMutants } from "../core/mutate.mjs";
import * as t from "../ui/term.mjs";

/** @param {import("./ratchet.mjs").CliContext} cx @returns {number} */
export function mutateCommand(cx) {
  const { dir, opt, flag, out, VERSION } = cx;
  const config = readAdoption(dir) || {};
  const range = opt("--range") || pushRange(dir, config.baseBranch || "main");
  const base = range.includes("...")
    ? range.split("...")[0] || "HEAD"
    : range.split("..")[0] || "HEAD";
  const command = String(config.mutation?.command || "node --test {files}");
  out(
    `\n${t.banner(VERSION)}  ${t.bold("mutate")} ${t.gray(`· the lines changed since ${base} · ${command}`)}\n\n`,
  );
  const mutants = runMutants({
    repoDir: dir,
    base,
    command,
    max: Number(opt("--max") || config.mutation?.max || 20),
    timeoutMs: Number(opt("--timeout") || config.mutation?.timeoutSeconds || 120) * 1000,
    log: (s) => out(t.gray(s)),
  });
  const by = (/** @type {string} */ o) => mutants.filter((m) => m.outcome === o);
  const survived = by("survived");
  out("\n");
  for (const m of survived)
    out(
      `  ${t.glyph.fail} ${t.bold(`${m.file}:${m.line}`)} ${t.yellow(m.operator)} ${t.gray("survived: no test noticed; write the one that would")}\n`,
    );
  for (const m of by("no test"))
    out(
      `  ${t.glyph.warn} ${t.bold(`${m.file}:${m.line}`)} ${t.gray("no test names this module")}\n`,
    );
  for (const m of by("timeout"))
    out(
      `  ${t.glyph.warn} ${t.bold(`${m.file}:${m.line}`)} ${t.gray("the tests did not finish in time")}\n`,
    );
  out(
    `\n${survived.length ? t.glyph.fail : t.glyph.ok} ${mutants.length} mutant(s): ${by("killed").length} killed, ${survived.length} survived, ${by("no test").length} with no test, ${by("timeout").length} timed out\n\n`,
  );
  return flag("--strict") && survived.length ? EXIT.findings : EXIT.clean;
}
