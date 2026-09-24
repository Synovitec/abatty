/** The night folders a repository has, newest first. @param {string} repoDir */
export function nightDates(repoDir: string): string[];
/**
 * Gather the facts of one night.
 * @param {string} repoDir @param {string} [date] the night folder; the newest when absent
 * @returns {NightReport | null}
 */
export function gatherNight(repoDir: string, date?: string): NightReport | null;
export { distil } from "./lessons.mjs";
export { renderNightReport } from "./report-render.mjs";
export type SessionFact = {
    name: string;
    phase: string;
    cost: number;
    denials: number;
    crashed: boolean;
    isError: boolean;
    sessionId: string;
};
export type ReceiptFact = {
    sessionId: string;
    phase: string | null;
    decision: string | null;
    reason: string | null;
    blocks: number;
    failedCheck: string | null;
};
export type BlockFact = {
    at: string;
    sessionId: string;
    phase: string | null;
    check: string;
    reason: string;
    block: number;
};
export type DenialFact = {
    at: string;
    tool: string;
    what: string;
    reason: string;
};
export type DecisionEntry = {
    date: string;
    code: string;
    text: string;
};
export type Lesson = {
    kind: "guard" | "stop-gate" | "phase" | "decision" | "direction" | "session" | "canary" | "tamper";
    title: string;
    lesson: string;
    check: string;
    evidence: string[];
    count: number;
};
export type NightReport = {
    date: string;
    branch: string;
    base: string;
    run: any;
    sessions: SessionFact[];
    receipts: ReceiptFact[];
    blocks: BlockFact[];
    denials: DenialFact[];
    direction: string[];
    phases: any[];
    decisions: Record<string, number>;
    decisionEntries: DecisionEntry[];
    commits: string[];
    tamper: string[];
    canary: {
        ok: boolean | null;
        findings: string[];
    };
    lessons: Lesson[];
    footprint: ReturnType<typeof harnessFootprint>;
    footprintShare: ReturnType<typeof footprintShare>;
};
import { harnessFootprint } from "./footprint.mjs";
import { footprintShare } from "./footprint.mjs";
