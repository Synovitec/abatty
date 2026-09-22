/**
 * The control cases: every probe proves itself on a throwaway repository where the answer is
 * known, in both directions (standard P.1). `abatty ratchet --controls` runs them for the
 * built-in probes and for a repository's own, and the package's test runs them on every push.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { buildContext } from "../rules/context.mjs";
import { DEFAULT_CONFIG, measureAll } from "./index.mjs";

/** @param {string} dir @param {string[]} args @param {string} [date] */
function git(dir, args, date = "") {
  const env = date
    ? { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date }
    : process.env;
  spawnSync("git", args, { cwd: dir, stdio: "ignore", env });
}

/** @param {string} dir @param {Record<string, string>} files */
function writeFiles(dir, files) {
  for (const [rel, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), content);
  }
}

/**
 * Remove a fixture, and never let the removal decide anything. The probe has already answered
 * by the time this runs, so a folder that will not go away is a leaked temp directory, not a
 * failed control: throwing from the teardown lost the answer AND masked whatever the block
 * above was reporting, which is how fifteen passing controls became a red suite on the release
 * of 0.3.0. The retries are for a writer that is not us and outlives the command that forked it.
 * @param {string} dir
 */
export function removeFixture(dir) {
  try {
    rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  } catch {
    // Left in the system's temp folder, which the system clears.
  }
}

/**
 * Run one probe's controls. Each control is a fresh git repository with the files committed,
 * the extra commits applied in order, and the probe measured with the control's config on top
 * of the defaults.
 * @param {import("./index.mjs").Probe} probe
 * @returns {{ name: string, expect: number, got: number, ok: boolean, detail: string }[]}
 */
export function runControls(probe) {
  return probe.controls.map((control) => {
    const dir = mkdtempSync(join(tmpdir(), `abatty-control-`));
    try {
      writeFiles(dir, control.files || {});
      git(dir, ["init", "-q", "-b", "main"]);
      git(dir, ["config", "user.email", "control@example.com"]);
      git(dir, ["config", "user.name", "Control"]);
      git(dir, ["config", "core.autocrlf", "false"]);
      // `git commit` forks `gc --auto`, which outlives the command and writes into `.git/`
      // (`update-server-info` recreates `.git/info/refs`) while the teardown below is walking
      // that very directory: ENOTEMPTY, about one run in six. The fixture lives for three
      // commits and is deleted, so it has nothing to collect.
      git(dir, ["config", "gc.auto", "0"]);
      git(dir, ["add", "-A"]);
      git(dir, ["commit", "-q", "--allow-empty", "--no-verify", "-m", "init"]);
      for (const c of control.commits || []) {
        writeFiles(dir, c.files);
        git(dir, ["add", "-A"]);
        git(dir, ["commit", "-q", "--allow-empty", "--no-verify", "-m", c.message], c.date);
      }
      const config = { ...DEFAULT_CONFIG, ...(control.config || {}) };
      const ctx = buildContext(dir);
      const [m] = measureAll([probe], ctx, { config, range: control.range || "" }, null);
      const got = m ? m.value : -1;
      const ok = got === control.expect;
      return {
        name: control.name,
        expect: control.expect,
        got,
        ok,
        detail: ok
          ? ""
          : m?.skipped ||
            m?.findings.map((f) => `${f.path}${f.detail ? " · " + f.detail : ""}`).join("; ") ||
            "no findings",
      };
    } finally {
      removeFixture(dir);
    }
  });
}
