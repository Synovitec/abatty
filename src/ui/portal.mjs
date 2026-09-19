/**
 * Conformance published into a developer portal's catalogue, without a plugin.
 *
 * The obvious shape for this is a portal plugin. A plugin is a separate package with the
 * portal's own framework as a dependency, which §1.1 of this repository's standard forbids here
 * and which would put the work behind an install everybody has to agree to. It also puts the
 * conformance where only that portal can read it.
 *
 * The catalogue already has a format: an entity descriptor, in the repository, that the portal
 * ingests on its own. So this writes that, with annotations pointing at the endpoints the hosted
 * service already serves. Any portal that reads the descriptor gets the conformance; nothing has
 * to be installed; and a team with no portal at all has a file that does no harm.
 *
 * It MERGES rather than overwrites. A `catalog-info.yaml` in a repository is somebody's, with an
 * owner and a system and a lifecycle nothing here knows; taking it over would be the rudest
 * thing this package could do to a tree it was invited into.
 */

/** The annotations this package owns. Everything else in the file belongs to whoever wrote it. */
export const ANNOTATION_PREFIX = "abatty.dev/";

/** @param {string} s */
const quote = (s) => `"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

/**
 * The annotations and links for a reading, as data. `dashboard` absent means the local file is
 * the only reading there is, so no URL is claimed: an annotation pointing nowhere is worse than
 * none, because a portal will render it as a working link.
 * @param {{ name: string, score: number, phase?: string, applicable: number, date: string, dashboard?: string }} o
 */
export function portalFacts(o) {
  /** @type {Record<string, string>} */
  const annotations = {
    [`${ANNOTATION_PREFIX}score`]: String(o.score),
    [`${ANNOTATION_PREFIX}checks`]: String(o.applicable),
    [`${ANNOTATION_PREFIX}measured-at`]: o.date,
  };
  if (o.phase) annotations[`${ANNOTATION_PREFIX}phase`] = o.phase;
  /** @type {{ url: string, title: string, icon: string }[]} */
  const links = [];
  if (o.dashboard) {
    const base = o.dashboard.replace(/\/+$/, "");
    annotations[`${ANNOTATION_PREFIX}report`] = `${base}/api/reports/${o.name}`;
    annotations[`${ANNOTATION_PREFIX}events`] = `${base}/api/events/${o.name}`;
    annotations[`${ANNOTATION_PREFIX}badge`] = `${base}/badge/${o.name}.svg`;
    links.push({
      url: `${base}/`,
      title: "abatty: what holds and what does not",
      icon: "dashboard",
    });
  }
  return { annotations, links };
}

/**
 * Merge the facts into an existing descriptor's text, or write a new one.
 *
 * The merge is textual and deliberately narrow: it replaces the lines whose key starts with this
 * package's prefix and appends the ones that were not there, inside the existing `annotations:`
 * block. It does not parse the file, because a parse-and-re-emit would reformat somebody else's
 * document and lose their comments, and nothing here is worth that.
 * @param {string | null} existing
 * @param {{ name: string, description: string }} entity
 * @param {ReturnType<typeof portalFacts>} facts
 * @returns {{ text: string, created: boolean, replaced: string[], added: string[] }}
 */
export function mergePortalEntity(existing, entity, facts) {
  const pairs = Object.entries(facts.annotations);
  if (!existing || !/^\s*kind:/m.test(existing)) {
    const lines = [
      "# Written by `abatty portal`. The annotations under abatty.dev/ are this package's and are",
      "# rewritten on each run; everything else here is yours, including the owner below, which is",
      "# a placeholder until somebody fills it in.",
      "apiVersion: backstage.io/v1alpha1",
      "kind: Component",
      "metadata:",
      `  name: ${entity.name}`,
      `  description: ${quote(entity.description)}`,
      "  annotations:",
      ...pairs.map(([k, v]) => `    ${k}: ${quote(v)}`),
      ...(facts.links.length ? ["  links:"] : []),
      ...facts.links.flatMap((l) => [
        `    - url: ${quote(l.url)}`,
        `      title: ${quote(l.title)}`,
        `      icon: ${l.icon}`,
      ]),
      "spec:",
      "  type: service",
      "  lifecycle: production",
      "  owner: unknown # fill this in: nothing in this package knows who owns your repository",
      "",
    ];
    return { text: lines.join("\n"), created: true, replaced: [], added: pairs.map(([k]) => k) };
  }
  /** @type {string[]} */
  const replaced = [];
  /** @type {string[]} */
  const added = [];
  let text = existing;
  for (const [k, v] of pairs) {
    const line = new RegExp(`^(\\s*)${k.replace(/[.\/]/g, "\\$&")}\\s*:.*$`, "m");
    if (line.test(text)) {
      text = text.replace(line, (_m, indent) => `${indent}${k}: ${quote(v)}`);
      replaced.push(k);
    } else added.push(k);
  }
  if (added.length) {
    const block = /^(\s*)annotations\s*:\s*$/m.exec(text);
    if (block) {
      const indent = `${block[1] || "  "}  `;
      text = text.replace(
        block[0],
        [block[0], ...added.map((k) => `${indent}${k}: ${quote(facts.annotations[k] || "")}`)].join(
          "\n",
        ),
      );
    } else {
      // No annotations block to merge into: say so by adding one under metadata, and if there is
      // no metadata either, leave the file alone rather than guessing at its shape.
      const meta = /^metadata\s*:\s*$/m.exec(text);
      if (!meta) return { text: existing, created: false, replaced, added: [] };
      text = text.replace(
        meta[0],
        [
          meta[0],
          "  annotations:",
          ...added.map((k) => `    ${k}: ${quote(facts.annotations[k] || "")}`),
        ].join("\n"),
      );
    }
  }
  return { text, created: false, replaced, added };
}
