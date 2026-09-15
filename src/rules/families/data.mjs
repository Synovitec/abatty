/**
 * Data: migrations as the source of truth, tenant isolation proven, a restore drill.
 * Standard DATA.1, DATA.3, DATA.5. Every check is n/a on a repository without an ORM.
 */

const ORMS = ["prisma", "drizzle-orm", "sequelize", "typeorm", "kysely"];

/** @param {import("../index.mjs").RepoContext} c */
const orm = (c) => ORMS.filter(c.has);
/** @param {import("../index.mjs").RepoContext} c */
const migrations = (c) => c.files(/(^|\/)(migrations|drizzle)\/.*\.(sql|js|cjs|ts)$/);

/** @type {import("../index.mjs").Rule[]} */
export const rules = [
  {
    id: "DATA-MIGRATIONS",
    family: "Data",
    title: "Migrations are the source of truth",
    standard: ["DATA.1"],
    level: "must",
    enforcement: "hard",
    phase: "0",
    why: "A schema that lives only in the database cannot be reviewed, replayed or rolled back; an applied migration edited afterwards is a schema that differs per environment.",
    next: "Generate or hand-write migrations; never edit an applied one",
    check: (c) => {
      const o = orm(c);
      const m = migrations(c);
      return {
        status: o.length === 0 ? "n/a" : m.length > 0 ? "present" : "missing",
        evidence: `${o.join(", ") || "no ORM"}; ${m.length} migration file(s)`,
      };
    },
  },
  {
    id: "DATA-TENANT",
    family: "Data",
    title: "Tenant isolation proven: RLS or a scoped service plus an isolation test",
    standard: ["DATA.3"],
    level: "must",
    enforcement: "hard",
    phase: "4 / 10",
    why: "One tenant reading another's rows is the failure a multi-tenant product does not survive; it is proven by a negative test on a real database, not by the presence of a column.",
    next: "Add a negative isolation integration test (tenant A cannot read B)",
    check: (c) => {
      const o = orm(c);
      const m = migrations(c);
      const rls = m.some((f) => /ROW LEVEL SECURITY/i.test(c.read(f)));
      // A column is a word on its own, not the tail of another name: `ms_tenant_id` (a settings
      // key for a Microsoft tenant) read as a tenant column on a single-tenant repository.
      const tenantCol = m.some((f) =>
        /(^|[^\w])(store_id|tenant_id|company_id|organisation_id|organization_id)(?![\w])/i.test(
          c.read(f),
        ),
      );
      // A negative scope test on a real database counts whatever it is named after: the proof
      // that one caller cannot read another's rows is called `visibility` or `scope` as often as
      // `tenant`.
      const isolationTest = c
        .files(/(isolation|tenant|rls|visibility|scope).*\.test\.|\/rls\//i)
        .some((f) => /^tests\/(db|integration|rls)\//.test(f));
      return {
        status:
          o.length === 0 ? "n/a" : rls || isolationTest ? "present" : tenantCol ? "partial" : "n/a",
        evidence: `${rls ? "RLS in migrations" : tenantCol ? "tenant column, no RLS" : "no tenant column found"}${isolationTest ? "; isolation test present" : "; no isolation test"}`,
      };
    },
  },
  {
    id: "DATA-BACKUP",
    family: "Data",
    title: "A restore drill exists",
    standard: ["DATA.5"],
    level: "must",
    enforcement: "review",
    phase: "-",
    why: "A backup that has never been restored is a hope; the drill, dated, is the proof, and a human runs it.",
    next: "Add a restore drill script and date each run in OPERATIONS.md",
    check: (c) => {
      // Match the script NAME, not its command line: a dev server whose command mentions a
      // backup-service module is not a restore drill.
      const key = Object.keys(c.scripts).find((k) => /restore|backup/.test(k));
      const file = c.firstFile(/(^|\/)scripts\/.*(backup|restore)/);
      const found = key || file;
      return {
        status: found ? "present" : "missing",
        evidence: found || "no backup/restore script",
      };
    },
  },
];
