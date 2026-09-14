---
paths:
  - "**/*.test.*"
  - "**/*.spec.*"
  - "tests/**"
  - "e2e/**"
---

# Testing rules (loaded when a test file is open)

- Vitest; tests colocated (`service.test.ts` beside `service.ts`) unless the repository's
  conventions say a mirrored `tests/` tree.
- Required: every service function, every non-trivial utility, every reducer, every guard.
  Not required: presentational components, generated code, thin resolvers.
- One behaviour per test, named as a sentence: `it("rejects an invoice with a past due date")`.
  A name that needs "and" is two tests.
- Deterministic by construction: `vi.useFakeTimers()` + `vi.setSystemTime()` restored in
  `afterEach`; randomness seeded or mocked; no network.
- Integration tests hit a real Postgres inside a rolled-back transaction, on real migrations.
  No mocking of the ORM: a mock cannot see a constraint, a transaction or a race.
- Fixtures live in `test/factories/`, never inline blobs copied between files.
- A new guard is mutation-tested: break what it protects, watch the test go red, restore.
  Confirm the mutant EXISTS before reading a green as a verdict; break both halves of a rule
  enforced twice; check the assertion can tell the two outcomes apart.
- Read the `Test Files` count, not only `Tests`: a file that failed to collect contributes
  nothing and reads green.
- `toHaveBeenCalledWith(a)` fails on `f(a, undefined)`: vitest compares argument arrays and
  `undefined` is not nothing. A suite that mocks a library barrel breaks when a child switches
  to a deep import; read the test before choosing the shape of a refactor.
- Playwright: a mobile viewport is a project, not a branch; `retries` 0 locally and at most 2
  in CI; `trace: "on-first-retry"`; `axe` with zero critical or serious, including after a
  modal opens. A flaky test is quarantined with an owner and a date, never retried away.
