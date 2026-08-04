/* Meridian PWA Service Worker（2026-08-05）
   轻量策略：导航请求 network-first（保证数据新鲜），静态资源 cache-first（秒开）。
   离线兜底：网络失败时回退缓存壳页面。 */

const CACHE = "meridian-v1";
const PRECACHE = ["/", "/manifest.json", "/meridian-icon.svg", "/apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // 只处理同源 GET
  if (e.request.method !== "GET" || url.origin !== location.origin) return;

  // API 请求：永远走网络（数据要新鲜），失败静默
  if (url.pathname.startsWith("/api/")) return;

  // 静态资源（_next/* 带 hash 指纹）：cache-first
  if (url.pathname.startsWith("/_next/")) {
    e.respondWith(
      caches.match(e.request).then((hit) =>
        hit || fetch(e.request).then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
          return res;
        })
      )
    );
    return;
  }

  // 页面导航：network-first，失败回退缓存
  e.respondWith(
    fetch(e.request).then((res) => {
      const clone = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, clone));
      return res;
    }).catch(() =>
      caches.match(e.request).then((hit) => hit || caches.match("/"))
    )
  );
});
