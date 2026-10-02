/**
 * The pull-request template: the reviewer's checklist in the author's hands. The gate is named
 * the way the repository runs it; `npm run gate` in a pnpm repository's template was the first
 * line an adopter corrected.
 * @param {string} [gate] the command that runs the gate here
 */
export function renderPullRequestTemplate(gate?: string): string;
/**
 * The organisation ruleset for GitHub (Settings → Rules → Rulesets → Import): a branch name
 * that names a tool is refused, a pull request is required on the default branch, and the
 * generated checks must pass. Carries the vocabulary in the open, so it is printed, never
 * written into a repository.
 * @param {{ checks?: string[] }} [o]
 */
export function renderRuleset(o?: {
    checks?: string[];
}): string;
