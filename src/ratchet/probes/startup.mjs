/**
 * What a command costs before it does anything (standard CODE.5). The slowest sensor an agent
 * needs on every iteration sets the pace of the whole loop, and the floor under every command is
 * the module graph the entry point pulls in: printing a version string once parsed the night
 * runner, the sandbox drivers, the hosted service and the MCP server.
 *
 * The metric is the graph rather than the milliseconds on purpose. A timing is a property of the
 * machine that ran it - a busy laptop and a cold runner disagree by a factor of three - and a
 * ratchet on a number that moves on its own is a ratchet nobody trusts. The count of modules
 * statically reachable from the entry point is the cause, it is the same on every machine, and it
 * only moves when somebody adds an import.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

/**
 * What a file pulls in before it runs: a static import, a bare import for its side effects, and a
 * re-export, which loads the module just as eagerly. `await import()` is the whole point of the
 * split and must never count.
 * @param {string} text
 */
export function staticImports(text) {
  /** @type {string[]} */
  const out = [];
  for (const m of text.matchAll(/^\s*(?:import|export)\s[^;]*?from\s*["']([^"']+)["']/gm))
    out.push(String(m[1]));
  for (const m of text.matchAll(/^\s*import\s*["']([^"']+)["']/gm)) out.push(String(m[1]));
  return out.filter((s) => s.startsWith("."));
}

/**
 * The modules a file pulls in before it runs, transitively, relative to the repository.
 * @param {string} repoDir @param {string} entry
 */
export function reachable(repoDir, entry) {
  const seen = new Set();
  /** @param {string} abs */
  const walk = (abs) => {
    const rel = relative(repoDir, abs).split("\\").join("/");
    if (seen.has(rel) || !existsSync(abs)) return;
    seen.add(rel);
    for (const spec of staticImports(readFileSync(abs, "utf8")))
      walk(resolve(dirname(abs), String(spec)));
  };
  walk(join(repoDir, entry));
  seen.delete(entry);
  return [...seen].sort();
}

/** @type {import("../index.mjs").Probe[]} */
export const probes = [
  {
    metric: "startup.eagerModules",
    kind: "ratchet",
    standard: ["CODE.5"],
    title: "Modules the entry point parses before it knows which command was asked for",
    why: "The floor under every command in the inner loop is the graph the entry point pulls in eagerly; a command that prints a version string should not parse the night runner. A number that may only fall keeps the cost of an added import visible in the change that adds it.",
    axis: "boundary-clarity",
    lossAt: 40,
    emptyScanOk: true,
    scan: (c) => {
      const entry = ["bin/abatty.mjs", "bin/cli.mjs", "src/index.mjs"].find((f) => c.exists(f));
      if (!entry) return { scanned: 0, findings: [], skipped: "no entry point" };
      const mods = reachable(c.repo, entry);
      return {
        scanned: 1,
        findings: mods.map((path) => ({ path, detail: `parsed before the command is known` })),
      };
    },
    controls: [
      {
        name: "an entry point that pulls its world in eagerly",
        files: {
          "bin/abatty.mjs": 'import { a } from "../src/a.mjs";\nconsole.log(a);\n',
          "src/a.mjs": 'export * from "./b.mjs";\nimport "./c.mjs";\nexport const a = 1;\n',
          "src/b.mjs": "export const b = 2;\n",
          "src/c.mjs": "export const c = 3;\n",
        },
        expect: 3,
      },
      {
        name: "the same graph behind a dynamic import costs nothing",
        files: {
          "bin/abatty.mjs": 'const { a } = await import("../src/a.mjs");\nconsole.log(a);\n',
          "src/a.mjs": 'import "./b.mjs";\nexport const a = 1;\n',
          "src/b.mjs": "export const b = 2;\n",
        },
        expect: 0,
      },
    ],
  },
];
