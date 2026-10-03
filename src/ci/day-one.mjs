/**
 * The gate in CI from the first day. An adopter's two critical advisories surfaced only because
 * somebody ran the gate by hand, and nothing in `init` or `doctor` said that no pipeline ran it:
 * `abatty ci` could write one, and nothing pointed to it. This module reads whether any pipeline
 * runs the gate, and writes the smallest one that does: install, then `gate:fast` (the audit and
 * the secret scan included) on every push and pull request. It never touches a pipeline it did not
 * write; the full one is still `abatty ci`'s.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { git, readJsonFile } from "../core/repo.mjs";
import { packageManager } from "../core/package-manager.mjs";
import { tooling } from "./generate.mjs";
import { githubSetup } from "./github.mjs";
import { runsGate } from "./hand-kept.mjs";

/** Where the day-one workflow goes. */
export const DAY_ONE = ".github/workflows/abatty-gate.yml";

/** The pipelines a repository keeps, by the forges' own conventions. @param {string} repoDir */
export function pipelinesOf(repoDir) {
  /** @param {string} dir */
  const yamlIn = (dir) =>
    existsSync(join(repoDir, dir))
      ? readdirSync(join(repoDir, dir))
          .filter((f) => /\.ya?ml$/.test(f))
          .map((f) => `${dir}/${f}`)
      : [];
  return [
    ...yamlIn(".github/workflows"),
    ...yamlIn(".woodpecker"),
    ...[".woodpecker.yml", ".gitlab-ci.yml"].filter((f) => existsSync(join(repoDir, f))),
  ];
}

/**
 * Whether CI runs the gate here: `gate` when a pipeline runs the whole gate, `fast` when the
 * best one runs it without its suites, `no-gate` when pipelines exist and none runs it, `none`
 * when there is no pipeline at all.
 * @param {string} repoDir
 * @returns {{ state: "gate" | "fast" | "no-gate" | "none", pipelines: string[], github: boolean }}
 */
export function ciGate(repoDir) {
  const pipelines = pipelinesOf(repoDir);
  // Whether init would write the day-one workflow here: what to say about a missing gate in CI
  // turns on it, since a repository off GitHub was told init writes one it never did.
  const github = onGithub(repoDir);
  if (!pipelines.length) return { state: "none", pipelines, github };
  const scripts = readJsonFile(repoDir, "package.json")?.scripts || {};
  const read = pipelines.map((p) => runsGate(readFileSync(join(repoDir, p), "utf8"), scripts));
  if (read.some((r) => r.runs)) return { state: "gate", pipelines, github };
  if (read.some((r) => /leaves out the suites/.test(r.how)))
    return { state: "fast", pipelines, github };
  return { state: "no-gate", pipelines, github };
}

/** Whether the repository's forge is GitHub: a GitHub remote, or a .github folder. @param {string} repoDir */
export function onGithub(repoDir) {
  return (
    /github\.com[:/]/.test(git(repoDir, "remote", "get-url", "origin")) ||
    existsSync(join(repoDir, ".github"))
  );
}

/**
 * The day-one workflow: the repository's own install, then the fast gate, on every push and pull
 * request, with read-only permissions and the actions pinned as the full pipeline pins them.
 * @param {string} repoDir @param {string[]} [pyTools] the tools a Python gate runs, installed first
 * @returns {string}
 */
export function dayOneWorkflow(repoDir, pyTools = []) {
  const t = tooling({ pm: packageManager(repoDir) });
  return [
    "# Written by `abatty init`: the gate on every push and pull request, the audit and the secret",
    "# scan included. Yours to edit; abatty never writes over it. `abatty ci` writes the full",
    "# pipeline (the suites, the findings, the conformance statement) when you want it.",
    // Not "abatty gate": a pipeline is read by the commands it runs, and the name matched as one.
    "name: gate",
    "on:",
    "  push:",
    "  pull_request:",
    "permissions:",
    "  contents: read",
    "jobs:",
    "  gate:",
    "    runs-on: ubuntu-latest",
    "    steps:",
    ...githubSetup(t, "22", pyTools),
    `      - run: ${t.run("gate:fast")}`,
    "",
  ].join("\n");
}

/**
 * What doctor and init say about CI and the gate, when it is not the whole gate on every push.
 * @param {ReturnType<typeof ciGate>} ci @returns {string}
 */
export function ciSays(ci) {
  const write = ci.github
    ? `abatty init writes ${DAY_ONE} (the fast gate on every push), abatty ci the full pipeline`
    : "abatty ci --provider <name> writes the pipeline (init writes a GitHub workflow only where the remote is GitHub)";
  if (ci.state === "none")
    return `no CI pipeline: the gate runs only when somebody runs it · ${write}`;
  if (ci.state === "no-gate")
    return `CI runs ${ci.pipelines.length} pipeline(s), none of them the gate: an advisory or a secret waits for a hand run · ${write}`;
  if (ci.state === "fast")
    return "CI runs the fast gate, without its suites: abatty ci writes the pipeline that runs them";
  return "";
}

/**
 * What the fast gate says about the suites it skipped: CI runs them only where a pipeline runs
 * the whole gate. It said "CI still runs them" while the pipeline init writes runs the fast gate.
 * @param {string} repoDir
 * @returns {string}
 */
export function fastNote(repoDir) {
  return ciGate(repoDir).state === "gate"
    ? "--fast: skipped the conditional suites. CI runs them (its pipeline runs the whole gate)."
    : "--fast: skipped the conditional suites, and no pipeline here runs them: `abatty ci` writes one that does.";
}
