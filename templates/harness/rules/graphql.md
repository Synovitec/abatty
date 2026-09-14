---
paths:
  - "**/*.graphql"
  - "apps/api/**/*.ts"
  - "server/**/*.{js,ts}"
---

# GraphQL rules (loaded when a schema or an API file is open)

- Every list field is paginated and returns a payload (`items`, `totalCount`, `hasNextPage`, or a
  Relay connection where the list can grow or move). No unbounded lists; the limit is clamped
  server-side and the clamped value is what goes into any cache key.
- A mutation takes one `input` argument and returns a payload type, never a bare scalar.
  Business failures go in a `userErrors` field of the payload; top-level `errors` is for
  transport and execution failures only.
- Nullability is deliberate: nullable by default, non-null only where correctness is guaranteed
  on the error path too.
- Every association resolver goes through a DataLoader created per request in the context
  factory. A loader at module scope serves one user's rows to another; a direct query in an
  association resolver is an N+1.
- A resolver reads args and context and calls a service. Logic lives in the service, persistence
  in the model. A resolver never queries the database directly.
- Every mutation input is validated with a Zod schema in the service before any write. One
  schema serves both sides and carries message keys, not sentences.
- Errors thrown by a service are typed with a machine-readable `code`; one formatter maps them
  to GraphQL errors and never leaks a stack trace in production.
- Deprecate with `@deprecated(reason: "...")`; never delete a field in the same change. A
  deprecated field still executes: it still needs its bound.
- Depth AND complexity limits are configured; depth alone does not stop a wide shallow query.
- Subscriptions use `graphql-ws`, authenticated on `connection_init`.
- After editing any `.graphql` file, run the codegen before the typecheck. A `.graphql` file is
  a public entry point: moving one breaks importers the unit suite cannot see.
