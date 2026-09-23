/**
 * The `raises` command: the floors this branch loosened against the base, and whether the one
 * approval that can land them is there. The pipeline runs it on a pull request with
 * `--require-review <number>`; without a pull request a loosened floor is a finding, because no
 * approval can be read from this machine.
 */
import { floorRises, reviewApproval } from "../core/raises.mjs";
import { git, readAdoption } from "../core/repo.mjs";
import { EXIT } from "./exit.mjs";
import * as t from "../ui/term.mjs";

/** @param {import("./ratchet.mjs").CliContext} cx @returns {number} */
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
  const ok = r.loosened.length === 0 || Boolean(approval?.approved);
  if (flag("--json")) {
    out(JSON.stringify({ ...r, approval, ok }, null, 2) + "\n");
    return ok ? EXIT.clean : EXIT.findings;
  }
  if (!r.found) {
    out(`${t.glyph.skip} ${t.gray(`no baseline on ${base}: no floor to raise`)}\n`);
    return EXIT.clean;
  }
  for (const l of r.loosened)
    out(
      `  ${t.glyph.warn} ${l.metric}  ${l.how}${l.now === null ? "" : ` · ${l.was} → ${l.now}`}\n`,
    );
  if (!r.loosened.length) out(`${t.glyph.ok} ${t.green(`no floor loosened against ${base}`)}\n`);
  else if (approval?.approved)
    out(`${t.glyph.ok} ${t.green(`floor(s) loosened, ${approval.detail}`)}\n`);
  else
    out(
      `${t.glyph.fail} ${t.red(`${r.loosened.length} floor(s) loosened against ${base} without an approval the raiser cannot give itself`)}${t.gray(approval ? ` · ${approval.detail}` : " · a raise lands through a pull request somebody other than its author approves (abatty raises --require-review <number> in the pipeline)")}\n`,
    );
  return ok ? EXIT.clean : EXIT.findings;
}
