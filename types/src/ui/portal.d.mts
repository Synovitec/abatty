/**
 * The annotations and links for a reading, as data. `dashboard` absent means the local file is
 * the only reading there is, so no URL is claimed: an annotation pointing nowhere is worse than
 * none, because a portal will render it as a working link.
 * @param {{ name: string, score: number, phase?: string, applicable: number, date: string, dashboard?: string }} o
 */
export function portalFacts(o: {
    name: string;
    score: number;
    phase?: string;
    applicable: number;
    date: string;
    dashboard?: string;
}): {
    annotations: Record<string, string>;
    links: {
        url: string;
        title: string;
        icon: string;
    }[];
};
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
export function mergePortalEntity(existing: string | null, entity: {
    name: string;
    description: string;
}, facts: ReturnType<typeof portalFacts>): {
    text: string;
    created: boolean;
    replaced: string[];
    added: string[];
};
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
export const ANNOTATION_PREFIX: "abatty.dev/";
