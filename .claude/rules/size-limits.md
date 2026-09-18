# Size and shape limits (no `paths`, so always loaded)

Budgets are code lines (blank and comment lines excluded); about 300 is where an agent stops
reading a file whole, and 500 means two responsibilities.

| Kind | Target | Hard max |
|---|---|---|
| Utility | 20-60 | 100 |
| Page / layout (composition root) | 30-60 | 100 |
| Hook | 40-80 | 150 |
| Route handler, resolvers file, model, SDL file | 50-120 | 200 |
| Component, entity form | 80-150 | 250 |
| Zod schema module | 50-150 | 250 |
| Module, service, queries, server actions | 100-200 | 300 |
| ORM schema declarations | - | 500, split per domain |
| Test | - | 400 |
| `CLAUDE.md` | 60-100 | 200 |

- Functions: 60 lines (150 in a component file), 4 parameters, cyclomatic complexity 12.
- More than 5 exported functions in one file means it should be split.
- JSX over 100 lines or nested deeper than 3 levels means a component is missing.
- Exempt: `generated/`, `migrations/`, `seeders/`, config files, constant tables, `scripts/`,
  hooks and tests. The 800-line cap still applies to everything.
- Enforced by `max-lines`, `max-lines-per-function`, `max-params`, `complexity` under
  `--max-warnings=0`, and by the standards ratchet with a per-file floor. Never disable one
  inline to make code fit; never move a file into a laxer category instead of splitting it;
  never relocate a long function into a hook or helper and call it shorter.
