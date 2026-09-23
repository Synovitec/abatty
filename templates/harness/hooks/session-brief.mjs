// SessionStart: what stdout says here is added to the model's context, so a fresh session starts
// oriented. Daytime: the gate commands. Unattended run: the run parameters, the phase, the
// state so far and the decisions already taken, so nothing is re-decided or re-done.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { NIGHT, currentBranch, defaultCommands, loadConfig, parseJsonFile, readEvent, snapshotFile, treeSnapshot } from "./lib.mjs";

const config = loadConfig();
const lines = [];

// What was already uncommitted when this session started, so the Stop hook judges only what the
// session itself changed: in a worktree other sessions share, their files are not this one's to
// commit or delete. The first start of a session is kept; a resumed session starts again from it.
if (NIGHT) {
  const file = snapshotFile(readEvent().session_id);
  if (!existsSync(file)) {
    try {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, JSON.stringify(treeSnapshot(), null, 2) + "\n");
    } catch {
      /* a snapshot that cannot be written means the Stop hook judges the whole tree, as before */
    }
  }
}

lines.push(`[brief] branch: ${currentBranch() || "unknown"}`);
// The config's commands, with the repository's own manager as the fallback (lib.mjs), so the
// brief names the command the Stop hook runs.
const cmd = { ...defaultCommands(), ...config.commands };
lines.push(`[brief] gate: ${cmd.gate} · full: ${cmd.gateFull} · ratchet: ${cmd.standards}`);

if (NIGHT) {
  lines.push(`[brief] UNATTENDED RUN. Nobody will answer a question. Take the default from CLAUDE.md §9 and record it in ${config.files?.decisions || "docs/ADOPTION_DECISIONS.md"}.`);
  lines.push(`[brief] phase: ${process.env.ADOPTION_PHASE ?? "unset"} · branch required: ${process.env.ADOPTION_BRANCH || "unset"} · run ends at: ${process.env.ADOPTION_UNTIL || "unset"}`);
  const stateFile = config.files?.state || "docs/ADOPTION_STATE.json";
  if (existsSync(stateFile)) {
    try {
      const state = parseJsonFile(stateFile);
      if (!Array.isArray(state.phases)) {
        lines.push(`[brief] ${stateFile}: "phases" is not an array - rewrite it as [{ id, status }, ...] first, the Stop hook refuses it as it is.`);
      }
      for (const p of Array.isArray(state.phases) ? state.phases : []) {
        lines.push(`[brief] phase ${p.id}: ${p.status}${p.reason ? " - " + p.reason : ""}${p.numbersAfter ? " · after: " + JSON.stringify(p.numbersAfter) : ""}`);
      }
    } catch {
      lines.push(`[brief] ${stateFile} is not valid JSON - restore it first.`);
    }
  } else {
    lines.push(`[brief] ${stateFile} is missing - create it from the phases in the config (abatty.config.json, or .claude/adoption.json) before anything else.`);
  }
  const decisions = config.files?.decisions || "docs/ADOPTION_DECISIONS.md";
  if (existsSync(decisions)) {
    const text = readFileSync(decisions, "utf8").split(/\r?\n/).filter((l) => l.startsWith("- ")).slice(-15);
    if (text.length) lines.push(`[brief] last decisions:\n${text.join("\n")}`);
  }
  lines.push(`[brief] the Stop hook will refuse to end this session while the gate is red, the tree is dirty, the changelog is untouched, or ${stateFile} was not updated for this phase.`);
}

process.stdout.write(lines.join("\n") + "\n");
