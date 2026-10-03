/**
 * Whether the repository's own eslint reads the harness `init` installs under `.claude/`. The
 * harness is the instrument, not the product: an adopter's `eslint .` judged its hooks by the
 * product's rules (an unused import, a 600-line cap on the self-test) and the gate went red on
 * files nobody there wrote. Their eslint config is code, so it is never edited; the line to add is
 * said where it is needed, by `init` and by `doctor`, until the config mentions `.claude`.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** The config files eslint reads, flat first, in the order eslint itself looks for them. */
const FLAT = ["eslint.config.js", "eslint.config.mjs", "eslint.config.cjs", "eslint.config.ts"];
const LEGACY = [
  ".eslintrc.js",
  ".eslintrc.cjs",
  ".eslintrc.json",
  ".eslintrc.yaml",
  ".eslintrc.yml",
  ".eslintrc",
];

/** @param {string} repoDir @param {string} rel */
function text(repoDir, rel) {
  try {
    return readFileSync(join(repoDir, rel), "utf8");
  } catch {
    return "";
  }
}

/**
 * The eslint config that would read `.claude/` and the line that keeps it out, or null when there
 * is no eslint config or it (or `.eslintignore`) already names `.claude`.
 * @param {string} repoDir @returns {{ config: string, line: string } | null}
 */
export function harnessLintHint(repoDir) {
  // Only where the harness's scripts are installed: under the minimal profile .claude/ holds the
  // lock alone, a JSON file no linter reads, and the hint told a new repository to ignore it.
  if (!existsSync(join(repoDir, ".claude", "hooks"))) return null;
  const flat = FLAT.find((f) => existsSync(join(repoDir, f)));
  const config = flat || LEGACY.find((f) => existsSync(join(repoDir, f)));
  if (!config) return null;
  if ([config, ".eslintignore"].some((f) => text(repoDir, f).includes(".claude"))) return null;
  return {
    config,
    line: flat ? '{ ignores: [".claude/**"] }' : 'ignorePatterns: [".claude/"]',
  };
}

/**
 * What to tell the reader, in one sentence.
 * @param {{ config: string, line: string }} hint @returns {string}
 */
export function harnessLintSays(hint) {
  return `${hint.config} lints .claude/, the harness abatty installs: add ${hint.line} so your lint judges the product, not the instrument (abatty does not edit your eslint config)`;
}
