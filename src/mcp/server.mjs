/**
 * The MCP server: `abatty mcp [dir]` speaks the Model Context Protocol over stdio (JSON-RPC
 * 2.0, one message per line) and exposes the package as typed tools - measure, ratchet, gate,
 * scrub, report, explain - so an agent verifies through a call whose result is data, never by
 * parsing a terminal. The server is scoped to one repository at start and no tool takes a
 * path: nothing outside that repository can be reached through it. Declared for a night in
 * `.claude/mcp.night.json` and named in the config's `mcpServers` like any server.
 *
 * Hand-written on purpose: the package has no runtime dependency, and the subset of the
 * protocol a tool server needs is small (initialize, ping, tools/list, tools/call).
 */
import { agentFinding, agentFindings } from "../rules/agent.mjs";
import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildReport, latestReport } from "../core/report.mjs";
import { analyze } from "../core/gap-analysis.mjs";
import { loadCatalog, ruleById, runCatalog } from "../rules/index.mjs";
import { buildContext } from "../rules/context.mjs";
import { scanFiles, allowList, scrubConfig } from "../core/scrub.mjs";
import {
  compare,
  failed,
  loadProbes,
  measureAll,
  ratchetSetup,
  readBaseline,
  scoreOf,
} from "../ratchet/index.mjs";
import { pushRange } from "../core/range.mjs";
import { readJsonFile } from "../core/repo.mjs";

export const PROTOCOL_VERSION = "2025-06-18";
const BIN = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "bin", "abatty.mjs");

/**
 * @typedef {{ name: string, description: string, inputSchema: object, run: (args: Record<string, any>) => Promise<unknown> }} Tool
 * @typedef {{ jsonrpc: "2.0", id?: number | string | null, method?: string, params?: any, result?: any, error?: { code: number, message: string } }} Message
 */

/** The tools of one repository. @param {string} repoDir @returns {Tool[]} */
export function tools(repoDir) {
  const dir = resolve(repoDir);
  const version = String(readJsonFile(join(dirname(BIN), ".."), "package.json")?.version || "");
  return [
    {
      name: "measure",
      description:
        "Measure the repository against the rule catalog: the score, the enforced share, every finding with its status, and the next steps in plan order. Writes the dated report under .abatty/reports/.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      run: async () => {
        const r = await buildReport(dir, { abattyVersion: version });
        return {
          name: r.name,
          date: r.date,
          score: r.score,
          applicable: r.applicable,
          enforced: r.enforced,
          families: r.families,
          findings: r.findings,
          problems: r.problems,
        };
      },
    },
    {
      name: "ratchet",
      description:
        'Run the ratchet: every probe against the committed baseline, per total and per file. Returns the verdicts (ok, improved, regressed, hard-fail, scanned-zero, unbaselined, redefined, probation, skipped) and whether the run fails; a probation verdict never fails it. `range` judges the changelog over a git range ("auto" for the push).',
      inputSchema: {
        type: "object",
        properties: { range: { type: "string", description: "A git range a..b, or auto" } },
        additionalProperties: false,
      },
      run: async (a) => {
        const { adoption, config, baselineRel } = ratchetSetup(dir);
        const { probes, problems } = await loadProbes(dir, config);
        const baseline = readBaseline(dir, baselineRel);
        const range =
          a.range === "auto"
            ? pushRange(dir, String(adoption?.baseBranch || "main"))
            : String(a.range || "");
        const measurements = measureAll(
          probes,
          buildContext(dir, { tracked: true }),
          { config, range },
          baseline,
        );
        const verdicts = compare(measurements, baseline, config);
        return {
          ok: !failed(verdicts) && !problems.length,
          baseline: baseline ? baselineRel : null,
          range,
          score: scoreOf(measurements).score,
          problems,
          verdicts,
        };
      },
    },
    {
      name: "gate",
      description:
        "Run the repository's gate (format, lint, typecheck, import graph, dead code, unit tests, the ratchet with the changelog range, then the suites by path). Returns whether it passed and its output. `fast` skips the conditional suites.",
      inputSchema: {
        type: "object",
        properties: { fast: { type: "boolean" }, range: { type: "string" } },
        additionalProperties: false,
      },
      run: async (a) => {
        const args = [
          BIN,
          "gate",
          dir,
          ...(a.fast ? ["--fast"] : []),
          ...(a.range ? ["--range", String(a.range)] : []),
        ];
        const r = spawnSync(process.execPath, args, {
          cwd: dir,
          encoding: "utf8",
          maxBuffer: 64 * 1024 * 1024,
          env: { ...process.env, NO_COLOR: "1" },
        });
        return {
          ok: r.status === 0,
          exit: r.status ?? 1,
          output: (r.stdout || "") + (r.stderr || ""),
        };
      },
    },
    {
      name: "scrub",
      description:
        "Scan the tracked files for a trace of the tools (a vendor, a model, a trailer). Returns the findings with path and line; says when the repository did not opt into the scrub (provenance is the default).",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      run: async () => {
        const sc = scrubConfig(dir);
        const findings = scanFiles(dir, { allow: allowList(dir) });
        return { enabled: sc.enabled, findings, count: findings.length };
      },
    },
    {
      name: "findings",
      description:
        "Every finding an agent should act on, shaped for one: where it is, what edit to make, a verify command whose exit code proves the edit worked, and why the rule exists. Missing and partial only; what already holds is not returned.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      run: async () => {
        const catalog = await loadCatalog(dir);
        const findings = runCatalog(buildContext(dir), catalog.rules);
        return { findings: agentFindings(findings, catalog.rules) };
      },
    },
    {
      name: "report",
      description:
        "The newest report on disk (.abatty/reports/latest.json), or null when the repository was never measured.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      run: async () => latestReport(dir),
    },
    {
      name: "explain",
      description:
        "One rule of the catalog by ID: its reason, the standard's IDs, its level, what insures it, its phase, and its finding in this repository.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string", description: "The rule ID, e.g. CODE-DEADCODE" } },
        required: ["id"],
        additionalProperties: false,
      },
      run: async (a) => {
        const catalog = await loadCatalog(dir);
        const rule = ruleById(String(a.id || "").toUpperCase(), catalog.rules);
        if (!rule) throw new Error(`no rule ${a.id}; abatty rules lists the catalog`);
        const finding = runCatalog(buildContext(dir), [rule])[0];
        if (!finding) throw new Error(`${rule.id} produced no finding`);
        const { check, ...data } = rule;
        void check;
        return { rule: data, finding, agent: agentFinding(finding, rule) };
      },
    },
  ];
}

/**
 * A pure message handler for one repository: a request in, a response out (null for a
 * notification). Errors are JSON-RPC errors or tool results with isError, never a crash.
 * @param {string} repoDir
 */
export function createHandler(repoDir) {
  const list = tools(repoDir);
  /** @param {Message} m @returns {Promise<Message | null>} */
  return async function handle(m) {
    const id = m.id ?? null;
    /** @param {number} code @param {string} message */
    const error = (code, message) => ({
      jsonrpc: /** @type {"2.0"} */ ("2.0"),
      id,
      error: { code, message },
    });
    /** @param {unknown} result */
    const ok = (result) => ({ jsonrpc: /** @type {"2.0"} */ ("2.0"), id, result });
    if (!m || m.jsonrpc !== "2.0" || typeof m.method !== "string")
      return error(-32600, "invalid request");
    if (m.method.startsWith("notifications/")) return null;
    switch (m.method) {
      case "initialize":
        return ok({
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: {
            name: "abatty",
            version: String(readJsonFile(join(dirname(BIN), ".."), "package.json")?.version || ""),
          },
          instructions:
            "Tools over one repository: measure, ratchet, gate, scrub, report, explain. Results are data; a failing gate or ratchet says why in its result, not in an error.",
        });
      case "ping":
        return ok({});
      case "tools/list":
        return ok({
          tools: list.map(({ name, description, inputSchema }) => ({
            name,
            description,
            inputSchema,
          })),
        });
      case "tools/call": {
        const name = String(m.params?.name || "");
        const tool = list.find((t) => t.name === name);
        if (!tool) return error(-32602, `unknown tool ${name}`);
        try {
          const result = await tool.run(m.params?.arguments || {});
          return ok({
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
            structuredContent: result === null ? undefined : result,
            isError: false,
          });
        } catch (e) {
          return ok({
            content: [{ type: "text", text: e instanceof Error ? e.message : String(e) }],
            isError: true,
          });
        }
      }
      default:
        return error(-32601, `method not found: ${m.method}`);
    }
  };
}

/**
 * Serve over stdio until stdin closes. Nothing but JSON-RPC goes to stdout; the log goes to
 * stderr. @param {string} repoDir
 */
export function serve(repoDir) {
  const handle = createHandler(repoDir);
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  let chain = Promise.resolve();
  rl.on("line", (line) => {
    if (!line.trim()) return;
    chain = chain.then(async () => {
      /** @type {Message} */
      let m;
      try {
        m = JSON.parse(line);
      } catch {
        process.stdout.write(
          JSON.stringify({
            jsonrpc: "2.0",
            id: null,
            error: { code: -32700, message: "parse error" },
          }) + "\n",
        );
        return;
      }
      const r = await handle(m);
      if (r) process.stdout.write(JSON.stringify(r) + "\n");
    });
  });
  rl.on("close", () => chain.then(() => process.exit(0)));
  process.stderr.write(`[abatty mcp] serving ${resolve(repoDir)} over stdio\n`);
}
