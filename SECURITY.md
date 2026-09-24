# Security policy

## Reporting a vulnerability

Report privately, through this repository's security advisories:

**https://github.com/Synovitec/abatty/security/advisories/new**

Please do not open a public issue for a vulnerability. A public issue is a disclosure, and it is
one you cannot take back.

## What to expect

- **Acknowledgement within 3 working days.** If you have not heard back in that time, assume the
  message was lost and report it again through the same link.
- **An assessment within 10 working days**, saying whether we agree it is a vulnerability, how
  severe we think it is and what we intend to do.
- **A fix, or a reason there will not be one.** Either way you are told, and you are told before
  anything is published.
- **Credit**, under whatever name you ask for, unless you would rather have none.

We will agree a disclosure date with you rather than setting one. If we disagree about severity,
that disagreement goes in the advisory too.

## What is in scope

This package is a command-line tool and a set of hooks that run inside somebody's repository. The
parts worth attacking are the ones that run code or read a credential:

- the hooks under `templates/harness/hooks/` and their installed copies in `.claude/`, which decide
  whether a command is allowed to run;
- the git shim in `templates/harness/bin/`, which stands in front of the real git;
- the unattended runner under `src/night/`, its sandbox and its trust scan;
- `abatty serve`, its bearer token and anything it exposes;
- any path where configuration from a repository can cause code to be executed.

A finding that a rule is wrong, a probe is inaccurate or a check misses a case is a **bug**, not a
vulnerability: open an issue for it. So is a false positive in the secret scan, though if you have
a case the scan should catch and does not, `src/core/secret-corpus.mjs` is where it goes and a
pull request is welcome.

## Versions

Only the latest published version is supported. This package has no runtime dependencies, so a
vulnerability here is in code this repository owns.

## How a release reaches you

With no runtime dependency, the package's whole supply-chain risk sits in one place: its own
publish. A compromised release would run inside every adopter's commit and push hooks, so the
path is short and has no stored secret in it.

- **A release is a tag.** `vX.Y.Z` is pushed after the version and the changelog section are on
  `main`; `.github/workflows/release.yml` runs the whole gate again on the tagged commit and
  refuses a tag that is not the version.
- **Trusted publishing, no token.** The registry names this repository and that workflow as the
  package's one publisher and refuses tokens, so no credential exists to be phished or leaked.
  The tarball carries provenance: which commit and which workflow run built it. The job that
  holds the identity a publish is made with installs nothing and runs no lifecycle script; the
  gate, and every development dependency it runs, is a job before it with no identity at all.
- **Every action the workflows use is pinned to a commit**, and a test in the package's own suite
  refuses one that is not, as it refuses a runtime dependency or an install script.
- **The conformance statement** for the release is signed with the run's identity, not with a key
  anybody holds.
- **Scorecard** measures the repository weekly, and its results are public.

The installed hooks call `npm run gate` and `npx abatty`, which resolve the copy your lockfile
pins, not the newest one. A release-age cooldown (`min-release-age` in npm, `minimumReleaseAge`
in pnpm) adds a day between a publish and your install; it also delays this package's own fixes by
that day, which is the trade.
