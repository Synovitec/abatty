---
paths:
  - "**/model.ts"
  - "**/models/**"
  - "**/migrations/**"
  - "**/associations.ts"
---

# Sequelize rules (loaded when a model, an association or a migration is open)

- Migrations are the source of truth; a model is second. An undeclared column is silently
  dropped from every INSERT and UPDATE Sequelize generates and reads back `undefined`.
- Models typed with `InferAttributes` / `InferCreationAttributes`; no untyped `Model`.
- Tables snake_case plural, columns snake_case, camelCase in TypeScript via `underscored: true`.
- Associations declared in one file (`associations.ts`), not scattered across models.
- Schema changes go through a migration file, hand-written and cumulative, never edited once
  applied anywhere. Never `sync({ alter: true })` outside tests. `.cjs` stays `.cjs`.
- Multi-write operations run in a transaction taken from the request context; managed
  transactions over unmanaged ones.
- Scope every read by tenant or owner in the service. Apply the mandatory condition with
  `Op.and` AFTER the caller's filter is built: spreading two `where` objects REPLACES a duplicate
  operator key instead of ANDing it, and the tenant scope is the key that disappears.
- No raw SQL string interpolation. Finders, or `replacements`.
- Eager-load with `include` to avoid N+1; `separate: true` on a `hasMany` that needs its own
  order or pagination.
