// SprintGames PWA Service Worker
const CACHE_NAME = 'sprintgames-shell-v15';

// Static application shell assets
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/manifest.json',
  '/js/api.js',
  '/js/sound.js',
  '/js/fish.js',
  '/js/game.js',
  '/js/ui.js',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
  '/assets/icon-maskable-512.png',
  '/assets/apple-touch-icon.png',
  '/assets/favicon.svg',
  '/assets/one_hook_cover.jpg',
  '/assets/cyber_runner_cover.jpg',
  '/assets/abyss_diver_cover.jpg'
];

// 1. Install Event: Pre-cache static app shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[Service Worker] Non-fatal asset pre-cache warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// 2. Activate Event: Clean up outdated caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch Event: Network-first for API, Stale-while-revalidate for safe static assets
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // STRICT RULE: Bypass Service Worker cache for all dynamic API requests & non-GET methods
  if (request.method !== 'GET' || url.pathname.startsWith('/api/')) {
    return; // Handled directly by browser network
  }

  // Handle static app shell requests: Stale-while-revalidate strategy
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request).then((networkResponse) => {
        // Cache valid static responses from same origin
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          networkResponse.type === 'basic' &&
          !url.pathname.startsWith('/api/')
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Offline fallback for navigation requests
        if (request.mode === 'navigate') {
          return caches.match('/index.html') || cachedResponse;
        }
        return cachedResponse;
      });

      return cachedResponse || fetchPromise;
    })
  );
});
