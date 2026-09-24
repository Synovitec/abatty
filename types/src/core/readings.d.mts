/**
 * Names `written` as the successor of every earlier reading of its series that names none,
 * each pointing at the reading that follows it. A reading that already names one is left alone,
 * and so is a document without front matter. Returns the file names it changed.
 * @param {string} written absolute path of the reading `measure` wrote
 * @returns {string[]}
 */
export function linkPreviousReadings(written: string): string[];
/**
 * The document with `superseded_by` set to `next` in its front matter, or the text unchanged when
 * it already names a successor or has no front matter. An empty `superseded_by:` line is filled
 * in place rather than doubled, which a YAML reader would refuse.
 * @param {string} text @param {string} next
 */
export function withSuccessor(text: string, next: string): string;
