// localfit service worker — network-first for the app shell so it's always
// fresh when online (home), and falls back to cache when offline (office).
// Scope-relative so it works whether served at '/' or under '/localfit/'.
const CACHE = 'localfit-v2'

// The registration scope is the app's base URL ('/' locally, '/localfit/' on
// Pages). Use it as the offline fallback / start URL instead of a hardcoded '/'.
const SCOPE = new URL('./', self.registration.scope).pathname

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('fetch', (e) => {
  const { request } = e
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return // never cache live data

  e.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(request, copy))
        }
        return res
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match(SCOPE)))
  )
})
