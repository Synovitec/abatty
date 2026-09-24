/**
 * The shared fixture `abatty fix --phase 3` writes: every test that imports `test` from it fails
 * when its page throws or logs a hydration mismatch.
 */
export const ERROR_FIXTURE: "// The browser suite's own `test`: a page that throws, or logs a hydration mismatch, fails the\n// test that opened it. The runner passes such a page unless a test listens, so every spec imports\n// `test` and `expect` from here rather than from @playwright/test.\nimport { test as base, expect } from \"@playwright/test\";\n\nconst HYDRATION = /hydrat|did not match|didn't match|server rendered HTML/i;\n\nexport const test = base.extend<{ pageErrors: string[] }>({\n  pageErrors: [\n    async ({ page }, use) => {\n      const errors: string[] = [];\n      page.on(\"pageerror\", (e) => errors.push(`pageerror: ${e.message}`));\n      page.on(\"console\", (m) => {\n        if (m.type() === \"error\" && HYDRATION.test(m.text())) errors.push(`hydration: ${m.text()}`);\n      });\n      await use(errors);\n      expect(errors, \"the page threw or failed to hydrate\").toEqual([]);\n    },\n    { auto: true },\n  ],\n});\n\nexport { expect };\n";
/** @type {import("../index.mjs").Rule[]} */
export const rules: import("../index.mjs").Rule[];
