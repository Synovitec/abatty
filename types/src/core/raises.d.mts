/**
 * Whether the BASE says the repository delivers straight to it. Read from the working tree, a
 * range could turn it on, write the decision line it then accepts, and raise a floor with no
 * approval: the machine that raised the floor would be approving the raise.
 * @param {string} repoDir @param {string} base
 */
export function directPushOnBase(repoDir: string, base: string): boolean;
/**
 * Every floor the working baseline and config loosened against `base`: a total above the base's,
 * a file's debt above its own floor or a file newly carrying some (debt moved is debt loosened),
 * a metric dropped, a HARD metric demoted, and the config's ways to the same end (see
 * `configLoosened`). A base with no baseline loosens nothing, since there was no floor to raise.
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
/**
 * The decision that records a raise where no pull request exists to approve it: a line the pushed
 * range added to the decisions file, naming the metric. A repository that delivers straight to its
 * base by policy (`directPushToBase: true`) never opens the pull request a second approver would
 * read, so an adopter's raise could be written down and never recorded as anything. The record is
 * not a second person's approval, and the command says so; it is the decision, on file, dated by
 * its commit. "" when the range adds no such line.
 * @param {string} repoDir @param {string} base @param {string} metric
 * @returns {string}
 */
export function recordedDecision(repoDir: string, base: string, metric: string): string;
export type Loosened = {
    metric: string;
    was: number | string;
    now: number | string | null;
    how: "rose" | "vanished" | "no longer hard" | "rose in a file" | "config";
    path?: string;
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
