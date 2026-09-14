---
paths:
  - "**/*.tsx"
  - "**/*.jsx"
  - "**/theme/**"
---

# Material UI rules (loaded when a component or the theme is open)

- Never hardcode a colour, radius, spacing or font size: `theme.palette.*`, `theme.spacing()`,
  `theme.shape.borderRadius`. A value needed twice that is not in the theme goes into
  `theme/tokens.ts` first.
- A recurring visual decision goes into `theme/components.ts` as `styleOverrides` or
  `defaultProps`, never repeated as `sx` across files.
- `sx` is for a one-off; more than about 8 keys means `styled()` or a theme override. A
  theme-driven `styled()` is the framework's own pattern, not a per-component stylesheet.
- No inline `style={{}}`, no CSS file per component, no `!important`.
- Layout with `Stack`, `Grid`, `Box`; `useFlexGap` on `Stack`; no bare system props (`m`, `p`
  as props are deprecated), use `sx`. Breakpoints only through `theme.breakpoints`.
- Icons from `@mui/icons-material`. No emoji anywhere in the UI, no icon fonts, no inline SVG
  for a standard icon. Barrel imports of the icons package are mocked in component tests
  (EMFILE on Windows otherwise).
- Lists use `@mui/x-data-grid` with `paginationMode="server"`, `rowCount`, `paginationModel`
  and `onPaginationModelChange`, and server-side filtering and sorting too. Never load all rows
  and paginate in the browser. Column definitions outside the component body or in `useMemo`.
- Dialogs, menus and drawers are MUI components; no custom modal. Keep the focus rings and the
  focus traps.
- Feedback: `Snackbar` or the toast helper for transient messages, `Alert` inline, `Skeleton`
  for loading, never a bare spinner on a full page.
- Light mode only unless the product says otherwise; do not add a dark palette speculatively.
- `100svh` for a first-paint full-height surface, `100dvh` only where resizing with the browser
  chrome is wanted, never `100vh`.
