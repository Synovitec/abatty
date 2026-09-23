// The audit on a real install, per package manager, in both directions. The suite reads each
// manager's report from a recording; this is where the recording is checked against the tool as
// it ships today, on the operating system the job runs on. A repository is installed with the
// manager, detected, audited clean, then given a dependency with a known high advisory and
// audited again, which must fail. A check nobody has watched fail is not a check, so the second
// half is the point.
//
//   node scripts/ci/manager-smoke.mjs <npm|pnpm|yarn>
//
// Exit 0 when both directions hold, 1 when one does not. A registry that cannot be reached is a
// deferral, never a pass: the job says so and exits 1, since this job exists to watch the network
// answer.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { launch } from "../../src/core/spawn.mjs";
import { packageManager } from "../../src/core/package-manager.mjs";
import { auditOutcome } from "../../src/core/audit.mjs";

const manager = process.argv[2] || "";
if (!["npm", "pnpm", "yarn"].includes(manager)) {
  console.error("usage: node scripts/ci/manager-smoke.mjs <npm|pnpm|yarn>");
  process.exit(2);
}

/** Run a command in a directory, output kept. @param {string} dir @param {string} cmd @param {string[]} args */
function run(dir, cmd, args) {
  const l = launch(cmd, args);
  const r = spawnSync(l.file, l.args, { cwd: dir, encoding: "utf8", shell: l.shell });
  return { status: r.status, output: (r.stdout || "") + (r.stderr || "") };
}

/** A repository with one dependency, installed by the manager under test. @param {Record<string, string>} deps */
function installed(deps) {
  const dir = mkdtempSync(join(tmpdir(), `abatty-smoke-${manager}-`));
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ name: "smoke", version: "1.0.0", private: true, dependencies: deps }),
  );
  const r = run(dir, manager, ["install"]);
  if (r.status !== 0) {
    console.error(`${manager} install failed:\n${r.output.slice(-2000)}`);
    process.exit(1);
  }
  return dir;
}

let failed = 0;
/** @param {string} what @param {Record<string, string>} deps @param {string} want */
function expect(what, deps, want) {
  const dir = installed(deps);
  try {
    const pm = packageManager(dir);
    const outcome = pm?.id === manager ? auditOutcome(dir, (c, a) => run(dir, c, a)) : null;
    const got = outcome ? outcome.outcome : `detected as ${pm?.id ?? "nothing"}`;
    const ok = got === want;
    if (!ok) failed++;
    console.log(
      `${ok ? "ok  " : "FAIL"} ${manager} · ${what}: ${got}${outcome?.detail ? ` · ${outcome.detail.split("\n")[0]}` : ""}`,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// is-number 7.0.0 carries no advisory. lodash 4.17.20 carries two high ones (GHSA-35jh-r3h4-6jhm
// among them); 4.17.21 is not clean either, since a later advisory covers every 4.x to 4.17.23.
expect("a clean install audits clean", { "is-number": "7.0.0" }, "ok");
expect("a known high advisory fails the step", { lodash: "4.17.20" }, "failed");
process.exit(failed ? 1 : 0);
