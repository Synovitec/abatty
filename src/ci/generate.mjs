/**
 * CI from the gate: the pipeline of a repository is generated from its preset's gate
 * definition - the same steps, in the same order, plus the secret scan, the audit and the
 * publish step to the hosted dashboard - so the gate and CI cannot list different steps. This
 * module is the provider-neutral half: the steps, the package manager's commands, the YAML
 * helpers. The providers render them (woodpecker.mjs, github.mjs); templates.mjs holds the
 * pull-request template and the ruleset, which is PRINTED, never written into a repository,
 * because it carries the vocabulary in the open.
 */
import { TERMS } from "../core/vocabulary.mjs";

/**
 * @typedef {import("../presets/index.mjs").Preset} Preset
 * @typedef {import("../presets/index.mjs").GateStep} GateStep
 * @typedef {import("../core/package-manager.mjs").PackageManager} PackageManager
 * @typedef {{ base?: string, node?: string, publish?: boolean, scripts?: Record<string, string>, pm?: PackageManager | null }} CiOptions
 * @typedef {{ name: string, command: string, when?: "always" | "db" | "browser", absent?: string }} CiStep
 */

/** The pipelines `abatty ci` can write, each from the same list of steps. */
export const PROVIDERS = ["woodpecker", "github"];

/**
 * The commands of the package manager a pipeline is written for: the repository's, read from
 * its lockfile, or npm where nothing says otherwise. A pipeline that said `npm ci` to a pnpm
 * repository was red from its first run (the trial's seventh defect).
 * @param {CiOptions} o
 */
export function tooling(o) {
  const pm = o.pm || null;
  const join = (/** @type {string[]} */ a) => a.join(" ");
  return {
    id: pm?.id || "npm",
    install: pm ? join(pm.install) : "npm ci",
    run: (/** @type {string} */ script, /** @type {string[]} */ args = []) =>
      pm
        ? join(pm.run(script, args))
        : join(["npm", "run", "-s", script, ...(args.length ? ["--", ...args] : [])]),
    exec: (/** @type {string} */ tool) => (pm ? join(pm.exec(tool)) : `npx ${tool}`),
    audit: pm ? pm.auditCommand : "npm audit --audit-level=high --omit=dev",
  };
}

/**
 * The steps of a preset's CI, in the gate's order, provider-neutral. Given the repository's
 * scripts, a step whose script the package does not have is kept in the list as ABSENT with the
 * reason and rendered as a comment rather than as a command that cannot run: the gate reports
 * the same step as skipped and the gap analysis names it, and the pipeline says the same thing
 * in the same words rather than going red on a script nobody wrote yet.
 * @param {Preset} preset @param {CiOptions} [o]
 */
export function ciSteps(preset, o = {}) {
  const base = o.base || "main";
  const t = tooling(o);
  /** The script the package has for a step (the preset's or an alternative), or null; every step when no scripts were given. @param {GateStep} s */
  const scriptOf = (s) => {
    if (!o.scripts) return String(s.script);
    const found = [s.script, ...(s.alternatives || [])].find(
      (n) => typeof n === "string" && typeof o.scripts?.[n] === "string",
    );
    return typeof found === "string" ? found : null;
  };
  /** @param {GateStep} s @param {"always" | "db" | "browser"} when @param {string} [suffix] */
  const stepOf = (s, when, suffix = "") => {
    const name = `${s.label}${suffix}`;
    // A preset command that starts with `npx` names a tool, not a manager: the manager's own
    // exec runs it (`pnpm exec`, `bunx`), and a pnpm pipeline carries nothing npm-shaped.
    if (s.command)
      return {
        name,
        command:
          s.command[0] === "npx" && s.command[1]
            ? [t.exec(String(s.command[1])), ...s.command.slice(2)].join(" ")
            : s.command.join(" "),
        when,
      };
    const script = scriptOf(s);
    if (!script)
      return {
        name,
        command: "",
        when,
        absent: `no "${s.script}" script in package.json; ${s.required ? "the preset requires this step, and the gate cannot run without it" : "the gap analysis names it"}`,
      };
    if (script === "standards")
      return {
        name,
        command: `git fetch --no-tags origin ${base} && ${t.run("standards", ["--range", `origin/${base}..HEAD`])}`,
        when,
      };
    return { name, command: t.run(script), when };
  };
  /** @type {CiStep[]} */
  const steps = [];
  for (const s of preset.gate.always) if (s.command || s.script) steps.push(stepOf(s, "always"));
  steps.push({
    name: "secret scan (SEC.1)",
    command: `git fetch --no-tags origin ${base} && ${t.exec("abatty")} secrets --range origin/${base}..HEAD`,
    when: "always",
  });
  steps.push({ name: "audit (SEC.1)", command: t.audit, when: "always" });
  // The same step the gate runs, so the two cannot list different ones. It is a no-op where the
  // repository did not opt in, exactly as the commit-msg hook is, and the command names no tool.
  steps.push({
    name: "no trace of the tools (scrub)",
    command: `${t.exec("abatty")} scrub .`,
    when: "always",
  });
  for (const suite of preset.gate.suites) {
    const when = /database|DATA.4/i.test(suite.name) ? "db" : "browser";
    for (const s of suite.steps)
      if (s.script || s.command) steps.push(stepOf(s, when, ` · ${suite.name}`));
  }
  if (o.publish !== false)
    steps.push({
      name: "publish the report to the dashboard",
      command: `${t.exec("abatty")} publish --to "$ABATTY_DASHBOARD" --token "$ABATTY_TOKEN"`,
      when: "always",
    });
  return steps;
}

/** A YAML scalar, quoted when it must be. @param {string} s */
export function y(s) {
  return /^[\w./ :=+()-]+$/.test(s) && !/^[\s-]|:\s|\s$/.test(s) ? s : JSON.stringify(s);
}
/** A step's name as an identifier. @param {string} name */
export function ident(name) {
  return (
    name
      .toLowerCase()
      .replace(/\(.*?\)/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "step"
  );
}
