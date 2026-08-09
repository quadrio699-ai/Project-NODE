// Project-NODE Service Worker
// Caches the app shell on first visit so the site still loads (even if
// only to show cached content) when a student has no connection later.
// This is intentionally simple: cache-first for the shell files, and a
// network-first fallback for everything else (API calls, lesson files)
// so students always get fresh content when they DO have a connection.

const CACHE_NAME = 'project-node-shell-v1';
const SHELL_FILES = [
    '/',
    '/index.html',
    '/dashboard.html',
    '/manifest.json',
    '/logo.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((names) =>
            Promise.all(
                names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
            )
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    // Only handle GET requests — never intercept POST/login/etc.
    if (event.request.method !== 'GET') return;

    // App shell files: cache-first (instant load, works offline)
    const url = new URL(event.request.url);
    if (SHELL_FILES.includes(url.pathname)) {
        event.respondWith(
            caches.match(event.request).then((cached) => cached || fetch(event.request))
        );
        return;
    }

    // Everything else (API calls, lesson content): network-first, so
    // content is always fresh when online, falling back to cache only
    // if the network genuinely fails.
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                const clone = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                return response;
            })
            .catch(() => caches.match(event.request))
    );
});
