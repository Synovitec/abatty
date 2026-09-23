/**
 * Run one built-in step. True when the gate goes on (passed, skipped or deferred), false when it
 * stops here.
 * @param {import("../presets/index.mjs").GateStep} s
 * @param {{ repoDir: string, log: (line: string) => void, events: import("./gate.mjs").GateEvent[], audit?: import("./gate.mjs").AuditRunner }} ctx
 */
export function builtinStep(s: import("../presets/index.mjs").GateStep, ctx: {
    repoDir: string;
    log: (line: string) => void;
    events: import("./gate.mjs").GateEvent[];
    audit?: import("./gate.mjs").AuditRunner;
}): boolean;
