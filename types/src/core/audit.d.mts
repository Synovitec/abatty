/**
 * The allowances that still allow, and the ones that have run out. An allowance with no date
 * never expires, which is a decision a reviewer can see in the config rather than a silence.
 * @param {Allowance[]} allow @param {string} today
 */
export function splitAllowances(allow: Allowance[], today: string): {
    live: Allowance[];
    expired: Allowance[];
};
/**
 * The advisories an audit's JSON report carries at or above the floor: one entry per package,
 * with every advisory id behind it, so an allowance may name either. Three shapes, each read
 * from a real run: npm 7+ (`vulnerabilities` by package, the advisories under `via`), pnpm (the
 * registry's own bulk response, `advisories` by id with `module_name`) and bun (packages as
 * keys, an array of advisories each). A banner before the JSON (bun prints one) is skipped. Both
 * yarns print one record per line instead, read first (`linesOf`).
 * @param {string} json @param {string} floor
 * @returns {Advisory[] | null}
 */
export function advisoriesOf(json: string, floor: string): Advisory[] | null;
/**
 * The audit as the gate runs it: production dependencies only, at or above the floor, less the
 * advisories this repository allows today. An allowance may name the package or the advisory id.
 * @param {string} repoDir
 * @param {(cmd: string, args: string[]) => { status: number | null, output: string }} run
 * @param {{ allow?: Allowance[], level?: string, today?: string }} [o]
 * @returns {AuditOutcome}
 */
export function auditOutcome(repoDir: string, run: (cmd: string, args: string[]) => {
    status: number | null;
    output: string;
}, o?: {
    allow?: Allowance[];
    level?: string;
    today?: string;
}): AuditOutcome;
export type Allowance = {
    id: string;
    reason: string;
    until?: string;
};
export type AuditOutcome = {
    outcome: "ok" | "failed" | "errored" | "deferred";
    detail: string;
    allowed?: string[];
    expired?: string[];
};
export type Advisory = {
    package: string;
    severity: string;
    ids: string[];
    title: string;
};
