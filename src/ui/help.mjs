/**
 * The help screen: every command, its flags and what it is for, plus the exit-code table.
 *
 * It lives here rather than in the entry point for two reasons. The boundary map says terminal
 * text belongs to `src/ui/`, and the entry point was 312 code lines against a 300 budget, which
 * its own rule kept reporting. It is imported lazily by the one case that needs it, so the
 * modules parsed before a command is known do not change.
 */
import { EXIT_CODES } from "../cli/exit.mjs";
import * as t from "./term.mjs";

/**
 * @param {{ version: string, presets: { id: string }[] }} o
 * @returns {string}
 */
export function renderHelp(o) {
  const VERSION = o.version;
  const presets = o.presets;
  return `
${t.banner(VERSION)}  ${t.gray("the engineering standard as a command")}

  ${t.bold("abatty")} [status] [dir] [--fresh]                                    the repository at a glance
  ${t.bold("abatty init")} [dir] --stack <${presets.map((p) => p.id).join("|")}> [--ci <providers>] [--agent <ids>] [--force] [--dry-run]   the instrument, from the templates and the preset
  ${t.bold("abatty measure")} [dir] [--out <file>] [--json] [--sarif] [--quiet]  the gap analysis: score, every check, next steps by phase
  ${t.bold("abatty gate")} [dir] [--fast] [--range <git-range>] [--base <b>]     the path-aware gate the pre-push hook and the night run
  ${t.bold("abatty doctor")} [dir] [--strict] [--skip-self-test] [--controls]     the harness self-test and the drift against the package; --controls proves each gate step can go red
  ${t.bold("abatty scrub")} [dir] [--fix] [--commits|--range <r>] [--prs] [--history]  no trace of the tools (opt-in, scrub.enabled): files, commit messages, pull requests
  ${t.bold("abatty scrub")} --message <file>                                     the commit-msg hook: refuse a message that names one
  ${t.bold("abatty report")} [dir] [--json]                                     the JSON report under .abatty/reports/
  ${t.bold("abatty attest")} [dir] [--out <file>] [--json]                 the conformance statement, ready to sign: an in-toto predicate with what held, the waivers and their owners, and the proof each gate step can fail
  ${t.bold("abatty evidence")} [dir] [--out <file>]                         the requirement mapping for a person: what the rules evidence, and the requirements nothing here bears on
  ${t.bold("abatty validate")} [dir] [--since <rev>] [--json]                do the files that break each rule turn out to be the files somebody had to fix HERE: a correlation, with its confounder printed beside it
  ${t.bold("abatty portal")} [dir] [--out catalog-info.yaml] [--dashboard <url>] [--dry-run]   the conformance in the catalogue's own entity descriptor, merged into an existing one rather than over it
  ${t.bold("abatty dashboard")} [dir ...] [--out <file>] [--open]               one HTML page over the reports, light and dark
  ${t.bold("abatty rules")} [dir] [--family <f>] [--level must|should] [--phase <n>] [--json|--md]  the rule catalog: what must hold, why, what insures it
  ${t.bold("abatty explain")} <ID> [dir]                                       one rule, its reason, and its finding in this repository
  ${t.bold("abatty fix")} [dir] [--phase <n>] [--write]                        what a phase asks for that a machine can write; the plan unless --write
  ${t.bold("abatty check")} <ID> [dir] [--json]                                 one rule and an exit code: 0 it holds, 3 it does not (what a finding\u0027s verify names)
  ${t.bold("abatty secrets")} [dir] [--staged|--range <r>|--benchmark] [--json]   the secret scan: the tree, the staged files, a range, or the scan measured against the published corpus
  ${t.bold("abatty ratchet")} [dir] [--range <r>] [--base <b>] [--json|--sarif] [--controls]  every probe against the committed floor: a number may only fall
  ${t.bold("abatty baseline")} [dir] [--reason <why> --owner <who>] [--dry-run]   today's numbers as the floor; a floor raised names its reason and owner
  ${t.bold("abatty raises")} [dir] [--base <b>] [--require-review <pr>] [--json]  the floors this branch loosened, and whether an approval lands them
  ${t.bold("abatty mutate")} [dir] [--range <r>] [--max <n>] [--timeout <s>] [--strict]  mutation testing over the changed lines: a test that survives a broken line
  ${t.bold("abatty changelog")} --message <file> | --release <version> [--date <d>]  the changelog rule at commit time (the commit-msg hook), or the release cut
  ${t.bold("abatty ci")} [dir] [--provider github,woodpecker] [--check] [--ruleset]  CI from the gate; a pipeline you keep is judged by whether it runs the gate
  ${t.bold("abatty hooks")} [dir]                                              point git at .githooks and give each hook its executable bit
  ${t.bold("abatty update")} [dir] [--dry-run] [--force]                        the harness brought to this version, your edits kept; a conflict goes beside as .abatty-new
  ${t.bold("abatty config")} [dir] [--json] [--migrate [--dry-run]]              the configuration, its problems against the schema, the move to the root config
  ${t.bold("abatty agents")} [dir]                                             the agent adapters: what each gives, and what the ones named here lose
  ${t.bold("abatty profiles")} [dir] [--json]                                   the standards profiles named here, their rules and phases
  ${t.bold("abatty night")} [dir] [--phases <list>] [--until <HH:MM|+Nmin>] [--max-cost <usd>] [--no-push] [--canary-only]  the unattended run, one phase at a time
  ${t.bold("abatty night-report")} [dir] [--date <yyyy-mm-dd>] [--json]           what a night did, read from its folder
  ${t.bold("abatty serve")} [dir] [--port <n>] [--token <t>|--no-auth] [--data <dir>]  the hosted dashboard; reports are posted to it with a bearer token
  ${t.bold("abatty publish")} [dir] --to <url> --token <t>                        the report sent to a hosted dashboard
  ${t.bold("abatty mcp")} [dir]                                                the MCP server over stdio, scoped to this repository
  ${t.bold("abatty presets")}                                                    the stacks, and which repository proved each
  ${t.bold("abatty version")}

  ${t.gray("--plain on any command: no colour, ASCII markers, for a log file or a script")}

  ${t.gray("exit codes")}  ${EXIT_CODES.map(([c, w]) => `${c} ${w}`).join("  ·  ")}
  ${t.gray("3 is the one that matters: a gate that found something did not fail, it worked. 4 is the instrument.")}

`;
}
