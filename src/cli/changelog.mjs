/**
 * The `changelog` command: the changelog rule at commit time, run by the commit-msg hook `init`
 * writes. The staged files are judged against the same pair the push is judged by (CHANGE.1),
 * so a commit that touches source without its changelog line is refused before it exists, with
 * the one escape a decision needs: a `no-changelog: <reason>` line in the message.
 */
import { readFileSync } from "node:fs";
import { changelogPairs, stagedVerdict } from "../core/coupled.mjs";
import { git, readAdoption } from "../core/repo.mjs";
import { resolveConfig } from "../ratchet/config.mjs";
import { EXIT } from "./exit.mjs";
import * as t from "../ui/term.mjs";

/** @param {import("./ratchet.mjs").CliContext} cx */
export function changelogCommand(cx) {
  const { dir, opt, err } = cx;
  const file = opt("--message");
  if (!file) {
    err(
      `${t.glyph.fail} abatty changelog --message <file>: the commit-msg hook's form is the only one\n`,
    );
    return EXIT.input;
  }
  const staged = git(dir, "diff", "--cached", "--name-only", "--diff-filter=ACMR")
    .split("\n")
    .filter(Boolean);
  const message = readFileSync(file, "utf8")
    .split(/\r?\n/)
    .filter((l) => !l.startsWith("#"))
    .join("\n");
  const cfg = resolveConfig(readAdoption(dir));
  const v = stagedVerdict(staged, changelogPairs(cfg), message);
  if (v.ok) return EXIT.clean;
  err(
    `${t.glyph.fail} ${v.detail}\n  Add the line under ## [Unreleased] in ${cfg.changelog}, written for the reader, and stage it with this commit (CHANGE.1); or say why on a line of the message: no-changelog: <reason>\n`,
  );
  return EXIT.findings;
}
