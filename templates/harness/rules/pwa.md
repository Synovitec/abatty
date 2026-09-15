---
paths:
  - "**/sw.{js,ts}"
  - "**/service-worker.{js,ts}"
  - "**/manifest.*"
  - "**/push/**"
  - "public/**"
---

# PWA rules (loaded when the worker, the manifest or push code is open)

Depth and reasons: the standard's `guides/PWA.md` (shipped under `docs/standard/` of the package).

- Installable means HTTPS, a valid manifest and a registered worker; a failure is silent, so
  verify in DevTools > Application, not with a Lighthouse PWA score (it no longer exists).
- Manifest: `id`, `name`, `short_name`, `start_url`, `scope` covering every internal path,
  `display`, `theme_color`, `background_color`, icons 192 and 512 plus a `maskable` one (artwork
  in the central 80 %), `orientation: any` (WCAG 1.3.4), screenshots `wide` and `narrow`.
  Every asset path the manifest, the worker or a push payload names must resolve to a file;
  the gate checks it.
- The worker never serves a stale shell: navigations network-first; only content-hashed assets
  cache-first; caches named by build and old ones deleted on activation; `sw.js` served with
  `Cache-Control: no-cache, no-store, must-revalidate`; disabled in development.
- Network Only for authentication, payment and mutations. Never cache an API response that
  reflects live or personal state; never intercept WebSocket or SSE. A surface that acts on
  money or stock caches nothing at all, and that decision lives in a contract test.
- Purge every cache at logout: a cached page rendered for one user is the next user's leak on
  a shared device.
- Offline: a precached `/offline` page that says what still works; an offline banner in a
  `role="status"` live region; queued writes replayed on `online`, no optimistic writes while
  offline.
- Push: `Notification.permission === "granted"` is consent, `PushManager.subscribe()` is the
  subscription; store subscriptions in the database keyed to user and device; ask for
  permission in context after an explicit action, never on page load; the VAPID pair is
  generated once and never rotated; `410` and `pushsubscriptionchange` mean re-subscribe; an
  endpoint is POSTed to only if its origin is on the allowlist of known push services; every
  notification has an in-app equivalent.
- Standalone mode has no browser chrome: every screen has a visible way back and a way to
  reload; `env(safe-area-inset-*)` with `viewport-fit=cover`; `theme-color` for both colour
  schemes; the install button is a `<button>` and iOS instructions are text.
- iOS: push only when installed (16.4+), no `beforeinstallprompt`, cache evicted after days of
  inactivity, no Background Sync; say so to the client before promising a PWA.
