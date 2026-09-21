/**
 * CI from the gate: the pipeline of a repository is generated from its preset's gate
 * definition - the same steps, in the same order, plus the secret scan, the audit and the
 * publish step to the hosted dashboard - so the gate and CI cannot list different steps. Two
 * providers today, Woodpecker and GitHub Actions; a pull-request template; and a ruleset for
 * the organisation that refuses branch names naming a tool and requires the checks.
 *
 * The ruleset is PRINTED, never written into a repository: it carries the vocabulary in the
 * open, which a repository that scrubs must not.
 */
import { TERMS } from "../core/vocabulary.mjs";

/**
 * @typedef {import("../presets/index.mjs").Preset} Preset
 * @typedef {import("../presets/index.mjs").GateStep} GateStep
 * @typedef {import("../core/package-manager.mjs").PackageManager} PackageManager
 * @typedef {{ base?: string, node?: string, publish?: boolean, scripts?: Record<string, string>, pm?: PackageManager | null }} CiOptions
 * @typedef {{ name: string, command: string, when?: "always" | "db" | "browser", absent?: string }} CiStep
 */

export const PROVIDERS = ["woodpecker", "github"];

/**
 * The commands of the package manager a pipeline is written for: the repository's, read from
 * its lockfile, or npm where nothing says otherwise. A pipeline that said `npm ci` to a pnpm
 * repository was red from its first run (the trial's seventh defect).
 * @param {CiOptions} o
 */
function tooling(o) {
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
        absent: `no "${s.script}" script in package.json; the gap analysis names it`,
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
function y(s) {
  return /^[\w./ :=+()-]+$/.test(s) && !/^[\s-]|:\s|\s$/.test(s) ? s : JSON.stringify(s);
}
/** A step's name as an identifier. @param {string} name */
function ident(name) {
  return (
    name
      .toLowerCase()
      .replace(/\(.*?\)/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "step"
  );
}

/**
 * The Woodpecker pipeline: one `checks` pipeline with the always-on steps, the suites in their
 * own pipelines depending on it, Postgres as a service where the preset has a database suite.
 * @param {Preset} preset @param {CiOptions} [o]
 */
export function renderWoodpecker(preset, o = {}) {
  const node = o.node || "22";
  const steps = ciSteps(preset, o);
  const t = tooling(o);
  // A node image carries corepack, which puts pnpm and yarn on PATH from the `packageManager`
  // field; bun ships its own image.
  const image = t.id === "bun" ? "oven/bun:1" : `node:${node}`;
  const install =
    t.id === "pnpm" || t.id === "yarn"
      ? [`      - corepack enable`, `      - ${t.install}`]
      : [`      - ${t.install}`];
  /** @param {CiStep} s */
  const step = (s) => {
    if (s.absent) return `  # ${ident(s.name)}: ${s.absent}`;
    const lines = [`  ${ident(s.name)}:`];
    if (/abatty publish/.test(s.command))
      lines.push(
        `    image: ${image}`,
        `    secrets: [abatty_dashboard, abatty_token]`,
        `    when:`,
        `      evaluate: 'ABATTY_DASHBOARD != ""'`,
        `    commands:`,
        `      - ${y(s.command)}`,
      );
    else lines.push(`    image: ${image}`, `    commands:`, `      - ${y(s.command)}`);
    return lines.join("\n");
  };
  const always = steps.filter((s) => s.when === "always");
  const db = steps.filter((s) => s.when === "db");
  const browser = steps.filter((s) => s.when === "browser");
  const out = [
    `# Generated by \`abatty ci\` from the ${preset.id} preset's gate: the same steps, in the same order.`,
    `# Regenerate after a gate change; \`abatty ci --check\` says when this file is behind.`,
    `when:`,
    `  - event: [push, pull_request]`,
    ``,
    `steps:`,
    `  install:`,
    `    image: ${image}`,
    `    commands:`,
    ...install,
    ...always.map(step),
    ``,
  ];
  /** @param {string} job @param {CiStep[]} list */
  const onlyAbsent = (job, list) =>
    out.push(
      `# ${job}: no runnable step yet`,
      ...list.map((s) => `#   ${s.name}: ${s.absent}`),
      ``,
    );
  if (db.length && db.every((s) => s.absent)) onlyAbsent("the database suite", db);
  else if (db.length) {
    out.push(
      `---`,
      `# The database suite, on a real Postgres.`,
      `depends_on: [checks]`,
      `when:`,
      `  - event: [push, pull_request]`,
      ``,
      `services:`,
      `  postgres:`,
      `    image: postgres:16`,
      `    environment:`,
      `      POSTGRES_PASSWORD: postgres`,
      `      POSTGRES_DB: test`,
      ``,
      `steps:`,
      `  install:`,
      `    image: ${image}`,
      `    commands:`,
      ...install,
    );
    for (const s of db)
      if (s.absent) out.push(`  # ${ident(s.name)}: ${s.absent}`);
      else
        out.push(
          `  ${ident(s.name)}:`,
          `    image: ${image}`,
          `    environment:`,
          `      DATABASE_URL: postgres://postgres:postgres@postgres:5432/test`,
          `    commands:`,
          `      - ${y(s.command)}`,
        );
    out.push(``);
  }
  if (browser.length && browser.every((s) => s.absent)) onlyAbsent("the browser suite", browser);
  else if (browser.length) {
    out.push(
      `---`,
      `# The browser suite with axe, over the built output.`,
      `depends_on: [checks]`,
      `when:`,
      `  - event: [push, pull_request]`,
      ``,
      `steps:`,
      `  install:`,
      `    image: mcr.microsoft.com/playwright:v1.48.0-noble`,
      `    commands:`,
      ...install,
    );
    for (const s of browser)
      if (s.absent) out.push(`  # ${ident(s.name)}: ${s.absent}`);
      else
        out.push(
          `  ${ident(s.name)}:`,
          `    image: mcr.microsoft.com/playwright:v1.48.0-noble`,
          `    commands:`,
          `      - ${y(s.command)}`,
        );
    out.push(``);
  }
  return out.join("\n");
}

/**
 * The GitHub Actions workflow: a `checks` job with the always-on steps, a `database` job with a
 * Postgres service, a `browser` job, the publish step guarded by the secret.
 * @param {Preset} preset @param {CiOptions} [o]
 */
export function renderGithubActions(preset, o = {}) {
  const node = o.node || "22";
  const steps = ciSteps(preset, o);
  const t = tooling(o);
  /** @param {CiStep} s */
  const step = (s) => {
    if (s.absent) return `      # ${s.name}: ${s.absent}`;
    if (/abatty publish/.test(s.command))
      return [
        `      - name: ${y(s.name)}`,
        `        if: \${{ env.ABATTY_DASHBOARD != '' }}`,
        `        env:`,
        `          ABATTY_DASHBOARD: \${{ secrets.ABATTY_DASHBOARD }}`,
        `          ABATTY_TOKEN: \${{ secrets.ABATTY_TOKEN }}`,
        `        run: ${y(s.command)}`,
      ].join("\n");
    return [`      - name: ${y(s.name)}`, `        run: ${y(s.command)}`].join("\n");
  };
  // The runner's toolchain follows the lockfile: pnpm is installed before node so the cache
  // can find it, bun brings its own action, and the install is the manager's frozen one.
  const setup = [
    `      - uses: actions/checkout@v4`,
    `        with:`,
    `          fetch-depth: 0`,
    ...(t.id === "pnpm" ? [`      - uses: pnpm/action-setup@v4`] : []),
    ...(t.id === "bun" ? [`      - uses: oven-sh/setup-bun@v2`] : []),
    `      - uses: actions/setup-node@v4`,
    `        with:`,
    `          node-version: "${node}"`,
    ...(t.id === "bun" ? [] : [`          cache: ${t.id}`]),
    `      - run: ${t.install}`,
  ];
  const always = steps.filter((s) => s.when === "always");
  const db = steps.filter((s) => s.when === "db");
  const browser = steps.filter((s) => s.when === "browser");
  const out = [
    `# Generated by \`abatty ci\` from the ${preset.id} preset's gate: the same steps, in the same order.`,
    `# Regenerate after a gate change; \`abatty ci --check\` says when this file is behind.`,
    `name: checks`,
    `on:`,
    `  push:`,
    `  pull_request:`,
    `permissions:`,
    `  contents: read`,
    // The workload identity the signature is made with, and the write the transparency log needs.
    `  id-token: write`,
    `  attestations: write`,
    // The findings are uploaded to code scanning, which is what puts them on the diff of the
    // change under review rather than in a report nobody opens.
    `  security-events: write`,
    `jobs:`,
    `  checks:`,
    `    runs-on: ubuntu-latest`,
    `    steps:`,
    ...setup,
    ...always.map(step),
    // Emitted and uploaded even when a step above went red: a run that failed is exactly the run
    // whose findings a reviewer needs on the diff.
    // A bypass nobody can see afterwards is a gate with a hole nobody can measure.
    `      - name: the bypass rate of this push`,
    `        if: always()`,
    `        run: ${t.exec("abatty")} report --json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const b=JSON.parse(s).bypass||{};console.log(\`bypass: \${b.bypassed||0} of \${b.commits||0} commit(s) got past the hook without saying why (\${b.rate||0}%), \${b.reasoned||0} with a reason\`);process.exit(b.bypassed?1:0)})"`,
    `      - name: findings as SARIF`,
    `        if: always()`,
    `        run: ${t.exec("abatty")} ratchet --range auto --sarif > abatty.sarif || true`,
    `      - name: upload the findings`,
    `        if: always()`,
    `        uses: github/codeql-action/upload-sarif@v3`,
    `        with:`,
    `          sarif_file: abatty.sarif`,
    `          category: abatty`,
    // The conformance statement, signed by the RUN rather than by a key anybody holds.
    //
    // WHY here and not in the package: a signature is worth the identity behind it, and the only
    // identity available to a measurement tool would be a key on a developer's machine or a
    // secret in a repository, which is the weakest attestation of the two and the one most
    // likely to leak. The pipeline already has a short-lived workload identity that no human can
    // export, and the platform's own attestation action turns it into a signature in the
    // established transparency log. So this package prints the statement and the pipeline signs
    // it, with the run's identity, for free, in the store every verifier already reads.
    `      - name: the conformance statement`,
    `        if: always()`,
    `        run: ${t.exec("abatty")} attest --out abatty-conformance.json || true`,
    `      - name: sign it with this run's identity`,
    `        if: always()`,
    `        uses: actions/attest@v2`,
    `        with:`,
    `          subject-path: abatty-conformance.json`,
    `          predicate-type: https://abatty.dev/attestation/conformance/v1`,
    `          predicate-path: abatty-conformance.json`,
  ];
  /** A job whose every step is absent is written as the comments, not as a job with no steps. @param {string} job @param {CiStep[]} list */
  const onlyAbsent = (job, list) =>
    out.push(
      `  # ${job}: no runnable step yet`,
      ...list.map((s) => `  #   ${s.name}: ${s.absent}`),
    );
  if (db.length && db.every((s) => s.absent)) onlyAbsent("database", db);
  else if (db.length) {
    out.push(
      `  database:`,
      `    needs: checks`,
      `    runs-on: ubuntu-latest`,
      `    services:`,
      `      postgres:`,
      `        image: postgres:16`,
      `        env:`,
      `          POSTGRES_PASSWORD: postgres`,
      `          POSTGRES_DB: test`,
      `        ports: ["5432:5432"]`,
      `        options: >-`,
      `          --health-cmd pg_isready --health-interval 5s --health-timeout 5s --health-retries 10`,
      `    env:`,
      `      DATABASE_URL: postgres://postgres:postgres@localhost:5432/test`,
      `    steps:`,
      ...setup,
      ...db.map(step),
    );
  }
  if (browser.length && browser.every((s) => s.absent)) onlyAbsent("browser", browser);
  else if (browser.length) {
    out.push(
      `  browser:`,
      `    needs: checks`,
      `    runs-on: ubuntu-latest`,
      `    steps:`,
      ...setup,
      `      - run: ${t.exec("playwright")} install --with-deps`,
      ...browser.map(step),
    );
  }
  return out.join("\n") + "\n";
}
