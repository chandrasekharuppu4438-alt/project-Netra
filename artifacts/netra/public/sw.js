const CACHE_NAME = 'netra-v1';
const SHELL_URLS = ['/', '/index.html'];

const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>NETRA — Offline</title>
  <style>
    body { font-family: sans-serif; background: #0a1f1a; color: #e0f2ef; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: #0f2e25; border: 1px solid #1a4a3a; border-radius: 12px; padding: 2rem; max-width: 420px; text-align: center; }
    h1 { color: #0F6E56; font-size: 2rem; margin-bottom: 0.5rem; }
    p { color: #8ab5a8; margin-bottom: 1.5rem; }
    .contacts { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
    a { display: block; background: #0F6E56; color: #fff; text-decoration: none; padding: 0.75rem; border-radius: 8px; font-weight: 600; }
    a.emergency { background: #dc2626; }
    a.ambulance { background: #d97706; }
    a.fire { background: #ea580c; }
    a.women { background: #7c3aed; }
  </style>
</head>
<body>
  <div class="card">
    <h1>NETRA</h1>
    <p>You are offline. Emergency contacts are always available.</p>
    <div class="contacts">
      <a href="tel:100" class="emergency">🚔 Police: 100</a>
      <a href="tel:108" class="ambulance">🚑 Ambulance: 108</a>
      <a href="tel:101" class="fire">🚒 Fire: 101</a>
      <a href="tel:1091" class="women">👩 Women: 1091</a>
    </div>
  </div>
</body>
</html>`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match('/index.html').then((r) => r || new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html' } }))
      )
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
