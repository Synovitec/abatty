/**
 * The statement, ready to sign. Everything in it is read from the repository and from a report
 * that was already produced; nothing is computed twice, so the attestation cannot disagree with
 * the measurement it attests to.
 * @param {{ repoDir: string, report: import("./report.mjs").Report, version: string }} o
 * @returns {Record<string, unknown>}
 */
export function attestation(o: {
    repoDir: string;
    report: import("./report.mjs").Report;
    version: string;
}): Record<string, unknown>;
/** The in-toto Statement type, version 1. */
export const STATEMENT_TYPE: "https://in-toto.io/Statement/v1";
/** The predicate this package defines. The URI is the version: a change of shape is a new one. */
export const PREDICATE_TYPE: "https://abatty.dev/attestation/conformance/v1";
export namespace SCOPE {
    let answers: string[];
    let doesNotAnswer: string[];
}
