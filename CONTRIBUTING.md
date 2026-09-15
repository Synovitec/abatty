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
