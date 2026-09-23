/**
 * The fragments waiting in a folder, with the section each names; a file whose name names no
 * section is read as Changed rather than dropped, since the entry is what matters.
 * @param {string} repoDir @param {string} folder relative to the repository
 * @returns {{ file: string, section: string, body: string }[]}
 */
export function readFragments(repoDir: string, folder: string): {
    file: string;
    section: string;
    body: string;
}[];
/**
 * Cut a release: what stands under `## [Unreleased]` and every fragment become the section
 * `## [version] - date`, grouped by section, and the fragments are removed. `[Unreleased]` stays,
 * empty, for the next change.
 * @param {{ repoDir: string, changelog: string, folder: string, version: string, date: string }} o
 * @returns {{ fragments: number, written: boolean }}
 */
export function foldRelease(o: {
    repoDir: string;
    changelog: string;
    folder: string;
    version: string;
    date: string;
}): {
    fragments: number;
    written: boolean;
};
/** Keep a Changelog's sections, in the order a release lists them. */
export const SECTIONS: string[];
