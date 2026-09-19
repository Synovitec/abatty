/**
 * What a provider reads that is not a pipeline: the pull-request template a reviewer's checklist
 * becomes, and the organisation ruleset that makes the checks required rather than advisory.
 * Kept beside the pipeline renderers rather than inside them, because a template is text for a
 * person and a ruleset is a setting for a forge, and neither is a step.
 */
import { TERMS } from "../core/vocabulary.mjs";

/** The pull-request template: the reviewer's checklist in the author's hands. */
export function renderPullRequestTemplate() {
  return [
    `## What changed, and why`,
    ``,
    `<!-- One behaviour per pull request. The changelog line under [Unreleased] says it for the reader. -->`,
    ``,
    `## Before asking for review`,
    ``,
    `- [ ] The gate is green (\`npm run gate\`), and CI runs the same steps`,
    `- [ ] A line under \`## [Unreleased]\` in the changelog, written for the reader`,
    `- [ ] No floor raised, no threshold lowered, no rule switched off without a reason in the decisions file`,
    `- [ ] A new guard or probe was seen red before green (a planted violation, then the fix)`,
    `- [ ] Docs that describe the changed code were re-read against it (\`last_verified\`), not just dated`,
    `- [ ] Behaviour kept identical in a refactor, and the commit says how that was checked`,
    ``,
  ].join("\n");
}

/**
 * The organisation ruleset for GitHub (Settings → Rules → Rulesets → Import): a branch name
 * that names a tool is refused, a pull request is required on the default branch, and the
 * generated checks must pass. Carries the vocabulary in the open, so it is printed, never
 * written into a repository.
 * @param {{ checks?: string[] }} [o]
 */
export function renderRuleset(o = {}) {
  // The vocabulary's own regex sources, word boundaries included (RE2 has them).
  const pattern = TERMS.join("|");
  const checks = o.checks && o.checks.length ? o.checks : ["checks"];
  return JSON.stringify(
    {
      name: "abatty",
      target: "branch",
      enforcement: "active",
      conditions: { ref_name: { include: ["~ALL"], exclude: [] } },
      rules: [
        {
          type: "branch_name_pattern",
          parameters: {
            operator: "regex",
            pattern: `(?i)(${pattern})`,
            negate: true,
            name: "no branch names a tool",
          },
        },
        { type: "deletion" },
        { type: "non_fast_forward" },
        {
          type: "pull_request",
          parameters: {
            required_approving_review_count: 1,
            dismiss_stale_reviews_on_push: true,
            require_code_owner_review: false,
            require_last_push_approval: false,
            required_review_thread_resolution: true,
          },
        },
        {
          type: "required_status_checks",
          parameters: {
            strict_required_status_checks_policy: true,
            required_status_checks: checks.map((c) => ({ context: c })),
          },
        },
      ],
      bypass_actors: [],
    },
    null,
    2,
  );
}
