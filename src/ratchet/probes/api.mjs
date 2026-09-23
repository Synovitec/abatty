/**
 * The API probes: what a handler hands back and how much of it. Opt-in (`ratchet.enable`), text
 * readings of the ORM's calls and the framework's cache, moved from the outside trial's own
 * probes (2026-09-21) with its particulars made configuration: the helpers that bound a page
 * (`ratchet.boundedBy`), the columns a select must never carry (`ratchet.secretFields`), the
 * fields that hold money (`ratchet.moneyFields`).
 */
import { callArguments, lineAt, stripComments } from "./jstext.mjs";

/** @typedef {import("../index.mjs").Probe} Probe */

const ROUTE_FILE = /(^|\/)app\/api\/.*route\.[jt]sx?$/;
const USE_SERVER = /^\s*(['"])use server\1/m;
const FIND_MANY = /\.findMany\s*\(/g;
const WRITE = String.raw`\b(?:prisma|db|tx)\.\w+\.(?:create|update|delete|upsert|updateMany|deleteMany)\s*\(`;
const ROW_RETURN = new RegExp(String.raw`\breturn\s+(?:await\s+)?` + WRITE, "g");
/** A row kept in a local and returned later: the same row by another route. */
const ROW_KEPT = new RegExp(
  String.raw`\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?` + WRITE,
  "g",
);
const DEFAULT_SECRETS = ["password", "secret", "token", "otp", "hash"];
const DEFAULT_MONEY = ["price", "amount", "cost", "fee", "subtotal", "balance"];
/**
 * What creates a cached read on the server: a cache directive (plain, private or remote), a
 * cache helper, a static or revalidating route, a fetch cache option, a cache store client. An
 * invalidation (revalidatePath, revalidateTag, updateTag) is a write doing its duty, not a cache.
 */
const SERVER_CACHE =
  /\bunstable_cache\s*\(|(['"])use cache(?::\s*\w+)?\1|\bcacheLife\s*\(|\bcacheTag\s*\(|^\s*export const revalidate\s*=|^\s*export const dynamic\s*=\s*['"]force-static['"]|\bgenerateStaticParams\b|\bnext:\s*\{[^}]*\brevalidate\b|\bcache:\s*['"]force-cache['"]|from\s+['"](?:ioredis|redis|@upstash\/redis|@vercel\/kv|memcached|lru-cache)['"]/gm;

/** A regex over any of the names, as whole words. @param {string[]} names */
const anyOf = (names) => names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");

/** @type {Probe[]} */
export const probes = [
  {
    metric: "api.unboundedList",
    kind: "ratchet",
    optIn: true,
    standard: ["API.1"],
    title: "Route handlers serving an unbounded list",
    why: "A list without a bound grows until it times out, on the one day it matters. Every list a route serves takes a limit. The count is the findMany calls in a route handler with neither a take nor one of the helpers `ratchet.boundedBy` names.",
    approximates:
      "stands in for a parser, which would be a dependency: a text reading: a .findMany( in a route file under app/api whose arguments carry neither `take:` nor a call of a `ratchet.boundedBy` helper. A read outside a route handler is bounded by what calls it and is not read.",
    axis: "boundary-clarity",
    lossAt: 5,
    scan: (c, o) => {
      const helpers = Array.isArray(o.config.boundedBy) ? o.config.boundedBy : [];
      const bounded = new RegExp(
        `\\btake\\s*:${helpers.length ? `|\\b(?:${anyOf(helpers)})\\s*\\(` : ""}`,
      );
      const findings = [];
      let scanned = 0;
      for (const f of c.sourceFiles) {
        if (!ROUTE_FILE.test(f)) continue;
        scanned++;
        const text = c.read(f);
        for (const m of text.matchAll(FIND_MANY))
          if (!bounded.test(callArguments(text, m)))
            findings.push({
              path: f,
              line: lineAt(text, m.index ?? 0),
              detail: "findMany without a bound",
            });
      }
      return { scanned, findings };
    },
    controls: [
      {
        name: "a findMany with no take counts",
        files: {
          "app/api/x/route.ts":
            "export async function GET() {\n  return ok(await prisma.user.findMany({ where: { role: 'X' } }))\n}\n",
        },
        expect: 1,
      },
      {
        name: "a take, or a configured page helper, is a bound; a findMany outside app/api is not read",
        config: { boundedBy: ["pageArgs"] },
        files: {
          "app/api/x/route.ts":
            "export async function GET() {\n  const a = await prisma.user.findMany({ take: 50 })\n  const b = await prisma.user.findMany({ where: {}, ...pageArgs(q) })\n  return ok([a, b])\n}\n",
          "lib/x.ts": "export const all = () => prisma.user.findMany()\n",
        },
        expect: 0,
      },
    ],
  },
  {
    metric: "api.rowReturn",
    kind: "ratchet",
    optIn: true,
    standard: ["API.1"],
    title: "Server actions returning the row as it came",
    why: "A mutation returns a payload the action shaped: the row as it came carries what the client must never see (a password hash) or cannot receive (a decimal). The count is the writes a 'use server' module returns without a select, and the selects that name a secret column (`ratchet.secretFields`).",
    approximates:
      "stands in for a parser, which would be a dependency: a text reading, in a module that starts with 'use server', of `return <prisma|db|tx>.<model>.<write>(` and of such a write kept in a const and returned later, whose arguments carry no `select:`, or a select naming a column that contains one of the secret words. A transaction returned whole is not read.",
    axis: "boundary-clarity",
    lossAt: 20,
    scan: (c, o) => {
      const secrets = Array.isArray(o.config.secretFields)
        ? o.config.secretFields
        : DEFAULT_SECRETS;
      const secret = new RegExp(`\\b\\w*(?:${anyOf(secrets)})\\w*\\s*:\\s*true\\b`, "i");
      /** @type {import("../index.mjs").Finding[]} */
      const findings = [];
      let scanned = 0;
      /** @param {string} f @param {string} text @param {RegExpMatchArray} m @param {string} what */
      const judge = (f, text, m, what) => {
        const args = callArguments(text, m);
        const line = lineAt(text, m.index ?? 0);
        if (!/\bselect\s*:/.test(args))
          findings.push({ path: f, line, detail: `${what} returned as it came` });
        else if (secret.test(args))
          findings.push({ path: f, line, detail: "a select carrying a secret column" });
      };
      for (const f of c.sourceFiles) {
        if (!/\.[jt]sx?$/.test(f)) continue;
        const text = c.read(f);
        if (!USE_SERVER.test(text)) continue;
        scanned++;
        for (const m of text.matchAll(ROW_RETURN)) judge(f, text, m, "a row");
        for (const m of text.matchAll(ROW_KEPT))
          if (new RegExp(`\\breturn\\s+${m[1]}\\b`).test(text.slice(m.index ?? 0)))
            judge(f, text, m, `the row ${m[1]}`);
      }
      return { scanned, findings };
    },
    controls: [
      {
        name: "a write returned without a select, one kept and returned later, and a select with a secret column count",
        files: {
          "app/actions/a.ts":
            "'use server'\nexport async function create(raw: unknown) {\n  return prisma.user.create({ data: input.parse(raw) })\n}\nexport async function rename(id: string) {\n  const row = await db.user.update({ where: { id }, data: {} })\n  return row\n}\nexport async function leak(id: string) {\n  return prisma.user.update({ where: { id }, data: {}, select: { id: true, passwordHash: true } })\n}\n",
        },
        expect: 3,
      },
      {
        name: "a selected payload is clean, and a module without the directive is not read",
        files: {
          "app/actions/a.ts":
            "'use server'\nexport async function create(raw: unknown) {\n  return prisma.user.create({ data: input.parse(raw), select: { id: true } })\n}\n",
          "lib/x.ts": "export const f = () => prisma.user.create({ data: {} })\n",
        },
        expect: 0,
      },
    ],
  },
  {
    metric: "api.floatMoney",
    kind: "ratchet",
    optIn: true,
    standard: ["API.1", "DATA.1"],
    title: "Money as a float",
    why: "An amount of money is exact: a decimal string beside its currency on the wire, a decimal or integer minor units in the database. A JavaScript number or a Float column rounds on the way. The count is the places a money field (`ratchet.moneyFields`) is made a number to send or receive it, and the Float columns that hold one.",
    approximates:
      "stands in for a parser, which would be a dependency: a text reading of `<field>: Number(`, `parseFloat(`, `parseInt(`, `z.number(` or `z.coerce.number(` in the source, and of a `<field> Float` column in a .prisma schema, for each money field name. Arithmetic on an amount already received (a formatter) is not a crossing and is not read.",
    axis: "boundary-clarity",
    lossAt: 10,
    scan: (c, o) => {
      const names = anyOf(
        Array.isArray(o.config.moneyFields) ? o.config.moneyFields : DEFAULT_MONEY,
      );
      const wire = new RegExp(
        `\\b(?:${names})\\s*:\\s*(?:Number|parseFloat|parseInt)\\s*\\(|\\b(?:${names})\\s*:\\s*z\\.(?:number|coerce\\.number)\\s*\\(`,
        "gi",
      );
      const column = new RegExp(`^\\s*\\w*(?:${names})\\w*\\s+Float\\b`, "gim");
      const findings = [];
      let scanned = 0;
      for (const [f, re] of [
        ...c.sourceFiles
          .filter((x) => /\.[jt]sx?$/.test(x))
          .map((x) => /** @type {const} */ ([x, wire])),
        ...c.files(/\.prisma$/).map((x) => /** @type {const} */ ([x, column])),
      ]) {
        scanned++;
        const text = stripComments(c.read(f));
        for (const m of text.matchAll(re))
          findings.push({
            path: f,
            line: lineAt(text, m.index ?? 0),
            detail: `money as a float: ${m[0].trim()}`,
          });
      }
      return { scanned, findings };
    },
    controls: [
      {
        name: "a price made a number, a numeric amount schema and a Float price column count",
        files: {
          "app/x/page.tsx":
            "export const rows = dishes.map((d) => ({ id: d.id, price: Number(d.price) }))\n",
          "lib/schemas/d.ts": "export const input = z.object({ amount: z.number().min(0) })\n",
          "prisma/schema.prisma": "model Dish {\n  id    String @id\n  price Float\n}\n",
        },
        expect: 3,
      },
      {
        name: "a two-decimal string, a Decimal column and a formatter's arithmetic are clean",
        files: {
          "app/x/page.tsx":
            "export const rows = dishes.map((d) => ({ id: d.id, price: d.price.toFixed(2) }))\n",
          "lib/menu.ts":
            "export function formatPrice(price: string) {\n  return Number(price).toFixed(2)\n}\n",
          "prisma/schema.prisma":
            "model Dish {\n  id    String  @id\n  price Decimal @db.Decimal(10, 2)\n}\n",
        },
        expect: 0,
      },
    ],
  },
  {
    metric: "cache.serverCacheUse",
    kind: "ratchet",
    optIn: true,
    standard: ["CACHE.1", "CACHE.2"],
    title: "Server-side caches of a read",
    why: "For a repository that decided to cache no read on the server, because a render that reads the database is cheaper to guarantee than an invalidation scheme. Each place that starts caching owes CACHE.1 a key with every parameter, an invalidation on every write and a lifetime, and the decision a re-reading; the count may only fall.",
    approximates:
      'stands in for a parser, which would be a dependency: a text reading of what creates a cached read: "use cache" (plain, private, remote), unstable_cache, cacheLife, cacheTag, export const revalidate, export const dynamic = "force-static", generateStaticParams, a fetch with next.revalidate or cache: "force-cache", and an import of a cache store or lru-cache. Blind to a cache written by hand over a Map and to the framework config file.',
    axis: "boundary-clarity",
    lossAt: 5,
    scan: (c) => {
      const findings = [];
      let scanned = 0;
      for (const f of c.sourceFiles) {
        if (!/\.[jt]sx?$/.test(f)) continue;
        scanned++;
        const text = c.read(f);
        for (const m of text.matchAll(SERVER_CACHE))
          findings.push({
            path: f,
            line: lineAt(text, m.index ?? 0),
            detail: `server cache: ${m[0].trim()}`,
          });
      }
      return { scanned, findings };
    },
    controls: [
      {
        name: "a cache helper, a directive, a static route and a fetch cache count, once each",
        files: {
          "lib/a.ts":
            "export const read = unstable_cache(async () => 1, ['a'])\nexport const r = () => fetch('https://x', { next: { revalidate: 60 } })\n",
          "app/b/page.tsx":
            "export default async function Page() {\n  'use cache: private'\n  return null\n}\n",
          "app/d/page.tsx":
            "export const dynamic = 'force-static'\nexport default function Page() {\n  return null\n}\n",
        },
        expect: 4,
      },
      {
        name: "a plain read, an invalidation and the browser's cache API are not a server cache",
        files: {
          "lib/a.ts":
            "import { revalidatePath } from 'next/cache'\nexport const read = () => prisma.dish.findMany()\nexport const write = () => revalidatePath('/admin', 'layout')\n",
          "components/sw.ts": "export const open = () => caches.open('menu')\n",
        },
        expect: 0,
      },
    ],
  },
];
