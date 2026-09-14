/**
 * Security: the secret scan in the hook and in CI, the dependency audit, the frozen lockfile,
 * no env file tracked. Standard SEC-1.
 */

/** @type {import("../index.mjs").Rule[]} */
export const rules = [
  {
    id: "SEC-SECRETS",
    family: "Security",
    title: "Secret scan in the hook and in CI from one config",
    standard: ["SEC-1"],
    level: "must",
    enforcement: "hard",
    phase: "0",
    why: "A secret in the history is a secret to rotate; the hook refuses it before the commit, CI catches what the hook was skipped for, one config so the two agree.",
    next: "Add gitleaks (staged in pre-commit, history in CI)",
    check: (c) => {
      const scanner = c.exists(".gitleaks.toml")
        ? ".gitleaks.toml"
        : c.firstFile(/scan-secrets|secret-scan|gitleaks/) ||
          (c.script(/secret/) ? "npm script" : "");
      const ci = /gitleaks|scan-secrets|secret-scan|secretlint|trufflehog/.test(c.ciText);
      const hook = /gitleaks|secret/.test(c.read(c.firstFile(/pre-commit/) || ""));
      return {
        status: ci && (hook || scanner) ? "present" : ci || scanner || hook ? "partial" : "missing",
        evidence: `${scanner || "no scanner config"}${ci ? "; CI step" : "; no CI step"}${hook ? "; pre-commit" : "; no pre-commit"}`,
      };
    },
  },
  {
    id: "SEC-AUDIT",
    family: "Security",
    title: "Dependency audit in CI",
    standard: ["SEC-1"],
    level: "must",
    enforcement: "hard",
    phase: "0",
    why: "The supply chain is part of the product; a known vulnerability in a dependency is refused by the audit, not discovered by an incident.",
    next: "Add npm/pnpm audit on the shipped tree and audit signatures",
    check: (c) => {
      const ci = /audit/.test(c.ciText);
      const s = c.script(/audit/);
      return {
        status: ci || s ? "present" : "missing",
        evidence: ci ? "ci step" : s?.[0] || "none",
      };
    },
  },
  {
    id: "SEC-LOCKFILE",
    family: "Security",
    title: "Lockfile committed and frozen installs in CI",
    standard: ["SEC-1"],
    level: "must",
    enforcement: "hard",
    phase: "0",
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
    standard: ["SEC-1"],
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
