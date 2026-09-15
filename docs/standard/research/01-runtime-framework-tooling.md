---
title: "Research 2026-09-13: Node.js, Next.js 16, TypeScript, ESLint, JSDoc"
description: "Sourced, rule-shaped practices for the runtime and language tooling cluster, with the conflicts and gaps found against the standard on the day it was written. A dated record; the standard is what was adopted."
category: reference
status: stable
audience: ["architect", "developer", "agent"]
tags: ["research", "nodejs", "nextjs", "typescript", "eslint", "jsdoc"]
related: ["../BEST_PRACTICES.md", "../ENGINEERING_STANDARD.md"]
scope: synovitec
last_verified: "2026-09-13"
---

# Runtime, framework, language tooling - 2026 best practices

Researched against official docs (nodejs.org, nextjs.org, typescriptlang.org, typescript-eslint.io,
eslint.org, OWASP) and widely-recognised secondary sources where no official page exists. Read
against `ops-hub/engineering/ENGINEERING_STANDARD.md` (last_verified 2026-09-13).

## 1. Node.js 22 LTS / 24

- MUST use `"type": "module"` and the `exports` field for a new package; ESM-only is the 2026
  default (https://nodejs.org/api/packages.html)
- SHOULD use `moduleResolution`/`module: "nodenext"` for any TS project that runs under Node, so
  `package.json` exports and dual ESM/CJS resolve correctly - `"node"` is deprecated
  (https://reintech.io/blog/how-to-set-up-typescript-with-nodejs-22-modern-configuration-guide)
- SHOULD run TypeScript directly via Node's native type-stripping for scripts/tools, keeping
  `tsc --noEmit` as the separate, authoritative type-check step - native stripping does not
  type-check (https://www.pkgpulse.com/guides/nodejs-native-typescript-support-toolchain-2026)
- MUST load env files with the built-in `--env-file` flag or `process.loadEnvFile()` (stable since
  v24), not a third-party dependency for the same job
  (https://dev.to/zacharylee/ditch-dotenv-nodejs-now-natively-supports-env-file-loading-8e6)
- MUST treat SIGTERM as "stop accepting new work, drain in-flight work, then exit" - never call
  `process.exit(0)` immediately and never ignore it (both drop in-flight requests)
  (https://dev.to/axiom_agent/nodejs-graceful-shutdown-the-right-way-sigterm-connection-draining-and-kubernetes-fp8)
- SHOULD fail health checks and reject new connections the instant SIGTERM arrives, before
  starting the drain, to minimise what still has to finish
  (https://oneuptime.com/blog/post/2026-01-06-nodejs-graceful-shutdown-handler/view)
- MUST bind an `error` listener on every socket/EventEmitter that can emit one, so a single bad
  connection cannot crash the process (https://nodejs.org/en/learn/getting-started/security-best-practices)
- MUST configure server timeouts (`headersTimeout`, `requestTimeout`, `keepAliveTimeout`) and
  connection caps to blunt slow-request DoS (https://nodejs.org/en/learn/getting-started/security-best-practices)
- MUST log structured JSON (pino or equivalent) with request-scoped child loggers, never
  string-concatenated messages (https://betterstack.com/community/guides/logging/how-to-install-setup-and-use-pino-to-log-node-js-applications/)
- MUST redact secrets/PII by field path at the logger configuration (password, token,
  authorization header, card number), not by hand at each call site
  (https://lepape.me/nodejs-best-practices-redacting-secrets-from-pino-logs/)
- MUST pin exact versions with a lockfile and run `npm ci` (never `npm install`) in CI
  (https://nodejs.org/en/learn/getting-started/security-best-practices)
- MUST run `npm audit` for known CVEs AND `npm audit signatures` for registry/provenance
  signatures in CI - the two catch different things
  (https://docs.npmjs.com/cli/v11/commands/npm-audit/, https://docs.npmjs.com/viewing-package-provenance/)
- SHOULD set a dependency cooldown (`--min-release-age`) so a just-published version is not
  installed sight-unseen; override only for a security fix
  (https://nodejs.org/en/learn/getting-started/security-best-practices)
- SHOULD disable install-time scripts by default (`npm config set ignore-scripts true`)
  (https://nodejs.org/en/learn/getting-started/security-best-practices)
- MUST never return a raw stack trace to a client; log the detail server-side, return a generic
  message (https://cheatsheetseries.owasp.org/cheatsheets/Nodejs_Security_Cheat_Sheet.html)
- SHOULD use `crypto.timingSafeEqual()` / `crypto.scrypt()` for any secret comparison, never a
  variable-time `===` on a token or hash (https://nodejs.org/en/learn/getting-started/security-best-practices)
- SHOULD use the built-in `node:test` runner for new pure-Node suites where a framework is not
  already load-bearing (https://nodejs.org/docs/latest-v24.x/api/test.html)

## 2. Next.js 16 App Router

- MUST rename `middleware.ts` to `proxy.ts` (exported fn `proxy`) - the old convention is
  deprecated (https://nextjs.org/docs/app/api-reference/file-conventions/proxy)
- MUST treat Proxy as always running on the Node.js runtime in Next 16; the `runtime` config
  cannot be set there (https://nextjs.org/docs/app/api-reference/file-conventions/proxy)
- MUST re-verify auth inside every Server Function/route rather than relying on a Proxy matcher -
  a matcher change or a Server Action on an excluded path silently skips Proxy
  (https://nextjs.org/docs/app/api-reference/file-conventions/proxy)
- MUST authenticate and authorize inside every Server Action; render-time gating (hiding a button)
  is not a security boundary (https://nextjs.org/docs/app/guides/server-actions)
- MUST accept only an id/reference from the client in a Server Action and re-derive the row and
  its ownership from the session server-side; never trust a whole object's id as authorization
  (https://nextjs.org/docs/app/guides/server-actions)
- SHOULD set `serverActions.allowedOrigins` when Actions sit behind a proxy/CDN domain, and set
  `bodySizeLimit` explicitly instead of relying on the 1MB default
  (https://nextjs.org/docs/app/guides/server-actions)
- MUST set `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` to a stable, shared value on any multi-instance or
  self-hosted deployment, or closures fail to decrypt (https://nextjs.org/docs/app/guides/server-actions)
- MUST enable Cache Components (`cacheComponents: true`) and mark cacheable work explicitly with
  `"use cache"`; everything else is dynamic per request by default in Next 16
  (https://nextjs.org/blog/next-16)
- MUST read `cookies()`/`headers()`/`searchParams` outside a `"use cache"` scope and pass the
  needed value in as an argument - calling them inside throws
  (https://nextjs.org/docs/app/api-reference/directives/use-cache)
- MUST set an explicit `cacheLife` profile on every `"use cache"` scope; omitting it silently
  applies the 5 min/15 min "default" profile (https://nextjs.org/docs/app/api-reference/directives/use-cache)
- MUST use `updateTag()` (Server Actions only) for read-your-own-writes, and
  `revalidateTag(tag, profile)` for stale-while-revalidate background refresh - `revalidateTag`
  now requires the profile argument and the two are not interchangeable (https://nextjs.org/blog/next-16)
- MUST remember a closed-over variable inside a `"use cache"` function becomes part of its cache
  key automatically; a per-tenant value in scope is safe by construction, a mutable shared object
  read by reference is not (https://nextjs.org/docs/app/api-reference/directives/use-cache)
- SHOULD prefer static `export const metadata` over `generateMetadata` whenever metadata does not
  depend on request data (https://nextjs.org/docs/app/getting-started/metadata-and-og-images)
- MUST give `global-error.tsx` its own `<html>/<body>` (it replaces the root layout) and know it
  cannot export `metadata`/`generateMetadata` because it must be a Client Component
  (https://github.com/vercel/next.js/discussions/82284)
- SHOULD use `next/image` with `remotePatterns` (the `domains` option is deprecated) and
  `next/font` for automatic self-hosting (https://nextjs.org/blog/next-16)
- Turbopack is stable and the default bundler for both dev and production builds in Next 16; keep
  `--webpack` only as a documented, explicit opt-out (https://nextjs.org/blog/next-16)

## 3. TypeScript strict configuration

- MUST enable `"strict": true` as the floor - it bundles `alwaysStrict`, `noImplicitAny`,
  `strictNullChecks`, `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`,
  `noImplicitThis`, `useUnknownInCatchVariables`, `strictBuiltinIteratorReturn`
  (https://www.typescriptlang.org/tsconfig/#strict)
- MUST enable `noUncheckedIndexedAccess` separately - it is NOT part of `strict` and turns every
  indexed/array access into `T | undefined` (https://www.typescriptlang.org/tsconfig/#strict)
- SHOULD enable `exactOptionalPropertyTypes` wherever the codebase must distinguish "property
  omitted" from "property explicitly set to undefined" (settings PATCH bodies, API DTOs) - also
  not part of `strict` (https://www.typescriptlang.org/tsconfig/#strict)
- MUST enforce `import type` for type-only imports (typescript-eslint `consistent-type-imports`,
  or `verbatimModuleSyntax`) so a type import cannot pull runtime code across a bundle boundary
  (https://typescript-eslint.io/users/configs/)
- SHOULD use `satisfies` instead of a type annotation when a literal must be checked against a
  type while keeping its narrowed literal type
- SHOULD brand primitive domain identifiers (a store id, a customer id, a money-as-string) with a
  nominal type so two same-shape strings cannot be swapped by a typo
- MUST run `tsc --noEmit` in CI as the primary safety net, independent of any bundler's own
  type-stripping (native Node TS support does not type-check)
  (https://www.pkgpulse.com/guides/nodejs-native-typescript-support-toolchain-2026)
- SHOULD migrate a legacy codebase to strict flags in order: `strictNullChecks` -> `noImplicitAny`
  -> `strict` -> `noUncheckedIndexedAccess` -> `exactOptionalPropertyTypes`
  (https://dev.to/jtorchia/typescript-strict-mode-the-6-tsconfig-options-that-actually-matter-in-production-and-when-to-446d)
- SHOULD use TypeScript project references in a multi-package monorepo so each package's
  `tsc --noEmit` is incremental and its boundary is checked
  (https://www.typescriptlang.org/docs/handbook/project-references.html)

## 4. ESLint 9 flat config + Prettier

- MUST use flat config (`eslint.config.js`/`.mjs`) - ESLint 9's default and the only format
  ESLint 10 will support (https://typescript-eslint.io/users/configs/)
- MUST extend `tseslint.configs.recommendedTypeChecked` (or `strictTypeChecked` once the team is
  fluent) with `languageOptions.parserOptions.project` pointed at the real tsconfig, not the
  untyped `recommended` alone (https://typescript-eslint.io/getting-started/typed-linting/)
- MUST run at `--max-warnings=0` in CI - a warning left to persist is a rule nobody enforces
  (https://chris.lu/web_development/tutorials/next-js-16-linting-setup-eslint-9-flat-config)
- MUST set `jsx-a11y` rules to `error`, and when linting a component library's markup, map its
  polymorphic components via `settings['jsx-a11y']` AND `polymorphicPropName` - without both,
  `jsx-a11y` reports zero on code that fails
- MUST configure `react-hooks/rules-of-hooks` as `error` and `react-hooks/exhaustive-deps` at
  minimum `warn` (https://github.com/react/react/issues/28313)
- MUST use `no-restricted-imports` to encode architecture bans (a vendor SDK outside its provider
  module, a deep import bypassing a barrel) - a lint rule doing an architectural job
- SHOULD scope JSX-only plugins (`react`, `jsx-a11y`) to `**/*.{jsx,tsx}` file blocks so they do
  not misfire on non-React files (https://chris.lu/web_development/tutorials/next-js-16-linting-setup-eslint-9-flat-config)
- SHOULD add per-directory overrides as additional flat-config array entries rather than a second
  config file - flat config composes as an array (https://typescript-eslint.io/users/configs/)
- MUST remember flat config does not read `.gitignore`; a new top-level directory or extension
  needs its own `ignores`/`files` entry or it silently lints against zero files
- SHOULD run Prettier with `--end-of-line auto` on a mixed-OS team so a Windows CRLF checkout does
  not manufacture a formatting diff
- SHOULD adopt `eslint-plugin-unicorn`'s `recommended` config for consistency rules once the team
  has budget beyond typescript-eslint + a11y + hooks (https://www.npmjs.com/package/eslint-plugin-unicorn)

## 5. JSDoc / TSDoc conventions

- MUST pick one doc-comment dialect per file type: `eslint-plugin-jsdoc`'s
  `flat/recommended-typescript-flavor` for `.ts`/`.tsx` (types come from TypeScript, not `{Type}`
  tags), or `flat/recommended-tsdoc` when docs are published via TypeDoc
  (https://github.com/gajus/eslint-plugin-jsdoc, https://tsdoc.org/)
- MUST turn off `require-param-type`/`require-returns-type`/`require-throws-type` (or use the
  presets that already do) - `@param {string} name` restates a signature TypeScript already
  declares and is the first line to rot (https://github.com/gajus/eslint-plugin-jsdoc)
- MUST scope the "must have a doc comment" rule to exported/public surface only (`publicOnly` on
  `jsdoc/require-jsdoc`) - ESLint core's own `require-jsdoc` was removed in v9 in favour of this
  plugin (https://eslint.org/docs/latest/rules/require-jsdoc)
- SHOULD write TSDoc `@param name - description` as a dash-separated clause, the one syntax every
  TSDoc-consuming tool (TypeDoc, API Extractor) parses the same way (https://tsdoc.org/, https://github.com/microsoft/tsdoc)
- MUST disable the auto-fixer for any require-doc rule - an empty `/** */` satisfies the rule and
  documents nothing
- SHOULD reserve the doc comment for the decision or refusal the code implements (why, not what)
  rather than restating the signature in prose - no linter enforces this mechanically
- SHOULD, for a JS (checkJs) repository using JSDoc as its only type system, use
  `eslint-plugin-jsdoc`'s plain `recommended` (not `-typescript-flavor`) so `{Type}` annotations
  are required, since there is no separate TypeScript signature to draw types from
  (https://github.com/gajus/eslint-plugin-jsdoc)

## Conflicts and gaps versus ENGINEERING_STANDARD.md

### (a) Practices the standard contradicts

- `eslint-plugin-jsdoc`'s plain `recommended` preset requires `@param`/`@returns` tags with
  descriptions on every documented function. CODE.7 explicitly says "`@param`/`@returns` are not
  required" and prefers prose, and bans JSDoc types where TypeScript already declares them.
  Adopting the plugin's default `recommended` config as-is would flag every standard-compliant TS doc
  block as a violation. Not a disagreement about what good documentation is - a warning that the
  wrong preset (`recommended` instead of `-typescript-flavor`) silently re-imposes the rule the
  standard rejects. Any repo wiring this plugin for `.ts`/`.tsx` must use `-typescript-flavor` (or an
  equivalent custom rule set), never the plugin's shipped default.
- No other direct contradiction found in this cluster. The standard's numeric thresholds (complexity
  12 vs ESLint's default 20, function length 60 vs no shipped default) are stricter than any
  tool's out-of-the-box number, which is a documented, deliberate choice (§9), not a conflict with
  a "correct" number - none of the sources surveyed claim one.

### (b) Practices the standard lacks and should add

- A graceful-shutdown rule for any long-running Node process (the jobs worker is the concrete
  case): stop accepting new work and fail health checks on SIGTERM, drain in-flight work, then
  exit; never call `process.exit(0)` immediately or ignore the signal. Nothing in §5 (OBS.1) or
  elsewhere addresses process lifecycle at all.
- Supply-chain hardening beyond "npm audit runs in CI" (SEC.1 as written): verify registry
  signatures and provenance with `npm audit signatures`, pin a release-age cooldown so a
  just-published version is not installed sight-unseen, and disable install-time scripts by
  default. Plain `npm audit` only catches known CVEs, not a malicious-but-not-yet-CVE'd package or
  a compromised maintainer account - the exact gap the 2026 supply-chain sources are about.
- VALID.3 ("the environment is one validated module") should add "loaded with the runtime's own
  mechanism, not a third-party dependency for the same job" - Node's `--env-file` /
  `process.loadEnvFile()` make a `dotenv` dependency unnecessary as of Node 24.
- CODE.3 names `noUncheckedIndexedAccess` but not `exactOptionalPropertyTypes`, which 2026 guidance
  treats as the companion flag for exactly the shape of bug the standard's own settings-PATCH lessons
  describe (omission-clears-a-value vs explicit-undefined is precisely what this flag catches at
  compile time rather than by convention and review).
- CODE.3/CODE.4 say nothing about type-only imports. Enforcing `import type`
  (`consistent-type-imports` or `verbatimModuleSyntax`) stops a type-only import from dragging
  runtime code across a bundle or package boundary - relevant to a monorepo with `@ecomm/types`
  imported from both server and edge-adjacent code.
- OBS.1 says "no PII" but names no mechanism. Add a concrete instrument (redaction by field path
  at the logger configuration, not per call site) the way SEC.1 already gets a concrete
  instrument (`npm audit`) rather than a bare principle.
- No rule addresses branded/nominal types for identifiers that must not be interchanged (a store
  id is not a customer id, both being strings under `any`-ban). CODE.3 bans `any` but is silent on
  this narrower, cheaper protection against a same-shape mixup.

### (c) Practices the standard already covers

CODE.1, CODE.2 (thresholds intentionally stricter than any tool default - consistent, not a gap),
CODE.3 (strict + `noUncheckedIndexedAccess` + any-ban + justified escapes), CODE.4 (flat config,
`--max-warnings=0`, `jsx-a11y` at error, `no-restricted-imports` for architecture, `.gitignore`
blind spot), CODE.7 (JSDoc scoped to exported/public surface, no fixer, no restated TS types),
VALID.1 (schema at every boundary including Server Action arguments), VALID.3 (env in one
validated module), AUTH.1 (deny by default per resource, UI gate never the only gate - matches
Next's own Server Actions security guidance almost verbatim), SEC.1 (lockfile + `npm ci` + audit,
partial - see gap above), OBS.1 (structured logs, no PII, partial - see gap above), CACHE.1 (cache
key must carry every parameter including tenant/user - matches Next 16's `"use cache"` closure-
capture model exactly), A11Y.1 (the `jsx-a11y` `polymorphicPropName` nuance is already named).
