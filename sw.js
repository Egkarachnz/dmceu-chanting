/* DMCEU SS15 · service worker
   App shell: cache-first with background revalidate.
   Sheet data is JSONP from Google and is never cached here. */

const VERSION = 'dmceu-ss15-v5';
const SHELL = [
    './',
    'index.html',
    'styles.css',
    'script.js',
    'manifest.webmanifest',
    'assets/logo-mark.png',
    'assets/icon-192.png',
    'assets/icon-512.png',
    'assets/apple-touch-icon.png',
    'assets/favicon-64.png'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(VERSION)
            .then(cache => cache.addAll(SHELL))
            .then(() => self.skipWaiting())
            .catch(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);

    // Never intercept the spreadsheet feed or other API calls.
    if (url.hostname.indexOf('docs.google.com') > -1 || url.hostname.indexOf('geojs.io') > -1) return;

    // Navigations: network first, fall back to the cached shell when offline.
    if (req.mode === 'navigate') {
        event.respondWith(
            fetch(req)
                .then(res => {
                    const copy = res.clone();
                    caches.open(VERSION).then(c => c.put('index.html', copy));
                    return res;
                })
                .catch(() => caches.match('index.html').then(r => r || caches.match('./')))
        );
        return;
    }

    // Same-origin assets + fonts: cache first, refresh in the background.
    const cacheable = url.origin === self.location.origin ||
        url.hostname.indexOf('fonts.googleapis.com') > -1 ||
        url.hostname.indexOf('fonts.gstatic.com') > -1;
    if (!cacheable) return;

    event.respondWith(
        caches.match(req).then(cached => {
            const network = fetch(req).then(res => {
                if (res && (res.ok || res.type === 'opaque')) {
                    const copy = res.clone();
                    caches.open(VERSION).then(c => c.put(req, copy));
                }
                return res;
            }).catch(() => cached);
            return cached || network;
        })
    );
});
