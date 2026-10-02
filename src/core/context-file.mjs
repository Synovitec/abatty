/**
 * Which file holds this repository's agent context, and what is left to fill in it. `init`
 * keeps a context file the repository wrote and points AGENTS.md at it; it writes the template
 * only where there was none, into AGENTS.md, with the primary file importing it. Its last step
 * said "Fill CLAUDE.md (the placeholders in <>)" in both cases: to a repository whose own file
 * has no placeholders, and to one whose placeholders are in AGENTS.md.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PRIMARY } from "../agents/index.mjs";

/** The template's questions: `<project name>`, `<domain>`, `<if the repo has a public API>`. */
const PLACEHOLDER = /<[a-z][^<>\n]{1,60}>/g;

/** @param {string} repoDir @param {string} rel */
function read(repoDir, rel) {
  try {
    return readFileSync(join(repoDir, rel), "utf8");
  } catch {
    return "";
  }
}

/**
 * The file holding the context, whether the repository wrote it, and its unfilled placeholders.
 * @param {string} repoDir
 * @returns {{ file: string, own: boolean, placeholders: number }}
 */
export function contextState(repoDir) {
  const primary = read(repoDir, PRIMARY.contextFile);
  const own = primary.trim() !== "" && primary.trim() !== "@AGENTS.md";
  const file = own ? PRIMARY.contextFile : "AGENTS.md";
  return { file, own, placeholders: (read(repoDir, file).match(PLACEHOLDER) || []).length };
}
