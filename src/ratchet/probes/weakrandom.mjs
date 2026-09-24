/**
 * `Math.random` where a secret is made (standard SEC.1). An adopter's "cryptographic" temporary
 * password came from `Math.random`, whose output an attacker who sees a few values can predict,
 * and no metric looked: a random id and a random password read the same to a text search. The
 * context tells them apart: the names on the line and the function around it. Opt-in, like every
 * probe that reads one family of languages.
 */
import { closeOf, codeOnly, lineAt } from "./lex.mjs";
import { shippedScripts } from "./lib.mjs";

// Assembled from parts so the controls below are not offenders against the metric they prove.
const RND = ["Math", "random()"].join(".");
const RANDOM = /\bMath\.random\s*\(/g;
const NAME = /[A-Za-z_$][\w$]*/g;
/** A word that says a secret is being made. */
const SECRET_WORDS = new Set([
  "password",
  "passwd",
  "passcode",
  "pwd",
  "secret",
  "token",
  "otp",
  "nonce",
  "salt",
  "credential",
  "apikey",
]);
/** A word that makes the next one a secret: a reset code, an API key, a one-time code. */
const BEFORE_CODE = new Set([
  "verification",
  "reset",
  "invite",
  "invitation",
  "auth",
  "confirmation",
  "activation",
  "recovery",
  "access",
  "pin",
  "time",
]);

/**
 * Whether a name says a secret, read by its words and not its letters: `plotPoints` holds "otP"
 * and no word "otp", and an adopter's shuffle was one rename from being read as a one-time code.
 * @param {string} name
 */
function namesSecret(name) {
  const words = name
    .split(/[_$]+|(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/)
    .map((w) => w.toLowerCase().replace(/s$/, ""))
    .filter(Boolean);
  return words.some(
    (w, i) =>
      SECRET_WORDS.has(w) ||
      (w === "key" && words[i - 1] === "api") ||
      (w === "code" && BEFORE_CODE.has(words[i - 1] || "")) ||
      (w === "pin" && words.length === 1),
  );
}
/** The nearest declaration above: a named function, a method, or a function bound to a name. */
const DECLARATION =
  /(?:function\s*\*?\s*([\w$]+)|(?:const|let|var)\s+([\w$]+)\s*=\s*(?:async\s*)?(?:function\b|\([^()]*\)\s*(?::[^=]*)?=>|[\w$]+\s*=>)|^\s*(?:async\s+)?([\w$]+)\s*\([^()]*\)\s*\{)/gm;

const KEYWORDS = new Set(["if", "for", "while", "switch", "catch", "with", "return", "function"]);

/**
 * The name of the function a position sits in, approximately: the last declaration within a
 * screen of text above it whose body still holds it. A function that closed before the position
 * lends it no name, so top-level code after `makeToken() {...}` is not read as a token.
 * @param {string} code @param {number} at
 */
function enclosingName(code, at) {
  const start = Math.max(0, at - 2000);
  let name = "";
  for (const m of code.slice(start, at).matchAll(DECLARATION)) {
    const found = m[1] || m[2] || m[3] || "";
    // `if (x) {` has the shape of a method; a block inside the function is not a new name.
    if (!found || KEYWORDS.has(found)) continue;
    const from = start + (m.index ?? 0) + m[0].length;
    const brace = code.indexOf("{", from);
    const lineEnd = code.indexOf("\n", from) >>> 0;
    // An arrow with an expression body holds what follows it on its own line; a braced body
    // holds what sits before its closing brace.
    const bodyEnd =
      brace >= 0 && (brace < lineEnd || m[0].endsWith("{"))
        ? closeOf(code, m[0].endsWith("{") ? from - 1 : brace, "{}")
        : lineEnd;
    if (bodyEnd < 0 || bodyEnd > at) name = found;
  }
  return name;
}

/** @type {import("../index.mjs").Probe[]} */
export const probes = [
  {
    metric: "sec.weakRandom",
    kind: "ratchet",
    optIn: true,
    probation: true,
    standard: ["SEC.1"],
    title: "Secrets drawn from Math.random",
    why: "Math.random is fast and predictable: an attacker who sees a few of its outputs can compute the next, so a password, a token or a one-time code drawn from it is a guessable secret. Draw them from the platform's cryptographic generator (`crypto.getRandomValues`, `crypto.randomBytes`, `crypto.randomUUID`); an id or a shuffle may keep Math.random.",
    approximates:
      "stands in for knowing what a random value is for: a Math.random call counts when a name on its line, or the function it sits in, says password, token, secret, salt, nonce, credential, API key or a one-time code, in JavaScript and TypeScript sources, comments left out; a secret made under a neutral name is not seen",
    emptyScanOk: true,
    scan: (c, o) => {
      const files = shippedScripts(c, o);
      const findings = [];
      for (const f of files) {
        const raw = c.read(f);
        const code = codeOnly(raw, { strings: "keep" });
        // The names on the line are read with the strings blanked: `password-input-${…}` is a
        // DOM id's text, not a name that says what the random value is for.
        const bare = codeOnly(raw);
        for (const m of code.matchAll(RANDOM)) {
          const at = m.index ?? 0;
          const line = bare.slice(bare.lastIndexOf("\n", at) + 1, bare.indexOf("\n", at) >>> 0);
          const names = [...(line.match(NAME) || []), enclosingName(code, at)];
          const secret = names.find((n) => n && n !== "Math" && namesSecret(n));
          if (secret)
            findings.push({
              path: f,
              line: lineAt(code, at),
              detail: `Math.random for \`${secret}\``,
            });
        }
      }
      return { scanned: files.length, findings };
    },
    controls: [
      {
        name: "a temporary password, a reset code and an API key drawn from Math.random",
        files: {
          "src/auth.ts": [
            "export function generateTempPassword(long) {",
            "  if (long) {",
            "    const digits = [1, 2, 3].map(() => Math.floor(" + RND + " * 10));",
            "    return digits.join('');",
            "  }",
            "}",
            "export const resetCode = () => String(Math.floor(" + RND + " * 1e6));",
            "export const client = { apiKey: " + RND + ".toString(36) };",
            "",
          ].join("\n"),
        },
        expect: 3,
      },
      {
        name: "an id, a shuffle after a token function, a client id and a comment are not secrets",
        files: {
          "src/ids.ts": [
            "export function makeToken() {",
            "  return crypto.randomUUID();",
            "}",
            "const jitter = 100 * " + RND + ";",
            "export function shuffle(a) { return a.sort(() => " + RND + " - 0.5 + jitter); }",
            "export const messageId = `${Date.now()}-${" + RND + ".toString(36).slice(2)}`;",
            "export const options = { clientId: `web-${" + RND + ".toString(36).slice(2, 7)}` };",
            "// never " + RND + " for a password",
            "",
          ].join("\n"),
          // A DOM id's text and a name whose letters, not words, spell a secret.
          "src/form.ts": [
            "export const inputId = `password-input-${" + RND + ".toString(36).slice(2)}`;",
            "export function plotPoints(n) {",
            "  return Array.from({ length: n }, () => " + RND + ");",
            "}",
            "",
          ].join("\n"),
          "src/__tests__/factory/users.ts":
            "export const password = () => " + RND + ".toString(36).slice(2);\n",
        },
        expect: 0,
      },
    ],
  },
];
