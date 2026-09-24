# Contributing

abatty is open source under the Apache License 2.0 (`LICENSE`). Contributions are accepted
under the Developer Certificate of Origin (https://developercertificate.org/): every commit
carries a `Signed-off-by: Name <email>` line (`git commit -s`), which says you wrote the change
or have the right to submit it under the license. There is no contributor agreement to sign.

## What a change carries

- The gate green: `npm run gate` (format, typecheck, tests, the ratchet against
  `scripts/ci/standards-baseline.json`, and the scan this repository opted into).
- A line under `## [Unreleased]` in `CHANGELOG.md` in the same commit, written for the reader.
- A rule change appends its ID to the list in `test/rules.test.mjs` and regenerates
  `docs/CATALOG.md` (`node bin/abatty.mjs rules --md > docs/CATALOG.md`).
- A new probe carries control cases in both directions; `abatty ratchet --controls` runs them,
  and a probe without a failing case is refused.
- A change to the standard (`docs/standard/`) says which rule moved and why, in the document
  itself; a rule that changes level is a changelog entry of its own, because it can turn a green
  repository red.

New rules and new probes are the best first contribution: small, self-contained, tested.

## Releasing

A release is a tag. On `main`: the version in `package.json` bumped (what bumps which number
is `docs/VERSIONING.md`), the `[Unreleased]` section of the changelog renamed to the version and the date,
`npm pack --dry-run` read once (the tarball is `bin`, `src`, `types`, `templates`, `schema`,
`docs/standard`, the README, the changelog and the license, nothing else), then
`git tag vX.Y.Z && git push origin vX.Y.Z`. The release workflow runs the gate on the tagged
commit, checks the tag is the version, and publishes to the registry with provenance through
trusted publishing: no token is stored anywhere (SECURITY.md, "How a release reaches you"). A
local `npm publish` runs the gate first (`prepublishOnly`), needs a maintainer's two-factor
session since the package refuses tokens, and is for the day the workflow cannot. Adopters pin the version through
`harness.lock.json`, written by `init` and `update`.

**A minor goes out as a candidate first.** Tag `vX.Y.0-rc.1` with the version `X.Y.0-rc.1`: the
workflow publishes it under the `next` tag, never `latest`. The adopters replay it
(`npm i -D abatty@next`, read-only for this repository: their reports come back as cases in
`test/adopter-corpus.test.mjs`); a miss is fixed as `rc.2`. When a candidate goes through a
replay with no must-level miss, the same commit is released as `vX.Y.0`. A patch that only fixes
what a replay found may skip the candidate.
