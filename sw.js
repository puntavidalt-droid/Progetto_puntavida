// ✅ Service Worker - Punta Vida PWA
// Aggiorna il numero versione ogni volta che modifichi i file
const CACHE_NAME = 'puntavida-v2';

// File da mettere in cache (solo quelli di Netlify, non Apps Script)
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

// ── INSTALL: mette in cache i file statici ──────────────────────────────────
self.addEventListener('install', event => {
  console.log('[SW] Install');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching files');
        // addAll può fallire se uno dei file non è raggiungibile;
        // usiamo Promise.allSettled per non bloccare l'installazione
        return Promise.allSettled(
          urlsToCache.map(url => cache.add(url).catch(e => console.warn('[SW] Cache miss:', url, e)))
        );
      })
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: rimuove cache vecchie ────────────────────────────────────────
self.addEventListener('activate', event => {
  console.log('[SW] Activate');
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: serve dalla cache, poi dalla rete ───────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Non intercettare richieste a domini esterni (Supabase, Google Script, ecc.)
  // Gestiamo solo le risorse di Netlify (stesso dominio)
  if (url.origin !== self.location.origin) {
    return; // lascia passare senza intercettare
  }

  event.respondWith(
    caches.match(event.request)
      .then(cached => {
        if (cached) {
          console.log('[SW] Serving from cache:', url.pathname);
          return cached;
        }
        return fetch(event.request);
      })
      .catch(() => {
        // Fallback offline: mostra index.html
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      })
  );
});
