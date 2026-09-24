/**
 * A gate step's output, shown as it runs and kept. The gate launches its steps synchronously with
 * their output on the terminal, which is what a reader watching a six-minute suite needs, and it
 * kept nothing: after a red suite it could not say which tests failed, let alone whether the push
 * touched them. This small process sits between the gate and the step: it runs the step, streams
 * both of its outputs through unchanged, writes a copy to a log file, and exits with the step's
 * code, so the gate stays synchronous and still gets the text to read afterwards.
 *
 *   node tee-step.mjs <log file> <0|1 run through a shell> <command> [args...]
 */
import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const [log = "", shell = "0", command = "", ...args] = process.argv.slice(2);
mkdirSync(dirname(log), { recursive: true });
const copy = createWriteStream(log);
// A tool writing to a pipe drops its colours; the reader is still a terminal when ours is one.
const env = process.stdout.isTTY
  ? { ...process.env, FORCE_COLOR: process.env.FORCE_COLOR || "1" }
  : process.env;
const child = spawn(command, args, {
  stdio: ["inherit", "pipe", "pipe"],
  shell: shell === "1",
  env,
});
child.stdout?.on("data", (d) => {
  process.stdout.write(d);
  copy.write(d);
});
child.stderr?.on("data", (d) => {
  process.stderr.write(d);
  copy.write(d);
});
// A program that could not be started ran nothing: 127, which the gate reads as "could not run".
child.on("error", (e) => {
  process.stderr.write(`${e.message}\n`);
  copy.end(() => process.exit(127));
});
child.on("close", (code, signal) => copy.end(() => process.exit(signal ? 1 : (code ?? 1))));
