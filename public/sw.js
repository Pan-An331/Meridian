// Task OS — Minimal Service Worker
// Handles: offline fallback, basic caching for PWA installability

const CACHE_NAME = "task-os-v1";

self.addEventListener("install", (event) => {
  // Skip waiting to activate immediately
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Clean up old caches
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  // Take control of all clients
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Network-first with cache fallback for navigation requests
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(event.request).then((r) => r || new Response("Offline"))
      )
    );
  }
});
