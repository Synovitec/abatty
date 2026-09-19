/**
 * The events between two readings. `prev` null means the first reading, which is one event of
 * its own rather than a hundred "this rule appeared" lines nobody would read.
 * @param {any | null} prev
 * @param {any} next
 * @returns {AdoptionEvent[]}
 */
export function eventsBetween(prev: any | null, next: any): AdoptionEvent[];
/**
 * Every event across a repository's readings, oldest first. Derived on read rather than stored,
 * so a bug in the derivation is fixed by deploying rather than by rewriting a log.
 * @param {any[]} reports oldest first
 */
export function eventsOf(reports: any[]): AdoptionEvent[];
/** What the log says at a glance: how many of each kind, losses counted separately. @param {AdoptionEvent[]} events */
export function summariseEvents(events: AdoptionEvent[]): {
    total: number;
    kinds: Record<string, number>;
    regressions: number;
};
export type AdoptionEvent = {
    at: string;
    kind: string;
    subject: string;
    from?: string;
    to?: string;
    detail: string;
};
