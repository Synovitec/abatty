/**
 * Where a repository stands in the adoption plan, phase by phase.
 *
 * The score over the whole catalog answers "how much of the standard does this repository
 * hold", which is the wrong question on day one: a healthy new project is missing a decisions
 * log, a coverage floor and a mutation run because the plan schedules them for later, and a
 * number that counts them against it reads as a verdict on work nobody was asked to do yet.
 * Of the rules a fresh application was missing on 2026-09-18, six were phase 0 and seventeen
 * were phases the plan puts after it.
 *
 * So the headline is the phase the repository is ON: the earliest one in plan order with
 * unfinished work, and its standing. The denominator is small and honest and grows as the
 * repository advances. The score over everything stays beside it as a trend, which is all the
 * evidence supports it being (research 07, F4: no rule catalog in the field has been validated
 * against defects, and this one has not either).
 */
/** @typedef {import("./index.mjs").Finding} Finding */
/** @typedef {{ id: string, title: string, held: number, applicable: number }} PhaseCount the counts a reader sees */
/** @typedef {PhaseCount & { unmet: Finding[] }} PhaseStanding the counts plus what is left, for a caller that lists it */
/**
 * The phase a rule first belongs to. A rule may name two ("2 / 10": installed at 2, driven to
 * target at 10), and the earliest is when a repository first owes it. A name the plan does not
 * carry ("-", "status") belongs to no phase and is unscheduled.
 * @param {string} phase @param {string[]} order the phase ids in plan order
 */
export function phaseOf(phase: string, order: string[]): string | null;
/**
 * The standing per phase, in plan order, and the phase the repository is on. `phases` is the
 * plan filtered to the repository's stage; a finding that is n/a or waived counts nowhere, and
 * one whose phase the plan does not carry is unscheduled rather than silently dropped.
 * @param {Finding[]} findings @param {{ id: string, title: string }[]} phases
 * @returns {{ phases: PhaseStanding[], current: PhaseStanding | null, unscheduled: PhaseStanding }}
 */
export function standing(findings: Finding[], phases: {
    id: string;
    title: string;
}[]): {
    phases: PhaseStanding[];
    current: PhaseStanding | null;
    unscheduled: PhaseStanding;
};
export type Finding = import("./index.mjs").Finding;
/**
 * the counts a reader sees
 */
export type PhaseCount = {
    id: string;
    title: string;
    held: number;
    applicable: number;
};
/**
 * the counts plus what is left, for a caller that lists it
 */
export type PhaseStanding = PhaseCount & {
    unmet: Finding[];
};
