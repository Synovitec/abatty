/**
 * Observability: what a service leaves behind when it is running and when it stops. Standard
 * OBS.1, which every clause of this family holds a piece of.
 *
 * The standard has carried OBS.1 since it was written and the catalog carried nothing for it,
 * so the pillar was a sentence: a repository could be measured, gated and ratcheted without
 * anyone ever asking whether its logs could be read, whether a secret reached them, or whether
 * the process stopped without dropping the work in flight.
 *
 * Every rule here is a service's: a library has no health endpoint and a browser application
 * has no SIGTERM, so elsewhere the finding is n/a with the reason. The enforcement levels are
 * the honest ones. Most of this family is `review` or `prose` today, which the enforced-share
 * metric will show and a night can promote; claiming `hard` for a mechanism no machine refuses
 * would be the one thing the enforcement map exists to prevent.
 */

import { SERVICE } from "../applies.mjs";

/** Logging libraries that emit structured records rather than lines. */
const LOGGERS = ["pino", "winston", "bunyan", "roarr", "tslog", "@opentelemetry/api", "loglevel"];
/** Error trackers, whose configuration must come from the environment. */
const TRACKERS = [
  "@sentry/node",
  "@sentry/nextjs",
  "@sentry/browser",
  "bugsnag",
  "@bugsnag/js",
  "rollbar",
  "@opentelemetry/sdk-node",
];

/** The text of a repository's server-side sources, joined once. @param {import("../context.mjs").RepoContext} c */
const serverText = (c) =>
  // At any depth, and the logger's own module wherever it lives: a monorepo's
  // `apps/web/lib/observability/logger.ts` configured the redaction the rule said was missing.
  c
    .files(
      /(^|\/)((app\/api|api|server|routes|workers?|jobs|observability|logging)\/.*|[^/]*logger[^/]*)\.(ts|tsx|js|jsx|mjs|cjs)$/,
    )
    // A test or a mock that mentions `redact` or `/health` configures nothing that runs.
    .filter((f) => !/(^|\/)(__mocks__|mocks?|__tests__|tests?)\/|\.(test|spec)\.[^/]+$/.test(f))
    .map((f) => c.read(f))
    .join("\n");

/** @type {import("../index.mjs").Rule[]} */
export const rules = [
  {
    id: "OBS-STRUCTURED",
    family: "Observability",
    title: "A structured logger, not lines on stdout",
    standard: ["OBS.1"],
    level: "must",
    enforcement: "prose",
    phase: "13",
    ...SERVICE,
    why: "A line of text is searchable by a human and by nothing else; a record with fields is queryable, and the first incident is the wrong moment to discover which of the two the service writes.",
    next: "Add a structured logger and make it the only writer of output from the server",
    check: (c) => {
      const dep = LOGGERS.find((l) => c.has(l));
      const own = c.firstFile(/^(src\/)?(server|lib|app)\/.*log(ger|ging)?\.(ts|js|mjs)$/);
      return {
        status: dep || own ? "present" : "missing",
        evidence: dep || own || "no logging dependency and no logger module",
      };
    },
  },
  {
    id: "OBS-REDACTION",
    ceiling: {
      at: "review",
      why: "A machine can see that the logger redacts by field path and can list the paths. Whether that list names every field that would hurt if it were logged is a judgement about this system's data, and the field nobody thought of is invisible to a scan.",
    },
    family: "Observability",
    title: "Redaction by field path at the logger, never at the call sites",
    standard: ["OBS.1"],
    level: "must",
    enforcement: "review",
    phase: "13",
    ...SERVICE,
    why: "A field redacted where it is logged is redacted in the one place somebody remembered; a field redacted in the logger's configuration is redacted everywhere, including in the call added next week by somebody who never read this rule.",
    next: "Configure redaction by field path at the logger (password, token, authorization, email, iban) and remove the hand-written masking at call sites",
    check: (c) => {
      const text = serverText(c);
      const configured = /\bredact\b|\bcensor\b|redactPaths|maskFields/i.test(text);
      const byHand = (text.match(/\*{3,}|\[redacted\]|\bmask\(/gi) || []).length;
      if (!configured)
        return {
          status: "missing",
          evidence: byHand
            ? `no redaction configured at the logger; ${byHand} hand-written masking(s) instead`
            : "no redaction configured at the logger",
        };
      return {
        status: byHand ? "partial" : "present",
        evidence: byHand
          ? `configured at the logger, and ${byHand} hand-written masking(s) remain`
          : "configured at the logger",
      };
    },
  },
  {
    id: "OBS-CONSOLE",
    family: "Observability",
    title: "Bare console output from the server is a lint error",
    standard: ["OBS.1"],
    level: "must",
    enforcement: "hard",
    phase: "13",
    ...SERVICE,
    why: "One console call is the hole every structured-logging rule leaks through: it bypasses the redaction, the request scope and the transport, and it is the easiest thing in the world to add in a hurry.",
    next: "Add no-console at error for the server's paths in the lint configuration",
    check: (c) => {
      // ESLint and oxlint call it no-console; Biome calls it suspicious/noConsole.
      const rule = /no-console|noConsole/.test(c.lintText);
      const calls = (serverText(c).match(/\bconsole\.(log|info|debug|warn|error)\s*\(/g) || [])
        .length;
      if (!rule)
        return {
          status: "missing",
          evidence: `no-console not in the lint configuration${calls ? `; ${calls} console call(s) in the server` : ""}`,
        };
      return {
        status: calls ? "partial" : "present",
        evidence: calls
          ? `no-console configured, and ${calls} console call(s) remain in the server`
          : "no-console configured; no console call in the server",
      };
    },
  },
  {
    id: "OBS-SIGTERM",
    ceiling: {
      at: "review",
      why: "A machine can see that a handler is registered and that the server is asked to close. Whether the work in flight actually finishes before the process goes is proven by sending the signal under load and watching, which is a drill, not a scan.",
    },
    family: "Observability",
    title: "SIGTERM drains the work in flight; it never exits on the spot",
    standard: ["OBS.1"],
    level: "must",
    enforcement: "review",
    phase: "13",
    ...SERVICE,
    why: "Every deploy sends SIGTERM. A process that exits on the signal drops whatever it was holding, and the requests it drops are invisible because the thing that would have logged them is the thing that exited.",
    next: "Handle SIGTERM: fail the health check, stop accepting work, drain what is in flight, then exit",
    check: (c) => {
      const text = serverText(c);
      if (!/process\.on\(\s*["'`]SIGTERM/.test(text))
        return { status: "missing", evidence: "no SIGTERM handler in the server" };
      // The handler's own body, as far as the next top-level statement: an immediate exit there
      // is the failure this rule exists for, and it reads as correct to anyone skimming.
      const body = text.slice(text.search(/process\.on\(\s*["'`]SIGTERM/)).slice(0, 600);
      const immediate = /process\.exit\s*\(/.test(body) && !/(await|then|close|drain)/.test(body);
      return {
        status: immediate ? "partial" : "present",
        evidence: immediate
          ? "a SIGTERM handler that exits without draining"
          : "a SIGTERM handler that drains before exiting",
      };
    },
  },
  {
    id: "OBS-HEALTH",
    family: "Observability",
    title: "A health endpoint the deploy and the load balancer can read",
    standard: ["OBS.1"],
    level: "must",
    enforcement: "review",
    phase: "13",
    ...SERVICE,
    why: "Without one, the only signal that a service is alive is that it has not yet failed visibly, and a dead background worker looks exactly like an idle one.",
    next: "Add a health or readiness endpoint, and make the SIGTERM handler fail it first",
    check: (c) => {
      // The shortest path is the endpoint itself: the first in file order named
      // `/api/health/email` where `/api/health` was the one a load balancer reads.
      // A route file before anything else, then the shortest path: `lib/api/health.ts` is a
      // helper the endpoint calls, and it was named over `app/api/health/route.ts` for being
      // shorter. Tests and mocks are never the endpoint.
      const isRoute = (/** @type {string} */ f) =>
        /(^|\/)(app\/.*\/route|pages\/api\/.*|routes?\/.*)\.(ts|tsx|js|jsx|mjs|cjs)$/.test(f);
      const route = c
        .files(/(^|\/)(health|healthz|ready|readyz|livez|liveness|readiness)(\.|\/)/i)
        .filter((f) => !/(^|\/)(__mocks__|mocks?|__tests__|tests?)\/|\.(test|spec)\./.test(f))
        .sort((a, b) => Number(isRoute(b)) - Number(isRoute(a)) || a.length - b.length)[0];
      const inText = /["'`]\/(healthz?|ready(z)?|livez|liveness|readiness)\b/.test(serverText(c));
      return {
        status: route || inText ? "present" : "missing",
        evidence: route || (inText ? "a health path in the server's routes" : "no health endpoint"),
      };
    },
  },
  {
    id: "OBS-TRACKER",
    family: "Observability",
    title: "The error tracker is configured from the environment",
    standard: ["OBS.1"],
    level: "should",
    enforcement: "prose",
    phase: "13",
    ...SERVICE,
    why: "The tracker has to work when the database is the broken thing, so its configuration cannot come from the database: a tracker that reads its own settings from the store it is meant to report on goes quiet exactly when it is needed.",
    next: "Add an error tracker and read its configuration from the environment",
    check: (c) => {
      const dep = TRACKERS.find((t) => c.has(t));
      if (!dep) return { status: "missing", evidence: "no error tracker" };
      const fromEnv = /process\.env\.[A-Z_]*(SENTRY|BUGSNAG|ROLLBAR|OTEL|DSN)/.test(serverText(c));
      return {
        status: fromEnv ? "present" : "partial",
        evidence: fromEnv
          ? `${dep}, configured from the environment`
          : `${dep}, configuration not read from the environment here`,
      };
    },
  },
];
