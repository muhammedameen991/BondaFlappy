// ===== Service Worker =====
const CACHE_NAME = "bonda-flappy-v1";

// List of files to cache
const ASSETS = [
  "/",                  // root
  "/index.html",        // main HTML
  "/style.css",         // CSS
  "/script.js",         // JS
  "/images/bonda.png",  // Bird icon
  "/sounds/jump.mp3",   // jump sound
  "/sounds/hit.mp3",    // hit sound
  "/sounds/point.mp3"   // point sound
];

// Install event - cache all files
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Activate event - remove old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
});

// Fetch event - load from cache first, then network
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request).catch(() => {
        // Optional: fallback offline page or image
      });
    })
  );
});
