// Scotia Fieldsport Log — Service Worker
// Cache-first for app shell; network-first for Firestore/API calls

const CACHE_NAME = 'sfl-v1.0.9';
const APP_SHELL = [
  '/',
  '/index.html',
  '/css/app.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.js',
  '/js/config.js',
  '/js/auth.js',
  '/js/popup.js',
  '/js/db.js',
  '/js/weather.js',
  '/js/cloudinary.js',
  '/js/dropbox.js',
  '/js/export.js',
  '/js/map.js',
  '/js/pins.js',
  '/js/lists.js',
  '/js/app.js',
  '/manifest.json',
  '/icons/logo-192.png',
  '/icons/logo-512.png'
];

// Map tile patterns to cache on request
const TILE_PATTERNS = [
  'arcgisonline.com',
  'cartocdn.com'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Network-only: Firebase, APIs, Google tiles, Dropbox
  if (url.includes('firestore.googleapis.com') ||
      url.includes('openweathermap.org') ||
      url.includes('api.dropbox') ||
      url.includes('content.dropboxapi.com') ||
      url.includes('cloudinary.com') ||
      url.includes('gstatic.com/firebasejs') ||
      url.includes('mt.google.com') ||
      url.includes('mt0.google.com') ||
      url.includes('mt1.google.com') ||
      url.includes('mt2.google.com') ||
      url.includes('mt3.google.com')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Cache tiles on first fetch, serve from cache thereafter
  if (TILE_PATTERNS.some(p => url.includes(p))) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, copy));
          }
          return res;
        }).catch(() => cached);
      })
    );
    return;
  }

  // Cache-first for app shell
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
