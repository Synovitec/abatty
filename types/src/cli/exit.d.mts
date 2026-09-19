/**
 * What an exit code means, in one place. A command that only ever says 0 or 1 makes a script
 * guess which of three different things happened, and the difference that matters most is the
 * one this package exists to keep: work that was judged and found wanting is not the same as an
 * instrument that could not judge it.
 *
 * Read by every command that exits, printed by `abatty help`, and documented in the README.
 */
/** @type {{ clean: 0, input: 2, findings: 3, error: 4, interrupted: 130 }} */
export const EXIT: {
    clean: 0;
    input: 2;
    findings: 3;
    error: 4;
    interrupted: 130;
};
/** The table, for the help screen and the documentation. */
export const EXIT_CODES: ((string | 0)[] | (string | 2)[] | (string | 3)[] | (string | 4)[] | (string | 130)[])[];
