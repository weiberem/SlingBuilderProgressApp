/// <reference lib="webworker" />
import { CacheableResponsePlugin, CacheFirst, ExpirationPlugin, NetworkFirst, Serwist, StaleWhileRevalidate, type RuntimeCaching } from "serwist";

/**
 * Service Worker (Serwist-Runtime, mit esbuild gebündelt: `pnpm build:sw` → public/sw.js).
 *
 * Zur Build-Zeit wird nichts vorgeladen. Beim Installieren wird nur die Seite /offline in einen
 * eigenen Cache gelegt; sie ist der Fallback für Navigationen, die weder das Netz (4 s) noch der
 * Seiten-Cache beantworten können.
 *
 * Nie gecacht: alles ausser GET (Server Actions sind POST) und der Sync-Endpunkt
 * /api/p/<id>/sync. Für diese Anfragen greift keine Route, sie gehen direkt ans Netz.
 */
declare const self: ServiceWorkerGlobalScope;

const OFFLINE_URL = "/offline";
const OFFLINE_CACHE = "sbt-offline-v1";
const DAY = 24 * 60 * 60;
const FONT_HOSTS = new Set(["fonts.googleapis.com", "fonts.gstatic.com"]);

const isSameOrigin = (url: URL) => url.origin === self.location.origin;
const isSyncRequest = (url: URL) => /^\/api\/p\/[^/]+\/sync(?:\/|$)/.test(url.pathname);
const isSnapshotRequest = (url: URL) => /^\/api\/p\/[^/]+\/snapshot(?:\/|$)/.test(url.pathname);

const runtimeCaching: RuntimeCaching[] = [
  // Gebaute Assets sind inhaltsgehasht: einmal geladen, lange gültig.
  {
    matcher: ({ url }) => isSameOrigin(url) && url.pathname.startsWith("/_next/static/"),
    handler: new CacheFirst({
      cacheName: "sbt-next-static",
      plugins: [new CacheableResponsePlugin({ statuses: [0, 200] }), new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 30 * DAY, purgeOnQuotaError: true })],
    }),
  },
  // Google Fonts (falls genutzt): Stylesheet und Schriftdateien.
  {
    matcher: ({ url }) => FONT_HOSTS.has(url.hostname),
    handler: new StaleWhileRevalidate({
      cacheName: "sbt-google-fonts",
      plugins: [new CacheableResponsePlugin({ statuses: [0, 200] }), new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 365 * DAY, purgeOnQuotaError: true })],
    }),
  },
  // Bilder und App-Icons.
  {
    matcher: ({ request, url }) => isSameOrigin(url) && (request.destination === "image" || url.pathname.startsWith("/icons/") || url.pathname.startsWith("/brand/")),
    handler: new CacheFirst({
      cacheName: "sbt-images",
      plugins: [new CacheableResponsePlugin({ statuses: [0, 200] }), new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 30 * DAY, purgeOnQuotaError: true })],
    }),
  },
  // Projekt-Snapshot (nur GET): Netz zuerst, sonst der letzte Stand aus dem Cache.
  {
    matcher: ({ url, request }) => isSameOrigin(url) && request.method === "GET" && isSnapshotRequest(url) && !isSyncRequest(url),
    handler: new NetworkFirst({
      cacheName: "sbt-snapshot",
      networkTimeoutSeconds: 4,
      plugins: [new CacheableResponsePlugin({ statuses: [200] }), new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 30 * DAY })],
    }),
  },
  // Seiten (Navigationen): Netz zuerst mit 4 s Timeout, dann die zuletzt gecachte Fassung.
  // Scheitert beides, liefert der Catch-Handler unten /offline.
  {
    matcher: ({ request, url }) => request.mode === "navigate" && isSameOrigin(url) && !url.pathname.startsWith("/api/"),
    handler: new NetworkFirst({
      cacheName: "sbt-pages",
      networkTimeoutSeconds: 4,
      plugins: [new CacheableResponsePlugin({ statuses: [200] }), new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 14 * DAY })],
    }),
  },
];

const serwist = new Serwist({
  precacheEntries: [],
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
  disableDevLogs: true,
  runtimeCaching,
});

serwist.setCatchHandler(async ({ request }) => {
  if (request.mode === "navigate" || request.destination === "document") {
    const cached = await caches.match(OFFLINE_URL, { cacheName: OFFLINE_CACHE });
    if (cached) return cached;
  }
  return Response.error();
});

// /offline beim Installieren vorladen. Ein Fehler (z. B. offline beim ersten Start) bricht die
// Installation nicht ab; der Fallback fehlt dann bis zur nächsten SW-Version.
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(OFFLINE_CACHE);
        await cache.add(new Request(OFFLINE_URL, { cache: "reload" }));
      } catch {
        /* ignorieren, siehe oben */
      }
    })(),
  );
});

// Auf Wunsch der App (z. B. beim Abmelden) alle Laufzeit-Caches leeren.
self.addEventListener("message", (event) => {
  if (event.data?.type !== "CLEAR_CACHES") return;
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("sbt-") && k !== OFFLINE_CACHE).map((k) => caches.delete(k)))));
});

serwist.addEventListeners();
