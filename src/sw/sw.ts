/// <reference lib="webworker" />
// Platzhalter: der vollständige Service Worker (Serwist) kommt mit der PWA-Aufgabe.
declare const self: ServiceWorkerGlobalScope;
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
export {};
