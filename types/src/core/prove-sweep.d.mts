/**
 * Remove what earlier runs left: copies older than two hours, logs older than a week. Returns
 * how many of each went, for a test; a folder that cannot be read is passed over.
 * @param {{ dir?: string, now?: number }} [o] @returns {{ copies: number, logs: number }}
 */
export function sweepStale(o?: {
    dir?: string;
    now?: number;
}): {
    copies: number;
    logs: number;
};
