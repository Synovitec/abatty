/**
 * What an exit code means, in one place. A command that only ever says 0 or 1 makes a script
 * guess which of three different things happened, and the difference that matters most is the
 * one this package exists to keep: work that was judged and found wanting is not the same as an
 * instrument that could not judge it.
 *
 * Read by every command that exits, printed by `abatty help`, and documented in the README.
 */

/** @type {{ clean: 0, input: 2, findings: 3, error: 4, interrupted: 130 }} */
export const EXIT = {
  /** Ran, and there is nothing to report. */
  clean: 0,
  /** The flags, the arguments or the configuration are wrong: nothing ran. */
  input: 2,
  /** Ran correctly and found violations. The tool worked; the work did not pass. */
  findings: 3,
  /** The instrument broke, or a step could not run at all. Not a verdict on the work. */
  error: 4,
  /** Interrupted (SIGINT), by the shell's convention of 128 plus the signal. */
  interrupted: 130,
};

/** The table, for the help screen and the documentation. */
export const EXIT_CODES = [
  [EXIT.clean, "clean"],
  [EXIT.input, "invalid input, flags or configuration"],
  [EXIT.findings, "ran correctly, found violations"],
  [EXIT.error, "internal error, or a step that could not run"],
  [EXIT.interrupted, "interrupted"],
];
