// Synthetic repositories shaped like the adopters that report to this package: never their code,
// only the shapes their reports turned on. Each report becomes a case in test/adopter-corpus.test
// against one of these, so a miss an adopter found once cannot come back unseen. Add the shape a
// new report needs here, not a copy of the adopter's files.
import { tempRepo } from "../helpers.mjs";

/** A Next + Prisma product with a browser suite, as the product adopter's reports describe it. */
export function productAdopter() {
  const dir = tempRepo("adopter-product", {
    "package.json": JSON.stringify({
      name: "product",
      devDependencies: { "@playwright/test": "1.50.0", vitest: "3.0.0" },
      scripts: {
        test: "vitest run",
        "test:changed": "vitest run --changed",
        "db:setup":
          "prisma generate && prisma db push --force-reset --accept-data-loss && prisma db seed",
        "db:push": "prisma db push",
        setup: "pnpm db:setup",
        lint: "eslint .",
        "test:integration": "node scripts/ci/integration.mjs",
      },
    }),
    "scripts/ci/integration.mjs":
      "import { run } from './test-db.mjs';\nprocess.exit(run('pnpm', ['exec', 'vitest', 'run', '-c', 'vitest.integration.config.ts']).status ?? 1);\n",
    "scripts/ci/test-db.mjs": "export const run = () => ({ status: 0 });\n",
    "vitest.integration.config.ts":
      "export default { test: { include: ['tests/integration/**/*.test.ts'], setupFiles: ['tests/integration/setup.ts'] } };\n",
    "tests/integration/orders.test.ts":
      'import { test } from "vitest";\ntest("orders", () => {});\n',
    "lib/orders.ts": "export const orders = 1;\n",
    "prisma/schema.prisma": "model Order { id Int @id }\n",
    ".env.example": "DATABASE_URL=\nNEXTAUTH_SECRET=\nNEXTAUTH_URL=\n",
    "vitest.config.ts":
      "export default { test: { coverage: { exclude: ['lib/prisma.ts', 'lib/auth-guard.ts', 'server/order-store.ts'] } } };\n",
    ".claude/settings.json": JSON.stringify({
      permissions: {
        deny: ["Read(./.env)", "Read(./.env.local)", "Read(./.env.production)"],
        allow: ["Read(./.env.example)"],
      },
    }),
    ".github/workflows/checks.yml": [
      "on: push",
      "jobs:",
      "  gate:",
      "    steps:",
      "      - run: |",
      '          BEFORE="${{ github.event.before }}"',
      '          if [ "$BEFORE" = "0000000000000000000000000000000000000000" ]; then RANGE="HEAD~1..HEAD"; else RANGE="$BEFORE..HEAD"; fi',
      "",
    ].join("\n"),
    "app/page.tsx": "export default function Home() { return null; }\n",
    "app/admin/login/page.tsx": "export default function Login() { return null; }\n",
    "app/manager/(protected)/restaurants/[id]/dishes/[dishId]/edit/page.tsx":
      "export default function EditDish() { return null; }\n",
    "e2e/session.ts": "export const login = (page, portal) => page.goto(`/${portal}/login`);\n",
    "e2e/home.spec.ts":
      'import { test, expect } from "@playwright/test";\ntest("home", async ({ page }) => { await page.goto("/"); });\n',
  });
  return dir;
}

/** A task-runner monorepo whose suites run in each workspace, as the monorepo adopter's do. */
export function monorepoAdopter() {
  const pkg = (/** @type {Record<string, string>} */ scripts) => JSON.stringify({ scripts });
  return tempRepo("adopter-monorepo", {
    "package.json": JSON.stringify({
      name: "monorepo",
      workspaces: ["apps/*", "packages/*"],
      scripts: {
        test: "turbo run test",
        "test:integration": "bun run scripts/run-integration-tests.ts",
      },
    }),
    "scripts/run-integration-tests.ts":
      "spawnSync('bun', ['test', '--isolate', 'tests/integration/'], { cwd: join(root, 'apps', 'web') });\n",
    "apps/mobile/package.json": pkg({ test: "jest" }),
    "apps/mobile/lib/a.ts": "export const a = 1;\n",
    "apps/web/package.json": pkg({ test: "bun test --isolate lib/ app/" }),
    "apps/web/lib/b.ts": "export const b = 1;\n",
    "apps/web/tests/integration/shifts.test.ts": "export {};\n",
    "packages/zod/package.json": pkg({ test: "echo 'no tests yet' && exit 0" }),
  });
}

/** A repository whose domain documents cite each other, as the documentation adopter's do. */
export function docsAdopter() {
  const FM = (/** @type {string} */ extra) =>
    `---\ntitle: "T"\ndescription: "D"\ncategory: reference\nstatus: living\n${extra}---\n\n# T\n`;
  const dir = tempRepo("adopter-docs", {
    "package.json": JSON.stringify({ name: "docs" }),
    "src/shifts.ts": "export const shifts = 1;\n",
    "docs/domain/shifts.md": FM(`source_truth:\n  - "src/shifts.ts"\n`) + "How shifts are paid.\n",
    "docs/product/module.md":
      FM(`last_verified: "2026-05-12"\nsource_truth:\n  - "docs/domain/shifts.md"\n`) +
      "The module.\n",
  });
  return { dir, FM };
}
