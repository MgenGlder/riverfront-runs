// Minimal, safe service worker: caches the app shell for fast/offline loads.
// It only touches same-origin GET requests — the cross-origin live WebSocket and
// Fly /health calls are never intercepted (WebSockets aren't fetch events anyway).
const CACHE = 'rrd-shell-v1'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return // leave cross-origin alone

  // Navigations: network-first, fall back to the cached shell when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const net = await fetch(req)
          const cache = await caches.open(CACHE)
          cache.put('/', net.clone())
          return net
        } catch {
          return (await caches.match('/')) || Response.error()
        }
      })(),
    )
    return
  }

  // Hashed static assets: cache-first (they're immutable), populate on miss.
  event.respondWith(
    (async () => {
      const cached = await caches.match(req)
      if (cached) return cached
      try {
        const net = await fetch(req)
        if (net.ok) {
          const cache = await caches.open(CACHE)
          cache.put(req, net.clone())
        }
        return net
      } catch {
        return cached || Response.error()
      }
    })(),
  )
})
