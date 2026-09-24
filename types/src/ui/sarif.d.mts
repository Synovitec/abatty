/**
 * @typedef {{ id: string, name?: string, shortDescription: { text: string }, fullDescription?: { text: string }, defaultConfiguration?: { level: string }, properties?: Record<string, unknown> }} SarifRule
 * @typedef {{ ruleId: string, level: string, message: { text: string }, locations?: unknown[], partialFingerprints?: Record<string, string>, properties?: Record<string, unknown> }} SarifResult
 */
/**
 * One SARIF log: the tool that produced it, the rules it knows, the results it found.
 * @param {{ version: string, rules: SarifRule[], results: SarifResult[], repoUri?: string }} o
 */
export function sarifLog(o: {
    version: string;
    rules: SarifRule[];
    results: SarifResult[];
    repoUri?: string;
}): {
    $schema: string;
    version: string;
    runs: {
        tool: {
            driver: {
                name: string;
                version: string;
                informationUri: string;
                rules: SarifRule[];
            };
        };
        results: SarifResult[];
    }[];
};
/**
 * The gap analysis as SARIF. A catalog finding is about the repository rather than about a line,
 * so it carries no location and a forge shows it against the run; the ratchet's findings are the
 * ones that land on a diff.
 * @param {{ findings: import("../rules/index.mjs").Finding[], version: string }} o
 */
export function sarifOfFindings(o: {
    findings: import("../rules/index.mjs").Finding[];
    version: string;
}): {
    $schema: string;
    version: string;
    runs: {
        tool: {
            driver: {
                name: string;
                version: string;
                informationUri: string;
                rules: SarifRule[];
            };
        };
        results: SarifResult[];
    }[];
};
/**
 * The ratchet as SARIF: every probe finding at the path and line it names, which is the shape a
 * forge puts on the diff of the change under review.
 * @param {{ verdicts: import("../ratchet/index.mjs").Verdict[], probes: import("../ratchet/index.mjs").Probe[], version: string }} o
 */
export function sarifOfVerdicts(o: {
    verdicts: import("../ratchet/index.mjs").Verdict[];
    probes: import("../ratchet/index.mjs").Probe[];
    version: string;
}): {
    $schema: string;
    version: string;
    runs: {
        tool: {
            driver: {
                name: string;
                version: string;
                informationUri: string;
                rules: SarifRule[];
            };
        };
        results: SarifResult[];
    }[];
};
/** The schema a SARIF log names, so a forge and a validator read it as the version it is. */
export const SARIF_SCHEMA: "https://json.schemastore.org/sarif-2.1.0.json";
/** The one SARIF version emitted: the one code-scanning services accept. */
export const SARIF_VERSION: "2.1.0";
export function sarifLevel(enforcement: string, rising?: boolean): "error" | "warning" | "note";
export function fingerprint(parts: (string | number | undefined)[]): string;
export type SarifRule = {
    id: string;
    name?: string;
    shortDescription: {
        text: string;
    };
    fullDescription?: {
        text: string;
    };
    defaultConfiguration?: {
        level: string;
    };
    properties?: Record<string, unknown>;
};
export type SarifResult = {
    ruleId: string;
    level: string;
    message: {
        text: string;
    };
    locations?: unknown[];
    partialFingerprints?: Record<string, string>;
    properties?: Record<string, unknown>;
};
