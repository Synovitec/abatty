---
title: "Research 2026-09-13: Vitest, Testcontainers, Playwright, Stryker, Woodpecker, hooks, supply chain, delivery"
description: "Sourced, rule-shaped practices for the testing, CI, delivery and supply-chain cluster, with the conflicts and gaps found against the standard on the day it was written. A dated record; the standard is what was adopted."
category: reference
status: stable
audience: ["architect", "developer", "agent"]
tags: ["research", "testing", "vitest", "playwright", "woodpecker", "supply-chain", "changelog"]
related: ["../BEST_PRACTICES.md", "../ENGINEERING_STANDARD.md"]
scope: synovitec
last_verified: "2026-09-13"
---

# Research: testing, CI, delivery, supply chain (2025-2026 practice)

Read against `ops-hub/engineering/ENGINEERING_STANDARD.md` (last_verified 2026-09-13). Versions named
where the source states them.

## 1. Testing strategy

### Unit (Vitest 3/4)

- MUST colocate a unit test next to the file it covers (`x.ts` / `x.test.ts` or `x.spec.ts`) so discoverability does not depend on a mirrored tree (https://app.studyraid.com/en/read/11292/352302/naming-conventions-and-patterns)
- MUST name a test after the observable behaviour ("throws if the email format is invalid"), never "works correctly" or "handles edge case" (https://alexop.dev/posts/frontend-testing-guide-10-essential-rules/)
- SHOULD split a test whose name needs "and" into two tests - one behaviour per test (https://alexop.dev/posts/frontend-testing-guide-10-essential-rules/)
- MUST replace `Date`/timers with `vi.useFakeTimers()` and pin the clock with `vi.setSystemTime()`, restoring with `vi.useRealTimers()` in `afterEach` - a test reading the real clock is nondeterministic by construction (https://vitest.dev/guide/mocking/dates, https://vitest.dev/config/faketimers)
- MUST replace `Math.random`/UUID generation with a seeded RNG or a fixed mock in any test asserting on a random value (https://medium.com/@Modexa/10-jest-vitest-patterns-that-reduce-flaky-tests-4105009ead56)
- SHOULD select `coverage.provider: 'v8'` (Vitest's default) unless Istanbul-only instrumentation features are needed; both support `reportOnFailure` (https://vitest.dev/config/coverage)
- MUST set `coverage.reportOnFailure: true` in CI so a report is still produced when the run fails - default is `false`, and CI failure-diagnosis needs the numbers precisely when tests are red (https://vitest.dev/config/coverage)
- SHOULD set global `coverage.thresholds` (lines/branches/functions/statements) plus glob-scoped overrides for critical paths (e.g. `'src/lib/payments/**': { 100: true }`), because a single global number lets debt hide in whichever files are already exempt (https://vitest.dev/config/coverage)
- SHOULD set `coverage.thresholds.perFile: true` on money/legal-logic globs so each file individually meets the floor - a repo-wide average lets one neglected module hide behind everything else's coverage (https://vitest.dev/config/coverage, https://qaskills.sh/blog/vitest-coverage-threshold-per-file)
- MUST NOT set `thresholds.autoUpdate: true` on a shared config - it silently rewrites the committed floor upward on every green run, which erases the "who raised this and why" record a ratchet needs (https://vitest.dev/config/coverage)

### Integration (real database)

- MUST run integration tests against a real Postgres via Testcontainers, never an ORM mock - a mock cannot exercise a constraint, a transaction or a race, which is where money-affecting defects live (https://testcontainers.com/guides/getting-started-with-testcontainers-for-nodejs/, https://oneuptime.com/blog/post/2026-01-06-nodejs-integration-tests-testcontainers/view)
- MUST NOT hardcode the container's port - Testcontainers maps a dynamic host port precisely so parallel runs do not collide (https://oneuptime.com/blog/post/2026-01-06-nodejs-integration-tests-testcontainers/view)
- SHOULD isolate each test in a transaction that is rolled back afterward (or `TRUNCATE` between tests) rather than a fresh container per test - cheaper and still gives real constraint enforcement (https://oneuptime.com/blog/post/2026-01-06-nodejs-integration-tests-testcontainers/view)
- SHOULD run real migrations against the container rather than `db push`/sync, so the suite tests the same schema path production takes (https://oneuptime.com/blog/post/2026-01-06-nodejs-integration-tests-testcontainers/view)
- SHOULD enable `withReuse(true)` for local iteration to skip cold-start time; never rely on reuse in CI, where a clean container per run is the correctness guarantee (https://qaskills.sh/blog/testcontainers-withreuse-node-guide)
- SHOULD disable the Ryuk reaper (`TESTCONTAINERS_RYUK_DISABLED=true`) only where the CI runner forbids privileged containers and the pipeline itself performs cleanup - not as a default (https://java.testcontainers.org/features/configuration/, adapted to Node)
- SHOULD tier the suite by cost: unit tests on every save, integration tests with Testcontainers on every PR, a small E2E smoke on every merge to main, the full E2E suite nightly (https://oneuptime.com/blog/post/2026-01-06-nodejs-integration-tests-testcontainers/view)

### E2E (Playwright)

- SHOULD define `projects` per browser/device and run mobile viewports as their own project rather than a runtime branch inside one test file (https://playwright.dev/docs/best-practices)
- SHOULD shard (`--shard=i/n`) to parallelize the suite across CI machines and merge blob reports back into one HTML report, rather than growing `workers` on a single runner (https://bug0.com/blog/playwright-test-sharding-guide, https://www.browserstack.com/guide/playwright-test-sharding)
- SHOULD set `retries: 2` on CI only (0 locally) to absorb genuine intermittent network flake, and treat a test that only fails under parallel workers as a test-isolation bug, not flake to retry away (https://qaskills.sh/blog/playwright-retries-flaky-test-handling-guide)
- MUST set `trace: 'on-first-retry'` (not `'on'`, which is too heavy to run on every test) and `screenshot: 'only-on-failure'` so a CI failure ships a full trace - DOM snapshots, network, console - without paying trace cost on green runs (https://playwright.dev/docs/best-practices, https://testingmint.com/chapter-17-playwright-advanced-tips-and-optimization/)
- SHOULD run `@axe-core/playwright` inside the E2E suite and fail on critical/serious violations - it inspects the real rendered DOM against WCAG 2.2 rules with actionable selectors (https://www.qamadness.com/a-you-oriented-guide-to-axe-core-playwright-accessibility-testing/, https://playwright.aims-ai.com/blog/playwright-accessibility-testing-2026)
- MUST use the trace viewer, not screenshots/video alone, to debug a shard-specific CI failure - it is a shareable local PWA with timeline, DOM inspection and network (https://playwright.dev/docs/best-practices)

### Contract tests (OpenAPI)

- SHOULD run Dredd (or an equivalent schema-vs-implementation runner) in CI for lightweight verification that the live API returns what the spec documents - minimal setup, no scenario generation (https://dev.to/r3d_cr0wn/enforcing-api-correctness-automated-contract-testing-with-openapi-and-dredd-2212)
- SHOULD add Schemathesis (or a Node property-based equivalent) for exploratory fuzzing from the OpenAPI schema when the contract check alone is not finding edge cases - it generates schema-compliant but adversarial requests (https://www.davidmello.com/software-testing/test-automation/automated-api-testing-with-schemathesis)
- SHOULD run each operation with its own setup/teardown hooks rather than one shared fixture, so one operation's contract failure does not cascade into unrelated ones (https://dev.to/r3d_cr0wn/enforcing-api-correctness-automated-contract-testing-with-openapi-and-dredd-2212)

### Mutation testing (Stryker)

- SHOULD run StrykerJS with the Vitest runner, moving to `coverageAnalysis: "perTest"` when full-suite-per-mutant cost becomes prohibitive - it re-runs only the tests relevant to each mutant (https://oneuptime.com/blog/post/2026-01-25-mutation-testing-with-stryker/, https://loiane.com/2026/08/mutation-testing-angular-stryker/)
- SHOULD set `thresholds: { high: 85, low: 70, break: <today's floor> }` and wire `stryker run` as a gating CI job, not an informational one (https://qaskills.sh/blog/mutation-testing-stryker-guide-2026)
- MUST set `break` at a number the current suite actually clears, then ratchet it up - an aspirational `break` that the tree does not meet is FLOW-3's mistake in mutation-testing form (https://qaskills.sh/blog/mutation-testing-stryker-guide-2026)
- SHOULD scope mutation testing to changed files on PRs and run the full sweep on a schedule (weekly) - full-repo mutation on every PR is usually too slow to gate on (https://github.com/rethinkhealth/glion/issues/737)
- MUST verify a mutation testing config actually executes mutants against tests - a misconfigured runner can execute zero tests per mutant and still exit green if `break: 0` reads "no failures" as "pass" (https://github.com/Chris0Jeky/Taskdeck/issues/3038)

### "Verify the guard by breaking it"

- MUST prove any guard, ratchet or mutation config by deliberately reintroducing the defect it exists to catch, watching it fail, then reverting - a check that reports "0 findings across 0 files" is a silent no-op, not a pass (https://github.com/kitplummer/lowendinsight/issues/68)
- MUST re-verify a guard whenever the code it guards changes shape, not only when the guard itself changes - a guard that stops matching its target rots silently (https://github.com/kitplummer/lowendinsight/issues/68)

### Flaky test policy

- SHOULD quarantine a flaky test into a separate non-blocking suite rather than deleting it or leaving it in the blocking gate - it keeps producing signal without holding up merges (https://mergify.com/learn/test-quarantine)
- MUST attach an owner and a deadline to every quarantined test - unowned quarantine becomes a graveyard nobody returns from (https://mergify.com/learn/test-quarantine, https://scrolltest.com/flaky-tests-detection-quarantine-prevention-guide-2026/)
- MUST return a quarantined test to the blocking suite only after its root cause is fixed and it has proven stable, never on a timer alone (https://scrolltest.com/flaky-tests-detection-quarantine-prevention-guide-2026/)
- SHOULD use 0 retries locally (so a developer feels their own flakiness) and at most 2 retries in CI; more than 2 hides genuine regressions and wastes CI minutes (https://qaskills.sh/blog/playwright-retries-flaky-test-handling-guide, https://scrolltest.com/flaky-tests-detection-quarantine-prevention-guide-2026/)

## 2. Coverage policy

- SHOULD prefer branch/function coverage over line coverage as the binding threshold - line coverage rewards executing a branch without asserting both outcomes (https://vitest.dev/config/coverage)
- SHOULD set thresholds per glob for the areas that carry legal/money weight, distinct from the global floor, because one number cannot express "checkout math needs 100%, the admin UI needs 60%" (https://vitest.dev/config/coverage)
- MUST record excluded paths (generated code, migrations, vendored UI) explicitly in `coverage.exclude` and in the document that explains the policy - an unwritten exclusion is indistinguishable from a hole nobody noticed (mirrors P-2/CODE-1 in the standard; https://vitest.dev/config/coverage)
- MUST pin a coverage threshold at today's measured number and only raise it in a dated, reasoned commit - never lower it to make a build pass, and never set an aspirational number the tree does not meet (general FLOW-3 principle; https://vitest.dev/config/coverage confirms `autoUpdate` exists but warns it is opt-in for exactly this reason)
- SHOULD treat mutation score as the check on what coverage cannot see: 80%+ is strong, 60-80% needs work, below 60% means the suite exercises code without asserting on it (https://qaskills.sh/blog/mutation-testing-stryker-guide-2026)

## 3. CI on Woodpecker CI (v3.x)

- SHOULD split a repository into multiple pipelines/workflows by cost (e.g. `checks`, `integration`, `e2e`) rather than one monolith, so a fast signal does not wait on a slow one (https://woodpecker-ci.org/docs/usage/workflows)
- MUST use `depends_on` to express ordering between workflows/steps - without it, steps run serially in file order; with it, Woodpecker builds a DAG and runs independent steps in parallel (https://woodpecker-ci.org/docs/usage/workflow-syntax)
- SHOULD use the `optional: true` flag on a `depends_on` entry (Woodpecker 3.15+) when a dependency should not block every execution path - e.g. a deploy pipeline depending optionally on a slow suite (https://linuxiac.com/woodpecker-ci-3-15-released-with-smarter-pipeline-dependencies/)
- SHOULD gate steps and workflows with `when:` filters (`branch`, `event`, `path`, `status`, `evaluate`) instead of shell-level `if` checks inside the step, so skipped work is visible in the UI rather than buried in a log (https://woodpecker-ci.org/docs/usage/workflow-syntax)
- SHOULD declare `services:` (e.g. `postgres`, `redis`) for anything an integration suite needs alongside the pipeline, rather than starting containers by hand inside a step - services run for the life of the workflow (https://woodpecker-ci.org/docs/usage/workflow-syntax)
- SHOULD use `matrix` to run one workflow against several configurations (e.g. two Postgres majors) rather than duplicating the pipeline file (https://woodpecker-ci.org/docs/usage/matrix-workflows)
- MUST NOT write a literal `${...}` in a Woodpecker YAML file, including inside a comment - config-time string substitution runs over the raw file before parsing, so any `${SOMETHING}` referencing a variable not available at config-evaluation time expands to nothing and the pipeline dies with no steps and no status; only variables with config scope (not runtime-only ones like a step's own output) may appear there (https://woodpecker-ci.org/docs/usage/environment, https://github.com/woodpecker-ci/woodpecker/issues/3983)
- MUST escape a secret referenced inside a shell `commands:` block as `$${SECRET_NAME}` (double `$`), because Woodpecker's own `${...}` interpolation would otherwise consume the single-`$` form before the shell ever sees it (https://woodpecker-ci.org/docs/usage/secrets)
- MUST mark a repository/pipeline "trusted" to grant Docker-socket / volume-mount capability for Testcontainers-style integration tests - untrusted pipelines cannot mount the socket, and trust is an admin-granted, per-repo capability, not a per-pipeline flag (https://github.com/woodpecker-ci/woodpecker/discussions/4078)
- SHOULD read Testcontainers' Docker connection from the standard `DOCKER_HOST`/`TESTCONTAINERS_*` environment variables rather than hardcoding a socket path - these are framework-agnostic and already respected by Testcontainers (adapted from Java Testcontainers docs, applies identically to the Node client: https://java.testcontainers.org/features/configuration/)
- SHOULD disable the Ryuk reap container (`TESTCONTAINERS_RYUK_DISABLED=true`) only when the runner forbids privileged containers and the pipeline's own teardown step cleans up - otherwise leave it on as the safety net (https://java.testcontainers.org/features/configuration/)
- MUST NOT deploy by calling the Coolify API after a push when a Coolify deploy webhook is already wired to the same push - the two race, and the ecomm repo memory (`feedback_no_api_deploy.md`) already records this as a live mistake to avoid; let the webhook trigger deployment and use the CI pipeline only for gates (https://next.coolify.io/docs/core/automation/deploy-webhooks)
- SHOULD scope a Coolify deploy webhook token to the deploy permission only (not general read/write) so a leaked CI secret cannot do more than trigger a deployment (https://next.coolify.io/docs/core/automation/deploy-webhooks)

## 4. Local gates (pre-commit / pre-push)

- SHOULD run fast, staged-file-only checks (format, lint autofix, a lightweight typecheck) in `pre-commit` via a staged-files runner (e.g. lint-staged), so nobody reaches for `--no-verify` out of impatience (https://dev.to/kreshby/keep-your-code-clean-with-eslint-prettier-pre-commit-and-pre-push-hooks-using-husky-lint-staged-and-pretty-quick-4fka)
- SHOULD reserve slower, whole-repo checks (full typecheck, unit tests, the ratchet/readability score) for `pre-push`, matching the "always-on set, about two minutes" shape - pre-commit is not the place for anything that takes longer than a few seconds (https://iotools.cloud/journal/git-hooks-pre-commit-pre-push-and-stopping-bad-code-at-the-door/)
- SHOULD prefer Lefthook over Husky in a polyglot or pnpm monorepo: it is a single Go binary with no Node runtime dependency, runs hooks in parallel, and scopes commands to a subdirectory by glob without hand-written shell logic - Husky's sequential, Node-dependent model requires exactly that hand-written glob logic for a monorepo (https://gazar.dev/devops/lefthook-vs-husky-git-hooks, https://www.pkgpulse.com/guides/husky-vs-lefthook-vs-lint-staged-git-hooks-nodejs-2026)
- MUST keep the hook script and the CI gate as one implementation invoked from both places (a single `gate` script called by the hook and by the pipeline) - a hook that carries its own duplicated list drifts from CI within weeks, and the drift surfaces as "it passed locally" (general principle from the standard §2.3, corroborated by the Lefthook/Husky monorepo-glob discussion: https://gazar.dev/devops/lefthook-vs-husky-git-hooks)
- SHOULD make hook selection path-aware (only run the suite whose glob matches staged/changed files) rather than running everything on every commit - this is what makes the fast tier fast (https://gazar.dev/devops/lefthook-vs-husky-git-hooks)

## 5. Supply chain and security

- MUST use `npm ci` (or `pnpm install --frozen-lockfile`) in CI and Docker, never `npm install`/`pnpm install` unpinned - it installs exactly what the lockfile pins, verifies integrity hashes, and fails loudly on drift instead of silently rewriting the lockfile (https://shattered.io/npm-audit-nodejs/, corroborated by https://github.com/pnpm/pnpm/issues/3114)
- MUST generate/regenerate a lockfile on Linux before it is used in a Linux Docker build - a Windows-generated lockfile can drop platform-specific optional-dependency entries (e.g. `@esbuild/*`) and `npm ci`/`pnpm install --frozen-lockfile` then fails in the container (matches ecomm memory `reference_windows_tmp_split.md`-adjacent lesson already logged in the standard §8 "On platforms"; general practice: https://github.com/pnpm/pnpm/issues/3114)
- MUST review a lockfile diff in a PR with the same scrutiny as production code - it is a statement of exactly which code will run (https://shattered.io/npm-audit-nodejs/)
- SHOULD run `pnpm audit` (or `npm audit`) in CI against the shipped tree and gate on vulnerabilities a request can reach, tracking the tool's own transitive dev-dependency noise separately (matches the standard's existing `pnpm audit:gate` design; https://www.npmjs.com/@pnpm/audit)
- SHOULD set `min-release-age` (npm 11+) to refuse resolving a dependency version published within a short window (a few days) - this is the direct mitigation for a compromised-maintainer publish landing before it is caught (https://www.pkgpulse.com/guides/npm-supply-chain-security-guide-2026)
- MUST run a secret scanner (gitleaks) in two places from one config: staged-only on `pre-commit` (`gitleaks detect --staged`) for fast feedback, and full-history on CI so a leak from before the hook existed is still caught (https://www.kunalganglani.com/blog/gitleaks-pre-commit-ci-setup, https://khimananda.com/blog/secrets-scanning-in-git-and-ci-with-gitleaks)
- SHOULD start a legacy repository's secret scan in audit mode, generate a baseline of pre-existing findings, and fail CI only on NEW leaks going forward, rather than blocking on a backlog nobody can fix today (https://www.kunalganglani.com/blog/gitleaks-pre-commit-ci-setup)
- SHOULD generate a CycloneDX SBOM (`cyclonedx-node-npm`) in CI as a build artifact, listing every dependency and its metadata for later vulnerability correlation (https://cyclonedx.org/tool-center/, https://crashoverride.com/resources/knowledge-base/supply-chain-security/cyclonedx-sbom-cicd)
- SHOULD treat an SBOM as inventory, not proof - without signed provenance (SLSA, npm provenance / Sigstore) a forged or replayed SBOM is possible, so provenance attestation and signature verification are the actual supply-chain control, the SBOM is what you check it against (https://squidhacker.com/2026/03/npm-attacks-in-2026-escalating-supply-chain-threats-in-the-globalized-javascript-ecosystem-and-why-your-sbom-still-wont-save-you/)
- SHOULD run Renovate rather than Dependabot on a self-hosted/non-GitHub setup (Gitea, GitLab, Bitbucket) or a monorepo needing custom grouping - Dependabot is GitHub-only; Renovate supports every major forge and 200+ config options for scheduling and grouping (https://konvu.com/compare/dependabot-vs-renovate, https://blog.codercops.com/blog/renovate-vs-dependabot-dependency-updates-2026)
- SHOULD separate the security-update cadence from the routine version-bump cadence: auto-merge a security fix with no major bump after a short observation window (e.g. 24h green CI), route a security fix with a major bump through normal review, and batch routine version bumps weekly/biweekly with no auto-merge (https://safeguard.sh/resources/blog/renovate-vs-dependabot-enterprise-rollout-2026)
- SHOULD cap `prConcurrentLimit`/`prHourlyLimit` (Renovate) so a first run against a stale repo does not flood the PR queue past what review capacity can absorb (https://safeguard.sh/resources/blog/renovate-vs-dependabot-enterprise-rollout-2026)
- MUST verify authorization at the object level from the token's identity, never from a URL/body id - "the object-level check validates input does nothing for BOLA if the URL still decides which tenant you read" (OWASP ASVS V8 Authorization; https://dev.to/securitystefan/owasp-secure-coding-checklist-for-node-express-apis-2026-1505) - this is the AUTH-1 rule already in the standard, cited here as the ASVS-referenced quick win
- MUST pin the JWT verification algorithm explicitly (never accept whatever `alg` the token header claims) to close the `alg: none` / RS256-to-HS256 confusion class (OWASP ASVS V9 Self-contained Tokens; https://dev.to/securitystefan/owasp-secure-coding-checklist-for-node-express-apis-2026-1505)
- MUST NOT return a raw stack trace to an API client - map every thrown error to a structured code before the response leaves the process (OWASP ASVS V16 Security Logging and Error Handling; https://dev.to/securitystefan/owasp-secure-coding-checklist-for-node-express-apis-2026-1505) - already API-1/AUTH-1 territory in the standard, restated as an explicit ASVS chapter reference
- MUST NOT string-concatenate request input into a query - parameterize or use the query builder/ORM exclusively (OWASP ASVS V1/V2 Validation and Sanitization; https://dev.to/securitystefan/owasp-secure-coding-checklist-for-node-express-apis-2026-1505)
- SHOULD keep `.env*` files out of the repository entirely (already SEC-1) and additionally out of any Docker build context not explicitly copying only the variables needed - a `COPY . .` before `.dockerignore` is applied is the common leak vector for `.env.local` (general OWASP ASVS V13 Configuration guidance)

## 6. Delivery

- MUST format every commit as `<type>[optional scope]: <description>`, with `fix:` -> PATCH, `feat:` -> MINOR, and a `BREAKING CHANGE:` footer or `!` after type/scope -> MAJOR, regardless of type - this is the whole of Conventional Commits 1.0.0's semantic contract (https://github.com/conventional-commits/conventionalcommits.org, https://en.wikipedia.org/wiki/Conventional_Commits_Specification)
- MUST treat only `feat` and `fix` as spec-defined types; every other type (`chore`, `refactor`, `docs`, `test`, `ci`) is convention a team adopts on top, not part of the spec - document the team's own type list rather than assuming it is standard (https://github.com/conventional-commits/conventionalcommits.org)
- SHOULD keep `CHANGELOG.md` in the Keep a Changelog 1.1.0 format: an `Unreleased` section at the top, versioned sections below it in reverse-chronological order, entries grouped under `Added`/`Changed`/`Deprecated`/`Removed`/`Fixed`/`Security` (https://keepachangelog.com/en/1.1.0/)
- MUST version releases under Semantic Versioning 2.0.0 (`MAJOR.MINOR.PATCH`, MAJOR on incompatible API change, MINOR on backward-compatible feature, PATCH on backward-compatible fix) and treat pre-1.0.0 (`0.y.z`) as "anything may change at any time" (https://semver.org/spec/v2.0.0.html)
- MUST enforce the changelog-in-the-same-change rule mechanically (a CI check over the pushed diff range), not by convention alone - a rule that only lives in a contributing guide is the first thing a rushed PR skips (matches the standard's own CHANGE-1; corroborating industry practice: Keep a Changelog's own guidance that "no diff is too small to note" https://keepachangelog.com/en/1.1.0/)
- SHOULD keep branches merging within 24-48 hours and split anything larger into stacked PRs (a refactor PR followed by a feature PR, or a feature landed behind a flag) rather than one long-lived branch (https://mergify.com/learn/trunk-based-development, https://ilirivezaj.com/guides/git-workflow-guide)
- SHOULD land anything larger than a few hours of work behind a feature flag that defaults off in production, rather than delaying the merge until the feature is finished - this decouples merge from release and is what makes small, frequent merges to trunk safe (https://www.flagsmith.com/blog/trunk-based-development-feature-flags, https://developer.harness.io/docs/feature-flags/get-started/trunk-based-development/)
- MUST have fast/reliable CI and a way to keep trunk green (a merge queue, or serialized merges with the gate re-run on the merge commit) before removing long-lived branches - trunk-based development without these three supports (fast CI, flags, a green-trunk mechanism) quietly degrades back into feature branching (https://mergify.com/learn/trunk-based-development)
- SHOULD write an ADR using the MADR template (Markdown front matter: status, date, decision-makers, consulted, informed; sections: Context, Decision Drivers, Considered Options, Decision Outcome, Consequences) for any structurally significant decision, kept lightweight rather than skipped (https://adr.github.io/madr/, https://ozimmer.ch/practices/2022/11/22/MADRTemplatePrimer.html)
- SHOULD revisit an ADR roughly a month after the decision to compare it against what actually happened, and record the outcome rather than leaving the ADR as a one-time artifact (https://hidekazu-konishi.com/entry/architecture_decision_records_templates_and_operations.html)
- SHOULD use the MADR "bare" or "minimal" template variant for a low-stakes decision and the full annotated template only where the reasoning itself needs to be taught to the next reader - matching template weight to decision weight keeps the practice alive (https://adr.github.io/adr-templates/)

## Conflicts and gaps versus ENGINEERING_STANDARD.md

### (a) Practices the standard contradicts

- None found. Every practice researched here is either silent in the standard (gap, below) or already matches it (covered, below). No researched 2025-2026 practice recommends something the standard's instrument (§2), code rules (§3-6) or lessons catalogue (§8) forbids.

### (b) Practices the standard lacks and should add

- **No mutation-testing rule.** §2.2/§3 ratchet the metrics a linter cannot state, but nothing measures whether the test suite actually asserts on the branches it executes - the standard's own worked lesson (P-6, "a guard nobody has watched fail is not a guard") is exactly what Stryker's `break` threshold operationalizes, and it is currently prose (P-1) with no script behind it for test-suite _quality_ specifically, only for guards/ratchets.
- **No flaky-test/quarantine policy.** The standard requires CI to be trusted (§2.4 "a workflow that never executes... teaches people to merge on red") but has no stated mechanism for a genuinely flaky (not broken) test - without a quarantine lane, teams either leave main red intermittently or start retrying/skipping tests ad hoc, which is the exact "learn to merge on red" failure mode §2.4 already names for a different cause.
- **No contract-test tooling named for the two generated OpenAPI specs.** §4 (API-2) requires the spec to be generated from code and checked both ways (undocumented route fails, documented-but-absent route fails), but nothing runs a Dredd/Schemathesis-style check that the LIVE response body actually matches the generated schema at the field level (types, required-ness, enum values) - API-2's own check is spec-vs-route-table, not spec-vs-response.
- **No SBOM/provenance practice.** SEC-1 covers secrets and `pnpm audit`; nothing in the standard addresses generating an SBOM or verifying package provenance/signatures, which is now a standard supply-chain control beyond audit-for-known-CVEs.
- **No stated Woodpecker `${}`-escaping rule in the standard's own §2.4**, even though ecomm's CLAUDE.md already independently discovered and documented this exact pitfall ("Never write a `${…}` placeholder in a Woodpecker file, comments included"). The standard's §2.4 CI section should absorb this from ecomm's CLAUDE.md the way §8 absorbs other per-repo lessons that recurred - it is a Woodpecker-specific instrument fact, not an ecomm-specific one, and the next repository onto Woodpecker will rediscover it blind.
- **No local-hook tool named.** §2.5 (agent harness) and the "instrument" section describe `.githooks/pre-push` calling a shared gate script, but never states a hooks manager (Lefthook vs Husky) or the pre-commit/pre-push split by cost - leaving each repository to reinvent the split. Given the standard is stack-agnostic and one of its three source repos is JS/Node-only while ecomm is a pnpm monorepo, Lefthook's monorepo-glob scoping is a concrete argument for a recommended default.
- **No ADR template named.** §2.1 requires `docs/DECISIONS.md` or `docs/decisions/NNNN-*.md` to exist, but does not specify or recommend a template shape (MADR) - two of the three source repos likely improvised their own, which is exactly the kind of drift the standard exists to prevent (see P-6/§9 "may differ... may not differ" - ADR template shape is currently unclassified either way).
- **No Renovate/Dependabot cadence policy.** DATA/SEC sections say nothing about how dependency updates are scheduled, grouped, or auto-merged, despite `pnpm audit:gate` already existing - a policy on security-vs-routine update cadence is the missing half of that gate (the gate catches a known vulnerability; nothing says how the fix arrives as a PR).

### (c) Practices the standard already covers

- Colocated, single-behaviour, deterministically-timed unit tests: CODE-9, P-1, P-4 (pure core testable with synthetic fixtures; evidence over assertion)
- Real-Postgres integration tests, no ORM mocking, rolled-back transaction: DATA-4 verbatim
- Coverage thresholds pinned at today's number, never lowered: FLOW-3, P-2
- Per-file floor (not just a scalar total): §2.2 "Every ratchet is held twice: by its total and by a per-file floor" - matches Vitest `thresholds.perFile` exactly
- Guard verified by reintroducing the defect: P-1, "On testing guards" in §8, `check-invariants.sh` reference
- A check that scans zero files fails the run: §2.2, matches the "0 findings across 0 files" line verbatim
- CI split into pipelines by cost, same gates as the local hook, one implementation: §2.3, §2.4
- Docker socket / Testcontainers trust as an infra fact to document: §2.4 general principle ("the same gates as the hook"); ecomm's own `docs/OPERATIONS.md`/CLAUDE.md already documents CI specifics like this pattern
- Coolify webhook-only deploy (no parallel API deploy): ecomm memory `feedback_no_api_deploy.md`, consistent with FLOW-2/§2.4
- Lockfile discipline, Linux-generated lockfile, `pnpm audit:gate`: SEC-1, §8 "On platforms" (Windows lockfile dropping `@esbuild/*`)
- Secret scanning in one implementation, pre-commit and CI: SEC-1 verbatim
- Conventional Commits + no-em-dash + no-co-author: FLOW-1 verbatim
- Changelog enforced mechanically over the pushed range: CHANGE-1 verbatim
- ADR/decisions file required to exist: §2.1 table row for `docs/DECISIONS.md`
- Small, reversible, verified-before-claimed changes; gate before push: P-7, FLOW-2
- Fail-closed opt-ins, deny-by-default authorization scoped per resource: VALID-4, AUTH-1 (matches OWASP ASVS V8/V9/V2 quick wins found in research)
