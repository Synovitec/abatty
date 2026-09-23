/**
 * @typedef {{ metric: string, was: number, now: number | null, how: "rose" | "vanished" | "no longer hard" }} Loosened
 * @typedef {{ approved: boolean, by: string[], detail: string }} Approval
 * @typedef {(args: string[]) => { ok: boolean, stdout: string }} Gh
 */
/**
 * Every floor the working baseline loosened against the one on `base`: a number above the base's,
 * a metric the base had and this one dropped, a HARD metric demoted. A base with no baseline
 * loosens nothing, since there was no floor to raise.
 * @param {string} repoDir @param {string} base @returns {{ base: string, found: boolean, loosened: Loosened[] }}
 */
export function floorRises(repoDir: string, base: string): {
    base: string;
    found: boolean;
    loosened: Loosened[];
};
/**
 * Has somebody other than the author approved the pull request as it stands? Each reviewer's
 * latest review counts, and only an approval of the head commit: an approval given before the
 * floor moved approved something else.
 * @param {string} pr @param {Gh} [gh] @returns {Approval}
 */
export function reviewApproval(pr: string, gh?: Gh): Approval;
export type Loosened = {
    metric: string;
    was: number;
    now: number | null;
    how: "rose" | "vanished" | "no longer hard";
};
export type Approval = {
    approved: boolean;
    by: string[];
    detail: string;
};
export type Gh = (args: string[]) => {
    ok: boolean;
    stdout: string;
};
