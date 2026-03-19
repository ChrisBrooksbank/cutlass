// Cutlass Video Editor — Service Worker
// Strategy: Network-first for HTML/navigation, Cache-first for assets,
// and aggressive long-lived caching for WASM files.

const CACHE_NAME = 'cutlass-v1';
const WASM_CACHE = 'cutlass-wasm-v1';

// Assets to pre-cache on install (shell)
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
];

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  // Activate immediately so the new SW takes over
  self.skipWaiting();
});

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  // Purge old caches (keep current versions)
  const keep = new Set([CACHE_NAME, WASM_CACHE]);
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Helpers ──────────────────────────────────────────────────────────────────
function isWasmOrFFmpeg(url) {
  const parsed = new URL(url);
  const path = parsed.pathname;
  // Local WASM/FFmpeg assets
  if (path.endsWith('.wasm') || path.includes('/ffmpeg-core-')) return true;
  // CDN-hosted FFmpeg core assets (jsdelivr)
  if (parsed.hostname === 'cdn.jsdelivr.net' && path.includes('@ffmpeg/core')) return true;
  return false;
}

function isNavigationOrHTML(request) {
  return request.mode === 'navigate' ||
    (request.headers.get('accept') || '').includes('text/html');
}

function isImmutableAsset(url) {
  const path = new URL(url).pathname;
  // Vite hashed assets in /assets/
  return path.startsWith('/assets/');
}

// ── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET
  if (request.method !== 'GET') return;

  // 1) WASM & FFmpeg files → Cache-first, store in dedicated WASM cache
  if (isWasmOrFFmpeg(request.url)) {
    event.respondWith(
      caches.open(WASM_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) {
          cache.put(request, response.clone());
        }
        return response;
      })
    );
    return;
  }

  // 2) Vite hashed assets (/assets/*) → Cache-first (content-addressed, immutable)
  if (isImmutableAsset(request.url)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) {
          cache.put(request, response.clone());
        }
        return response;
      })
    );
    return;
  }

  // 3) Navigation / HTML → Network-first (so updates are picked up)
  if (isNavigationOrHTML(request)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch((err) => {
            console.warn('SW: failed to cache HTML response:', err);
          });
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // 4) Everything else → Stale-while-revalidate
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      const fetchPromise = fetch(request).then((response) => {
        if (response.ok) {
          cache.put(request, response.clone());
        }
        return response;
      }).catch(() => cached);

      return cached || fetchPromise.then((r) => r || new Response('Offline', { status: 503, statusText: 'Service Unavailable' }));
    })
  );
});

// ── Message handling for update flow ─────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
