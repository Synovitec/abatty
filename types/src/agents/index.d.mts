/** @param {string} id */
export function adapterById(id: string): Adapter | null;
/**
 * The adapters a repository configured (`agents` in its config), the primary when it names
 * none; unknown ids are reported, never silently dropped.
 * @param {Record<string, any> | null | undefined} config
 */
export function configuredAdapters(config: Record<string, any> | null | undefined): {
    adapters: Adapter[];
    unknown: string[];
};
/** What a repository loses when its adapters have no hook protocol: one line per lost guarantee. @param {Adapter} a */
export function lostGuarantees(a: Adapter): string[];
/**
 * A path-scoped rule (`paths:` front matter) as a Cursor `.mdc` rule: the same body, the
 * paths as `globs`, never always-on. Returns the text.
 * @param {string} text
 */
export function toMdc(text: string): string;
/**
 * The argument list of one headless session for an adapter that has a headless mode.
 * @param {Adapter} a
 * @param {{ prompt: string, mode: string, budget: number, model: string, effort: string, mcpConfig: string, name: string }} s
 */
export function sessionArgs(a: Adapter, s: {
    prompt: string;
    mode: string;
    budget: number;
    model: string;
    effort: string;
    mcpConfig: string;
    name: string;
}): string[];
/** @type {Adapter} */
export const PRIMARY: Adapter;
/** @type {Adapter} */
export const AGENTS_MD: Adapter;
/** @type {Adapter} */
export const CURSOR: Adapter;
/** @type {Adapter[]} */
export const ADAPTERS: Adapter[];
export type Adapter = {
    id: string;
    name: string;
    folder: string | null;
    contextFile: string;
    rulesDir: string | null;
    skillsDir: string | null;
    rulesFormat: "paths-front-matter" | "mdc";
    hooks: {
        protocol: "json-stdin" | "none";
        preToolUse: boolean;
        stop: boolean;
        sessionStart: boolean;
    };
    headless: null | {
        prompt: string[];
        mode: (mode: string) => string[];
        promptsOff: string[];
        outputJson: string[];
        budget: (usd: number) => string[];
        model: (m: string) => string[];
        effort: (e: string) => string[];
        mcpStrict: (cfg: string) => string[];
        name: (n: string) => string[];
    };
    guarantees: Record<"guard" | "protect" | "stopGate" | "canary" | "night" | "rules" | "context", boolean>;
};
