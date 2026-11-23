/* ==========================================================================
   Service worker: permite abrir la app sin conexión.
   - Guarda los archivos de la app (misma dirección) al instalarse.
   - Con conexión siempre pide la versión nueva (espera hasta 4 s); sin conexión
     usa la copia guardada.
   - NO intercepta otros sitios: mapas base, OpenStreetMap ni el servidor del
     municipio (los datos confidenciales nunca se guardan aquí).
   Al cambiar archivos de la app, suba la VERSION para renovar la copia.
   ========================================================================== */
const VERSION = 'g4g-0.4.0';
const ARCHIVOS = [
  './', 'index.html', 'manifest.webmanifest',
  'css/fonts.css', 'css/base.css', 'css/components.css', 'css/public.css', 'css/acceso.css',
  'css/fonts/Montserrat-latin-1.woff2', 'css/fonts/Montserrat-latin-ext-0.woff2', 'css/fonts/Roboto-latin-3.woff2',
  'css/fonts/Roboto-latin-ext-2.woff2', 'css/fonts/RobotoCondensed-latin-5.woff2', 'css/fonts/RobotoCondensed-latin-ext-4.woff2',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png',
  'js/vendor/leaflet/leaflet.css', 'js/vendor/leaflet/leaflet.js', 'js/vendor/xlsx.mini.min.js',
  'js/config/config.js',
  'js/core/util.js', 'js/core/scoring.js', 'js/core/importer.js', 'js/core/api.js', 'js/core/auth.js', 'js/core/store.js', 'js/core/ui.js',
  'js/core/charts.js', 'js/core/basemap.js', 'js/core/hidro.js', 'js/core/pwa.js', 'js/core/app.js',
  'js/data/seed.js', 'js/data/rios.js', 'js/data/hidro-zona.js',
  'js/modules/detalle.js', 'js/modules/inicio.js', 'js/modules/resumen.js', 'js/modules/mapa.js', 'js/modules/operadores.js',
  'js/modules/pasivos.js', 'js/modules/denuncias.js', 'js/modules/datos.js', 'js/modules/registro.js', 'js/modules/buzon.js',
  'js/modules/configuracion.js', 'js/modules/ingresar.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ARCHIVOS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('g4g-') && k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('message', (e) => { if (e.data === 'activar') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;          // otros sitios: sin tocar
  e.respondWith(redDespuesCopia(req));
});

async function redDespuesCopia(req) {
  const cache = await caches.open(VERSION);
  const red = fetch(req).then((res) => { if (res && res.ok) cache.put(req, res.clone()); return res; });
  red.catch(() => {});
  try {
    return await Promise.race([red, new Promise((_, no) => setTimeout(() => no(new Error('lento')), 4000))]);
  } catch (err) {
    const copia = (await cache.match(req, { ignoreSearch: true })) || (req.mode === 'navigate' ? await cache.match('index.html') : undefined);
    if (copia) return copia;
    return red;   // sin copia guardada: esperar a la red (o fallar)
  }
}
