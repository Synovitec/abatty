import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

/** A fresh temp directory that is a git repository with one commit on main. @param {string} name @param {Record<string,string>} [files] */
export function tempRepo(name, files = {}) {
  const dir = mkdtempSync(join(tmpdir(), `abatty-${name}-`));
  for (const [rel, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), content);
  }
  git(dir, "init", "-q", "-b", "main");
  git(dir, "config", "user.email", "test@example.com");
  git(dir, "config", "user.name", "Test");
  git(dir, "config", "core.autocrlf", "false");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "--allow-empty", "-m", "init");
  return dir;
}

/** @param {string} dir @param {string[]} args */
export function git(dir, ...args) {
  const r = spawnSync("git", args, { cwd: dir, encoding: "utf8" });
  return (r.stdout || "").trim();
}

/** Run the CLI; { code, out } with stdout and stderr joined. @param {string[]} args @param {string} cwd */
export function cli(args, cwd) {
  const r = spawnSync(
    process.execPath,
    [new URL("../bin/abatty.mjs", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"), ...args],
    { cwd, encoding: "utf8", env: { ...process.env, ADOPTION_RUN: "" } },
  );
  return { code: r.status ?? 1, out: (r.stdout || "") + (r.stderr || "") };
}

/** A minimal Next-shaped package.json. */
export const NEXT_PKG =
  JSON.stringify(
    {
      name: "fixture-next",
      version: "0.1.0",
      private: true,
      scripts: { test: "node -e process.exit(0)", build: "node -e process.exit(0)" },
      dependencies: { next: "15.0.0", react: "19.0.0" },
    },
    null,
    2,
  ) + "\n";
