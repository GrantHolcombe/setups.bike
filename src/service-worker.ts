/// <reference lib="webworker" />
/* eslint-disable no-restricted-globals */

// Setups.Bike service worker (Phase 3 PWA). The build (Create React App + Workbox) turns this
// into build/service-worker.js and fills in self.__WB_MANIFEST with the app's hashed files.
//
// What it does:
//  - Precaches the app shell (index.html, JS, CSS) so the app opens fast and opens offline.
//  - Caches same-origin images (logos, tokens, icons).
//  - NEVER caches API calls or Google sign-in: those are other origins and aren't routed here,
//    so they always go to the network and garage data is always fresh.
//  - A new version waits until the app asks it to take over ("New version available · Reload").

import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope;

clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);

// Opening the app (/, including shared links like /?s=<id>) gets the cached index.html.
// Only "/" is handled: the legal pages and anything else are real files fetched normally.
const PUBLIC_URL = process.env.PUBLIC_URL === '.' ? '' : process.env.PUBLIC_URL;
registerRoute(new NavigationRoute(createHandlerBoundToURL(`${PUBLIC_URL}/index.html`), {
  allowlist: [/^\/$/, /^\/index\.html$/],
}));

// Same-origin images: from the cache first, refreshed when they expire.
registerRoute(
  ({ url, request }) => url.origin === self.location.origin && request.destination === 'image',
  new CacheFirst({
    cacheName: 'images',
    plugins: [new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 })],
  })
);

// The app sends this when the rider clicks "Reload" on the update notice.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
