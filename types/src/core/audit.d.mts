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
 * The advisories an `npm audit --json` report carries at or above the floor: one entry per
 * package, with every advisory id behind it, so an allowance may name either.
 * @param {string} json @param {string} floor
 * @returns {{ package: string, severity: string, ids: string[], title: string }[] | null}
 */
export function advisoriesOf(json: string, floor: string): {
    package: string;
    severity: string;
    ids: string[];
    title: string;
}[] | null;
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
    outcome: "ok" | "failed" | "skipped" | "deferred";
    detail: string;
    allowed?: string[];
    expired?: string[];
};
