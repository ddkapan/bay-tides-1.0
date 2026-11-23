/* Bay Tide Log — service worker (offline support).

   Modelled on saexplore's sw.js, minus the manual version bump:
   - App shell (this site's own files): NETWORK-FIRST, revalidated past the browser's HTTP
     cache, so a new deploy is always picked up when online; cached copy when offline.
     Because the shell is always refreshed from the network, the cache names below are
     stable and never need bumping. Edit this file only when the caching logic changes.
   - NOAA API: network-first, cached copy offline (the last tides you loaded stay viewable).
   - Libraries (cdnjs) and fonts: cache-first (URLs are versioned / immutable).
   - Map tiles (OpenStreetMap): cache-first, capped so the cache can't grow without bound.
   Live reload of open tabs is done by the page itself (ETag poll in index.html), not here. */

var SHELL = 'btl-shell';
var DATA = 'btl-data';
var LIBS = 'btl-libs';
var TILES = 'btl-tiles', TILE_MAX = 800;

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(SHELL)
      .then(function (c) { return c.addAll([new Request('./', { cache: 'reload' })]); })
      .catch(function () {})
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  var keep = [SHELL, DATA, LIBS, TILES];
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { if (keep.indexOf(k) < 0) return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function put(name, req, resp) {
  // Never cache opaque responses: Chrome counts each as ~7 MB of quota, and quota pressure can
  // evict the whole origin, including the observations in IndexedDB.
  if (!resp || !resp.ok || resp.type === 'opaque') return;
  var copy = resp.clone();
  caches.open(name).then(function (c) { return c.put(req, copy); }).catch(function () {});
}

function networkFirst(name, req, fetchReq) {
  return fetch(fetchReq || req).then(function (resp) { put(name, req, resp); return resp; })
    .catch(function () {
      return caches.match(req, { ignoreVary: true }).then(function (hit) {
        if (hit) return hit;
        if (req.mode === 'navigate') return caches.match('./');
        return new Response('', { status: 504, statusText: 'Offline' });
      });
    });
}

function cacheFirst(name, req, onStore) {
  return caches.match(req).then(function (hit) {
    if (hit) return hit;
    // Re-request with CORS (cdnjs, Google Fonts and OSM all allow it) so the response is cacheable.
    return fetch(req.url, { mode: 'cors', credentials: 'omit' })
      .then(function (resp) { put(name, req, resp); if (onStore) onStore(); return resp; },
            function () { return fetch(req); });
  }).catch(function () { return new Response('', { status: 504, statusText: 'Offline' }); });
}

function trimTiles() {
  caches.open(TILES).then(function (c) {
    return c.keys().then(function (keys) {
      var extra = keys.length - TILE_MAX;
      for (var i = 0; i < extra; i++) c.delete(keys[i]);   // oldest first
    });
  }).catch(function () {});
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;            // HEAD (the page's update poll) goes straight to network
  var url = new URL(req.url);

  if (url.origin === self.location.origin) {
    // 'no-cache' revalidates with the server (cheap 304) instead of trusting max-age=600
    e.respondWith(networkFirst(SHELL, req, new Request(req, { cache: 'no-cache' })));
  } else if (url.hostname === 'api.tidesandcurrents.noaa.gov') {
    e.respondWith(networkFirst(DATA, req));
  } else if (url.hostname === 'cdnjs.cloudflare.com' || /(^|\.)(fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(url.hostname)) {
    e.respondWith(cacheFirst(LIBS, req));
  } else if (/(^|\.)tile\.openstreetmap\.org$/.test(url.hostname)) {
    e.respondWith(cacheFirst(TILES, req, trimTiles));
  }
});
