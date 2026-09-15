// SessionStart: what stdout says here is added to the model's context, so a fresh session starts
// oriented. Daytime: the gate commands. Unattended run: the run parameters, the phase, the
// state so far and the decisions already taken, so nothing is re-decided or re-done.

import { existsSync, readFileSync } from "node:fs";
import { NIGHT, currentBranch, loadConfig, parseJsonFile } from "./lib.mjs";

const config = loadConfig();
const lines = [];

lines.push(`[brief] branch: ${currentBranch() || "unknown"}`);
lines.push(`[brief] gate: ${config.commands?.gate || "npm run gate:fast"} · full: ${config.commands?.gateFull || "npm run gate"} · ratchet: ${config.commands?.standards || "npm run standards"}`);

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
