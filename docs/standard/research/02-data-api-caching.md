---
title: "Research 2026-09-13: PostgreSQL, ORMs, Redis, GraphQL, REST/OpenAPI, jobs and webhooks"
description: "Sourced, rule-shaped practices for the data, API and caching cluster, with the conflicts and gaps found against the standard on the day it was written. A dated record; the standard is what was adopted."
category: reference
status: stable
audience: ["architect", "developer", "agent"]
tags: ["research", "postgresql", "prisma", "drizzle", "sequelize", "redis", "graphql", "openapi"]
related: ["../BEST_PRACTICES.md", "../ENGINEERING_STANDARD.md"]
scope: synovitec
last_verified: "2026-09-13"
---

# Research: data, API and caching (2025-2026 practices)

Compiled against `ops-hub/engineering/ENGINEERING_STANDARD.md` (the standard for paycore_dms/Drizzle, Paycore-Task-Manager/Sequelize+Apollo, ecomm/Prisma). Sources are official docs and recognized authorities, 2025-2026 where dated.

## 1. PostgreSQL schema practices

Constraints

- MUST enforce NOT NULL, FK, UNIQUE, CHECK in the database, never in app code alone (https://rohitsakhare.medium.com/sql-constraints-your-last-line-of-defense-against-bad-data-d0af84af66c0)
- SHOULD use CHECK for declarative invariants (e.g. exactly-one-of-two-columns) so no client can skip it (https://reintech.io/blog/sql-check-constraint-statement-detailed-guide)

Indexes

- MUST index every FK column on the referencing side; Postgres does not do this automatically (https://www.cybertec-postgresql.com/en/index-your-foreign-key/)
- MUST index a multi-column FK with a matching composite index, not just the first column (https://monpg.app/blog/postgresql-foreign-key-indexes)
- SHOULD add partial indexes (`WHERE ...`) for hot predicates touching a row subset (https://www.postgresql.org/docs/current/indexes-partial.html)
- SHOULD use `INCLUDE` for covering indexes so index-only scans avoid a heap fetch (https://www.postgresql.org/docs/current/indexes-index-only-scans.html)

timestamptz and money

- MUST use `timestamptz`, never `timestamp without time zone`, and store/compute in UTC (https://www.crunchydata.com/blog/working-with-time-in-postgres)
- MUST store money as `numeric`/integer minor units, never `float`/`double precision` (https://www.crunchydata.com/blog/working-with-money-in-postgres)
- SHOULD avoid Postgres's built-in `money` type for new schemas; less flexible than `numeric` (https://www.postgresql.org/docs/current/datatype-money.html)

Row Level Security for multi-tenancy

- MUST put `tenant_id` as the leading column of every index serving a tenant-scoped query (https://theroadtoenterprise.com/blog/postgres-rls-multi-tenant-saas)
- MUST enable RLS with `ENABLE ROW LEVEL SECURITY` and per-operation `CREATE POLICY` predicates (https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- MUST also run `FORCE ROW LEVEL SECURITY`; table owners bypass RLS by default otherwise (https://oneuptime.com/blog/post/2026-01-25-row-level-security-postgresql/view)
- MUST connect as a non-superuser role without `BYPASSRLS`, or RLS is bypassed regardless of FORCE (https://queryplane.com/blog/postgres-row-level-security-in-practice/)
- MUST set the tenant GUC with `SET LOCAL` inside a transaction, never plain `SET`, which leaks across a pooled connection (https://dev.to/qays_kadhim_c3fea1c94957f/the-set-local-advice-is-right-and-it-understates-the-problem-1f62)
- SHOULD run a CI negative test per table class proving tenant A cannot read tenant B's rows (https://oneuptime.com/blog/post/2026-01-25-row-level-security-postgresql/view)

Partial unique indexes and migrations

- SHOULD use `CREATE UNIQUE INDEX ... WHERE <predicate>` for "unique among rows where X holds" (https://www.ironin.it/blog/partial-unique-indexes-in-postgresql-and-rails.html)
- MUST split a breaking schema change into expand / migrate / contract deploys, both shapes live in between (https://xata.io/blog/zero-downtime-schema-migrations-postgresql)
- MUST build new indexes with `CREATE INDEX CONCURRENTLY` in production to avoid a write-blocking lock (https://xata.io/blog/zero-downtime-schema-migrations-postgresql)

Backups

- MUST treat an untested backup as not a backup; correctness is proven only by a successful restore (https://dev.to/libme/your-postgres-backups-are-untested-until-you-restore-one-a-drill-for-small-teams-3paj)
- SHOULD run automated restore drills regularly, comparing row counts/checksums against production (https://dev.to/libme/your-postgres-backups-are-untested-until-you-restore-one-a-drill-for-small-teams-3paj)
- MUST verify archived WAL content, not just `archive_command`'s exit code, which can be 0 on an empty/corrupt segment (https://dev.to/libme/your-postgres-backups-are-untested-until-you-restore-one-a-drill-for-small-teams-3paj)

## 2. ORMs: Drizzle, Prisma, Sequelize 6

Drizzle

- MUST generate migrations with `drizzle-kit generate`/`migrate` for team or production work; `push` is local-prototype only (https://orm.drizzle.team/docs/migrations)
- MUST commit generated migration files and never delete or reorder one once applied anywhere (https://orm.drizzle.team/docs/migrations)
- MUST wrap multi-statement writes in `db.transaction(async (tx) => ...)` and query only through `tx` inside it (https://orm.drizzle.team/docs/transactions)
- SHOULD declare RLS with `.enableRLS()`/`pgPolicy()` in the schema DSL - it is schema-as-code now, not only hand-written SQL (https://orm.drizzle.team/docs/rls)
- SHOULD still hand-write the per-request `SET LOCAL` GUC assignment the policy reads; Drizzle declares the policy, not the connection binding (https://neon.com/docs/guides/rls-drizzle)

Prisma

- MUST run `migrate dev` only in development and `migrate deploy` in CI/production, no prompts (https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production)
- SHOULD hand-edit generated migration SQL for RLS `CREATE POLICY`, CHECK and partial/expression unique indexes, then treat that file as authoritative (https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production)
- MUST run every atomic write through one `$transaction`, and inside an interactive callback query only via the handed `tx`, never the outer client (https://www.prisma.io/docs/orm/v6/prisma-client/queries/transactions)
- SHOULD bound long interactive transactions with `timeout`/`maxWait` or a slow step exhausts the pool (https://www.prisma.io/docs/orm/v6/prisma-client/queries/transactions)
- SHOULD implement cross-cutting concerns (audit, RLS binding, timing) as a Client Extension's `query` component, not per-call-site wrapping (https://www.prisma.io/docs/orm/prisma-client/client-extensions)
- MUST exclude sensitive columns via a global `omit` on the `PrismaClient` constructor, not only per query (https://www.prisma.io/docs/orm/prisma-client/queries/excluding-fields)
- MUST treat `Decimal` fields as `Decimal.js` instances and serialize them explicitly before the wire; Prisma does not pad the output scale, so trailing zeros drop silently (https://github.com/prisma/prisma/discussions/20013)
- SHOULD isolate `$queryRaw`/`$executeRaw` error handling: every raw failure surfaces as one generic `P2010`, real code nested in `.meta` (https://github.com/prisma/prisma/issues/2867)

Sequelize 6

- MUST treat migrations as the source of truth; an undeclared model column is silently dropped from every INSERT/UPDATE Sequelize generates (https://sequelize.org/docs/v6/other-topics/migrations/)
- SHOULD use managed transactions (`sequelize.transaction(async (t) => ...)`) over unmanaged ones (https://sequelize.org/docs/v6/other-topics/transactions/)
- SHOULD enable CLS (`Sequelize.useCLS`) to thread the active transaction automatically, noting it is all-or-nothing per process (https://sequelize.org/docs/v6/other-topics/transactions/)
- MUST NOT merge scope/where objects by plain spread when combining tenant scoping with caller `Op.and`/`Op.or`: a duplicate operator key across merged scopes is replaced, not ANDed, silently dropping the first condition (https://github.com/sequelize/sequelize/issues/11588)
- SHOULD use eager loading (`include`) to avoid N+1, and `separate: true` on a `hasMany` include that needs its own order/pagination (https://sequelize.org/docs/v6/advanced-association-concepts/eager-loading/)

Where each falls short

- Drizzle: no extension system; cross-cutting concerns are hand-rolled wrappers; the per-request GUC bind is still raw SQL (https://orm.drizzle.team/docs/rls)
- Prisma: no native RLS in the schema DSL; policy/CHECK/partial-unique live permanently in hand-edited migration SQL (https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production)
- Sequelize: weaker TS inference than Prisma/Drizzle; no built-in RLS session-variable helper, `SET LOCAL` goes in a hand-written hook (https://sequelize.org/docs/v6/other-topics/migrations/)

## 3. Redis caching

Key design and TTL

- MUST include every dimension that changes the response in the key - tenant, user, locale, every filter/page/sort param (https://oneuptime.com/blog/post/2026-03-31-redis-key-namespaces-multi-tenant/view)
- MUST use a hierarchical colon namespace (`{tenant}:{service}:{entity}:{id}`); Redis has no native namespace concept (https://redis.io/blog/5-key-takeaways-for-developing-with-redis/)
- MUST set a TTL atomically with `SET key value EX seconds`, never `SET` then a separate `EXPIRE` (https://www.runxbuild.com/blog/redis-expire/)
- SHOULD jitter TTLs (~10%) on keys sharing an expiry pattern so mass-expiry does not stampede at once (https://redis.io/blog/how-to-tame-the-thundering-herd-problem/)
- MUST NOT leave a key with no expiration at all - unbounded growth with no eviction path (https://oneuptime.com/blog/post/2026-03-31-redis-data-expiration-strategy-best-practices/view)

Invalidation and tag pitfalls

- MUST invalidate the affected key explicitly on the mutation that changes its source, not rely on TTL alone, whenever the event is known (https://dev.to/moose978/cache-invalidation-strategies-with-redis-59ap)
- MUST NOT run `KEYS` in production; it blocks the single-threaded event loop for the whole scan (https://last9.io/blog/retrieving-all-keys-in-redis/)
- MUST use `SCAN` with a cursor instead, returning a small batch per call (https://redis.io/docs/latest/commands/scan)
- MUST treat `MATCH` patterns as literal glob syntax, never a semantic hierarchy: `x:*` and a key shaped `x:{id}` are unrelated strings to the matcher (https://dev.to/rijultp/redis-pattern-matching-how-to-use-keys-and-scan-effectively-5dkp)
- SHOULD maintain a Redis Set per tag listing member keys, so bulk invalidation is SMEMBERS+DEL, not a keyspace scan (https://oneuptime.com/blog/post/2026-03-31-redis-how-to-implement-cache-invalidation-with-tags-in-redis/view)

Stampede and what not to cache

- SHOULD use request coalescing/single-flight so one caller recomputes a missed key while others wait or get stale-while-revalidate (https://medium.com/@DevTarangini/redis-coordination-patterns-eace4b5468e6)
- SHOULD implement the recompute lock as atomic `SET key value NX EX ttl` with a unique token and an atomic compare-and-delete release (https://redis.io/glossary/redis-lock/)
- SHOULD apply probabilistic early expiration (XFetch-style) so regeneration spreads over time (https://redis.antirez.com/fundamental/cache-stampede-prevention.html)
- MUST NOT cache an authorization decision without a bounded TTL and an invalidation hook on every role-mutating event (https://www.ory.com/blog/perils-of-caching-in-iam)
- MUST NOT cache data that must reflect the absolute latest write (balances, stock reservations); read live or invalidate inside the writing transaction (https://dev.to/alaikrm/caching-strategies-when-they-solve-a-problem-and-when-they-create-three-new-ones-37pg)

Rate limiting

- MUST centralize rate-limit state in Redis, not per-process memory, once there is more than one app instance (https://redis.io/docs/latest/develop/use-cases/rate-limiter/)
- SHOULD run the read-decide-update cycle as one Lua script via EVAL so concurrent instances cannot double-spend (https://redis.io/docs/latest/develop/use-cases/rate-limiter/)
- MUST document in-memory rate limiting as correct only for a single instance, an explicit tradeoff, not an oversight (https://redis.io/docs/latest/develop/use-cases/rate-limiter/)

## 4. GraphQL (Apollo Server 5, graphql-ws)

Schema and pagination

- SHOULD design a public/stable schema SDL-first, reviewed as its own product artifact (https://graphql.org/learn/schema-review/)
- MUST use Relay-style cursor connections (`edges { cursor node }`, `pageInfo`) for lists that can grow or mutate concurrently (https://relay.dev/graphql/connections.htm)
- MUST make `hasNextPage`/`hasPreviousPage` non-null and treat cursors as opaque strings (https://relay.dev/graphql/connections.htm)

Mutations and nullability

- MUST accept one `input` object per mutation, not scalar arguments, so fields can be added without a breaking signature (https://github.com/Shopify/graphql-design-tutorial/blob/master/TUTORIAL.md)
- MUST return a dedicated payload type per mutation rather than the bare entity (https://github.com/Shopify/graphql-design-tutorial/blob/master/TUTORIAL.md)
- MUST expose business/validation failures via a `userErrors` payload field; reserve top-level `errors` for transport/execution failures (https://shopify.dev/docs/api/admin-graphql/latest/objects/UserError)
- SHOULD make fields nullable by default, tightening only where correctness is guaranteed including in error paths (https://graphql.org/learn/best-practices/)
- MUST mark a retiring field `@deprecated(reason: "...")` and never delete one without a deprecation period (https://graphql.org/learn/best-practices/)

DataLoader and limits

- MUST instantiate a new DataLoader per request in the context factory, never at module scope, or one user's cached rows leak to another (https://www.graphql-js.org/docs/n1-dataloader/)
- MUST enforce a maximum query depth (e.g. `graphql-depth-limit`) to block deeply nested queries (https://oneuptime.com/blog/post/2026-01-24-graphql-maximum-query-depth/view)
- MUST also enforce query complexity/cost limits; depth alone does not stop a wide, shallow query (https://github.com/nvdaz/apollo-server-plugin-query-complexity)
- SHOULD adopt Automatic Persisted Queries for bandwidth, but MUST use a registered Persisted Query List, not APQ, when the goal is operation allowlisting - APQ's cache self-updates with anything it sees (https://www.apollographql.com/docs/graphos/routing/operations/apq)

Errors, linting, subscriptions

- MUST attach a machine-readable `extensions.code` to every thrown error (https://www.apollographql.com/docs/deploy-preview/5c3da3032590c7170218/apollo-server/data/errors)
- MUST NOT leak stack traces in production; Apollo Server 5 already omits them when NODE_ENV is production/test - do not override that (https://github.com/apollographql/apollo-server/issues/7608)
- SHOULD lint schema SDL in CI (`graphql-schema-linter`, `graphql-eslint`) and fail CI on an unmarked breaking change (https://www.npmjs.com/package/graphql-schema-linter)
- MUST use `graphql-ws`, not the unmaintained `subscriptions-transport-ws`, for new subscription work (https://www.npmjs.com/package/subscriptions-transport-ws)
- MUST authenticate on `connection_init` via `connectionParams` validated in `onConnect`, before the socket is accepted (https://github.com/apollographql/graphql-subscriptions/blob/master/.designs/authorization.md)
- NOTE Apollo Server 3 is EOL (2024-10-22); current stable is the consolidated `@apollo/server` 5.x line (https://knowledge.apollo.io/hc/en-us/articles/34072157047309-Release-Notes-2025)

## 5. REST + OpenAPI 3.1

Design workflow and envelopes

- MUST treat a code-first generated spec as suspect unless generation is enforced in CI (https://bump.sh/blog/code-first-openapi/)
- SHOULD wrap single resources as `{ data }` and lists as `{ data, meta }`, consistently across endpoints (https://opensource.zalando.com/restful-api-guidelines/)
- MUST specify both success and error responses for every operation, never leaving an error shape implicit (https://opensource.zalando.com/restful-api-guidelines/)

RFC 9457 and money

- SHOULD serve errors as `application/problem+json` with the RFC 9457 members (`type`, `title`, `status`, `detail`, `instance`) instead of a bespoke shape (https://www.rfc-editor.org/rfc/rfc9457.html)
- MUST make the `status` member match the actual HTTP status code, and MAY add documented extension members (https://www.rfc-editor.org/rfc/rfc9457.html)
- NOTE RFC 9457 (2023) obsoletes RFC 7807 - cite 9457 going forward (https://www.rfc-editor.org/info/rfc9457/)
- MUST represent money as a decimal-formatted string, never a bare float, and pair every amount with an ISO 4217 currency code (https://opensource.zalando.com/restful-api-guidelines/)

Pagination and idempotency

- SHOULD prefer cursor/keyset pagination over offset for a growing or mutating collection (https://opensource.zalando.com/restful-api-guidelines/)
- MUST give the keyset a total order by appending a unique tiebreaker (typically `id`) after the sort key (https://github.com/zalando/restful-api-guidelines/blob/main/chapters/pagination.adoc)
- SHOULD support an `Idempotency-Key` header on POST/PATCH per the IETF httpapi draft (https://www.ietf.org/archive/id/draft-ietf-httpapi-idempotency-key-header-07.html)
- MUST return the stored result when a completed key is replayed, 409 if still processing, 422 if the same key carries a different payload (https://www.ietf.org/archive/id/draft-ietf-httpapi-idempotency-key-header-07.html)
- SHOULD publish an explicit expiration policy for stored idempotency keys (https://www.ietf.org/archive/id/draft-ietf-httpapi-idempotency-key-header-07.html)
- MAY support ETag with If-Match/If-None-Match for optimistic locking on PUT/PATCH and GET cache validation (https://opensource.zalando.com/restful-api-guidelines/)

Versioning, spec format, governance

- SHOULD default public APIs to URL path versioning (`/v1/...`) as the most widely adopted, cache-friendly choice (https://www.digitalapplied.com/blog/api-versioning-strategies-2026-engineering-decision-matrix) - NOTE Zalando's own guidelines mandate media-type versioning instead; the two authoritative sources disagree, pick one deliberately.
- MUST NOT delete or repurpose a field in the same change that deprecates it (https://opensource.zalando.com/restful-api-guidelines/)
- MUST express nullability with a `type` array (`["string","null"]`) in OpenAPI 3.1, not the removed `nullable: true` (https://beeceptor.com/docs/concepts/openapi-what-is-new-3.1.0/)
- MUST lint every spec change in CI against a shared ruleset (Spectral `oas` or Redocly `recommended-strict`) (https://docs.stoplight.io/docs/spectral/4dec24461f3af-open-api-rules)
- SHOULD run a spec-conformance suite driving the live server from the document (Dredd baseline, Schemathesis fuzzing) so contract and behavior cannot silently diverge (https://dev.to/rishi_gaurav/we-ran-schemathesis-dredd-and-our-own-contract-test-runner-against-30-real-world-openapi-specs-2dm2)
- SHOULD give every operation a stable, unique `operationId` and consistent `tags`, since SDK generators turn both directly into client method names/namespaces (https://www.speakeasy.com/openapi/operations)
- MUST prefix any non-standard field with `x-`, and document its meaning and valid values in the spec's own governance docs (https://swagger.io/docs/specification/v3_0/openapi-extensions/)

## 6. Background jobs and outbound webhooks

Postgres-backed queue claim

- MUST claim jobs with one atomic `UPDATE ... WHERE id IN (SELECT ... FOR UPDATE SKIP LOCKED)`, never a plain SELECT followed by a separate UPDATE (https://www.netdata.cloud/academy/update-skip-locked/)
- MUST use `SKIP LOCKED` (Postgres 9.5+) so concurrent workers skip rows already locked instead of blocking on them (https://www.postgresql.org/docs/17/sql-select.html)
- SHOULD add a separate primitive (e.g. `pg_advisory_xact_lock`) when the queue must also enforce a cross-row invariant like "at most N concurrent jobs" - SKIP LOCKED only stops two workers claiming the same row (https://terrislinenbach.medium.com/why-for-update-skip-locked-isnt-enough-using-pg-advisory-xact-lock-to-build-a-correct-postgresql-d3eb9db46473)

Transactional outbox and idempotent handlers

- MUST write the job/event row inside the SAME transaction as the business change it describes, so it can never exist for a rollback or be missing after a commit (https://microservices.io/patterns/data/transactional-outbox.html)
- MUST design every handler assuming at-least-once execution, since a worker can die after doing the work but before recording it (https://riverqueue.com/docs/reliable-workers)
- SHOULD wrap a handler's writes in one transaction, completed in the same transaction as the job's own completion where the queue supports it (https://riverqueue.com/docs/reliable-workers)
- MUST guard a call to an external system (API, PSP, search index) with its own idempotency key or unique constraint - a DB transaction cannot protect that half (https://riverqueue.com/docs/reliable-workers)

Dead workers and attempts

- SHOULD detect a stuck job via an execution timeout plus a shorter grace period, since one timeout cannot distinguish "still working" from "ignored cancellation" (https://riverqueue.com/docs/stuck-jobs)
- MUST count an attempt at claim/execution time, not only on terminal failure, so a job that keeps crashing mid-run still exhausts its retry budget (https://riverqueue.com/docs/job-retries)
- SHOULD cap retries with a documented maximum-attempts ceiling so a permanently failing job stops retrying instead of looping forever (https://riverqueue.com/docs/job-retries)

Outbound webhook signing and retries

- MUST sign every webhook payload via HMAC-SHA256 over `{id}.{timestamp}.{payload}` in a dedicated header (Standard Webhooks `v1` scheme) (https://github.com/standard-webhooks/standard-webhooks/blob/main/spec/standard-webhooks.md)
- MUST have the receiver reject a webhook whose timestamp falls outside a tolerance window, to stop replay of a captured but validly-signed request (https://github.com/standard-webhooks/standard-webhooks/blob/main/spec/standard-webhooks.md)
- SHOULD support multiple space-delimited signatures in one header for zero-downtime signing-key rotation (https://github.com/standard-webhooks/standard-webhooks/blob/main/spec/standard-webhooks.md)
- MUST treat only a 2xx response as success and retry on anything else, including timeouts (https://www.svix.com/resources/webhook-best-practices/retries/)
- SHOULD retry on exponential backoff with jitter across roughly a day and ~8 attempts, moving to a dead-letter state for manual replay after exhaustion (https://www.svix.com/resources/webhook-best-practices/retries/)

SSRF defense for tenant-supplied URLs

- MUST resolve a tenant-supplied hostname and validate the RESOLVED IP, never the hostname string alone (https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- MUST reject resolved IPs in private/loopback/link-local/CGNAT/cloud-metadata ranges, preferring an allowlist where feasible (https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- MUST disable automatic redirect-following or re-validate the target on every redirect hop (https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- MUST pin the outbound connection to the IP that was validated, not re-resolve at connect time, to defeat DNS-rebinding/TOCTOU (https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)

## Conflicts and gaps versus ENGINEERING_STANDARD.md

(a) Practices the standard contradicts or states more weakly than current practice

- Tenant isolation: DATA.3 treats RLS as conditional ("where RLS is the guarantee") and relies on proven service-layer scoping as the default; current multi-tenant-Postgres practice treats RLS + FORCE + a non-owner role as a MUST for defense-in-depth beneath the service layer, not an alternative to it.
- API.1's bespoke `{ error, code, details }` envelope is not RFC 9457 `application/problem+json` (no `type`/`title`/`instance`, different media type) - a considered deviation from the current IETF shape that the standard does not name as one.
- DATA.1's claim that RLS "cannot be expressed by the tool" has gone stale for Drizzle specifically, which now supports policies as schema-as-code (`pgPolicy()`/`.enableRLS()`); still true for Prisma and Sequelize.
- No REST versioning rule exists, and the two most-cited authoritative sources (Zalando vs. mainstream URL-path practice) directly disagree - the standard should pick one rather than leave it to default silently per repo.

(b) Practices the standard lacks and should add

- Atomic job claim as a single `UPDATE ... WHERE id IN (SELECT ... FOR UPDATE SKIP LOCKED)` statement, promoted from ecomm's project doc to a DATA rule of the standard (paycore_dms and Task-Manager may grow the same need).
- Transactional outbox: job/event row written in the same transaction as the business change - DATA.6 covers idempotency, not this half.
- Dead-worker reclaim: stale-lock timeout plus attempt-counting at claim time, not only heartbeat/fallback (OBS.1 covers only the latter).
- Outbound webhook signing scheme (HMAC + timestamp + replay-tolerance window, multi-signature rotation) - entirely absent; SEC.3/SEC.4 cover the SSRF and fire-and-forget half only.
- Outbound webhook retry schedule (exponential backoff, jitter, dead-letter after exhaustion) - absent.
- Prisma's Decimal.js wire-serialization pitfall (trailing zeros drop silently) is a real, costly, already-paid-for lesson in ecomm not yet promoted to the lessons catalogue (§8), unlike its sibling PSP-token-cache and DataLoader lessons.
- Sequelize's `Op.and`/`Op.or` scope-merge pitfall (a duplicate operator key across merged scopes is replaced, not ANDed) is distinct from the standard's existing JSON.stringify-symbol lesson and directly threatens DATA.3/AUTH.1's tenant-scoping guarantee on that stack.
- Redis cache-stampede mitigation (single-flight lock, jittered/probabilistic TTLs) and an explicit "when NOT to cache" rule (never an authorization decision without a bound TTL and invalidation hook; never absolute-latest-write financial/stock data) - CACHE.1 covers key shape and invalidation-on-write, not whether a read belongs in cache at all.
- Redis-backed vs in-memory rate limiting is documented only in ecomm's env-var table (REDIS_URL), not promoted to a CONFIG.1-style rule in the standard, despite being exactly the cross-repo config-precedence hazard that rule family exists for.
- GraphQL-specific rules are entirely absent despite Task-Manager running Apollo/GraphQL in production: SDL-first schema review, single `input` object plus dedicated payload type per mutation (the GraphQL mirror of API.1's REST rule), `@deprecated` before removal, query depth/complexity limits, and no-stack-traces-in-error-extensions.
- Client-facing `Idempotency-Key` request header for admin-API mutations - DATA.6 covers server-side event dedup only, not a request-scoped contract exposed to API callers retrying their own network failures.
- Conditional requests (ETag/If-Match) for optimistic concurrency on PATCH/PUT - absent from API.1.
- Backup verification should name the specific failure mode of a silently-empty/corrupted WAL segment passing its own `archive_command` exit code - sharpens DATA.5 rather than replacing it.

(c) Practices the standard already covers
DATA.1, DATA.2, DATA.3, DATA.4, DATA.5, DATA.6, API.1, API.2, CACHE.1, SEC.3, SEC.4, OBS.1, CONFIG.1
