/**
 * The `secrets` command: the secret scan over the tree, the staged files (the pre-commit
 * hook) or a pushed range (CI), one implementation for the three.
 */
import { EXIT } from "./exit.mjs";
import { scanSecrets, scanText } from "../core/secrets.mjs";
import { CORPUS, NEGATIVES, POSITIVES, scoreCorpus } from "../core/secret-corpus.mjs";
import * as t from "../ui/term.mjs";

/**
 * `abatty secrets --benchmark`: the scan measured against the published corpus, precision and
 * recall, and every case it got wrong by name. A scanner nobody has measured is a claim, and a
 * number nobody can reproduce is a slogan: the corpus is a file in this package, so the run is
 * the same on anybody's machine.
 * @param {import("./ratchet.mjs").CliContext} c
 */
function benchmark(c) {
  const { flag, out, VERSION } = c;
  const r = scoreCorpus((text) => scanText("corpus", text));
  if (flag("--json")) {
    out(
      JSON.stringify(
        {
          corpus: "src/core/secret-corpus.mjs",
          cases: r.total,
          positives: POSITIVES.length,
          negatives: NEGATIVES.length,
          precision: r.precision,
          recall: r.recall,
          falsePositives: r.falsePositives.map((x) => x.why),
          falseNegatives: r.falseNegatives.map((x) => x.why),
        },
        null,
        2,
      ) + "\n",
    );
    return r.falsePositives.length || r.falseNegatives.length ? EXIT.findings : EXIT.clean;
  }
  out(
    `\n${t.banner(VERSION)}  ${t.bold("secrets --benchmark")} ${t.gray(`· ${CORPUS.length} case(s): ${POSITIVES.length} secrets, ${NEGATIVES.length} look-alikes`)}\n\n`,
  );
  out(
    `  ${t.bold("precision")} ${t.bold(r.precision + "%")} ${t.gray("of what it reported was really a secret")}\n`,
  );
  out(
    `  ${t.bold("recall   ")} ${t.bold(r.recall + "%")} ${t.gray("of the secrets in the corpus were found")}\n\n`,
  );
  for (const x of r.falseNegatives) out(`  ${t.glyph.fail} ${t.red("missed")}  ${x.why}\n`);
  for (const x of r.falsePositives) out(`  ${t.glyph.fail} ${t.red("false alarm")}  ${x.why}\n`);
  out(
    `\n  ${t.gray("The corpus is this repository's own, assembled from the vendors' documented formats and from the false positives that get scanners uninstalled. A third-party benchmark would be better evidence and is still open.")}\n\n`,
  );
  return r.falsePositives.length || r.falseNegatives.length ? EXIT.findings : EXIT.clean;
}

/** @param {import("./ratchet.mjs").CliContext} c */
export function secretsCommand(c) {
  const { dir, opt, flag, out, VERSION } = c;
  if (flag("--benchmark")) return benchmark(c);
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
