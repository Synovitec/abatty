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

A release is a tag. On `main`: the version in `package.json` bumped (SemVer: a rule or a
probe added is a minor, a floor or a default changed for adopters is a major until 1.0, a fix
is a patch), the `[Unreleased]` section of the changelog renamed to the version and the date,
`npm pack --dry-run` read once (the tarball is `bin`, `src`, `types`, `templates`, `schema`,
`docs/standard`, the README, the changelog and the license, nothing else), then
`git tag vX.Y.Z && git push origin vX.Y.Z`. The release workflow runs the gate on the tagged
commit, checks the tag is the version, and publishes to the registry with provenance; the
token is the repository secret `NPM_TOKEN`. A local `npm publish` runs the gate first
(`prepublishOnly`) and is for the day the workflow cannot. Adopters pin the version through
`harness.lock.json`, written by `init` and `update`.
