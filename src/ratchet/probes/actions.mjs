/**
 * Server actions that never ask who is calling (standard AUTH.1). A `'use server'` export is a
 * public endpoint: the framework makes it a POST any browser can send, whatever the page that
 * renders the button. An adopter's worst finding was one with no check at all, through which any
 * signed-in user could zero their own recorded spend; abatty saw it only indirectly, as a
 * parameter no schema read. This reads the other half: whether the action establishes the caller.
 *
 * On probation: a text reading of the auth helpers a codebase may name a hundred ways. A
 * repository adds its own through `ratchet.authCalls`.
 */
import { USE_SERVER, exportedFunctions, functionAt } from "./jstext.mjs";
import { codeOnly, lineAt } from "./lex.mjs";

/** The calls that establish the caller in the libraries a Next app commonly uses. */
const KNOWN = [
  "auth",
  "getServerSession",
  "getSession",
  "currentUser",
  "getCurrentUser",
  "getUser",
  "requireUser",
  "requireAuth",
  "requireSession",
  "verifySession",
  "validateRequest",
  "assertAuthenticated",
];

/** @param {string} s */
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** @type {import("../index.mjs").Probe[]} */
export const probes = [
  {
    metric: "auth.unguardedAction",
    kind: "ratchet",
    optIn: true,
    probation: true,
    standard: ["AUTH.1"],
    title: "Server actions that never establish who is calling",
    why: "A 'use server' export is a public POST endpoint whatever the page that shows its button; with no check of the caller, anyone signed in, or anyone at all, can run it on any data it reaches. The count is the number of actions trusting the page to have asked.",
    approximates:
      "stands in for knowing each action checks its caller: an exported function of a 'use server' module whose body calls none of the known session and auth helpers (auth(), getServerSession, getSession, currentUser, getUser, requireUser, verifySession, validateRequest and the like) nor a name the repository lists in ratchet.authCalls; a check made in a helper the action calls under another name is not seen, so the name is the repository's to add",
    axis: "boundary-clarity",
    lossAt: 10,
    scan: (c, o) => {
      const names = [...KNOWN, ...(o.config.authCalls || [])].map(escape).join("|");
      const asks = new RegExp(`(?:^|[^\\w$])(?:${names})\\s*\\(`);
      const findings = [];
      let scanned = 0;
      for (const f of c.sourceFiles) {
        if (!/\.[jt]sx?$/.test(f)) continue;
        const text = c.read(f);
        if (!USE_SERVER.test(text)) continue;
        scanned++;
        const code = codeOnly(text);
        for (const { name, index, paren } of exportedFunctions(code)) {
          const fn = functionAt(code, paren);
          if (fn && !asks.test(fn.body))
            findings.push({
              path: f,
              line: lineAt(code, index),
              detail: `server action ${name} never establishes who is calling`,
            });
        }
      }
      return { scanned, findings };
    },
    controls: [
      {
        name: "an action that writes without asking who calls counts",
        files: {
          "app/actions/spend.ts":
            "'use server'\nexport async function resetSpend(userId: string) {\n  await db.spend.update({ where: { userId }, data: { total: 0 } })\n}\n",
        },
        expect: 1,
      },
      {
        name: "an action that asks the session, or a helper the repository names, holds",
        files: {
          "app/actions/spend.ts":
            "'use server'\nexport async function resetSpend() {\n  const session = await auth()\n  if (!session) throw new Error('no')\n}\nexport async function rename(name: string) {\n  const user = await mustBeOwner()\n  return { user, name }\n}\n",
        },
        config: { authCalls: ["mustBeOwner"] },
        expect: 0,
      },
      {
        name: "a module without the directive, or the word auth in a string, is not read as a check",
        files: {
          "lib/money.ts": "export async function format(n: number) {\n  return String(n)\n}\n",
          "app/actions/a.ts":
            "'use server'\nexport async function ping() {\n  return 'call auth() first'\n}\n",
        },
        expect: 1,
      },
    ],
  },
];
