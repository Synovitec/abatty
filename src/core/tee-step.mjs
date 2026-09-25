/**
 * A gate step's output, shown as it runs and kept. The gate launches its steps synchronously with
 * their output on the terminal, which is what a reader watching a six-minute suite needs, and it
 * kept nothing: after a red suite it could not say which tests failed, let alone whether the push
 * reached them. This small process sits between the gate and the step: it runs the step, passes
 * both of its outputs through, writes a copy to a log file, and ends as the step ended (its exit
 * code, or the signal that killed it, which the gate reads as "could not run").
 *
 * The step's output is a pipe here, not the terminal, so a tool that checks for one prints its
 * plain form (no colours, a runner's non-interactive reporter). Colour is not forced back: a
 * suite whose tests match a CLI's plain text would fail under the gate and pass under the runner.
 * A log that cannot be written (a read-only checkout, a locked file) is given up, and the step
 * runs as it would without one.
 *
 *   node tee-step.mjs <log file> <0|1 run through a shell> <command> [args...]
 */
import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const [log = "", shell = "0", command = "", ...args] = process.argv.slice(2);

/** @type {import("node:fs").WriteStream | null} */
let copy = null;
try {
  mkdirSync(dirname(log), { recursive: true });
  copy = createWriteStream(log);
  copy.on("error", () => (copy = null));
} catch {
  copy = null;
}

const child = spawn(command, args, { stdio: ["inherit", "pipe", "pipe"], shell: shell === "1" });
child.stdout?.on("data", (d) => {
  process.stdout.write(d);
  copy?.write(d);
});
child.stderr?.on("data", (d) => {
  process.stderr.write(d);
  copy?.write(d);
});

/** Close the copy, then end. @param {() => void} end */
const finish = (end) => (copy ? copy.end(end) : end());
// A program that could not be started ran nothing: 127, which the gate reads as "could not run".
child.on("error", (e) => {
  process.stderr.write(`${e.message}\n`);
  finish(() => process.exit(127));
});
// A step killed by a signal ends this process by the same signal, so the gate still reads a
// killed runner (out of memory, a timeout) as one that could not run, not as a failed test.
child.on("close", (code, signal) =>
  finish(() => (signal ? process.kill(process.pid, signal) : process.exit(code ?? 1))),
);
