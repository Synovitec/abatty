/**
 * The browser suite's blind spots: what a green browser run does not prove. A page that throws
 * or fails to hydrate passes every test that did not listen for it; an adopter shipped a React
 * hydration mismatch through sixty-two green browser tests, twice. Standard TEST.3.
 */
import { BROWSER } from "../applies.mjs";

/** A browser test or fixture: a script that imports the browser runner. */
const RUNNER_IMPORT = /from\s+["']@playwright\/test["']|require\(\s*["']@playwright\/test["']\s*\)/;
/** `test` taken from the runner itself rather than from the repository's fixture. */
const BARE_TEST = /import\s*\{[^}]*\btest\b[^}]*\}\s*from\s+["']@playwright\/test["']/;
const SPEC = /\.(spec|test|e2e)\.[cm]?[jt]sx?$/;

/**
 * The shared fixture `abatty fix --phase 3` writes: every test that imports `test` from it fails
 * when its page throws or logs a hydration mismatch.
 */
export const ERROR_FIXTURE = `// The browser suite's own \`test\`: a page that throws, or logs a hydration mismatch, fails the
// test that opened it. The runner passes such a page unless a test listens, so every spec imports
// \`test\` and \`expect\` from here rather than from @playwright/test.
import { test as base, expect } from "@playwright/test";

const HYDRATION = /hydrat|did not match|didn't match|server rendered HTML/i;

export const test = base.extend<{ pageErrors: string[] }>({
  pageErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(\`pageerror: \${e.message}\`));
      page.on("console", (m) => {
        if (m.type() === "error" && HYDRATION.test(m.text())) errors.push(\`hydration: \${m.text()}\`);
      });
      await use(errors);
      expect(errors, "the page threw or failed to hydrate").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
`;

/** @type {import("../index.mjs").Rule[]} */
export const rules = [
  {
    id: "TEST-E2E-ERRORS",
    family: "Tests",
    title: "A browser test fails when its page throws or does not hydrate",
    standard: ["TEST.3"],
    level: "must",
    enforcement: "hard",
    phase: "3",
    ...BROWSER,
    why: "The browser runner passes a page that threw an uncaught error or logged a hydration mismatch unless a test listens for it, so a suite can be green over a page that is broken for every user. One shared fixture that listens, and every spec taking `test` from it, closes that for the whole suite at once.",
    next: "Add a fixture that fails the test on `pageerror` and on a hydration console error, and import `test` from it in every spec (`abatty fix --phase 3` writes e2e/fixtures.ts)",
    check: (c) => {
      if (!c.has("@playwright/test"))
        return {
          status: "n/a",
          evidence: "no Playwright suite (another browser runner is not read yet)",
        };
      const files = c.files(/\.[cm]?[jt]sx?$/).filter((f) => RUNNER_IMPORT.test(c.read(f)));
      const listens = (/** @type {RegExp} */ re) => files.filter((f) => re.test(c.read(f)));
      const pageErrors = listens(/["']pageerror["']/);
      // Heard only where a console listener sits beside the pattern: a test titled "hydration"
      // listens to nothing.
      const hydration = listens(/on\(\s*["']console["']/).filter((f) => /hydrat/i.test(c.read(f)));
      const bare = files.filter((f) => SPEC.test(f) && BARE_TEST.test(c.read(f)));
      const heard = pageErrors.length > 0 && hydration.length > 0;
      return {
        status:
          heard && !bare.length
            ? "present"
            : pageErrors.length || hydration.length
              ? "partial"
              : "missing",
        evidence: `${pageErrors.length ? `pageerror heard in ${pageErrors[0]}` : "no pageerror listener"}, ${hydration.length ? "hydration errors heard" : "hydration errors not heard"}${bare.length ? `; ${bare.length} spec(s) take test from @playwright/test and skip the listener: ${bare.slice(0, 3).join(", ")}` : ""}`,
      };
    },
  },
];
