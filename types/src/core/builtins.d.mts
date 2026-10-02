/**
 * @typedef {{ repoDir: string, log: (line: string) => void, events: import("./gate.mjs").GateEvent[], audit?: import("./gate.mjs").AuditRunner, range?: string }} BuiltinContext
 */
/**
 * Run one built-in step. True when the gate goes on (passed, skipped or deferred), false when it
 * stops here. With `stepLog`, what the step said is kept there as a script step's output is:
 * the secret scan, the audit and the scrub kept nothing, so a red one left no log to read.
 * @param {import("../presets/index.mjs").GateStep} s
 * @param {BuiltinContext & { stepLog?: string }} ctx
 */
export function builtinStep(s: import("../presets/index.mjs").GateStep, ctx: BuiltinContext & {
    stepLog?: string;
}): boolean;
export type BuiltinContext = {
    repoDir: string;
    log: (line: string) => void;
    events: import("./gate.mjs").GateEvent[];
    audit?: import("./gate.mjs").AuditRunner;
    range?: string;
};
