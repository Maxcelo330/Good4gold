/* ==========================================================================
   Instalación como aplicación (PWA) y uso sin conexión.
   - Android / Chrome / Edge: el navegador ofrece "Instalar" (beforeinstallprompt).
   - iPhone / iPad (Safari): no hay botón automático; se explica el paso
     Compartir > Agregar a inicio.
   - Requiere que la página se sirva por https (GitHub Pages) o localhost.
     Abierta como archivo (file://) no se puede instalar.
   ========================================================================== */
(function () {
  const G4G = (window.G4G = window.G4G || {});
  let aviso = null, registro = null, actualizacion = false;

  const ua = navigator.userAgent || '';
  const esIOS = () => /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const esAndroid = () => /android/i.test(ua);
  const instalada = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const servible = () => location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname);

  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); aviso = e; G4G.bus.emit('pwa:changed'); });
  window.addEventListener('appinstalled', () => { aviso = null; G4G.bus.emit('pwa:changed'); G4G.ui && G4G.ui.toast('Aplicación instalada. Ya la tiene en su pantalla de inicio.'); });

  function iniciar() {
    if (!('serviceWorker' in navigator) || !servible()) return;
    navigator.serviceWorker.register('sw.js').then((r) => {
      registro = r;
      r.addEventListener('updatefound', () => {
        const n = r.installing;
        if (n) n.addEventListener('statechange', () => { if (n.state === 'installed' && navigator.serviceWorker.controller) { actualizacion = true; G4G.bus.emit('pwa:changed'); } });
      });
    }).catch((e) => console.warn('Service worker no registrado:', e.message));
  }

  /* Estado para la pantalla de Configuración. */
  function estado() {
    if (instalada()) return { modo: 'instalada' };
    if (!servible()) return { modo: 'archivo' };
    if (aviso) return { modo: 'disponible' };
    if (esIOS()) return { modo: 'ios' };
    return { modo: 'manual', android: esAndroid() };
  }

  async function instalar() {
    if (!aviso) return false;
    aviso.prompt();
    const r = await aviso.userChoice;
    aviso = null; G4G.bus.emit('pwa:changed');
    return r && r.outcome === 'accepted';
  }

  async function buscarActualizacion() {
    if (!registro) return false;
    await registro.update();
    return actualizacion;
  }
  function aplicarActualizacion() {
    if (registro && registro.waiting) registro.waiting.postMessage('activar');
    navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
    setTimeout(() => location.reload(), 1500);
  }

  G4G.pwa = { iniciar, estado, instalar, buscarActualizacion, aplicarActualizacion, hayActualizacion: () => actualizacion, conServiceWorker: () => !!registro, servible };
})();
