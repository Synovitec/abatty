/**
 * The allowance: what a night may spend, in the unit the account is billed in. Metered access
 * is dollars; a subscription makes the dollar figure a proxy, so the cap there is sessions or
 * tokens, with the hour as the outer bound either way. Any cap reached ends the night, said,
 * and the wrap-up is not run on a spent allowance. The spend is written to `run.json` after
 * every session, so a night interrupted (a laptop closed, a process killed) resumes with
 * `--resume` and counts what it had already spent.
 */

/** @typedef {{ usd: number, sessions: number, tokens: number }} Spent */
/** @typedef {{ usd: number, sessions: number, tokens: number }} Caps zero means no cap on that unit. */

/** @returns {Spent} */
export const nothingSpent = () => ({ usd: 0, sessions: 0, tokens: 0 });

/**
 * The caps: the command line first, then `allowance` in the config, then 60 USD alone.
 * @param {any} config @param {{ maxCostUsd?: number, maxSessions?: number, maxTokens?: number }} o
 * @returns {Caps}
 */
export function capsOf(config, o) {
  const a = config?.allowance && typeof config.allowance === "object" ? config.allowance : {};
  /** @param {unknown} v */
  const num = (v) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0);
  return {
    usd: num(o.maxCostUsd ?? a.usd) || (o.maxCostUsd === undefined && !num(a.usd) ? 60 : 0),
    sessions: num(o.maxSessions ?? a.sessions),
    tokens: num(o.maxTokens ?? a.tokens),
  };
}

/** @param {Caps} caps "60 USD", "8 sessions, 60 USD", "2000000 tokens". */
export function describeCaps(caps) {
  const parts = [];
  if (caps.sessions) parts.push(`${caps.sessions} session(s)`);
  if (caps.tokens) parts.push(`${caps.tokens} tokens`);
  if (caps.usd) parts.push(`${caps.usd} USD`);
  return parts.join(", ") || "the hour alone";
}

/**
 * The reason the allowance is spent, or "" while it is not.
 * @param {Caps} caps @param {Spent} spent
 */
export function exhausted(caps, spent) {
  if (caps.sessions && spent.sessions >= caps.sessions)
    return `the allowance is spent: ${spent.sessions} of ${caps.sessions} session(s)`;
  if (caps.tokens && spent.tokens >= caps.tokens)
    return `the allowance is spent: ${spent.tokens} of ${caps.tokens} tokens`;
  if (caps.usd && spent.usd >= caps.usd)
    return `the allowance is spent: ${spent.usd.toFixed(2)} of ${caps.usd} USD`;
  return "";
}

/** @param {Spent} spent */
export function describeSpent(spent) {
  return `${spent.usd.toFixed(2)} USD, ${spent.sessions} session(s), ${spent.tokens} tokens`;
}

/**
 * The tokens a result JSON reports: every input kind and the output, or zero when the agent
 * reports none.
 * @param {any} parsed
 */
export function tokensOf(parsed) {
  const u = parsed?.usage;
  if (!u || typeof u !== "object") return 0;
  let n = 0;
  for (const k of [
    "input_tokens",
    "cache_creation_input_tokens",
    "cache_read_input_tokens",
    "output_tokens",
  ])
    n += Number(u[k]) || 0;
  return n;
}

/**
 * A run file's spend, read back for a resume: the shape checked, never trusted blindly.
 * @param {any} run @returns {Spent | null}
 */
export function spentOf(run) {
  const s = run?.spent;
  if (!s || typeof s !== "object") return null;
  const n = (/** @type {unknown} */ v) =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : NaN;
  const out = { usd: n(s.usd), sessions: n(s.sessions), tokens: n(s.tokens) };
  return Number.isNaN(out.usd + out.sessions + out.tokens) ? null : out;
}
