// sw.js — የቤተ ዮሴፍ ገንዘብ መዝገብ app ኦፍላይን እንዲሰራ የሚያደርግ Service Worker
//
// ይህ ፋይል index.html, manifest.json እና ሁለቱን ምስሎች (icon-192.png,
// icon-512.png) አስቀድሞ በመሳሪያው ላይ (cache) ያስቀምጣል፤ ስለዚህ ኔትወርክ ጠፍቶ
// እንኳ አፕሊኬሽኑ ራሱ (ገጹ/ንድፉ) ያለምንም ችግር ይከፈታል። እውነተኛው መረጃ (ገቢ/ወጭ/
// አባላት ወዘተ) ግን በ localStorage/IndexedDB ውስጥ በራሱ በገጹ ኮድ የሚቀመጥ ነው፤
// ይህ service worker ከዚያ ጋር ምንም ንክኪ የለውም — መረጃውን አይነካውም፣ አያጠፋውም።

const CACHE_NAME = 'beteyosef-app-cache-v1';

// አፕሊኬሽኑ ኦፍላይን ሲሆን እንኳ እንዲከፈት አስቀድመው መቀመጥ ያለባቸው ፋይሎች
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// 1) መጫኛ (install)፡ የመተግበሪያውን ዋና ፋይሎች ወደ cache ይቀዳል
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch((err) => console.warn('⚠️ App shell caching failed:', err))
  );
});

// 2) ማንቃት (activate)፡ የቆዩ (የቀድሞ ስሪት) cache ዎችን ያጸዳል
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// 3) fetch፡ "cache-first, then network in background" ስልት
//    - ገፁ/ፋይሉ በcache ካለ ወዲያውኑ ከዚያ ይመልሳል (ፈጣን + ኦፍላይንም ይሰራል)
//    - በተመሳሳይ ጊዜ ከኔትወርክ አዲስ ስሪት እየመጣ cache ውስጥ ያድሳል
//    - በcache ውስጥ ካልተገኘ ብቻ ከኔትወርክ ይጠብቃል (ለምሳሌ CDN ላይብረሪዎች)
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // POST/PUT ወዘተ ጥያቄዎችን (ለምሳሌ ወደ Supabase የሚላኩ) ጣልቃ አንገባም
  if (request.method !== 'GET') return;

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const networkFetch = fetch(request)
        .then((networkResponse) => {
          // status 200 ወይም cross-origin (opaque) ምላሽ ከሆነ cache እናድርገው
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse); // ኔትወርክ ከሌለ cache ብቻ ይመለሳል

      return cachedResponse || networkFetch;
    })
  );
});
