/**
 * The `secrets` command: the secret scan over the tree, the staged files (the pre-commit
 * hook) or a pushed range (CI), one implementation for the three.
 */
import { EXIT } from "./exit.mjs";
import { scanSecrets } from "../core/secrets.mjs";
import * as t from "../ui/term.mjs";

/** @param {import("./ratchet.mjs").CliContext} c */
export function secretsCommand(c) {
  const { dir, opt, flag, out, VERSION } = c;
  const mode = flag("--staged") ? "staged" : opt("--range") || "tree";
  const r = scanSecrets(dir, { mode });
  if (flag("--json")) {
    out(JSON.stringify({ mode, scanned: r.scanned, findings: r.findings }, null, 2) + "\n");
    return r.findings.length ? EXIT.findings : EXIT.clean;
  }
  out(
    `\n${t.banner(VERSION)}  ${t.bold("secrets")} ${t.gray(`· ${mode === "staged" ? "the staged files" : mode === "tree" ? "the tree" : "range " + mode} · ${r.scanned} file(s)`)}\n\n`,
  );
  for (const f of r.findings)
    out(
      `  ${t.glyph.fail} ${f.path}${t.gray(":" + f.line)}  ${t.red(f.kind)}  ${t.gray(f.sample)}\n`,
    );
  out(
    `${r.findings.length ? "\n" + t.glyph.fail + " " + t.red(`${r.findings.length} secret(s): rotate it, remove it, or mark a false positive on its line with abatty:allow-secret (or a path in secrets.allow, with the reason)`) : t.glyph.ok + " " + t.green("no secret in the scanned files")}\n\n`,
  );
  return r.findings.length ? EXIT.findings : EXIT.clean;
}
