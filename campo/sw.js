/* ==========================================================================
   Service worker de Aurum80 Campo (alcance: /campo/).
   - Guarda los archivos de la app de campo y los de la app principal que usa (un nivel arriba).
   - Con conexión pide siempre la versión nueva (espera hasta 4 s); sin conexión o con señal muy
     lenta usa la copia guardada.
   - NO guarda otros orígenes (mapas, servidor del municipio / Apps Script) ni zonas confidenciales:
     solo archivos de esta misma dirección. Los datos de la jornada viven en localStorage, no aquí.
   Al cambiar archivos de la app, suba la VERSION para renovar la copia.
   Nota: el nombre de la copia empieza con 'g4g-campo-' para no chocar con el de la app principal
   ('g4g-0.6.0-...'); aun así el sw.js principal borra copias que empiezan con 'g4g-' distintas de la suya
   (ver el informe): si lo hiciera, esta app vuelve a guardar sus archivos en cuanto hay conexión.
   ========================================================================== */
const VERSION = 'g4g-campo-0.7.0-1';
const ARCHIVOS = [
  './', 'index.html', 'manifest.webmanifest',
  'css/campo.css',
  'js/campo.js', 'js/muestra.js', 'js/fichas.js', 'js/planilla.js', 'js/arranque.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png', '../icons/logo-aurum80.svg',
  '../img/muestra.svg', '../img/vacio-datos.svg',
  '../css/fonts.css', '../css/base.css', '../css/components.css',
  '../css/fonts/Montserrat-latin-1.woff2', '../css/fonts/Montserrat-latin-ext-0.woff2', '../css/fonts/Roboto-latin-3.woff2',
  '../css/fonts/Roboto-latin-ext-2.woff2', '../css/fonts/RobotoCondensed-latin-5.woff2', '../css/fonts/RobotoCondensed-latin-ext-4.woff2',
  '../js/config/config.js',
  '../js/core/util.js', '../js/core/importer.js', '../js/core/api.js', '../js/core/auth.js', '../js/core/ui.js', '../js/core/pwa.js', '../js/core/hgsense.js'
];

self.addEventListener('install', (e) => {
  /* Un archivo que falle no debe impedir la instalación: se guardan uno por uno. */
  e.waitUntil(caches.open(VERSION).then((c) => Promise.all(ARCHIVOS.map((a) => c.add(a).catch((err) => console.warn('No se pudo guardar', a, err && err.message))))));
});

self.addEventListener('activate', (e) => {
  /* Solo se borran copias anteriores de la app de campo. */
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('g4g-campo-') && k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('message', (e) => { if (e.data === 'activar') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;          // otros sitios y el servidor: sin tocar
  if (/\.geojson$/i.test(url.pathname) || /zonas-revisadas/i.test(url.pathname)) return;   // zonas confidenciales: nunca se guardan aquí
  e.respondWith(redDespuesCopia(req));
});

async function redDespuesCopia(req) {
  const cache = await caches.open(VERSION);
  const red = fetch(req).then((res) => { if (res && res.ok && res.type === 'basic') cache.put(req, res.clone()); return res; });
  red.catch(() => {});
  try {
    return await Promise.race([red, new Promise((_, no) => setTimeout(() => no(new Error('lento')), 4000))]);
  } catch (err) {
    const copia = (await cache.match(req, { ignoreSearch: true })) || (req.mode === 'navigate' ? await cache.match(new URL('index.html', self.registration.scope).href) : undefined);
    if (copia) return copia;
    return red;   // sin copia guardada: esperar a la red (o fallar)
  }
}
