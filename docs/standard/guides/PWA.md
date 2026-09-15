---
title: "PWA - best practices (manifest, service worker, offline, push, a11y)"
description: "Operational reference guide, independent of any project: the three non-negotiables of installability, the manifest and the fields that matter, the service-worker tool in 2026 (Serwist), one cache strategy per resource type and the purge at logout, offline and deferred writes, worker updates, installation (Android, desktop, iOS), the iOS constraints to tell a client, push and VAPID, security, the accessibility specific to installed mode, a checklist. Rule PWA.1 of the standard points here."
category: guide
status: living
audience: ["developer", "architect", "agent", "reviewer"]
tags: ["pwa", "service-worker", "manifest", "offline", "web-push", "vapid", "serwist"]
related:
  ["../ENGINEERING_STANDARD.md", "./A11Y.md", "./I18N.md", "../research/03-ui-a11y-i18n-pwa.md"]
scope: synovitec
last_verified: "2026-09-13"
---

# PWA: best practices

Operational reference guide. Companion to the a11y guide, with a section on the accessibility problems specific to PWAs. The examples use Next.js App Router / Serwist; the rules hold for any front end. Sources at the end.

---

## 1. The three non-negotiables

1. **HTTPS** (localhost is treated as secure)
2. A valid **Web App Manifest**
3. A registered **service worker**

Without all three, the install prompt does not fire, silently. No error message, nothing.

Important note: **Lighthouse removed the PWA category in v12** (Chrome 126), following Chrome's updated installability criteria. Stop looking for a "PWA score". Verification happens in DevTools, Application tab, Manifest and Service Workers sections.

---

## 2. Manifest

Next.js App Router handles the manifest natively through `app/manifest.ts`, typed. (An application that must emit a localised manifest with `crossorigin="use-credentials"` goes through an explicit route instead, otherwise two `<link rel="manifest">` coexist without an error.)

```ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Full application name",
    short_name: "ShortName",
    description: "Description shown in the install UI",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#000000",
    orientation: "any",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
```

### Fields required for installability

`name` or `short_name`, an `icons` array containing a 192x192 and a 512x512, `start_url`, `display` set to `fullscreen`, `standalone` or `minimal-ui`, and `prefer_related_applications` absent or not `true`.

Any red validation error in DevTools > Application > Manifest prevents installation.

### Fields that make a difference

- **`purpose: 'maskable'`**: without a maskable icon, Android shows the icon in an ugly white frame. A maskable icon needs a safe zone, the useful content in the central 80 %.
- **`id`**: the application's stable identifier. Without it, changing `start_url` creates a different application in the browser's eyes; the installed one becomes an orphan.
- **`screenshots`**: with `form_factor: 'wide'` and `'narrow'`, Chrome shows a richer install UI instead of a mini-bar. A real impact on the install rate.
- **`shortcuts`**: shortcuts on long-press of the icon.
- **`scope`**: URLs outside the scope open in the browser, not in the installed app. A classic trap with payments and external authentication.

### i18n

One manifest per locale is not natively supported. Generate the manifest dynamically from the locale, or accept a single manifest in the main language. Remember that `start_url` must point at the right locale.

---

## 3. Service worker

### Which tool in 2026

**Serwist** (`@serwist/next`), the maintained fork of Workbox. The maintainer of `@ducanh2912/next-pwa` explicitly recommends migrating to Serwist. The official Next.js docs cite Serwist as the option for full offline caching, with integration examples for **Turbopack** and for webpack.

```bash
npm i @serwist/next serwist
```

```ts
// next.config.ts
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

export default withSerwist({});
```

```ts
// app/sw.ts
import { defaultCache } from "@serwist/next/worker";
import { Serwist } from "serwist";

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();
```

Disabling the service worker in development is essential, otherwise changes are masked by the cache.

### Writing your own service worker

Viable when the only need is push, with no offline cache. That is what the Next.js docs show: a `lib/service-worker.js` that only listens to `push` and `notificationclick`. A surface that acts on money or stock (a counter app, an operations console) caches nothing at all, and that decision is written in a contract test.

As soon as there is a cache, go through Serwist. Writing correct cache logic by hand is a source of hard-to-reproduce bugs.

---

## 4. Cache strategies

One strategy per resource type. Getting it wrong produces either a stale UI or pointless network requests.

| Resource                           | Strategy                          | Reason                                |
| ---------------------------------- | --------------------------------- | ------------------------------------- |
| App shell, JS, CSS, fonts          | Cache First                       | Immutable (hashed), serve instantly   |
| API, dynamic data                  | Network First with cache fallback | Freshness first, graceful degradation |
| Images, avatars                    | Stale While Revalidate            | Immediate display, background refresh |
| Authentication, payment, mutations | Network Only                      | Never a cache on these routes         |
| Offline fallback page              | Cache Only                        | Precached at install                  |

HTML navigations are always Network First: an HTML page rendered with one user's data, served from the cache after their logout, shows their documents to the next person.

### Golden rule

Never cache a response containing personal data on a shared device without expiry, and purge the cache at logout.

```ts
// at logout
if ("caches" in window) {
  const keys = await caches.keys();
  await Promise.all(keys.map((k) => caches.delete(k)));
}
```

### Quotas

Storage is not unlimited and the browser can evict caches under pressure. Plan for the cache to disappear: the application must work without it, in degraded mode.

---

## 5. Offline

### App shell

Precache the shell (layout, styles, scripts, navigation) so the interface shows instantly offline. Dynamic content comes from the cache or shows a fallback.

### Offline page

A precached `/offline` route, served as the navigation fallback when the network fails. It must be useful: remind what stays available offline, not just a dinosaur.

### Data

`IndexedDB` through the `idb` library for structured data readable offline. `localStorage` is synchronous and limited; reserve it for preferences.

### Offline writes

**Background Sync** to replay an action when the connection returns (a submitted form, a basket). Not supported on iOS; plan a fallback: an IndexedDB queue replayed on the `online` event. No optimistic write while offline on a surface that touches money or stock: show the state, do not simulate it.

### New in Next.js: `useOffline`

Next.js recently exposes built-in connectivity detection, marked experimental and not recommended for production for now.

```ts
// next.config.ts
export default {
  experimental: {
    useOffline: true,
  },
};
```

Once enabled, Next.js listens to the `offline` and `online` events, detects network failures on navigations, prefetches and Server Actions, probes connectivity with `HEAD` requests and backoff, and automatically replays the blocked requests when the network returns. A failed navigation stays pending instead of throwing, the UI staying in its loading state.

```tsx
"use client";

import { useOffline } from "next/offline";

export function OfflineBanner() {
  const isOffline = useOffline();
  if (!isOffline) return null;

  return (
    <div role="status" aria-live="polite">
      You are offline. Changes will be sent when the connection returns.
    </div>
  );
}
```

Without the flag, the hook always returns `false`. `fetch()` calls made directly in a Client Component or through React Query / SWR remain governed by those libraries' retry policy.

This mechanism complements a service worker; it does not replace one: it handles network resilience, not the offline cache.

---

## 6. Updating the service worker

The most frequent PWA trap: the user stays stuck on an old version for days.

- `skipWaiting: true` + `clientsClaim: true` activates the new version immediately. Careful: it can load new code over a page rendered by the old version, with inconsistencies if the assets changed.
- The clean alternative is to detect the waiting service worker and show a user-controlled "New version available, reload" prompt.
- The `sw.js` file itself must never be cached. Serve it with `Cache-Control: no-cache, no-store, must-revalidate`.
- Caches are named per build and the old ones deleted on activation: a cached `index.html` pointing at chunks a deployment deleted is the classic blank page.

---

## 7. Installation

### Android and desktop

Chrome fires `beforeinstallprompt` when every criterion is met. The pattern is to capture the event, defer it, and offer an install button at the right moment.

**Limited support**: Chrome and Edge only. Firefox and Safari, iOS included, do not implement it. The Next.js docs explicitly advise against building a custom install button on that basis, because it is neither cross-browser nor cross-platform.

Pragmatic position: keep the browser's default prompt, and add a custom prompt only if the install rate is a measured business objective.

### iOS

No automatic prompt, no `beforeinstallprompt`. Installation is manual through the Share button then "Add to Home Screen". So the steps have to be explained.

```tsx
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
```

Show nothing if `isStandalone` is true; the application is already installed.

---

## 8. iOS constraints to know

To tell the client before selling a PWA rather than a native app:

- No install prompt, no `beforeinstallprompt`.
- **Push notifications since iOS 16.4 only, and only if the application is installed on the home screen.** A PWA opened in Safari cannot receive push.
- Cache eviction after several days of inactivity. Plan to re-precache the critical assets at each launch and keep the cache small.
- No Background Sync, no background processing, no Bluetooth or NFC.
- In the European Union, the DMA-related changes since iOS 17.4 degraded the PWA experience to a browser-tab rendering. A critical point for a Belgian market.

Go native when: hardware access is essential, background processing is required, heavy 3D or video performance, deep iOS integration (widgets, Siri).

---

## 9. Push notifications

Current support: iOS 16.4+ for applications installed on the home screen, Safari 16 on macOS 13+, Chromium browsers, Firefox.

### VAPID keys

```bash
npm i -g web-push
web-push generate-vapid-keys
```

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
```

The pair is generated once and never rotated: every subscription is bound to the public key it was created with, a rotation invalidates every existing subscription and no error surfaces anywhere; notifications simply stop arriving.

### Server side

```ts
"use server";

import webpush from "web-push";

webpush.setVapidDetails(
  "mailto:contact@example.be",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

export async function sendNotification(subscription: PushSubscription, message: string) {
  await webpush.sendNotification(
    subscription,
    JSON.stringify({ title: "Title", body: message, icon: "/icon.png" }),
  );
}
```

Subscriptions must be stored in the database, not in memory, to survive restarts and handle several users. `Notification.permission === 'granted'` is consent, not a subscription: only `PushManager.subscribe()` produces the endpoint the server can target, and a flow that stops at the permission never sends anything. A `410 Gone` from the push service, or the `pushsubscriptionchange` event, means "re-subscribe", not "retry". The endpoint received from the browser is a URL supplied by a third party: the server only POSTs to it if its origin is on the allowlist of known push services.

### Service worker side

```js
self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || "/icon.png",
      badge: "/badge.png",
      data: { url: data.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
```

### Permission UX

Never ask for permission on page load. The refusal rate is massive and a refusal is nearly permanent. Ask in a context where the value is obvious, after an explicit action, with a prior explanation in the interface.

### Local testing

`next dev --experimental-https` is required; notifications need HTTPS.

---

## 10. Security

```js
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};
```

A compromised service worker persists and intercepts every request of the origin. It is the most sensitive attack surface of a PWA. Validate the source of push messages, and never serve the service worker from a third-party CDN.

---

## 11. Accessibility specific to PWAs

Points the general a11y guide does not cover, because they only exist in installed mode.

### No more browser chrome

In `display: standalone` there is **no address bar, no back button, no reload button**. Direct consequences:

- Complete internal navigation is mandatory. Every screen must have a visible way back in the interface.
- A dead end (an error page with no link, a flow with no exit) becomes a trap the user can only leave by killing the application.
- Provide a way to reload from the interface in case of an inconsistent state.

`display: minimal-ui` keeps minimal navigation controls. It is a reasonable compromise while the internal navigation is not mature yet.

### Announcing network state changes

Going offline is critical information that must be perceived other than by a visual change.

```tsx
<div role="status" aria-live="polite" aria-atomic="true">
  {isOffline ? "Offline. The displayed data may be stale." : ""}
</div>
```

`polite` and not `assertive`: the information matters but must not interrupt the current reading. The container must exist in the DOM before the message is injected.

Same principle for the update prompt and for the confirmation of an action queued offline.

### The install button

It is a `<button>` with an explicit label, not a clickable `<div>`. The iOS instructions are screen-reader-readable text, not only icons.

```tsx
<button type="button" onClick={promptInstall}>
  Install the application
</button>
```

Symbolic icons in the instructions (share, plus) must have an `aria-label` or be doubled by text.

### Orientation

**WCAG 1.3.4 Orientation (AA)**: do not lock the display to portrait or landscape unless the orientation is essential to the function. The manifest's `orientation` field must therefore not be forced to `portrait` for development convenience.

```ts
orientation: "any";
```

### Safe area and notch

In standalone mode, content runs under the notch and under the gesture bar.

```css
body {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
}
```

With `viewport-fit=cover` in the viewport meta. Without it, interactive elements can become unreachable, which is a conformance failure, not only an aesthetic flaw.

### Touch target

**WCAG 2.2, 2.5.8 Target Size (Minimum, AA)**: 24 x 24 CSS pixels minimum. In installed mobile use, aim for 44 px. A PWA is used with a thumb, often in motion.

### Theme

`theme_color` in the manifest colours the system bar. It must be consistent with the active theme.

```html
<meta name="theme-color" media="(prefers-color-scheme: light)" content="#ffffff" />
<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0b0b0b" />
```

A light `theme_color` with a dark interface produces unreadable contrast on the status bar.

### Notifications are never the only channel

Important information delivered only by push notification is inaccessible to whoever refused the permission, to whoever is on iOS without installation, or to whoever uses an unsupported browser. Every notification must have an equivalent readable in the application.

---

## 12. Checklist

**Manifest**

- [ ] `name`, `short_name`, `start_url`, `display`, `theme_color`, `background_color`
- [ ] Icons 192 and 512, plus a `maskable` variant
- [ ] `id` defined and stable
- [ ] `scope` covers every internal journey
- [ ] `screenshots` in `wide` and `narrow`
- [ ] `orientation` not locked
- [ ] No error in DevTools > Application > Manifest
- [ ] Every icon or asset path named by the manifest, the worker or a push payload resolves to a file (a broken path is silent; the gate checks it)

**Service worker**

- [ ] Disabled in development
- [ ] Cache strategy defined per resource type, navigations Network First
- [ ] Authentication and payment routes Network Only
- [ ] `/offline` page precached and useful
- [ ] Update strategy chosen and tested, caches named per build
- [ ] `sw.js` served `no-cache`
- [ ] Cache purged at logout
- [ ] The rules above held by a contract test on the worker

**Push**

- [ ] VAPID keys in environment variables, the private one never exposed, the pair never rotated
- [ ] Subscriptions persisted in the database, endpoints filtered by an allowlist of known origins
- [ ] Permission asked in context, never on load
- [ ] In-app equivalent for every notification

**Accessibility**

- [ ] Complete internal navigation, no dead end in standalone
- [ ] Offline state announced through a live region
- [ ] Accessible install button, iOS instructions as text
- [ ] `env(safe-area-inset-*)` with `viewport-fit=cover`
- [ ] Touch targets at 44 px
- [ ] `theme-color` for light and dark

**Tests**

- [ ] Production build, `next build` then `next start`
- [ ] Real test on Android Chrome for the install prompt
- [ ] Real test on an iPhone for standalone and push
- [ ] Full offline test, network cut, not only DevTools
- [ ] Test after 7 days of inactivity on iOS for cache eviction
- [ ] Test of the update path, old version to new

---

## Sources

**Official**

- Next.js, PWA guide: https://nextjs.org/docs/app/guides/progressive-web-apps
- Next.js, `useOffline` (config): https://nextjs.org/docs/app/api-reference/config/next-config-js/useOffline
- Next.js, `useOffline` (hook): https://nextjs.org/docs/app/api-reference/functions/use-offline
- Next.js, handling connection loss: https://nextjs.org/docs/app/guides/offline-support
- Next.js, `manifest` convention: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/manifest
- Installability criteria, Chrome: https://developer.chrome.com/docs/lighthouse/pwa/installable-manifest
- Removal of the PWA category in Lighthouse 12: https://github.com/GoogleChrome/lighthouse/issues/15535
- MDN, Web App Manifest: https://developer.mozilla.org/docs/Web/Progressive_web_apps/Manifest
- MDN, PushSubscription: https://developer.mozilla.org/docs/Web/API/PushSubscription

**Tools**

- Serwist: https://github.com/serwist/serwist
- Serwist Turbopack example: https://github.com/serwist/serwist/tree/main/examples/next-turbo-basic
- next-pwa (deprecated in favour of Serwist): https://github.com/DuCanhGH/next-pwa
- What PWA Can Do Today: https://whatpwacando.today/

**Platform constraints**

- PWA limitations on iOS and Safari: https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide
- `beforeinstallprompt` support: https://web-platform-dx.github.io/web-features-explorer/features/beforeinstallprompt
