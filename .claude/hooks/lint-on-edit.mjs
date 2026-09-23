// PostToolUse on Edit|Write and on MCP editing tools (mcp__*), unattended runs only: lint the file
// that was just written and hand the output back as additionalContext, so a limit is seen at the
// edit rather than at the stop. An MCP tool names its file as relative_path (Serena) or path.
// Never blocks - the Stop gate is the enforcement; this is the early warning.

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { extname } from "node:path";
import { NIGHT, defaultCommands, loadConfig, readEvent, tail } from "./lib.mjs";

if (!NIGHT) process.exit(0);

const config = loadConfig();
if (config.lintOnEdit === false) process.exit(0);

const event = readEvent();
const file = event.tool_input?.file_path || event.tool_input?.relative_path || event.tool_input?.path || "";
if (!file || !existsSync(file)) process.exit(0);
if (!(config.lintExtensions || [".ts", ".tsx", ".js", ".jsx", ".mjs"]).includes(extname(file))) process.exit(0);
if (/[\\/](node_modules|dist|build|coverage|\.next)[\\/]/.test(file)) process.exit(0);

// config.commands.lintFile is eslint through the repository's manager by default; split it into argv so the
// file path is passed as one argument and never re-parsed by a shell.
const parts = String(config.commands?.lintFile || defaultCommands().lintFile).split(/\s+/).filter(Boolean);
const [bin, ...args] = parts;
const isWin = process.platform === "win32";

try {
  execFileSync(isWin ? `${bin}.cmd` : bin, [...args, file], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 90 * 1000,
    shell: isWin,
  });
  process.exit(0);
} catch (err) {
  const out = `${err.stdout || ""}\n${err.stderr || ""}`;
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext: `Lint of ${file} is red. Fix before moving on (the Stop gate will refuse to end the session otherwise):\n${tail(out, 40)}`,
      },
    }) + "\n",
  );
  process.exit(0);
}
