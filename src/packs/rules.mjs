/**
 * The verdict of a tool across the packs a tree carries: present when every pack has it,
 * partial when some, missing when none, n/a when no pack is selected. The evidence names the
 * pack and what was found, so a rule about "the linter" reads the same for every language.
 */
import { toolOf } from "./index.mjs";

/**
 * @param {import("../rules/context.mjs").RepoContext} c
 * @param {keyof import("./index.mjs").Pack["tools"]} tool
 * @param {(p: import("./index.mjs").Pack) => boolean} [select] the packs to judge (every one by default)
 * @returns {import("../rules/index.mjs").Verdict}
 */
export function perPack(c, tool, select = () => true) {
  const packs = c.packs.filter(select);
  if (!packs.length) return { status: "n/a", evidence: "no language pack selected" };
  const found = packs.map((p) => ({ pack: p, ...toolOf(c, p, tool) }));
  const n = found.filter((f) => f.present).length;
  return {
    status: n === packs.length ? "present" : n ? "partial" : "missing",
    evidence: found.map((f) => `${f.pack.id}: ${f.evidence}`).join("; "),
  };
}
