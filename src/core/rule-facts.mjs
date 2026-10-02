/**
 * What a preset's rule file is judged against: the repository's dependencies, and the facts the
 * catalog reads from its tree, as `stack:<fact>`. A rule about a PWA was written into every Next
 * repository, since no dependency names one, while the catalog read the PWA family as not
 * applying (no service worker, no web manifest): the file was guidance for a repository that
 * does not exist. The same reading decides both now.
 */
import { buildContext } from "../rules/context.mjs";
import { dependencyNames } from "./repo.mjs";

/** The stack facts a rule may need, with how a skip names each one. */
const STACK = /** @type {const} */ ({ pwa: "service worker or web manifest" });

/**
 * The dependency names and the `stack:<fact>` entries true here.
 * @param {string} repoDir @returns {Set<string>}
 */
export function ruleFacts(repoDir) {
  const facts = new Set(dependencyNames(repoDir));
  const stack = buildContext(repoDir).stack;
  for (const k of /** @type {(keyof typeof STACK)[]} */ (Object.keys(STACK)))
    if (stack[k]) facts.add(`stack:${k}`);
  return facts;
}

/**
 * A need as a reader says it: a dependency by its name, a fact by what it is.
 * @param {string} need @returns {string}
 */
export function needLabel(need) {
  const k = need.startsWith("stack:") ? need.slice(6) : "";
  return k && k in STACK ? STACK[/** @type {keyof typeof STACK} */ (k)] : need;
}
