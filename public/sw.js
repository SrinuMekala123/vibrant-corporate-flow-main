// const CACHE_NAME = 'brihaspathi-v4';
// const DYNAMIC_CACHE = 'brihaspathi-dynamic-v2';
// const API_CACHE = 'brihaspathi-api-v1';

// // Static assets to cache immediately
// const STATIC_ASSETS = [
//     '/',
//     '/index.html',
//     '/manifest.webmanifest',
//     '/src/main.tsx',
//     '/src/App.tsx',
//     '/src/index.css'
// ];

// // Install event
// self.addEventListener('install', (event) => {
//     console.log('✅ Service Worker installing...');
//     event.waitUntil(
//         caches.open(CACHE_NAME).then((cache) => {
//             console.log('📦 Caching static assets');
//             return cache.addAll(STATIC_ASSETS);
//         }).then(() => self.skipWaiting())
//     );
// });

// // Activate event - clean old caches and take control
// self.addEventListener('activate', (event) => {
//     console.log('✅ Service Worker activating...');
//     event.waitUntil(
//         caches.keys().then((cacheNames) => {
//             return Promise.all(
//                 cacheNames.map((cacheName) => {
//                     if (![CACHE_NAME, DYNAMIC_CACHE, API_CACHE].includes(cacheName)) {
//                         console.log('🗑️ Deleting old cache:', cacheName);
//                         return caches.delete(cacheName);
//                     }
//                 })
//             );
//         }).then(() => self.clients.claim())
//     );
// });

// // Fetch event - comprehensive caching strategy
// self.addEventListener('fetch', (event) => {
//     const url = new URL(event.request.url);

//     // Skip non-GET requests
//     if (event.request.method !== 'GET') {
//         event.respondWith(fetch(event.request));
//         return;
//     }

//     // Handle Supabase API calls - Network First with cache fallback
//     if (url.hostname.includes('supabase.co')) {
//         event.respondWith(
//             fetch(event.request).then((response) => {
//                 // Cache successful API responses
//                 const responseClone = response.clone();
//                 caches.open(API_CACHE).then((cache) => {
//                     cache.put(event.request, responseClone);
//                 });
//                 return response;
//             }).catch(async () => {
//                 // Return cached API response if available
//                 const cachedResponse = await caches.match(event.request);
//                 if (cachedResponse) {
//                     console.log('📦 Serving cached API:', url.pathname);
//                     return cachedResponse;
//                 }
//                 return new Response(JSON.stringify({
//                     error: 'You are offline',
//                     offline: true,
//                     cached: false
//                 }), {
//                     status: 503,
//                     headers: { 'Content-Type': 'application/json' }
//                 });
//             })
//         );
//         return;
//     }

//     // Handle HTML pages (including authenticated routes)
//     if (event.request.mode === 'navigate' ||
//         event.request.headers.get('accept')?.includes('text/html')) {
//         event.respondWith(
//             fetch(event.request).then((response) => {
//                 // Cache the page for offline use
//                 const responseClone = response.clone();
//                 caches.open(DYNAMIC_CACHE).then((cache) => {
//                     cache.put(event.request, responseClone);
//                     console.log('📄 Cached page:', url.pathname);
//                 });
//                 return response;
//             }).catch(async () => {
//                 // Try to serve from cache
//                 const cachedResponse = await caches.match(event.request);
//                 if (cachedResponse) {
//                     console.log('📄 Serving cached page:', url.pathname);
//                     return cachedResponse;
//                 }
//                 // Fallback to homepage
//                 const homepage = await caches.match('/');
//                 if (homepage) {
//                     return homepage;
//                 }
//                 return new Response('Offline - Page not available', { status: 404 });
//             })
//         );
//         return;
//     }

//     // Handle JS/CSS files
//     if (event.request.destination === 'script' ||
//         event.request.destination === 'style') {
//         event.respondWith(
//             caches.match(event.request).then((cachedResponse) => {
//                 if (cachedResponse) {
//                     return cachedResponse;
//                 }
//                 return fetch(event.request).then((response) => {
//                     const responseClone = response.clone();
//                     caches.open(CACHE_NAME).then((cache) => {
//                         cache.put(event.request, responseClone);
//                     });
//                     return response;
//                 });
//             })
//         );
//         return;
//     }

//     // Handle images and fonts
//     if (event.request.destination === 'image' ||
//         event.request.destination === 'font') {
//         event.respondWith(
//             caches.match(event.request).then((cachedResponse) => {
//                 if (cachedResponse) {
//                     return cachedResponse;
//                 }
//                 return fetch(event.request);
//             })
//         );
//         return;
//     }

//     // Default - Network first with cache fallback
//     event.respondWith(
//         fetch(event.request).catch(async () => {
//             const cachedResponse = await caches.match(event.request);
//             if (cachedResponse) {
//                 return cachedResponse;
//             }
//             return new Response('Offline - Content not available', { status: 404 });
//         })
//     );
// });

// // Handle online/offline events
// self.addEventListener('online', () => {
//     console.log('🟢 Back online - refreshing...');
//     self.clients.matchAll().then(clients => {
//         clients.forEach(client => client.postMessage({ type: 'ONLINE' }));
//     });
// });

// self.addEventListener('offline', () => {
//     console.log('🔴 Offline mode activated');
// });

// // Message handler for skip waiting
// self.addEventListener('message', (event) => {
//     if (event.data && event.data.type === 'SKIP_WAITING') {
//         self.skipWaiting();
//     }
// });

// public/sw.js - ENHANCED OFFLINE SUPPORT WITH BETTER ERROR HANDLING






// 2nd code

// const CACHE_NAME = 'brihaspathi-v4';
// const DYNAMIC_CACHE = 'brihaspathi-dynamic-v2';
// const API_CACHE = 'brihaspathi-api-v1';

// // Static assets to cache immediately
// const STATIC_ASSETS = [
//     '/',
//     '/index.html',
//     '/manifest.webmanifest'
// ];

// // Install event
// self.addEventListener('install', (event) => {
//     console.log('✅ Service Worker installing...');
//     event.waitUntil(
//         caches.open(CACHE_NAME).then((cache) => {
//             console.log('📦 Caching static assets');
//             return cache.addAll(STATIC_ASSETS);
//         }).then(() => self.skipWaiting())
//     );
// });

// // Activate event - clean old caches and take control
// self.addEventListener('activate', (event) => {
//     console.log('✅ Service Worker activating...');
//     event.waitUntil(
//         caches.keys().then((cacheNames) => {
//             return Promise.all(
//                 cacheNames.map((cacheName) => {
//                     if (![CACHE_NAME, DYNAMIC_CACHE, API_CACHE].includes(cacheName)) {
//                         console.log('🗑️ Deleting old cache:', cacheName);
//                         return caches.delete(cacheName);
//                     }
//                 })
//             );
//         }).then(() => self.clients.claim())
//     );
// });

// // 🔥 Enhanced: Fetch event with better error handling
// self.addEventListener('fetch', (event) => {
//     const url = new URL(event.request.url);

//     // Skip non-GET requests
//     if (event.request.method !== 'GET') {
//         // For POST/PUT/DELETE, try network first, then fail gracefully
//         event.respondWith(
//             fetch(event.request).catch(() => {
//                 console.log('⚠️ Offline: Cannot perform', event.request.method, 'request');
//                 return new Response(JSON.stringify({
//                     error: 'Offline mode - changes will sync when back online',
//                     offline: true,
//                     method: event.request.method
//                 }), {
//                     status: 503,
//                     headers: { 'Content-Type': 'application/json' }
//                 });
//             })
//         );
//         return;
//     }

//     // 🔥 Handle Supabase API calls with better CORS handling
//     if (url.hostname.includes('supabase.co')) {
//         event.respondWith(
//             fetch(event.request, {
//                 mode: 'cors',
//                 credentials: 'include'
//             }).then((response) => {
//                 // Cache successful API responses
//                 if (response.ok) {
//                     const responseClone = response.clone();
//                     caches.open(API_CACHE).then((cache) => {
//                         cache.put(event.request, responseClone);
//                     });
//                 }
//                 return response;
//             }).catch(async (error) => {
//                 console.log('⚠️ API request failed, trying cache:', error.message);

//                 // Return cached API response if available
//                 const cachedResponse = await caches.match(event.request);
//                 if (cachedResponse) {
//                     console.log('📦 Serving cached API:', url.pathname);
//                     return cachedResponse;
//                 }

//                 // Return offline fallback
//                 return new Response(JSON.stringify({
//                     error: 'You are offline',
//                     offline: true,
//                     cached: false,
//                     message: 'Data will be available when you reconnect'
//                 }), {
//                     status: 503,
//                     headers: {
//                         'Content-Type': 'application/json',
//                         'X-Offline': 'true'
//                     }
//                 });
//             })
//         );
//         return;
//     }

//     // 🔥 Handle HTML pages (including authenticated routes)
//     if (event.request.mode === 'navigate' ||
//         event.request.headers.get('accept')?.includes('text/html')) {
//         event.respondWith(
//             fetch(event.request).then((response) => {
//                 // Cache the page for offline use
//                 if (response.ok) {
//                     const responseClone = response.clone();
//                     caches.open(DYNAMIC_CACHE).then((cache) => {
//                         cache.put(event.request, responseClone);
//                         console.log('📄 Cached page:', url.pathname);
//                     });
//                 }
//                 return response;
//             }).catch(async (error) => {
//                 console.log('⚠️ Page fetch failed, trying cache:', error.message);

//                 // Try to serve from cache
//                 const cachedResponse = await caches.match(event.request);
//                 if (cachedResponse) {
//                     console.log('📄 Serving cached page:', url.pathname);
//                     return cachedResponse;
//                 }

//                 // Try to serve from dynamic cache with similar path
//                 const cache = await caches.open(DYNAMIC_CACHE);
//                 const keys = await cache.keys();
//                 const similarPage = keys.find(key => {
//                     const keyUrl = new URL(key.url);
//                     return keyUrl.pathname === '/' || keyUrl.pathname === '/dashboard';
//                 });

//                 if (similarPage) {
//                     console.log('📄 Serving similar cached page');
//                     return cache.match(similarPage);
//                 }

//                 // Fallback to homepage
//                 const homepage = await caches.match('/');
//                 if (homepage) {
//                     return homepage;
//                 }

//                 return new Response('Offline - Page not available', {
//                     status: 404,
//                     headers: { 'Content-Type': 'text/plain' }
//                 });
//             })
//         );
//         return;
//     }

//     // 🔥 Handle JS/CSS files with cache-first strategy
//     if (event.request.destination === 'script' ||
//         event.request.destination === 'style') {
//         event.respondWith(
//             caches.match(event.request).then((cachedResponse) => {
//                 if (cachedResponse) {
//                     return cachedResponse;
//                 }
//                 return fetch(event.request).then((response) => {
//                     if (response.ok) {
//                         const responseClone = response.clone();
//                         caches.open(CACHE_NAME).then((cache) => {
//                             cache.put(event.request, responseClone);
//                         });
//                     }
//                     return response;
//                 }).catch(() => {
//                     return new Response('/* Offline */', {
//                         headers: { 'Content-Type': 'text/css' }
//                     });
//                 });
//             })
//         );
//         return;
//     }

//     // 🔥 Handle images and fonts with cache-first
//     if (event.request.destination === 'image' ||
//         event.request.destination === 'font') {
//         event.respondWith(
//             caches.match(event.request).then((cachedResponse) => {
//                 if (cachedResponse) {
//                     return cachedResponse;
//                 }
//                 return fetch(event.request).catch(() => {
//                     // Return a 1x1 pixel for images
//                     if (event.request.destination === 'image') {
//                         return new Response(
//                             'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
//                             { headers: { 'Content-Type': 'image/gif' } }
//                         );
//                     }
//                     return new Response('', { status: 404 });
//                 });
//             })
//         );
//         return;
//     }

//     // 🔥 Default - Network first with cache fallback
//     event.respondWith(
//         fetch(event.request).then((response) => {
//             if (response.ok) {
//                 const responseClone = response.clone();
//                 caches.open(CACHE_NAME).then((cache) => {
//                     cache.put(event.request, responseClone);
//                 });
//             }
//             return response;
//         }).catch(async () => {
//             const cachedResponse = await caches.match(event.request);
//             if (cachedResponse) {
//                 return cachedResponse;
//             }
//             return new Response('Offline - Content not available', {
//                 status: 404,
//                 headers: { 'Content-Type': 'text/plain' }
//             });
//         })
//     );
// });

// // 🔥 Enhanced: Handle online/offline events
// self.addEventListener('online', () => {
//     console.log('🟢 Back online - notifying clients...');
//     self.clients.matchAll().then(clients => {
//         clients.forEach(client => {
//             client.postMessage({
//                 type: 'ONLINE',
//                 timestamp: new Date().toISOString()
//             });
//         });
//     });
// });

// self.addEventListener('offline', () => {
//     console.log('🔴 Offline mode activated');
//     self.clients.matchAll().then(clients => {
//         clients.forEach(client => {
//             client.postMessage({
//                 type: 'OFFLINE',
//                 timestamp: new Date().toISOString()
//             });
//         });
//     });
// });

// // 🔥 Enhanced: Message handler for skip waiting and sync
// self.addEventListener('message', (event) => {
//     if (event.data && event.data.type === 'SKIP_WAITING') {
//         self.skipWaiting();
//     }

//     if (event.data && event.data.type === 'SYNC_NOW') {
//         console.log('🔄 Manual sync requested');
//         self.clients.matchAll().then(clients => {
//             clients.forEach(client => {
//                 client.postMessage({
//                     type: 'SYNC',
//                     timestamp: new Date().toISOString()
//                 });
//             });
//         });
//     }
// });

// // 🔥 Background sync event (for when browser supports it)
// self.addEventListener('sync', (event) => {
//     if (event.tag === 'sync-complaints') {
//         console.log('🔄 Background sync triggered');
//         event.waitUntil(
//             self.clients.matchAll().then(clients => {
//                 clients.forEach(client => {
//                     client.postMessage({
//                         type: 'SYNC',
//                         timestamp: new Date().toISOString()
//                     });
//                 });
//             })
//         );
//     }
// });

// public/sw.js - UPDATED VERSION

const CACHE_NAME = 'brihaspathi-v5';
const OFFLINE_URL = '/';

// Files to cache immediately
const PRECACHE_URLS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/src/main.tsx',
    '/src/App.tsx',
];

// Install event
self.addEventListener('install', (event) => {
    console.log('✅ Service Worker installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('📦 Caching static assets');
                return cache.addAll(PRECACHE_URLS);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event
self.addEventListener('activate', (event) => {
    console.log('✅ Service Worker activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('🗑️ Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch event - DON'T INTERCEPT SUPABASE REQUESTS
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // IMPORTANT: Skip all Supabase requests - let them go directly
    if (url.hostname.includes('supabase.co')) {
        // Don't intercept, don't cache, just pass through
        event.respondWith(fetch(event.request));
        return;
    }

    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        event.respondWith(fetch(event.request));
        return;
    }

    // For HTML pages
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => {
                return caches.match(OFFLINE_URL);
            })
        );
        return;
    }

    // For static assets
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }
            return fetch(event.request).then((networkResponse) => {
                return caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, networkResponse.clone());
                    return networkResponse;
                });
            });
        })
    );
});