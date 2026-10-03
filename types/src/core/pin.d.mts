/**
 * The range a repository gives this package when it is a range on a prerelease, or "": an exact
 * pin, a range on a release and no pin at all are each what they say.
 * @param {string} repoDir @returns {string}
 */
export function prereleaseRange(repoDir: string): string;
