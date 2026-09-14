// PreToolUse guard on Edit|Write|MultiEdit|NotebookEdit and on every MCP tool (mcp__*). The guard
// on Bash watches commands; this watches the file tools, which are how an agent edits most of
// the time, and the MCP tools, which are the door the other two do not see.
//
//   daytime  (ADOPTION_RUN unset)  nothing: exits 0, the normal permission flow decides
//   night    (ADOPTION_RUN=1)      denies a write under .claude/ (the harness: hooks, settings,
//                                  adoption.json, the stop counters - the very files the Stop gate
//                                  and this guard read), a write to a protected path (applied
//                                  migrations, env files), and a write outside the repository.
//                                  Denies every MCP tool whose server is not named in
//                                  adoption.json -> mcpServers (a mail, chat or drive connector
//                                  loaded from the user settings would otherwise act at night with
//                                  no hook watching), and applies the same path rules to any
//                                  path an allowed server's tool names (Serena's relative_path).
//
// The worker is the actor these hooks constrain; a control it can rewrite is prose. The Stop gate
// also reads adoption.json from the base branch, the runner refuses to push a branch where
// .claude/ moved, and the runner starts every session with --strict-mcp-config so only the
// servers in .claude/mcp.night.json exist at all - layers, because a text match is not a
// boundary on its own.

import { basename } from "node:path";
import { HARNESS_DIR, NIGHT, appendLog, decide, loadConfig, readEvent, toRepoPath } from "./lib.mjs";

if (!NIGHT) process.exit(0);

// Fail closed: a crashed PreToolUse hook does not block, so at night an internal error denies.
process.on("uncaughtException", (err) => {
  if (NIGHT) decide("deny", `Unattended run: the guard hit an internal error and refuses by default (${err && err.message ? err.message : err}).`);
  process.exit(0);
});

const event = readEvent();
const tool = String(event.tool_name || "");
const isMcp = tool.startsWith("mcp__");
if (!isMcp && !["Edit", "Write", "MultiEdit", "NotebookEdit"].includes(tool)) process.exit(0);

const config = loadConfig();

function deny(target, reason) {
  appendLog("guard-denials", { tool, path: target, reason });
  decide("deny", reason);
  process.exit(0);
}

/** The harness, the protected paths and the tree boundary: one target, denied or let through. */
function checkPath(target) {
  const rel = toRepoPath(target);
  if (rel === null) {
    deny(target, `Unattended run: writing outside the repository (${target}) is not allowed. Record the need in the decisions file.`);
  }
  if (rel.startsWith(HARNESS_DIR)) {
    deny(
      target,
      `Unattended run: ${rel} is part of the harness (.claude/) and is read-only tonight. If adoption.json or a hook needs a change, write the exact edit as "decision: harness-change" in the decisions file; the morning applies it.`,
    );
  }
  const name = basename(rel);
  const hit = (config.protectedPaths || []).find((p) =>
    p.endsWith("/") ? ("/" + rel).includes("/" + p) : name === p || (p.startsWith(".") && name.startsWith(p)) || rel.includes("/" + p),
  );
  if (hit) {
    deny(
      target,
      `Unattended run: ${rel} is a protected path (${hit}: applied migrations, env files, production compose). Write the next migration instead of editing one; never touch env files. Record the need if it is real.`,
    );
  }
}

if (isMcp) {
  // mcp__<server>__<tool>: the server is what adoption.json allows or not. The names the agent
  // gives servers replace anything but [A-Za-z0-9_] with "_" ("mail.example" -> mail_example).
  const server = (tool.match(/^mcp__(.+?)__/) || [])[1] || tool.slice(5);
  const norm = (s) => String(s).replace(/[^A-Za-z0-9_]/g, "_");
  const allowed = (config.mcpServers || []).map(norm);
  if (!allowed.includes(norm(server))) {
    deny(
      "",
      `Unattended run: the MCP server "${server}" is not part of the night (adoption.json -> mcpServers names ${allowed.length ? allowed.join(", ") : "none"}). Nothing outside the repository is read or written at night; if the tool is needed, record it as "decision: environment-gap" and the morning decides.`,
    );
  }
  // An allowed server's tool that names a path is held to the same rules as Edit and Write.
  const input = event.tool_input || {};
  const targets = [];
  for (const key of ["file_path", "relative_path", "path", "notebook_path", "target_path", "new_path"]) if (input[key]) targets.push(String(input[key]));
  for (const key of ["paths", "relative_paths", "file_paths"]) if (Array.isArray(input[key])) targets.push(...input[key].map(String));
  for (const t of targets) checkPath(t);
  process.exit(0);
}

const target = String(event.tool_input?.file_path || event.tool_input?.notebook_path || "");
if (!target) process.exit(0);
checkPath(target);
process.exit(0);
