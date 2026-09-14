---
title: "Tooling templates - the import graph, dead code, codemods, duplication"
description: "The analysis pipeline a repository copies beside its lint and typecheck: a dependency-cruiser configuration whose rules are the arrows of the boundary map (cycles, orphans, layering, dev-dependencies in production code) with a known-violations baseline that only shrinks; a knip configuration that makes dead files, dependencies and exports a gate; a jscodeshift codemod skeleton for any change that touches more than ten files; and jscpd as the duplication ratchet. Where each file goes, the gate lines, the baseline commands, and how to prove each by breaking it."
category: reference
status: living
audience: ["developer", "agent"]
tags: ["tooling", "dependency-cruiser", "knip", "jscodeshift", "jscpd", "templates"]
related: ["../../ENGINEERING_STANDARD.md", "../../ENFORCEMENT_MAP.md", "../../ADOPTION_PLAN.md", "../agent/README.md"]
scope: synovitec
last_verified: "2026-09-14"
---

# Tooling templates

The verification box of the pipeline, beyond lint, types and tests: what the import graph
looks like (CODE-5), what nothing imports (CODE-6), what a change to many files is (CODE-11),
what is written twice (CODE-12). Versions verified 2026-09-14: dependency-cruiser 18.3,
knip 6.35, jscodeshift 17.4, jscpd 5.2.

| Template | Copy to | Wire |
|---|---|---|
| `.dependency-cruiser.cjs` | `<repo>/.dependency-cruiser.cjs` | `npm i -D dependency-cruiser`. Edit the rules under "the boundary map": one rule per arrow of `CLAUDE.md` §3 that must not exist; delete the examples that name directories the repository does not have. Gate line: `npx depcruise src --config .dependency-cruiser.cjs --ignore-known --output-type err` (exit code = error violations). Existing repository: `npx depcruise src --config .dependency-cruiser.cjs --baseline` once, commit `.dependency-cruiser-known-violations.json`, and it may only shrink |
| `knip.jsonc` | `<repo>/knip.json` | `npm i -D knip`. Gate line: `npx knip --max-issues 0`. Existing repository: `npx knip --reporter json` once for the count, gate at `--max-issues <count>` held by the ratchet as `dead.knipIssues`, drive to zero, drop the flag. A false positive is an `ignoreFiles` / `ignoreDependencies` entry with its reason beside it |
| `codemods/rename-import.cjs` | `<repo>/scripts/codemods/<what-it-does>.cjs` | `npm i -D jscodeshift` (`@types/jscodeshift` on TS). Dry run first: `npx jscodeshift --parser=tsx --dry --print -t scripts/codemods/<name>.cjs src`; the number of files it would touch goes in the commit message; apply, format, one commit that touches nothing else |
| (no file) jscpd | `package.json` script `dup: jscpd src --min-tokens 50 --reporters json --output .jscpd` | `npm i -D jscpd`. The ratchet reads `.jscpd/jscpd-report.json` as `dup.clones` (count) and `dup.clonedLines`, held per file like every ratchet; the gate runs the script before the ratchet. SHOULD-level: a repository may record "not measured" with the reason |

The gate order becomes: format → lint → typecheck → **graph → dead code** → unit → standards
(with `dup.*` when wired) + changelog range → the path-aware heavy suites. Graph and dead code
take seconds and sit in `gate:fast`; knip on a large Next.js tree can take twenty, which is
still under the two-minute always-on budget of the standard §2.3.

## Prove each by breaking it

A check nobody has watched fail is not a check (P-1). Once, on the day it is wired, and again
after any change to its configuration:

```bash
# graph: a cycle between two scratch modules is reported and the gate goes red
printf 'import "./b";\n' > src/a-probe.ts; printf 'import "./a-probe";\n' > src/b.ts
npx depcruise src --config .dependency-cruiser.cjs --ignore-known --output-type err; echo "exit $?"   # non-zero, names a-probe.ts and b.ts
rm src/a-probe.ts src/b.ts

# graph: an arrow of the boundary map is reported by the rule's own name
# (import the data layer from a component, run, expect the rule name in the output, restore)

# dead code: an exported function nobody imports is reported
printf 'export function unusedProbe() { return 1; }\n' > src/probe-dead.ts
npx knip --max-issues 0; echo "exit $?"   # non-zero, names probe-dead.ts
rm src/probe-dead.ts

# baseline direction: regenerate the known violations after adding a cycle - the file grows;
# check-direction.mjs must refuse it at night (a baseline that rose), and the morning reads why
```

Write the two results (red, then green after the restore) in `STANDARDS_PROGRESS.md` with the
date, as the plan's B.1 rule 3 requires.

## What is deliberately not here

`madge` (cycles and a graph picture: dependency-cruiser does both, with rules); a wrapper
script that runs all of these and prints one report (that is `npm run standards`, and the
gap analysis names the missing pieces per repository); an MCP code server at night (see
`templates/agent/mcp.night.json` - declared per repository, never in the user settings).
