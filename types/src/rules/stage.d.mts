/**
 * @param {any} config
 * @param {{ docsOnly: boolean }} stack
 * @param {(re: RegExp) => string[]} files
 * @param {Record<string, string>} scripts
 * @returns {{ stage: Stage, from: "config" | "tree" }}
 */
export function stageOf(config: any, stack: {
    docsOnly: boolean;
}, files: (re: RegExp) => string[], scripts: Record<string, string>): {
    stage: Stage;
    from: "config" | "tree";
};
/**
 * The stage of a repository: design (documents, decisions, a schema, a mockup; no application
 * yet), build (an application being built), run (an application serving users, with a deploy
 * surface). The config names it (`stage`); otherwise it is read from the tree. A rule that
 * belongs to a stage is n/a at another, with the reason: a repository under design needs the
 * documents family, the changelog, a decisions log and a CI that can fail, not a dead-code gate.
 */
/** @typedef {"design" | "build" | "run"} Stage */
/** The stages a repository can be at, earliest first: a rule applies from the stage it names onwards. */
export const STAGES: string[];
export type Stage = "design" | "build" | "run";
