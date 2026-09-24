/**
 * The stage of a repository: design (documents, decisions, a schema, a mockup; no application
 * yet), build (an application being built), run (an application serving users, with a deploy
 * surface). The config names it (`stage`); otherwise it is read from the tree. A rule that
 * belongs to a stage is n/a at another, with the reason: a repository under design needs the
 * documents family, the changelog, a decisions log and a CI that can fail, not a dead-code gate.
 */

/** @typedef {"design" | "build" | "run"} Stage */
/** The stages a repository can be at, earliest first: a rule applies from the stage it names onwards. */
export const STAGES = ["design", "build", "run"];

/**
 * @param {any} config
 * @param {{ docsOnly: boolean }} stack
 * @param {(re: RegExp) => string[]} files
 * @param {Record<string, string>} scripts
 * @returns {{ stage: Stage, from: "config" | "tree" }}
 */
export function stageOf(config, stack, files, scripts) {
  const named = String(config?.stage || "");
  if (STAGES.includes(named)) return { stage: /** @type {Stage} */ (named), from: "config" };
  if (stack.docsOnly) return { stage: "design", from: "tree" };
  const deploySurface =
    files(
      /(^|\/)(Dockerfile|docker-compose[^/]*\.ya?ml|fly\.toml|vercel\.json|netlify\.toml|render\.yaml|Procfile)$|^(k8s|helm|deploy|infra|terraform)\/|^\.github\/workflows\/[^/]*(deploy|release)[^/]*\.ya?ml$|^\.woodpecker\/[^/]*(deploy|release)[^/]*\.ya?ml$/,
    ).length > 0 || Object.keys(scripts).some((k) => /^(deploy|release)(:|$)/.test(k));
  return { stage: deploySurface ? "run" : "build", from: "tree" };
}
