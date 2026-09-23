/**
 * What each hook actually does in this repository, by day and at night: the settings that wire
 * it, the config keys it reads, and the tools it calls, read together. A hook's source says what
 * it CAN do; whether it does depends on three files nobody reads side by side, and a hook that is
 * installed, in step and unwired, or wired and switched off by one key, is green in every other
 * check `doctor` runs. An outside trial asked for this line after reading a hook that did nothing.
 */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { readAdoption } from "./repo.mjs";
import { scriptProgram, toolFound } from "./which.mjs";

/**
 * @typedef {{
 *   hook: string,
 *   wired: string[],
 *   day: string,
 *   night: string,
 *   warn?: string,
 * }} HookMode
 *   `wired`: the events (and matchers) that run it; empty when no settings file does.
 *   `warn`: the reason the effective mode is not the one the reader would assume.
 */

/** The settings files whose hooks run here, project first: the ones a session merges. */
const SETTINGS = [".claude/settings.json", ".claude/settings.local.json"];

/** A settings file, or null; `trim` also drops the BOM PowerShell 5.1 writes. @param {string} path @returns {Record<string, any> | null} */
function readJson(path) {
  try {
    return existsSync(path) ? JSON.parse(readFileSync(path, "utf8").trim()) : null;
  } catch {
    return null;
  }
}

/**
 * Where each hook script is wired: `Event` or `Event(matcher)`, per settings file, and whether any
 * of them (or the user's own settings) switches every hook off.
 * @param {string} repoDir @param {string} [home]
 * @returns {{ wiring: Map<string, string[]>, disabledBy: string | null }}
 */
export function hookWiring(repoDir, home = homedir()) {
  /** @type {Map<string, string[]>} */
  const wiring = new Map();
  /** @type {string | null} */
  let disabledBy = null;
  /** @type {[string, string][]} */
  const files = [
    ...SETTINGS.map((f) => /** @type {[string, string]} */ ([f, join(repoDir, f)])),
    ["~/.claude/settings.json", join(home, ".claude", "settings.json")],
  ];
  for (const [label, path] of files) {
    const s = readJson(path);
    if (!s) continue;
    if (s.disableAllHooks === true && !disabledBy) disabledBy = label;
    for (const [event, groups] of Object.entries(s.hooks || {}))
      for (const g of Array.isArray(groups) ? groups : [])
        for (const h of Array.isArray(g?.hooks) ? g.hooks : []) {
          const line = [h?.command, ...(Array.isArray(h?.args) ? h.args : [])].join(" ");
          const m = /\.claude[\\/]hooks[\\/]([\w-]+)\.mjs/.exec(line);
          const name = m?.[1];
          if (!name) continue;
          const at = g.matcher ? `${event}(${g.matcher})` : event;
          wiring.set(name, [...(wiring.get(name) || []), at]);
        }
  }
  return { wiring, disabledBy };
}

/**
 * The lint command's own tool, when it is one this machine cannot find: `npx eslint` runs eslint,
 * and npx without eslint installed answers every file with an error that reads as a red lint.
 * @param {string} repoDir @param {string} command @returns {string | null}
 */
function absentLinter(repoDir, command) {
  const words = command.trim().split(/\s+/);
  const program =
    words[0] === "npx"
      ? scriptProgram(
          words
            .slice(1)
            .filter((w) => !w.startsWith("-"))
            .join(" "),
        )
      : scriptProgram(command);
  return program && !toolFound(repoDir, program) ? program : null;
}

/**
 * Each shipped hook's effective mode here. The day and night lines are the hook's documented
 * behaviour narrowed by this repository's config; `warn` is set where the narrowing leaves the
 * hook doing nothing, or doing something the reader would not expect.
 * @param {string} repoDir @param {{ home?: string }} [o] @returns {HookMode[]}
 */
export function hookModes(repoDir, o = {}) {
  const cfg = readAdoption(repoDir) || {};
  const base = String(cfg.baseBranch || "main");
  const { wiring, disabledBy } = hookWiring(repoDir, o.home);
  const lintFile = String(cfg.commands?.lintFile || "npx eslint --max-warnings=0");
  const missingLinter = cfg.lintOnEdit === false ? null : absentLinter(repoDir, lintFile);
  const servers = Array.isArray(cfg.mcpServers) ? cfg.mcpServers.length : 0;
  const trailer = typeof cfg.provenance?.trailer === "string" ? cfg.provenance.trailer.trim() : "";
  const scrub = cfg.scrub?.enabled === true;
  /** @type {Omit<HookMode, "wired">[]} */
  const modes = [
    {
      hook: "guard",
      day: [
        cfg.directPushToBase === true ? `push to ${base} allowed` : `denies a push to ${base}`,
        "denies force push and --no-verify",
        scrub ? "refuses a commit that names a tool" : "",
      ]
        .filter(Boolean)
        .join("; "),
      night: `also denies leaving the branch, a push to ${base}, history rewrite, destructive SQL, deploy, publish, a dependency change and a shell write to the harness${trailer ? `; a commit without "${trailer}"` : ""}`,
    },
    {
      hook: "protect",
      day: "nothing (the permission flow decides)",
      night: `denies a write under .claude/, to a protected path (${(cfg.protectedPaths || []).length}) or outside the tree; ${servers ? `${servers} MCP server(s) allowed` : "every MCP tool denied"}`,
    },
    {
      hook: "lint-on-edit",
      day: "nothing",
      night:
        cfg.lintOnEdit === false
          ? "off (lintOnEdit: false)"
          : `lints each edited ${(cfg.lintExtensions || [".ts", ".tsx", ".js", ".jsx", ".mjs"]).join(" ")} file with ${lintFile}`,
      ...(missingLinter && {
        warn: `${missingLinter} is not installed here: npx fetches it or fails, and neither is a lint of this repository; set lintOnEdit to false or commands.lintFile to a linter this repository has`,
      }),
    },
    {
      hook: "stop-gate",
      day: "nothing (the gate is yours to run)",
      night: `refuses the stop until ${cfg.commands?.gate || "the gate"} is green, nothing is loosened, the tree is clean and the changelog moved; at most ${cfg.maxStopBlocks ?? 6} blocks; the config read from ${base}`,
    },
    { hook: "session-brief", day: "prints the brief", night: "prints the brief and the phase" },
  ];
  return modes.map((m) => {
    const wired = wiring.get(m.hook) || [];
    const off = disabledBy
      ? `every hook is off (disableAllHooks in ${disabledBy})`
      : !wired.length
        ? "not wired in any settings file, so it never runs"
        : "";
    return { ...m, wired, ...(off && { day: "nothing", night: "nothing", warn: off }) };
  });
}
