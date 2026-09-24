/**
 * The database's own "today": `CURRENT_DATE` and its relatives, which the server evaluates in the
 * session's time zone, UTC unless the repository set another. It is the SQL half of the defect
 * `valid.utcDay` counts in JavaScript: between midnight and the offset, the day the query sees is
 * yesterday for a user east of Greenwich. An adopter's `valid.utcDay` read 0 while 196 of these
 * sat in its queries, so a green utcDay read as "the UTC-day problem is closed". Opt-in
 * (`ratchet.enable`), because only a repository that talks to a database has them.
 */
import { codeOnly, lineAt } from "./lex.mjs";
import { matchesAny, regexes } from "./lib.mjs";

/** @typedef {import("../index.mjs").Probe} Probe */

// Assembled from parts so this file is not an offender against the metric it defines.
const DAY = ["current", "date"].join("_");
const NOW = String.raw`(?:now\(\)|current_timestamp|localtimestamp|transaction_timestamp\(\)|statement_timestamp\(\))`;
/**
 * The session's calendar day, in the spellings SQL writes it. Each shape takes the day of the bare
 * timestamp, so one converted first (`(now() AT TIME ZONE 'Europe/Brussels')::date`) never matches.
 */
const SESSION_DAY = new RegExp(
  [
    String.raw`\b${DAY}\b`,
    String.raw`\b${NOW}\s*::\s*date\b`,
    String.raw`\bdate\s*\(\s*${NOW}\s*\)`,
    String.raw`\bdate_trunc\s*\(\s*'day'\s*,\s*${NOW}\s*\)`,
  ].join("|"),
  "gi",
);

/** @type {Probe[]} */
export const probes = [
  {
    metric: "valid.sqlCurrentDate",
    kind: "ratchet",
    optIn: true,
    standard: ["VALID.5"],
    title: "Calendar days the database takes in its session's time zone",
    why: "A query that asks the database for today gets the session's today, UTC unless the connection says otherwise, which is yesterday for the length of the offset every night east of Greenwich. It is the same defect valid.utcDay counts in the code, where that metric cannot see it, so a zero there was read as the problem closed. Take the day in the zone the product lives in (`(now() AT TIME ZONE 'Europe/Brussels')::date`) or pass it from the one function the code already uses.",
    approximates:
      "stands in for knowing the session's time zone: a text reading of CURRENT_DATE, now()::date, current_timestamp::date, date(now()) and date_trunc('day', now()) in .sql files and in the strings of JavaScript and TypeScript, comments left out; one converted with AT TIME ZONE before its day is taken is not counted, and a connection that sets its own time zone is not seen",
    emptyScanOk: true,
    scan: (c, o) => {
      const exempt = regexes(o.config.exempt);
      const files = c.files(/\.(sql|[cm]?[jt]sx?)$/).filter((f) => !matchesAny(f, exempt));
      const findings = [];
      for (const f of files) {
        const raw = c.read(f);
        const text = f.endsWith(".sql")
          ? raw.replace(/--[^\n]*/g, (m) => " ".repeat(m.length))
          : codeOnly(raw, { strings: "keep" });
        for (const m of text.matchAll(SESSION_DAY)) {
          const at = m.index ?? 0;
          findings.push({ path: f, line: lineAt(text, at), detail: `the session's day: ${m[0]}` });
        }
      }
      return { scanned: files.length, findings };
    },
    controls: [
      {
        name: "the session's day in a query string, a query file and three spellings",
        files: {
          "src/shifts.ts": `export const today = (sql) => sql\`select * from shift where day = ${DAY.toUpperCase()}\`;\n`,
          "db/queries/today.sql": `create table t (d date default ${DAY});\nselect now()::date, date(now()), date_trunc('day', current_timestamp);\n`,
        },
        expect: 5,
      },
      {
        name: "a day taken in a named zone, a comment, and a JavaScript name are not counted",
        files: {
          "src/shifts.ts": `// ${DAY} would be the session's day\nconst ${DAY}_label = 1;\nexport const q = "select (now() at time zone 'Europe/Brussels')::date";\n`,
          "db/queries/zoned.sql": `-- not ${DAY}\nselect (now() AT TIME ZONE 'Europe/Brussels')::date;\n`,
        },
        expect: 0,
      },
    ],
  },
];
