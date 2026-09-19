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
