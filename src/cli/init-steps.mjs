/**
 * The steps `init` leaves after writing its files, said in order, and with `--apply` the ones a
 * machine can take safely taken for the reader: installing what the gate needs, the hooks, the
 * executable bits and the two baselines. What needs a person (filling the context file, writing
 * the graph's rules, committing) stays a step to read. Each adopter's first hour was eight steps
 * typed by hand, and a step typed wrong was the first red they met.
 */
import { spawnSync } from "node:child_process";
import { launch } from "../core/spawn.mjs";
import * as t from "../ui/term.mjs";

/**
 * A step: what it says, and the command that takes it when a machine safely can.
 * @typedef {{ text: string, run?: string[], note?: boolean }} InitStep a `note` is what the gate
 * skips until the repository adds it: said apart, never numbered as something to do
 */

/**
 * Say the steps; with `apply`, take each one that has a command, in order, until one fails. The
 * rest are said as before, numbered from one, so the list a reader is left with is only theirs.
 * @param {InitStep[]} steps @param {{ dir: string, apply: boolean, out: (s: string) => void }} o
 * @returns {number} 0 when every step it took passed, else the failing step's exit code (4 when it
 * could not start), so a first gate that found something reads as found (3), not as broken
 */
export function finishSteps(steps, o) {
  let code = 0;
  /** @type {InitStep[]} */
  const left = [];
  /** @type {InitStep[]} */
  const notes = [];
  for (const s of steps) {
    if (s.note) {
      notes.push(s);
      continue;
    }
    if (!o.apply || !s.run || code) {
      left.push(s);
      continue;
    }
    const cmd = s.run.join(" ");
    o.out(`\n  ${t.glyph.run} ${cmd}\n`);
    const l = launch(String(s.run[0]), s.run.slice(1));
    const r = spawnSync(l.file, l.args, { cwd: o.dir, stdio: "inherit", shell: l.shell });
    if (r.status === 0) {
      o.out(`  ${t.glyph.ok} ${cmd}\n`);
      continue;
    }
    code = r.error || r.status === null ? 4 : r.status;
    o.out(
      `  ${t.glyph.fail} ${cmd} ${r.error ? `could not run (${r.error.message})` : `exited ${r.status}`}: this step and the ones after it are left to do by hand\n`,
    );
    left.push(s);
  }
  if (o.apply) o.out(t.heading(left.length ? "Left to do by hand" : "Nothing left to do by hand"));
  left.forEach((s, i) => o.out(`  ${i + 1}. ${s.text}\n`));
  if (notes.length) o.out(t.heading("Not in the gate yet"));
  for (const s of notes) o.out(`  ${t.glyph.skip} ${s.text}\n`);
  o.out("\n");
  return code;
}
