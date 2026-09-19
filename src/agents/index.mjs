/**
 * The agent adapters: the harness talks to an agent through an adapter - its settings folder,
 * its context file, where its path-scoped rules go and in what shape, whether it has a hook
 * protocol, and the flags of its headless mode. What an adapter cannot give is said plainly:
 * the enforcement of a night is the hooks (the guard, the file guard, the Stop gate), and an
 * agent without a hook protocol gets the context, the rules, the gate and CI, never a night.
 *
 * The skill is in the open agent-skills format (a folder with SKILL.md: name, description,
 * license, compatibility, metadata) and every adapter names where it goes.
 * The primary adapter is the one the harness was built on; its folder is the agent's own and
 * its id is derived from it, so this file names no tool. The others are open conventions.
 */
import { REQUIRED_PATHS } from "../core/vocabulary.mjs";

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   folder: string | null,
 *   contextFile: string,
 *   rulesDir: string | null,
 *   skillsDir: string | null,
 *   rulesFormat: "paths-front-matter" | "mdc",
 *   hooks: { protocol: "json-stdin" | "none", preToolUse: boolean, stop: boolean, sessionStart: boolean },
 *   headless: null | {
 *     prompt: string[], mode: (mode: string) => string[], promptsOff: string[], outputJson: string[],
 *     budget: (usd: number) => string[], model: (m: string) => string[], effort: (e: string) => string[],
 *     mcpStrict: (cfg: string) => string[], name: (n: string) => string[],
 *   },
 *   guarantees: Record<"guard" | "protect" | "stopGate" | "canary" | "night" | "rules" | "context", boolean>,
 * }} Adapter
 */

const primaryFolder = REQUIRED_PATHS[2] || ".claude";
const primaryContext = REQUIRED_PATHS[3] || "CLAUDE.md";

/** @type {Adapter} */
export const PRIMARY = {
  id: primaryFolder.replace(/^\./, ""),
  name: "the harness's own agent (hooks, settings folder, headless mode)",
  folder: primaryFolder,
  contextFile: primaryContext,
  rulesDir: `${primaryFolder}/rules`,
  skillsDir: `${primaryFolder}/skills`,
  rulesFormat: "paths-front-matter",
  hooks: { protocol: "json-stdin", preToolUse: true, stop: true, sessionStart: true },
  headless: {
    prompt: ["-p"],
    mode: (m) => ["--permission-mode", m],
    promptsOff: ["--permission-prompts", "none"],
    outputJson: ["--output-format", "json"],
    budget: (usd) => ["--max-budget-usd", String(usd)],
    model: (m) => ["--model", m],
    effort: (e) => ["--effort", e],
    mcpStrict: (cfg) => ["--strict-mcp-config", "--mcp-config", cfg],
    name: (n) => ["-n", n],
  },
  guarantees: {
    guard: true,
    protect: true,
    stopGate: true,
    canary: true,
    night: true,
    rules: true,
    context: true,
  },
};

/** @type {Adapter} */
export const AGENTS_MD = {
  id: "agents-md",
  name: "the open AGENTS.md convention (any agent that reads it)",
  folder: null,
  contextFile: "AGENTS.md",
  rulesDir: null,
  skillsDir: ".agents/skills",
  rulesFormat: "paths-front-matter",
  hooks: { protocol: "none", preToolUse: false, stop: false, sessionStart: false },
  headless: null,
  guarantees: {
    guard: false,
    protect: false,
    stopGate: false,
    canary: false,
    night: false,
    rules: false,
    context: true,
  },
};

/** @type {Adapter} */
export const CURSOR = {
  id: "cursor",
  name: "Cursor (AGENTS.md, .cursor/rules/*.mdc with globs)",
  folder: ".cursor",
  contextFile: "AGENTS.md",
  rulesDir: ".cursor/rules",
  skillsDir: ".cursor/skills",
  rulesFormat: "mdc",
  hooks: { protocol: "none", preToolUse: false, stop: false, sessionStart: false },
  headless: null,
  guarantees: {
    guard: false,
    protect: false,
    stopGate: false,
    canary: false,
    night: false,
    rules: true,
    context: true,
  },
};

/** @type {Adapter[]} */
export const ADAPTERS = [PRIMARY, AGENTS_MD, CURSOR];

/** @param {string} id */
export function adapterById(id) {
  return ADAPTERS.find((a) => a.id === id) || null;
}

/**
 * The adapters a repository configured (`agents` in its config), the primary when it names
 * none; unknown ids are reported, never silently dropped.
 * @param {Record<string, any> | null | undefined} config
 */
export function configuredAdapters(config) {
  const ids =
    Array.isArray(config?.agents) && config.agents.length
      ? config.agents.map(String)
      : [PRIMARY.id];
  /** @type {Adapter[]} */
  const found = [];
  /** @type {string[]} */
  const unknown = [];
  for (const id of ids) {
    const a = adapterById(id);
    if (a) found.push(a);
    else unknown.push(id);
  }
  return { adapters: found, unknown };
}

/** What a repository loses when its adapters have no hook protocol: one line per lost guarantee. @param {Adapter} a */
export function lostGuarantees(a) {
  /** @type {Record<string, string>} */
  const words = {
    guard: "the guard (a dangerous command refused before it runs)",
    protect: "the file guard (the harness and the protected paths read-only at night)",
    stopGate: "the Stop gate ('done' only when the gate says so)",
    canary: "the canary (the hooks proven in a real session before a night)",
    night: "the unattended night itself",
    rules: "path-scoped rules loaded when a matching file is read",
  };
  return Object.entries(a.guarantees)
    .filter(([k, v]) => !v && words[k])
    .map(([k]) => words[k] || k);
}

/**
 * A path-scoped rule (`paths:` front matter) as a Cursor `.mdc` rule: the same body, the
 * paths as `globs`, never always-on. Returns the text.
 * @param {string} text
 */
export function toMdc(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  const body = m ? text.slice(m[0].length) : text;
  const front = m ? m[1] || "" : "";
  const paths = [...front.matchAll(/^\s*-\s*["']?([^"'\n]+?)["']?\s*$/gm)].map((x) => x[1] || "");
  const title = (body.match(/^#\s+(.+)$/m) || [null, "rule"])[1];
  return `---\ndescription: ${JSON.stringify(String(title).replace(/\s*\(.*\)\s*$/, ""))}\nglobs: ${JSON.stringify(paths.join(","))}\nalwaysApply: false\n---\n${body.replace(/^\s+/, "")}`;
}

/**
 * The argument list of one headless session for an adapter that has a headless mode.
 * @param {Adapter} a
 * @param {{ prompt: string, mode: string, budget: number, model: string, effort: string, mcpConfig: string, name: string }} s
 */
export function sessionArgs(a, s) {
  const h = a.headless;
  if (!h) throw new Error(`${a.id} has no headless mode: no session can be started for it`);
  return [
    ...h.prompt,
    s.prompt,
    ...h.mode(s.mode),
    ...h.promptsOff,
    ...h.outputJson,
    ...h.budget(s.budget),
    ...h.model(s.model),
    ...h.effort(s.effort),
    ...h.mcpStrict(s.mcpConfig),
    ...h.name(s.name),
  ];
}

/**
 * Which agent surfaces this repository actually covers: per adapter, whether the file it reads
 * is on disk. An adapter named in the config whose file was never written is the gap this
 * answers - the repository believes it is covered and the agent reads nothing.
 * @param {(p: string) => boolean} exists @param {Adapter[]} [adapters]
 */
export function surfaceCover(exists, adapters = ADAPTERS) {
  return adapters.map((a) => ({
    id: a.id,
    name: a.name,
    contextFile: a.contextFile,
    covered: exists(a.contextFile),
  }));
}
