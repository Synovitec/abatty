/**
 * The dashboard hosted: a small self-hosted service that CI posts each report to, serving the
 * same page over every repository. No dependency: Node's http, a folder of JSON files, the
 * dashboard renderer the local page already uses.
 *
 *   POST /reports                 a report (the shape `abatty measure` writes), bearer token
 *   GET  /                        the dashboard over every repository
 *   GET  /api/reports             the index: repositories, readings, scores
 *   GET  /api/reports/<name>      one repository's readings
 *   GET  /api/events [?limit=]    what CHANGED across every repository, newest first
 *   GET  /api/events/<name>       one repository's adoption events, newest first
 *   GET  /badge/<name>.svg        the score as a badge
 *   GET  /healthz
 *
 * Writes need the token (`--token`, or ABATTY_TOKEN); the service refuses to start without one
 * unless `--no-auth`, which is for a machine nobody else reaches. Reads are open: a report
 * carries no secret, only the findings of a repository against the standard.
 */
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { renderDashboard } from "../ui/dashboard.mjs";
import { eventsOf, summariseEvents } from "./events.mjs";
import { localToday } from "../core/today.mjs";

/**
 * @typedef {{ dataDir: string, token: string, noAuth?: boolean, abattyVersion?: string }} ServiceOptions
 */

/** A repository name as a folder: letters, digits, dots, dashes, underscores; anything else a dash. @param {string} name */
export function safeName(name) {
  const s = String(name || "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "");
  return s.slice(0, 100) || "repository";
}

/** The folder of reports as a store. @param {string} dataDir */
export function createStore(dataDir) {
  const root = resolve(dataDir);
  mkdirSync(root, { recursive: true });
  /** @param {string} p @returns {any} */
  const readJson = (p) => {
    try {
      return JSON.parse(readFileSync(p, "utf8"));
    } catch {
      return null;
    }
  };
  return {
    root,
    /** Store one report under its repository's folder by date; the newest wins the day. @param {any} report */
    put(report) {
      const name = safeName(report.name);
      const date = /^\d{4}-\d{2}-\d{2}$/.test(String(report.date))
        ? String(report.date)
        : localToday();
      const dir = join(root, name);
      mkdirSync(dir, { recursive: true });
      const text = JSON.stringify(report, null, 2) + "\n";
      writeFileSync(join(dir, `${date}.json`), text);
      writeFileSync(join(dir, "latest.json"), text);
      return { name, date };
    },
    /** Every repository with its readings, oldest first. */
    repos() {
      /** @type {{ name: string, reports: any[] }[]} */
      const out = [];
      for (const name of (existsSync(root) ? readdirSync(root) : []).sort()) {
        const dir = join(root, name);
        let files = [];
        try {
          files = readdirSync(dir)
            .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
            .sort();
        } catch {
          continue;
        }
        const reports = files.map((f) => readJson(join(dir, f))).filter(Boolean);
        if (reports.length) out.push({ name, reports });
      }
      return out;
    },
    /** @param {string} name */
    repo(name) {
      return this.repos().find((r) => r.name === safeName(name)) || null;
    },
  };
}

/** The score as a badge, the colour of the band the terminal uses. @param {string} label @param {number | null} score */
export function badgeSvg(label, score) {
  const value = score === null ? "no reading" : `${score}/100`;
  const colour =
    score === null ? "#9ca3af" : score >= 90 ? "#2f6f46" : score >= 70 ? "#a65a1e" : "#9d3535";
  const lw = 6 * label.length + 12;
  const vw = 6.5 * value.length + 12;
  const w = lw + vw;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20" role="img" aria-label="${label}: ${value}"><title>${label}: ${value}</title><rect width="${lw}" height="20" fill="#374151"/><rect x="${lw}" width="${vw}" height="20" fill="${colour}"/><g fill="#fff" font-family="Verdana,DejaVu Sans,sans-serif" font-size="11" text-anchor="middle"><text x="${lw / 2}" y="14">${label}</text><text x="${lw + vw / 2}" y="14">${value}</text></g></svg>`;
}

/** @param {import("node:http").IncomingMessage} req */
function readBody(req) {
  return new Promise((resolveBody, reject) => {
    /** @type {Buffer[]} */
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > 8 * 1024 * 1024) {
        reject(new Error("body over 8 MB"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolveBody(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

/** A report is an object with a name, a date, a numeric score and findings. @param {any} r */
export function isReport(r) {
  return (
    Boolean(r) &&
    typeof r === "object" &&
    typeof r.name === "string" &&
    typeof r.score === "number" &&
    Array.isArray(r.findings)
  );
}

/**
 * The service. Returns Node's server, not yet listening, so a test can listen on port 0.
 * @param {ServiceOptions} o
 */
export function createService(o) {
  if (!o.token && !o.noAuth)
    throw new Error(
      "a token is required (--token or ABATTY_TOKEN), or --no-auth for a machine nobody else reaches",
    );
  const store = createStore(o.dataDir);
  /** @param {import("node:http").ServerResponse} res @param {number} status @param {string} type @param {string} body */
  const send = (res, status, type, body) => {
    res.writeHead(status, {
      "content-type": type,
      "content-length": Buffer.byteLength(body),
      "cache-control": "no-store",
    });
    res.end(body);
  };
  /** @param {import("node:http").ServerResponse} res @param {number} status @param {unknown} value */
  const json = (res, status, value) =>
    send(res, status, "application/json; charset=utf-8", JSON.stringify(value, null, 2) + "\n");

  const server = createServer(async (req, res) => {
    const url = new URL(req.url || "/", "http://localhost");
    const path = url.pathname;
    try {
      if (req.method === "GET" && path === "/healthz")
        return json(res, 200, { ok: true, repositories: store.repos().length });
      if (req.method === "GET" && path === "/")
        return send(
          res,
          200,
          "text/html; charset=utf-8",
          renderDashboard(store.repos(), { abattyVersion: o.abattyVersion || "" }),
        );
      if (req.method === "GET" && path === "/api/reports")
        return json(
          res,
          200,
          store.repos().map((r) => ({
            name: r.name,
            readings: r.reports.length,
            latest: r.reports.at(-1)?.date,
            score: r.reports.at(-1)?.score,
            enforced: r.reports.at(-1)?.enforced?.share ?? null,
          })),
        );
      // What changed, rather than what the number is: derived from the readings the service
      // already holds, so a repository cannot tell the service it adopted something.
      if (req.method === "GET" && path === "/api/events") {
        const all = store
          .repos()
          .flatMap((r) => eventsOf(r.reports).map((e) => ({ repository: r.name, ...e })));
        all.sort((a, b) => String(b.at).localeCompare(String(a.at)));
        const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit")) || 100));
        return json(res, 200, {
          ...summariseEvents(all),
          events: all.slice(0, limit),
        });
      }
      const events = path.match(/^\/api\/events\/([^/]+)$/);
      if (req.method === "GET" && events) {
        const r = store.repo(decodeURIComponent(events[1] || ""));
        if (!r) return json(res, 404, { error: "no such repository" });
        const list = eventsOf(r.reports).reverse();
        return json(res, 200, { repository: r.name, ...summariseEvents(list), events: list });
      }
      const one = path.match(/^\/api\/reports\/([^/]+)$/);
      if (req.method === "GET" && one) {
        const r = store.repo(decodeURIComponent(one[1] || ""));
        return r ? json(res, 200, r) : json(res, 404, { error: "no such repository" });
      }
      const badge = path.match(/^\/badge\/([^/]+)\.svg$/);
      if (req.method === "GET" && badge) {
        const r = store.repo(decodeURIComponent(badge[1] || ""));
        return send(
          res,
          200,
          "image/svg+xml; charset=utf-8",
          badgeSvg("abatty", r ? Number(r.reports.at(-1)?.score) : null),
        );
      }
      if (req.method === "POST" && path === "/reports") {
        if (!o.noAuth) {
          const auth = String(req.headers.authorization || "");
          if (auth !== `Bearer ${o.token}`)
            return json(res, 401, { error: "a bearer token is required" });
        }
        /** @type {any} */
        let report;
        try {
          report = JSON.parse(await readBody(req));
        } catch (e) {
          return json(res, 400, {
            error: `not JSON: ${e instanceof Error ? e.message : String(e)}`,
          });
        }
        if (!isReport(report))
          return json(res, 400, {
            error:
              "not a report: name, score and findings are required (the shape abatty measure writes)",
          });
        const stored = store.put(report);
        return json(res, 201, {
          stored,
          url: `/api/reports/${encodeURIComponent(stored.name)}`,
          badge: `/badge/${encodeURIComponent(stored.name)}.svg`,
        });
      }
      return json(res, 404, { error: "no such route" });
    } catch (e) {
      return json(res, 500, { error: e instanceof Error ? e.message : String(e) });
    }
  });
  return { server, store };
}

/**
 * Post a report to a service: the CI step. Returns the service's answer.
 * @param {{ url: string, token: string, report: unknown }} o
 */
export async function publishReport(o) {
  const target = new URL("/reports", o.url);
  const res = await fetch(target, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(o.token ? { authorization: `Bearer ${o.token}` } : {}),
    },
    body: JSON.stringify(o.report),
  });
  const text = await res.text();
  /** @type {any} */
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  return { ok: res.ok, status: res.status, body };
}
