import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { NEXT_PKG, cli, tempRepo } from "./helpers.mjs";
import { PROTOCOL_VERSION, createHandler, tools } from "../src/mcp/server.mjs";

/** @param {string} method @param {any} [params] @param {number} [id] */
const req = (method, params, id = 1) => ({
  jsonrpc: /** @type {"2.0"} */ ("2.0"),
  id,
  method,
  params,
});

test("the handler: initialize, ping, tools/list, a notification answered by nothing, an unknown method and an unknown tool as errors", async () => {
  const dir = tempRepo("mcp-handler", {
    "package.json": NEXT_PKG,
    "src/a.ts": "export const a = 1;\n",
  });
  const handle = createHandler(dir);
  const init = await handle(
    req("initialize", {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "t", version: "0" },
    }),
  );
  assert.equal(init?.result.protocolVersion, PROTOCOL_VERSION);
  assert.equal(init?.result.serverInfo.name, "abatty");
  assert.ok(init?.result.capabilities.tools);
  assert.equal(await handle({ jsonrpc: "2.0", method: "notifications/initialized" }), null);
  assert.deepEqual((await handle(req("ping", undefined, 2)))?.result, {});
  const list = await handle(req("tools/list", undefined, 3));
  assert.deepEqual(
    list?.result.tools.map((/** @type {any} */ t) => t.name),
    ["measure", "ratchet", "gate", "scrub", "findings", "report", "explain"],
  );
  assert.ok(
    list?.result.tools.every(
      (/** @type {any} */ t) => t.inputSchema.type === "object" && t.description.length > 20,
    ),
  );
  assert.equal((await handle(req("nope", undefined, 4)))?.error?.code, -32601);
  assert.equal((await handle(req("tools/call", { name: "ghost" }, 5)))?.error?.code, -32602);
  assert.equal((await handle(/** @type {any} */ ({ jsonrpc: "1.0" })))?.error?.code, -32600);
});

test("the tools return data: report is null before a measure and the report after; explain, scrub and ratchet answer; a bad id is a tool error, not a crash", async () => {
  const dir = tempRepo("mcp-tools", {
    "package.json": NEXT_PKG,
    "src/a.ts": "export const a = 1;\n",
  });
  const handle = createHandler(dir);
  /** @param {string} name @param {any} [args] */
  const call = async (name, args = {}) => {
    const r = await handle(req("tools/call", { name, arguments: args }, 9));
    return r?.result;
  };
  assert.equal((await call("report")).content[0].text, "null");
  const m = await call("measure");
  assert.equal(m.isError, false);
  assert.equal(typeof m.structuredContent.score, "number");
  assert.ok(Array.isArray(m.structuredContent.findings));
  assert.equal(typeof m.structuredContent.enforced.total, "number");
  assert.equal((await call("report")).structuredContent.score, m.structuredContent.score);
  // The agent surface: every open finding with the command that proves its own fix.
  const af = await call("findings");
  assert.ok(Array.isArray(af.structuredContent.findings));
  for (const f of af.structuredContent.findings) {
    assert.equal(f.verify, `npx abatty check ${f.id}`);
    assert.ok(f.status === "missing" || f.status === "partial", f.status);
  }
  const e = await call("explain", { id: "code-deadcode" });
  assert.equal(e.structuredContent.rule.id, "CODE-DEADCODE");
  assert.ok(["present", "partial", "missing", "n/a"].includes(e.structuredContent.finding.status));
  const bad = await call("explain", { id: "NOPE-1" });
  assert.equal(bad.isError, true);
  assert.match(bad.content[0].text, /no rule NOPE-1/);
  const s = await call("scrub");
  assert.equal(s.structuredContent.enabled, false, "provenance is the default");
  assert.equal(s.structuredContent.count, 0);
  const r = await call("ratchet");
  assert.equal(typeof r.structuredContent.ok, "boolean");
  assert.ok(
    r.structuredContent.verdicts.some((/** @type {any} */ v) => v.metric === "size.overBudget"),
  );
  assert.equal(tools(dir).length, 7);
});

test("the gate tool runs the repository's gate as a child and returns its outcome and output", async () => {
  const dir = tempRepo("mcp-gate", {
    "package.json": NEXT_PKG,
    "src/a.ts": "export const a = 1;\n",
  });
  cli(["init", dir, "--stack", "next"], dir);
  const handle = createHandler(dir);
  const r = await handle(req("tools/call", { name: "gate", arguments: { fast: true } }, 7));
  assert.equal(
    r?.result.structuredContent.ok,
    false,
    "the dependencies are named, never installed: lint fails",
  );
  assert.match(r?.result.structuredContent.output, /lint \(CODE.4\) failed/);
});

test("over stdio: abatty mcp answers JSON-RPC line by line and writes nothing else to stdout", () => {
  const dir = tempRepo("mcp-stdio", {
    "package.json": NEXT_PKG,
    "src/a.ts": "export const a = 1;\n",
  });
  const input =
    [
      JSON.stringify(
        req("initialize", {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: "t", version: "0" },
        }),
      ),
      JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
      "not json",
      JSON.stringify(req("tools/list", undefined, 2)),
      JSON.stringify(req("tools/call", { name: "scrub", arguments: {} }, 3)),
    ].join("\n") + "\n";
  const r = spawnSync(
    process.execPath,
    [new URL("../bin/abatty.mjs", import.meta.url).pathname, "mcp", dir],
    { input, encoding: "utf8", cwd: dir },
  );
  assert.equal(r.status, 0, r.stderr);
  const lines = r.stdout
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l));
  assert.equal(lines.length, 4, r.stdout);
  assert.equal(lines[0].id, 1);
  assert.equal(lines[1].error.code, -32700, "a parse error is answered, not fatal");
  assert.equal(lines[2].result.tools.length, 7);
  assert.equal(lines[3].result.structuredContent.count, 0);
  assert.match(r.stderr, /\[abatty mcp\] serving/);
});
