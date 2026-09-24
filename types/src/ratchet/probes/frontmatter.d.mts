/**
 * The faults of a front matter block, each with its line in the document. Empty when the document
 * has none, or has no front matter at all (that absence is reported on its own).
 * @param {string} text
 * @returns {{ line: number, fault: string }[]}
 */
export function frontMatterFaults(text: string): {
    line: number;
    fault: string;
}[];
