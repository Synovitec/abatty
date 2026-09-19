/**
 * Security: the secret scan in the hook and in CI, the dependency audit, the frozen lockfile,
 * no env file tracked. Standard SEC.1.
 */

import { PACKAGE } from "../applies.mjs";

/** @type {import("../index.mjs").Rule[]} */
export const rules = [
  {
    id: "SEC-SECRETS",
    family: "Security",
    title: "Secret scan in the hook and in CI from one config",
    standard: ["SEC.1"],
    level: "must",
    enforcement: "hard",
    phase: "0",
    why: "A secret in the history is a secret to rotate; the hook refuses it before the commit, CI catches what the hook was skipped for, one config so the two agree. What the scan is worth is a measurement, not an assertion: `abatty secrets --benchmark` scores it against a published corpus, and the numbers are in docs/SECRET_SCAN_BENCHMARK.md.",
    next: "abatty init writes the pre-commit hook (abatty secrets --staged) and abatty ci the CI step; the gate runs the same scan",
    check: (c) => {
      const scanner = c.exists(".gitleaks.toml")
        ? ".gitleaks.toml"
        : c.firstFile(/scan-secrets|secret-scan|gitleaks/) ||
          (c.script(/secret/) ? "npm script" : "") ||
          (c.script(/abatty gate/) ? "the gate's built-in scan" : "");
      const ci = /gitleaks|scan-secrets|secret-scan|secretlint|trufflehog|abatty secrets/.test(
        c.ciText,
      );
      const hook = /gitleaks|secret/.test(c.read(c.firstFile(/pre-commit/) || ""));
      return {
        status: ci && (hook || scanner) ? "present" : ci || scanner || hook ? "partial" : "missing",
        evidence: `${scanner || "no scanner config"}${ci ? "; CI step" : "; no CI step"}${hook ? "; pre-commit" : "; no pre-commit"}`,
      };
    },
  },
  {
    id: "SEC-DISCLOSURE",
    family: "Security",
    title: "A coordinated vulnerability disclosure policy, where a reporter looks for it",
    standard: ["SEC.1"],
    level: "should",
    enforcement: "prose",
    phase: "0",
    ceiling: {
      at: "review",
      why: "A machine can see that the policy exists, that it names a contact and that it says how long a reporter should expect to wait. Whether anybody answers that contact is the only thing that matters about it, and no check can see an unanswered mail.",
    },
    why: "Somebody who finds a vulnerability in your product will spend about five minutes looking for where to send it. With no policy they either post it publicly or drop it, and both are worse for you than an email. The file also carries the promise a reporter is owed: who reads it, and how long they should expect to wait.",
    next: "Publish SECURITY.md at the root, in .github/ or in docs/, naming a contact and the response time a reporter should expect",
    check: (c) => {
      const file = ["SECURITY.md", ".github/SECURITY.md", "docs/SECURITY.md"].find(c.exists);
      if (!file) return { status: "missing", evidence: "no SECURITY.md" };
      const text = c.read(file);
      const contact = /@|https?:\/\/|mailto:/.test(text);
      const expectation =
        /within \d|\d+ (business |working )?(day|hour|week)|response time|acknowledg/i.test(text);
      return {
        status: contact && expectation ? "present" : "partial",
        evidence: `${file}${contact ? ", a contact" : ", NO contact: a policy nobody can reply to"}${expectation ? ", a response time" : ", no response time a reporter can hold you to"}`,
      };
    },
  },
  {
    id: "SEC-AUDIT",
    family: "Security",
    title: "Dependency audit in CI",
    standard: ["SEC.1"],
    level: "must",
    enforcement: "hard",
    phase: "0",
    ...PACKAGE,
    why: "The supply chain is part of the product; a known vulnerability in a dependency is refused by the audit, not discovered by an incident. An UNSCOPED audit is the reason teams switch audits off: it reports a dev-only advisory nobody ships, at a severity nobody would act on, with no fix available, on every push, until somebody adds the flag that kills it for good.",
    next: "Scope the audit before you trust it: production dependencies only (--omit=dev / --prod), a severity floor (--audit-level), and an advisory allowed with a reason and an expiry date (security.audit.allow) rather than a flag that silences everything",
    check: (c) => {
      const ci = /audit/.test(c.ciText);
      const s = c.script(/audit/);
      const text = [c.ciText, s?.[1] || ""].join("\n");
      const allow = /** @type {any} */ (c.adoption)?.security?.audit?.allow;
      // The gate's own audit step is scoped by construction: production dependencies, a severity
      // floor, and allowances that expire. A repository whose CI runs the gate has it, and a rule
      // that could not see that would be reading for a flag rather than for the practice.
      if (/abatty(\.mjs)? gate\b/.test([c.ciText, ...Object.values(c.scripts || {})].join("\n")))
        return {
          status: "present",
          evidence: `the gate's built-in audit: production only, a severity floor${Array.isArray(allow) && allow.length ? `, ${allow.length} allowance(s)` : ""}`,
        };
      if (!ci && !s) return { status: "missing", evidence: "none" };
      // Two of the three scopes are readable from the command; the third is the allowance, which
      // is a config key rather than a flag and is counted where the repository states it.
      const scoped = /--omit=dev|--production\b|--prod\b|--groups=?\s*prod/.test(text);
      const floor = /--audit-level|--severity|--fail-on/.test(text);
      const where = ci ? "ci step" : s?.[0] || "script";
      const has = [
        scoped ? "production only" : "",
        floor ? "a severity floor" : "",
        Array.isArray(allow) && allow.length ? `${allow.length} allowance(s)` : "",
      ].filter(Boolean);
      const lacks = [scoped ? "" : "production scoping", floor ? "" : "a severity floor"].filter(
        Boolean,
      );
      return {
        status: scoped && floor ? "present" : "partial",
        evidence: `${where}${has.length ? ": " + has.join(", ") : ""}${lacks.length ? `; unscoped on ${lacks.join(" and ")}, which is the audit people end up switching off` : ""}`,
      };
    },
  },
  {
    id: "SEC-LOCKFILE",
    family: "Security",
    title: "Lockfile committed and frozen installs in CI",
    standard: ["SEC.1"],
    level: "must",
    enforcement: "hard",
    phase: "0",
    ...PACKAGE,
    why: "An install that resolves versions at build time builds a different product each time; the lockfile, frozen, is the one that was tested.",
    next: "Use npm ci / pnpm install --frozen-lockfile in CI",
    check: (c) => {
      const lockfile = ["pnpm-lock.yaml", "package-lock.json", "yarn.lock"].find(c.exists);
      const frozen = /npm ci|--frozen-lockfile|--immutable/.test(c.ciText);
      return {
        status:
          lockfile && /npm ci|--frozen-lockfile|yarn install --immutable/.test(c.ciText)
            ? "present"
            : lockfile
              ? "partial"
              : "missing",
        evidence: `${lockfile || "no lockfile"}${frozen ? ", frozen install in CI" : ", CI install not frozen"}`,
      };
    },
  },
  {
    id: "SEC-ENVFILES",
    family: "Security",
    title: "No .env file tracked in git",
    standard: ["SEC.1"],
    level: "must",
    enforcement: "hard",
    phase: "0",
    why: "A tracked env file is every secret in it, in the history, on every clone.",
    next: "Remove from the index, rotate the secrets, gitignore the pattern",
    check: (c) => {
      const tracked = c
        .git("ls-files", ".env", ".env.local", ".env.production", ".env.development.local")
        .split("\n")
        .filter(Boolean);
      return {
        status: tracked.length === 0 ? "present" : "missing",
        evidence: tracked.length ? `tracked: ${tracked.join(", ")}` : "none tracked",
      };
    },
  },
];
