/**
 * The `changelog` command: the changelog rule at commit time, run by the commit-msg hook `init`
 * writes. The staged files are judged against the same pair the push is judged by (CHANGE.1),
 * so a commit that touches source without its changelog line is refused before it exists, with
 * the one escape a decision needs: a `no-changelog: <reason>` line in the message. And
 * `--release <version>`: the release cut, which folds [Unreleased] and every fragment into the
 * dated section (src/core/fragments.mjs).
 */
import { readFileSync } from "node:fs";
import { changelogPairs, stagedVerdict } from "../core/coupled.mjs";
import { git, readAdoption } from "../core/repo.mjs";
import { resolveConfig } from "../ratchet/config.mjs";
import { foldRelease } from "../core/fragments.mjs";
import { localToday } from "../core/today.mjs";
import { EXIT } from "./exit.mjs";
import * as t from "../ui/term.mjs";

/** @param {import("./ratchet.mjs").CliContext} cx */
export function changelogCommand(cx) {
  const { dir, opt, err, out } = cx;
  const version = opt("--release");
  if (version) {
    const cfg = resolveConfig(readAdoption(dir));
    const r = foldRelease({
      repoDir: dir,
      changelog: cfg.changelog,
      folder: cfg.changelogFragments,
      version,
      date: opt("--date") || localToday(),
    });
    out(
      `${t.glyph.ok} ${cfg.changelog}: [Unreleased] released as [${version}]${r.fragments ? `, ${r.fragments} fragment(s) folded in and removed` : ""}
`,
    );
    return EXIT.clean;
  }
  const file = opt("--message");
  if (!file) {
    err(
      `${t.glyph.fail} abatty changelog --message <file> (the commit-msg hook's form), or --release <version>\n`,
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
    `${t.glyph.fail} ${v.detail}\n  Add the line under ## [Unreleased] in ${cfg.changelog}${cfg.changelogFragments ? ` or a fragment in ${cfg.changelogFragments}/ (<slug>.<added|changed|fixed|...>.md)` : ""}, written for the reader, and stage it with this commit (CHANGE.1); or say why on a line of the message: no-changelog: <reason>\n`,
  );
  return EXIT.findings;
}
