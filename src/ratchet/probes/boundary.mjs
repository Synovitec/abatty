/**
 * The boundary probes: where outside input enters the program, and whether a schema meets it
 * there. Opt-in (`ratchet.enable`), because each is a text reading of one stack's conventions and
 * a repository on another stack would read noise; the `next` preset enables the ones for its
 * stack when it writes the config. Moved from the outside trial's own probes (2026-09-21), where
 * each found real defects, with what was particular to that product made configuration.
 */
import {
  ROUTE_FILE,
  USE_SERVER,
  exportedFunctions,
  functionAt,
  parsedArguments,
  unparsedParams,
} from "./jstext.mjs";
import { closeOf, codeOnly, lineAt } from "./lex.mjs";
import { matchesAny, regexes } from "./lib.mjs";

/** @typedef {import("../index.mjs").Probe} Probe */

/** What a route handler reads from the request: the body, the query, the path. */
const READS_INPUT = /\.(json|formData|text)\(\)|searchParams|\bparams\b/;
const HTTP_METHOD = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/;
/** A credentials callback as it is defined: `authorize(...) {`, or `authorize: (async) (...)`/`function (`. */
const AUTHORIZE_METHOD = /(?:^|[\s{,])(?:async\s+)?authorize\s*\(/gm;
const AUTHORIZE_PROPERTY = /\bauthorize\s*:\s*(?:async\s+)?(?:function\s*)?\(/g;

/**
 * The `(` of every credentials callback a file defines. A call (`if (!authorize(s))`, `return
 * authorize(user)`) is not one: it was read as one, and every guard that called its own helper
 * `authorize` counted as an unparsed boundary.
 * @param {string} text @returns {number[]}
 */
function authorizeCallbacks(text) {
  const methods = [...text.matchAll(AUTHORIZE_METHOD)]
    .map((m) => (m.index ?? 0) + m[0].length - 1)
    .filter((paren) => {
      const end = closeOf(text, paren, "()");
      return end > 0 && /^\s*(?::[^{;]*)?\{/.test(text.slice(end));
    });
  const properties = [...text.matchAll(AUTHORIZE_PROPERTY)].map(
    (m) => (m.index ?? 0) + m[0].length - 1,
  );
  return [...methods, ...properties];
}
/** Spelled apart so the probe does not count its own text. */
const ENV = "process" + ".env";
const WHOLE_ENV = new RegExp(`\\b${ENV.replace(".", "\\.")}\\b(?![.[?])`, "g");

/**
 * The findings of one boundary file: its exported handlers, then its credentials callbacks.
 * @param {string} f @param {string} text
 */
function boundaryFindings(f, text) {
  const isRoute = ROUTE_FILE.test(f);
  const isAction = USE_SERVER.test(text);
  /** @type {import("../index.mjs").Finding[]} */
  const findings = [];
  for (const { name, index, paren } of exportedFunctions(text)) {
    const fn = functionAt(text, paren);
    if (!fn) continue;
    let detail = "";
    if (isRoute) {
      // One parse in a handler covers every read of the request: the reads are by name.
      if (HTTP_METHOD.test(name) && READS_INPUT.test(fn.body) && !parsedArguments(fn.body).length)
        detail = `${name} reads the request without a schema`;
    } else if (isAction) {
      const missing = unparsedParams(fn.params, fn.body);
      if (missing.length) detail = `server action ${name}: no parse names ${missing.join(", ")}`;
    }
    if (detail) findings.push({ path: f, line: lineAt(text, index), detail });
  }
  for (const paren of authorizeCallbacks(text)) {
    const fn = functionAt(text, paren);
    if (fn && unparsedParams(fn.params, fn.body).length)
      findings.push({
        path: f,
        line: lineAt(text, paren),
        detail: "authorize() reads the credentials without a schema",
      });
  }
  return findings;
}

/** @type {Probe[]} */
export const probes = [
  {
    metric: "valid.unparsedBoundary",
    kind: "ratchet",
    optIn: true,
    standard: ["VALID.1"],
    title: "Boundaries that read input without a schema",
    why: "A route handler, a server action or a credentials callback is a public endpoint: its parameter type is a promise the caller need not keep. A schema parse at the top makes the type true at runtime. The count is the number of boundaries still trusting some of their input.",
    approximates:
      'stands in for a parser, which would be a dependency: a text reading: an exported function of a route file under app/api, of a "use server" module, or an authorize() callback; a parse is a .parse/.safeParse call (JSON and Date excluded) whose argument names the parameter. In a route handler one parse in the body counts for every read of the request.',
    axis: "boundary-clarity",
    lossAt: 40,
    scan: (c) => {
      const findings = [];
      let scanned = 0;
      for (const f of c.sourceFiles) {
        if (!/\.[jt]sx?$/.test(f)) continue;
        const text = c.read(f);
        if (!ROUTE_FILE.test(f) && !USE_SERVER.test(text) && !authorizeCallbacks(text).length)
          continue;
        scanned++;
        findings.push(...boundaryFindings(f, text));
      }
      return { scanned, findings };
    },
    controls: [
      {
        name: "a route handler that reads the body and never parses it counts",
        files: {
          "app/api/x/route.ts":
            "export async function POST(req: Request) {\n  const { a } = await req.json()\n  return Response.json({ a })\n}\n",
        },
        expect: 1,
      },
      {
        name: "a route handler that parses the body is clean, whatever braces its return type holds",
        files: {
          "app/api/x/route.ts":
            "const s = z.object({ a: z.string() })\nexport async function POST(req: Request): Promise<Response | { ok: boolean }> {\n  const r = s.safeParse(await req.json())\n  return Response.json(r)\n}\n",
        },
        expect: 0,
      },
      {
        name: "a server action with an argument no parse names counts, one argument parsed or not",
        files: {
          "app/actions/a.ts":
            "'use server'\nexport async function create(raw: unknown, ip?: string) {\n  const data = input.parse(raw)\n  return { data, ip }\n}\nexport const rename = async (data: { name: string }) => data.name\n",
        },
        expect: 2,
      },
      {
        name: "a server action that parses every argument is clean, and so is one with none",
        files: {
          "app/actions/a.ts":
            "'use server'\nexport async function create(rawId: string, raw: unknown) {\n  const id = uuid.parse(rawId)\n  return { id, data: input.parse(raw) }\n}\nexport async function list() {\n  return []\n}\n",
        },
        expect: 0,
      },
      {
        name: "JSON.parse is not a schema; a credentials callback that casts counts",
        files: {
          "app/actions/a.ts":
            "'use server'\nexport async function create(raw: string) {\n  return JSON.parse(raw)\n}\n",
          "auth.ts":
            "export const config = { providers: [{\n  async authorize(credentials) {\n    const { email } = credentials as Record<string, string>\n    return { email }\n  },\n}] }\n",
        },
        expect: 2,
      },
      {
        name: "an exported function of an ordinary module is not a boundary, nor a call of authorize",
        files: {
          "lib/money.ts":
            "export async function format(amount: number) {\n  return String(amount)\n}\n",
          // calls, without semicolons: each was once read as a callback with unparsed parameters
          "lib/perm.ts":
            "export function check(s) {\n  if (!authorize(s)) {\n    throw new Error('no')\n  }\n  return authorize(s.user)\n}\nexport async function load(user) {\n  await authorize(user)\n  if (user) {\n    return 1\n  }\n}\n",
        },
        expect: 0,
      },
      {
        name: "a credentials callback written as a property is read like a method",
        files: {
          "auth.ts":
            "export const config = { providers: [{\n  authorize: async (credentials) => {\n    return { email: credentials.email }\n  },\n}] }\n",
        },
        expect: 1,
      },
    ],
  },
  {
    metric: "valid.wholeEnv",
    kind: "ratchet",
    optIn: true,
    standard: ["VALID.3"],
    title: "The environment taken whole outside the env module",
    why: "valid.rawEnv sees a member read of the environment; a destructuring, an alias or a function handed the whole object reads the same variables past it. The count is the number of such takes outside the env module and the exempt paths.",
    approximates:
      "stands in for a parser, which would be a dependency: a text reading of the environment object not followed by a member read, an index or an optional read, outside the env module and the ratchet's exempt paths (scripts, tests, bin, the hooks: tooling that hands the environment to a child process)",
    axis: "boundary-clarity",
    lossAt: 10,
    scan: (c, o) => {
      const env = new RegExp(o.config.envModule);
      const exempt = regexes(o.config.exempt);
      const findings = [];
      let scanned = 0;
      for (const f of c.sourceFiles) {
        if (!/\.[cm]?[jt]sx?$/.test(f) || env.test(f) || matchesAny(f, exempt)) continue;
        scanned++;
        const text = codeOnly(c.read(f));
        for (const m of text.matchAll(WHOLE_ENV))
          findings.push({
            path: f,
            line: lineAt(text, m.index ?? 0),
            detail: `${ENV} taken whole`,
          });
      }
      return { scanned, findings };
    },
    controls: [
      {
        name: "a destructuring of the environment counts, and so does handing it on",
        files: {
          "src/service.ts": `const { KEY } = ${ENV}\nexport const k = KEY\nexport const all = () => run(${ENV})\n`,
        },
        expect: 2,
      },
      {
        name: "the env module and a script may take it whole; a member read is valid.rawEnv's",
        files: {
          "src/env.ts": `export const env = schema.parse(${ENV})\n`,
          "src/service.ts": `export const k = ${ENV}.KEY\n`,
          "scripts/ci/run.mjs": `spawnSync("x", [], { env: { ...${ENV}, A: "1" } })\n`,
          "src/rule.ts": `// the ${ENV} object, named in a comment\nexport const why = "never pass ${ENV} on"\n`,
        },
        expect: 0,
      },
    ],
  },
  {
    metric: "auth.unguardedPage",
    kind: "ratchet",
    optIn: true,
    standard: ["AUTH.1", "CACHE.2"],
    title: "Protected pages that do not check the session first",
    why: "A layout stays mounted across client navigations, so a check in the layout runs once per visit, and a page that does not re-check keeps serving somebody whose role was withdrawn after it ran (CACHE.2: an authorisation decision is never cached). Each entry of `ratchet.pageGuards` names the pages and the guard their default export must await first; the count is the pages that do not.",
    approximates:
      "stands in for a parser, which would be a dependency: a text reading: the first statement of the default export function is an await of the configured guard, kept in a const or not; a page whose default export the reading cannot find counts too. Skipped until `ratchet.pageGuards` names a guard.",
    axis: "boundary-clarity",
    lossAt: 5,
    emptyScanOk: true,
    scan: (c, o) => {
      const guards = Array.isArray(o.config.pageGuards) ? o.config.pageGuards : [];
      if (!guards.length)
        return {
          scanned: 0,
          findings: [],
          skipped: "no ratchet.pageGuards: name the pages and their guard",
        };
      const findings = [];
      let scanned = 0;
      for (const f of c.sourceFiles) {
        const g = guards.find((x) => new RegExp(x.pages).test(f));
        if (!g || !/(^|\/)page\.[jt]sx?$/.test(f)) continue;
        scanned++;
        const text = c.read(f);
        const m = text.match(/export default (?:async )?function\s*[A-Za-z_$]?[\w$]*\s*\(/);
        const fn = m ? functionAt(text, (m.index ?? 0) + m[0].length - 1) : null;
        const first = fn ? fn.body.slice(1).trim().split("\n")[0]?.trim() || "" : "";
        const guarded = new RegExp(
          `^(?:const\\s+[\\w$]+\\s*=\\s*)?await\\s+${g.guard}\\s*\\(`,
        ).test(first);
        if (!guarded)
          findings.push({
            path: f,
            line: m ? lineAt(text, m.index ?? 0) : 1,
            detail: fn
              ? `first statement is "${first.slice(0, 40)}", not ${g.guard}()`
              : "no default export function found",
          });
      }
      return { scanned, findings };
    },
    controls: [
      {
        name: "a protected page that reads before it guards counts, and so does an arrow default export",
        config: { pageGuards: [{ pages: "^app/admin/", guard: "requireAdmin" }] },
        files: {
          "app/admin/a/page.tsx":
            "export default async function Page() {\n  const rows = await db.user.findMany()\n  await requireAdmin()\n  return rows.length\n}\n",
          "app/admin/b/page.tsx":
            "const Page = async () => {\n  await requireAdmin()\n  return null\n}\nexport default Page\n",
        },
        expect: 2,
      },
      {
        name: "a page that guards first is clean, and a page outside the guarded paths is not read",
        config: { pageGuards: [{ pages: "^app/admin/", guard: "requireAdmin" }] },
        files: {
          "app/admin/a/page.tsx":
            "export default async function Page({ params }: { params: Promise<{ id: string }> }) {\n  const me = await requireAdmin()\n  return me.email\n}\n",
          "app/shop/page.tsx": "export default async function Page() {\n  return null\n}\n",
          // an apostrophe in JSX text is not a string: it once unbalanced the body and the page
          // read as "no default export function found"
          "app/admin/c/page.tsx":
            "export default async function Page() {\n  await requireAdmin()\n  return <p>Don't forget {1}</p>\n}\n",
        },
        expect: 0,
      },
    ],
  },
];
