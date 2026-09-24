/**
 * The `raises` command: the floors this branch loosened against the base, and whether the one
 * approval that can land them is there. The pipeline runs it on a pull request with
 * `--require-review <number>`; without a pull request a loosened floor is a finding, because no
 * approval can be read from this machine.
 */
import { directPushOnBase, floorRises, recordedDecision, reviewApproval } from "../core/raises.mjs";
import { git, readAdoption } from "../core/repo.mjs";
import { EXIT } from "./exit.mjs";
import * as t from "../ui/term.mjs";

/**
 * The floors loosened against the base, judged. Exit 3 when one is loosened and no approval was
 * read, which is always the case without `--require-review`: this machine has no approval to read.
 * @param {import("./ratchet.mjs").CliContext} cx @returns {number}
 */
export function raisesCommand(cx) {
  const { dir, opt, flag, out } = cx;
  // The pipeline has the remote's branch and may not have a local one; a laptop has both.
  const name = readAdoption(dir)?.baseBranch || "main";
  const base =
    opt("--base") ||
    [`origin/${name}`, name].find((ref) => git(dir, "rev-parse", "--verify", "--quiet", ref)) ||
    name;
  const pr = opt("--require-review");
  const r = floorRises(dir, base);
  const approval = r.loosened.length && pr ? reviewApproval(pr) : null;
  // Where the repository delivers straight to its base, there is no pull request to approve a
  // raise: the decision written in the range is what is read instead, and said to be that. The
  // base must say so, and the range may only take it back: a branch that switched it on would
  // approve its own raise.
  const direct = !pr && directPushOnBase(dir, base) && readAdoption(dir)?.directPushToBase === true;
  const records = direct
    ? r.loosened.map((l) => ({ metric: l.metric, line: recordedDecision(dir, base, l.metric) }))
    : [];
  const recorded = direct && records.every((x) => x.line);
  const ok = r.loosened.length === 0 || Boolean(approval?.approved) || recorded;
  if (flag("--json")) {
    out(JSON.stringify({ ...r, approval, ok }, null, 2) + "\n");
    return ok ? EXIT.clean : EXIT.findings;
  }
  if (!r.found) {
    out(`${t.glyph.skip} ${t.gray(`no baseline on ${base}: no floor to raise`)}\n`);
    return EXIT.clean;
  }
  for (const l of r.loosened) {
    const change =
      l.now === null
        ? l.how === "config"
          ? ` · removed ${l.was}`
          : ""
        : l.was === ""
          ? ` · added ${l.now}`
          : ` · ${l.was} → ${l.now}`;
    out(`  ${t.glyph.warn} ${l.metric}  ${l.how}${l.path ? ` ${l.path}` : ""}${change}\n`);
  }
  if (!r.loosened.length) out(`${t.glyph.ok} ${t.green(`no floor loosened against ${base}`)}\n`);
  else if (direct) {
    for (const x of records)
      out(
        `    ${x.line ? t.glyph.ok : t.glyph.fail} ${x.metric}${t.gray(x.line ? ` · recorded: ${x.line.slice(0, 120)}` : " · no decision in the range names it")}\n`,
      );
    out(
      recorded
        ? `${t.glyph.ok} ${t.green("floor(s) loosened, each recorded in the decisions file")}${t.gray(" · this repository pushes to its base directly, so the record is the decision, not a second person's approval")}\n`
        : `${t.glyph.fail} ${t.red("floor(s) loosened without a decision in the range that names each one")}${t.gray(" · add a line to the decisions file naming the metric, why and who decided")}\n`,
    );
  } else if (approval?.approved)
    out(`${t.glyph.ok} ${t.green(`floor(s) loosened, ${approval.detail}`)}\n`);
  else
    out(
      `${t.glyph.fail} ${t.red(`${r.loosened.length} floor(s) loosened against ${base} without an approval the raiser cannot give itself`)}${t.gray(approval ? ` · ${approval.detail}` : " · a raise lands through a pull request somebody other than its author approves (abatty raises --require-review <number> in the pipeline)")}\n`,
    );
  return ok ? EXIT.clean : EXIT.findings;
}
