/* ==========================================================================
   Movimiento: transiciones entre pantallas, entradas escalonadas, indicador de la
   barra inferior, barra de progreso y contadores numéricos.
   Principios: solo transform y opacity (los contadores cambian texto, nada más);
   todo se apaga con prefers-reduced-motion; ninguna animación deja contenido oculto:
   las entradas son CSS con estado final visible y esta clase se quita sola.
   Si este archivo falla o no carga, la aplicación funciona igual, sin movimiento.
   API (G4G.motion): transicion, entrar, indicador, progreso, contadores, vibrar, reducido.
   Para desactivar a mano las transiciones entre pantallas: G4G.motion.usarTransiciones = false.
   ========================================================================== */
(function () {
  const G4G = (window.G4G = window.G4G || {});
  const U = G4G.util;
  const doc = document.documentElement;
  const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const reducido = () => !!(mq && mq.matches);
  const esMovil = () => !!(window.matchMedia && window.matchMedia('(max-width: 860px)').matches);

  const M = { usarTransiciones: true, reducido };
  const vistos = new Set(); // vistas que ya hicieron su entrada escalonada

  /* Clase temporal: se agrega y se quita sola (por tiempo, no depende de animationend). */
  function temporal(nodo, clases, ms) {
    nodo.classList.add(...clases);
    clearTimeout(nodo._mt);
    nodo._mt = setTimeout(() => nodo.classList.remove(...clases), ms);
  }

  /* ---- Vibración corta (solo con soporte, tras un toque real y sin movimiento reducido) ---- */
  M.vibrar = (ms) => { if (G4G.ui && G4G.ui.haptico) G4G.ui.haptico(ms); };

  /* ---- Barra de progreso fina (sincronización y cambio de pantalla) ---- */
  const tareas = new Set();
  let barra = null;
  function pintarBarra() {
    if (!barra) {
      barra = U.el('div', { class: 'm-progress', 'aria-hidden': 'true' }, U.el('span', { class: 'm-progress__bar' }));
      document.body.appendChild(barra);
    }
    const on = tareas.size > 0;
    barra.classList.toggle('is-on', on);
    barra.classList.toggle('is-nav', on && tareas.size === 1 && tareas.has('nav'));
  }
  M.progreso = function (clave, activo, maxMs) {
    if (reducido()) return;
    if (activo) {
      tareas.add(clave);
      /* Seguro: una tarea que nunca avisa que terminó no deja la barra encendida para siempre. */
      clearTimeout(M.progreso['t' + clave]);
      M.progreso['t' + clave] = setTimeout(() => { tareas.delete(clave); pintarBarra(); }, maxMs || 25000);
    } else { tareas.delete(clave); clearTimeout(M.progreso['t' + clave]); }
    pintarBarra();
  };
  function sincronizacion() {
    const c = G4G.store && G4G.store.state && G4G.store.state.conexion;
    M.progreso('sync', !!c && c.modo === 'cargando');
  }

  /* ---- Pastilla dorada de la barra inferior (celular): se desliza bajo el acceso activo ---- */
  M.indicador = function (nav) {
    nav = nav || document.querySelector('.nav');
    const ind = nav && nav.querySelector('.nav__ind');
    if (!ind) return;
    const act = Array.from(nav.querySelectorAll('.is-active')).find((n) => n.offsetWidth > 0);
    if (!act || !esMovil()) { nav.classList.remove('nav--ind'); return; }
    const primero = !nav.classList.contains('nav--ind');
    if (primero) ind.classList.add('is-jump'); // la primera colocación no se desliza desde el borde
    nav.style.setProperty('--ind-x', act.offsetLeft + 'px'); nav.style.setProperty('--ind-w', act.offsetWidth + 'px');
    nav.classList.add('nav--ind');
    if (primero) { void ind.offsetWidth; ind.classList.remove('is-jump'); }
  };
  let tResize = 0;
  window.addEventListener('resize', () => { clearTimeout(tResize); tResize = setTimeout(() => M.indicador(), 120); });

  /* ---- Entrada escalonada de los bloques de una vista ---- */
  /* Si la vista tiene un solo bloque envolvente, se escalonan los hijos de ese bloque. */
  function contenedor(sec) {
    let c = sec;
    for (let i = 0; i < 2; i++) {
      const hijos = Array.from(c.children).filter((n) => !n.hidden);
      if (hijos.length === 1 && hijos[0].children.length > 1 && !hijos[0].matches('.mapview, .leaflet-container')) c = hijos[0]; else break;
    }
    return c;
  }
  /* mod: módulo de app.js; o: { vt, inicial } */
  M.entrar = function (mod, o) {
    o = o || {};
    const sec = mod && mod.seccion;
    if (!sec || reducido()) return;
    const primera = !vistos.has(mod.id);
    if (mod.full) { if (!o.vt && !o.inicial) temporal(sec, ['is-entering', 'is-entering--fade'], 420); return; } // el mapa no se anima
    vistos.add(mod.id);
    if (!o.vt && !o.inicial) temporal(sec, primera ? ['is-entering', 'is-entering--fade'] : ['is-entering'], 420);
    if (primera) temporal(contenedor(sec), o.vt ? ['m-enter', 'm-enter--vt'] : ['m-enter'], 900);
  };

  /* ---- Transición entre pantallas ----
     aplicar(): cambia la pantalla (app.js). info: { desde, hacia } (módulos).
     Con View Transitions (si existen); si no, fundido + subida de 10 px en la sección nueva.
     Sin animación: primera carga, misma sección, movimiento reducido. Con el mapa (a pantalla completa) solo fundido. */
  M.transicion = function (aplicar, info) {
    const desde = info && info.desde, hacia = info && info.hacia;
    if (reducido() || !desde || !hacia) { aplicar(); if (hacia && !desde) M.entrar(hacia, { inicial: true }); return; }
    if (desde.id === hacia.id) { aplicar(); return; }
    const conMapa = !!(desde.full || hacia.full);
    if (M.usarTransiciones && !conMapa && typeof document.startViewTransition === 'function' && document.visibilityState === 'visible') {
      M.progreso('nav', true, 1500);
      doc.classList.add('m-vt');
      let vt = null;
      try {
        vt = document.startViewTransition(() => { aplicar(); M.entrar(hacia, { vt: true }); });
      } catch (e) { vt = null; }
      if (vt) {
        const fin = () => { doc.classList.remove('m-vt'); M.progreso('nav', false); };
        vt.finished.then(fin, fin);
        vt.ready.catch(() => {});
        vt.updateCallbackDone.catch((e) => console.error(e));
        return;
      }
      doc.classList.remove('m-vt'); M.progreso('nav', false);
    }
    aplicar();
    M.entrar(hacia, {});
    M.progreso('nav', true, 600); setTimeout(() => M.progreso('nav', false), 520);
  };

  /* ---- Contadores: de 0 al valor (600 ms) solo si el texto es un entero puro ---- */
  const previos = new Map(); // clave de posición -> último texto visto (no repite la animación con el mismo valor)
  const pend = new WeakMap();
  let io = null;
  const ES_ENTERO = /^\d+$|^\d{1,3}([.  ]\d{3})+$/;
  function animar(n) {
    const info = pend.get(n); if (!info) return;
    pend.delete(n);
    if (!n.isConnected) return;
    const t0 = performance.now(), dur = 600;
    n.textContent = U.fmt(0);
    function paso(ahora) {
      if (!n.isConnected) return;
      const p = Math.min(1, (ahora - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      n.textContent = p >= 1 ? info.txt : U.fmt(Math.round(info.valor * e));
      if (p < 1) requestAnimationFrame(paso);
    }
    requestAnimationFrame(paso);
    setTimeout(() => { if (n.textContent !== info.txt) n.textContent = info.txt; }, dur + 400); // el valor final siempre es el real
  }
  M.contadores = function (raiz) {
    if (reducido() || !raiz) return;
    const veces = {};
    raiz.querySelectorAll('.kpi__value, .stat-link__n, .banner-link__n, .akpi__value').forEach((n) => {
      if (n.children.length) return;
      const txt = n.textContent.trim();
      if (!ES_ENTERO.test(txt)) return;
      const valor = parseInt(txt.replace(/\D/g, ''), 10);
      const base = (raiz.id || '') + '|' + n.className;
      veces[base] = (veces[base] || 0) + 1;
      const clave = base + '|' + veces[base];
      const antes = previos.get(clave);
      previos.set(clave, txt);
      if (antes === txt || !(valor >= 2) || valor > 1e7) return;
      pend.set(n, { valor, txt });
      if (!('IntersectionObserver' in window)) { animar(n); return; }
      if (!io) io = new IntersectionObserver((es) => es.forEach((x) => { if (x.isIntersecting) { io.unobserve(x.target); animar(x.target); } }), { threshold: 0.2 });
      io.observe(n);
    });
  };

  /* ---- Arranque ---- */
  function iniciar() {
    sincronizacion();
    if (G4G.bus) G4G.bus.on('conexion:changed', sincronizacion);
    document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('.nav a, .nav__mas')) M.vibrar(8); }, { passive: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();

  G4G.motion = M;
})();
