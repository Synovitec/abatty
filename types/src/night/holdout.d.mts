/**
 * A deterministic slice, by the hash of the rule's id against the night's seed. Deterministic so
 * two readings of the same night agree, seeded so two nights do not withhold the same rules and
 * a repository cannot quietly settle into passing the visible ones forever.
 * @param {string[]} ids @param {string} seed @param {number} [share] the fraction withheld
 * @returns {{ visible: string[], withheld: string[] }}
 */
export function splitSurface(ids: string[], seed: string, share?: number): {
    visible: string[];
    withheld: string[];
};
/**
 * How each side of the split stands, and the gap between them. A rule that does not apply is not
 * counted on either side: a night cannot be credited or blamed for a rule that was never its
 * subject.
 * @param {{ id: string, status: string }[]} findings @param {{ visible: string[], withheld: string[] }} split
 */
export function holdoutGap(findings: {
    id: string;
    status: string;
}[], split: {
    visible: string[];
    withheld: string[];
}): {
    visible: {
        judged: number;
        held: number;
        pct: number;
    };
    withheld: {
        judged: number;
        held: number;
        pct: number;
    };
    gap: number;
};
export function describeGap(g: ReturnType<typeof holdoutGap>): string;
