// Service Worker: alles vorab cachen (offline ab dem ersten Besuch),
// danach "stale-while-revalidate": sofort aus dem Cache, im Hintergrund aktualisieren.
//
// Bei jeder Veröffentlichung VERSION erhöhen: Dann installiert der Browser den neuen
// Worker, die App zeigt „Neue Version verfügbar“ und lädt erst auf Knopfdruck neu.
//
// Der Ursprung (4ng318i.github.io) wird von allen Pages-Projekten geteilt. Deshalb
// trägt der Cache ein eigenes Präfix und es werden NUR eigene Caches gelöscht.
const PREFIX = 'deutschb2-';
const VERSION = 2;
const CACHE = PREFIX + 'v' + VERSION;
const LEGACY_CACHES = ['satzbau-b2-v1']; // Name aus der ersten Veröffentlichung
const ASSETS = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'icons/icon-192.png', 'icons/icon-512.png',
  'js/app.js', 'js/dom.js', 'js/store.js', 'js/content.js', 'js/scheduler.js',
  'js/i18n.js', 'js/speech.js', 'js/charts.js',
  'js/exercises/choice.js', 'js/exercises/satzbau.js', 'js/exercises/konnektor.js',
  'js/exercises/luecke.js',
  'js/views/start.js', 'js/views/session.js', 'js/views/anrufe.js',
  'js/views/nachschlagen.js', 'js/views/fortschritt.js', 'js/views/einstellungen.js',
  'data/index.json', 'data/ui.json', 'data/wortschatz.json', 'data/redemittel.json',
  'data/anrufe.json', 'data/grammatik.json',
  'data/saetze-anfrage.json', 'data/saetze-termin.json', 'data/saetze-reklamation.json',
  'data/saetze-stoerung.json', 'data/saetze-rechnung.json'
];

// Kein skipWaiting bei der Installation: Eine neue Version wartet, bis die App
// sie per Nachricht aktiviert (Knopf „Neu laden“). Beim allerersten Besuch gibt es
// keinen alten Worker, dann wird der neue ohnehin sofort aktiv.
self.addEventListener('install', e => {
  // cache: 'reload' umgeht den HTTP-Cache, damit wirklich die neuen Dateien geladen werden
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', e => {
  const mine = k => (k.startsWith(PREFIX) || LEGACY_CACHES.includes(k)) && k !== CACHE;
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(mine).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(req, { ignoreSearch: true });
      const fresh = fetch(req).then(res => {
        if (res.ok) cache.put(req, res.clone());
        return res;
      }).catch(() => null);
      if (cached) { e.waitUntil(fresh); return cached; }
      const res = await fresh;
      return res || new Response('Offline', { status: 503, statusText: 'Offline' });
    })
  );
});
