/* ==========================================================================
   Aurum80 Campo: núcleo de la app instalable para técnicos y autoridades.
   - Ingreso (solo roles 'tecnico' y 'funcionario') y descarga de la base de la jornada.
   - Cola de envío en el teléfono (muestras y fichas hechas sin señal) con reintento.
   - Barra de 5 pestañas: Muestra, Planilla, Fichas, Pendientes, Cuenta.
   Las pestañas Muestra, Planilla y Fichas viven en muestra.js, planilla.js y fichas.js y se registran aquí.
   Seguridad: todo dato externo entra al DOM como texto (G4G.util.el), nunca como HTML.
   La clave no se guarda; el token vive en sessionStorage (js/core/auth.js).
   ========================================================================== */
(function () {
  const G4G = (window.G4G = window.G4G || {});
  const U = G4G.util, el = U.el, ui = G4G.ui;

  const VERSION = 'g4g-campo-0.7.0-1';
  /* Texto para mostrar: sin el prefijo interno del caché. */
  const VERSION_TXT = VERSION.replace(/^g4g-campo-/, '');
  const K_BASE = 'g4g.campo.base.v1', K_COLA = 'g4g.campo.cola.v1', K_LOTE = 'g4g.campo.lote.v1';
  const TABS = [
    { id: 'muestra', label: 'Muestra', icono: 'muestras' },
    { id: 'planilla', label: 'Planilla', icono: 'tabla' },
    { id: 'fichas', label: 'Fichas', icono: 'ubicacion' },
    { id: 'pendientes', label: 'Pendientes', icono: 'enviar' },
    { id: 'cuenta', label: 'Cuenta', icono: 'usuario' }
  ];

  /* Iconos propios de campo (los que no existen en ui.js): cada pestaña de campo los registra con registrarIcono(). */
  const ICONOS_EXTRA = {};
  const registrarIcono = (nombre, d) => { ICONOS_EXTRA[nombre] = d; };
  function icono(nombre, size) {
    const d = ICONOS_EXTRA[nombre];
    if (!d) return ui.icon(nombre, size);
    return U.svg('svg', { viewBox: '0 0 24 24', width: size || 18, height: size || 18, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' }, U.svg('path', { d }));
  }

  /* auth.js llama a G4G.store.alCambiarSesion(): en campo no hay almacén principal. */
  G4G.store = { alCambiarSesion: async () => {} };

  /* ---- Almacenamiento local (siempre con try/catch: puede no estar disponible) ---- */
  function leerJSON(k, def) { try { const v = JSON.parse(localStorage.getItem(k)); return v === null || v === undefined ? def : v; } catch (e) { return def; } }
  function escribirJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function quitar(k) { try { localStorage.removeItem(k); } catch (e) { /* nada */ } }

  const enLinea = () => navigator.onLine !== false;
  const pad2 = (n) => String(n).padStart(2, '0');
  function hoy() { const d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function esHoy(ms) { const d = new Date(ms), h = new Date(); return d.getFullYear() === h.getFullYear() && d.getMonth() === h.getMonth() && d.getDate() === h.getDate(); }
  function horaCorta(ms) { return new Date(ms).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' }); }
  function nuevoId(prefijo, hex) {
    const b = new Uint8Array(Math.ceil(hex / 2));
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(b); else for (let i = 0; i < b.length; i++) b[i] = Math.floor(Math.random() * 256);
    return prefijo + Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('').toUpperCase().slice(0, hex);
  }
  /* Id de una ficha nueva creada en campo. Termina en LETRA a propósito: el servidor numera las fichas
     siguientes con los dígitos finales del id (PA-001, PA-002...) y así no se altera su secuencia. */
  const idFicha = (pref) => pref + '-' + nuevoId('', 5) + 'ZXKWVT'[Math.floor(Math.random() * 6)];
  const idMuestra = () => nuevoId('MU-', 8);

  /* ---- Validación de coordenadas (misma regla que js/modules/registro.js) ---- */
  function validarCoord(lat, lng) {
    const L = G4G.config.limites;
    if (lat === null || lng === null || lat === undefined || lng === undefined) return 'Faltan las coordenadas.';
    if (lat < L.latMin || lat > L.latMax || lng < L.lngMin || lng > L.lngMax) return 'Las coordenadas están fuera de Bolivia (¿latitud y longitud invertidas o sin el signo menos?).';
    return '';
  }

  /* ---- Ubicación ---- */
  let ultimaPos = null;
  function ubicacion(opts) {
    opts = opts || {};
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) { reject(new Error('Este dispositivo no permite obtener la ubicación.')); return; }
      navigator.geolocation.getCurrentPosition((p) => {
        ultimaPos = { lat: p.coords.latitude, lng: p.coords.longitude, precision: p.coords.accuracy, ms: Date.now() };
        resolve(ultimaPos);
      }, (err) => {
        reject(new Error(err.code === 1 ? 'Permiso de ubicación denegado. Actívelo en el navegador o escriba las coordenadas.'
          : err.code === 3 ? 'La ubicación tardó demasiado. Salga a cielo abierto e intente de nuevo.' : 'No se pudo obtener la ubicación.'));
      }, { enableHighAccuracy: opts.alta !== false, timeout: opts.timeout || 20000, maximumAge: opts.maximumAge || 0 });
    });
  }
  /* Posición rápida (puede ser aproximada) para ordenar listas por cercanía. Nunca lanza error. */
  async function posicionRapida() {
    if (ultimaPos && Date.now() - ultimaPos.ms < 5 * 60000) return ultimaPos;
    try { return await ubicacion({ alta: false, timeout: 8000, maximumAge: 120000 }); } catch (e) { return null; }
  }

  /* ---- Imágenes ---- */
  async function decodificar(file) {
    if (window.createImageBitmap) { try { return await createImageBitmap(file); } catch (e) { /* se usa Image */ } }
    return new Promise((resolve, reject) => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen.')); };
      img.src = url;
    });
  }
  const dimensiones = (img) => ({ w: img.naturalWidth || img.width, h: img.naturalHeight || img.height });
  /* Recorte centrado ("cover") a un lienzo del tamaño de trabajo. */
  function aLienzo(img, W, H) {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const d = dimensiones(img), r = d.w / d.h, cr = W / H;
    let sx = 0, sy = 0, sw = d.w, sh = d.h;
    if (r > cr) { sw = d.h * cr; sx = (d.w - sw) / 2; } else { sh = d.w / cr; sy = (d.h - sh) / 2; }
    c.getContext('2d', { willReadFrequently: true }).drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
    return c;
  }
  /* Imagen completa reducida (lado mayor 1280 px) como JPEG calidad 0,8. */
  function aJpeg(img, maxLado, calidad) {
    const d = dimensiones(img), k = Math.min(1, (maxLado || 1280) / Math.max(d.w, d.h));
    const c = document.createElement('canvas'); c.width = Math.round(d.w * k); c.height = Math.round(d.h * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', calidad || 0.8);
  }

  /* ======================================================================
     Base de la jornada (operadores y pasivos) para uso sin conexión.
     Solo se guarda lo necesario para elegir un lugar: no la situación legal ni los requisitos.
     ====================================================================== */
  let base = { operadores: [], pasivos: [], bajada: null, usuario: '' };
  (function () { const b = leerJSON(K_BASE, null); if (b && Array.isArray(b.operadores) && Array.isArray(b.pasivos)) base = b; })();

  const redOp = (o) => ({ id: o.id, nombre: o.nombre, tipo: o.tipo, departamento: o.departamento, municipio: o.municipio, lat: o.lat, lng: o.lng, socios: o.socios, actualizado: o.actualizado });
  const redPas = (p) => ({ id: p.id, operador_id: p.operador_id, nombre: p.nombre, tipo: p.tipo, lat: p.lat, lng: p.lng, volumen_m3: p.volumen_m3, estructura: p.estructura, uso_hg: p.uso_hg, actualizado: p.actualizado, deteccion: p.deteccion });

  function upsertLocal(tabla, reg) {
    const lista = base[tabla], i = lista.findIndex((x) => x.id === reg.id);
    if (i >= 0) lista[i] = Object.assign({}, lista[i], reg); else lista.push(reg);
  }
  function guardarBase() { return escribirJSON(K_BASE, base); }

  async function bajarBase() {
    const token = G4G.auth.token();
    let r;
    try { r = await G4G.api.completo(token); }
    catch (e) { if (e.codigo === 'sesion') G4G.auth.vencida(); throw e; }
    const ops = G4G.importer.mapear(r.operadores || [], 'operadores').registros.map(redOp);
    const pas = G4G.importer.mapear(r.pasivos || [], 'pasivos').registros.map(redPas);
    const u = G4G.auth.usuario();
    base = { operadores: ops, pasivos: pas, bajada: Date.now(), usuario: u ? u.usuario : '' };
    /* Las fichas hechas en este teléfono que aún no llegaron al servidor se vuelven a mostrar. */
    cola.filter((i) => i.tipo === 'ficha' && i.estado !== 'enviado' && i.local).forEach((i) => upsertLocal(i.tabla, i.local));
    const guardada = guardarBase();
    G4G.bus.emit('base:changed');
    return { guardada, operadores: ops.length, pasivos: pas.length };
  }

  /* ======================================================================
     Cola de envío. Cada elemento: { qid, tipo:'muestra'|'ficha', tabla, etiqueta, detalle, semaforo,
     creado, usuario, estado:'pendiente'|'enviado'|'error', error, intentos, payload, local }
     ====================================================================== */
  let cola = leerJSON(K_COLA, []);
  if (!Array.isArray(cola)) cola = [];
  cola = cola.filter((i) => i && i.qid && i.payload !== undefined);
  cola.forEach((i) => { if (i.estado === 'enviando') i.estado = 'pendiente'; });
  /* Lo enviado hace más de 2 días ya no se muestra. */
  cola = cola.filter((i) => i.estado !== 'enviado' || Date.now() - (i.enviado || i.creado) < 2 * 86400000);

  const guardarCola = () => escribirJSON(K_COLA, cola);
  guardarCola();
  const avisarCola = () => G4G.bus.emit('cola:changed');

  /* Agrega a la cola y guarda. Si no hay espacio, intenta sin la foto; si tampoco, avisa. */
  function encolar(item) {
    const u = G4G.auth.usuario();
    const it = Object.assign({ qid: nuevoId('Q-', 8), creado: Date.now(), usuario: u ? u.usuario : '', estado: 'pendiente', error: '', intentos: 0 }, item);
    cola.push(it);
    if (!guardarCola()) {
      if (it.payload && it.payload.foto) {
        it.payload = Object.assign({}, it.payload, { foto: null }); it.sinFoto = true;
        if (guardarCola()) { ui.toast('Poco espacio en el teléfono: la muestra se guardó sin la foto.', 'warn'); return it; }
      }
      cola.pop();
      throw new Error('No hay espacio en el teléfono para guardar este registro. Envíe los pendientes o libere espacio.');
    }
    return it;
  }

  let enviandoP = null;
  /* Envía en orden los registros por enviar de la cuenta actual. Se detiene si no hay señal. */
  function enviarCola(opts) {
    if (enviandoP) return enviandoP.then(() => enviarCola(opts));
    enviandoP = (async () => {
      const u = G4G.auth.usuario(), token = G4G.auth.token();
      if (!u || !token || !enLinea()) return;
      const incluirErrores = !!(opts && opts.errores), intentados = new Set();
      for (;;) {
        const it = cola.find((x) => x.usuario === u.usuario && !intentados.has(x.qid) && (x.estado === 'pendiente' || (incluirErrores && x.estado === 'error')));
        if (!it) break;
        intentados.add(it.qid);
        it.estado = 'enviando'; it.intentos = (it.intentos || 0) + 1; avisarCola();
        try {
          if (it.tipo === 'muestra') await G4G.api.guardarMuestra(token, it.payload);
          else await G4G.api.guardar(token, it.tabla, it.payload);
          it.estado = 'enviado'; it.error = ''; it.enviado = Date.now();
          if (it.payload && it.payload.foto) it.payload = Object.assign({}, it.payload, { foto: null });   // ya no hace falta
          guardarCola(); avisarCola();
        } catch (e) {
          if (!e.codigo) { it.estado = 'pendiente'; it.error = 'Sin conexión: se enviará cuando haya señal.'; guardarCola(); avisarCola(); break; }
          if (e.codigo === 'sesion') { it.estado = 'pendiente'; it.error = 'Su sesión venció. Ingrese de nuevo para enviar.'; guardarCola(); avisarCola(); G4G.auth.vencida(); break; }
          it.estado = 'error'; it.error = e.message || 'El servidor no aceptó el registro.'; guardarCola(); avisarCola();
        }
      }
    })().finally(() => { enviandoP = null; avisarCola(); });
    return enviandoP;
  }

  /* Quita un registro de la cola (la planilla lo usa al corregir una fila con error, para que no se reenvíe la versión vieja). */
  function quitarDeCola(qid) {
    const n = cola.length;
    cola = cola.filter((x) => x.qid !== qid || x.estado === 'enviando');
    if (cola.length !== n) { guardarCola(); avisarCola(); }
  }

  /* Crea el registro en la cola y lo manda sin esperar la respuesta. Devuelve el elemento de la cola. */
  function registrar(item) {
    const it = encolar(item);
    avisarCola();
    enviarCola();
    return it;
  }

  /* ======================================================================
     Estado de la jornada y navegación
     ====================================================================== */
  const vistas = {};
  const jornada = { preparando: false, aviso: '', avisoBase: '' };
  let vistaId = 'muestra';

  function registrarVista(id, def) { vistas[id] = def; }
  function tabDeHash() { const m = (location.hash || '').match(/^#\/(\w+)/); return m && TABS.some((t) => t.id === m[1]) ? m[1] : 'muestra'; }
  function navegar(id) { if (location.hash === '#/' + id) pintarVista(true); else location.hash = '#/' + id; }
  function porEnviar() { const u = G4G.auth.usuario(); return cola.filter((i) => (!u || i.usuario === u.usuario) && i.estado !== 'enviado'); }

  const $ = (id) => document.getElementById(id);

  function chipRed() {
    const on = enLinea();
    return el('span', { class: 'chip c-red ' + (on ? 'chip--ok' : 'chip--warn'), id: 'c-red', role: 'status' },
      ui.shapeSvg(on ? 'circulo' : 'triangulo', on ? '#2E7D4F' : '#B97A00', 12), on ? 'En línea' : 'Sin señal');
  }
  function actualizarRed() { const v = $('c-red'); if (v) v.replaceWith(chipRed()); const o = $('c-sinsenal'); if (o) o.hidden = enLinea(); if (vistaId === 'pendientes' && $('c-main')) pintarVista(false); }

  function cabecera() {
    return el('header', { class: 'c-head' },
      el('div', { class: 'c-head__brand' }, el('img', { class: 'c-mark', src: '../icons/logo-aurum80.svg', alt: '', width: 40, height: 40 }),
        el('div', null, el('div', { class: 'c-head__t' }, 'Aurum80 Campo'), el('div', { class: 'c-head__s', id: 'c-sub' }, ''))),
      chipRed());
  }
  function barra() {
    return el('nav', { class: 'c-tabs', 'aria-label': 'Secciones' }, TABS.map((t) => el('a', { class: 'c-tab', href: '#/' + t.id, 'data-tab': t.id, onclick: () => { if (ui.haptico) ui.haptico(8); } },
      el('span', { class: 'c-tab__ico' }, icono(t.icono, 26), el('span', { class: 'c-badge', id: 'c-badge-' + t.id, hidden: true }, '0')),
      el('span', { class: 'c-tab__txt' }, t.label))));
  }
  function marcarTab() {
    document.querySelectorAll('.c-tab').forEach((a) => {
      const on = a.getAttribute('data-tab') === vistaId;
      a.classList.toggle('is-on', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    const s = $('c-sub'); if (s) s.textContent = (vistas[vistaId] && vistas[vistaId].subtitulo) || '';
    const barraTabs = document.querySelector('.c-tabs'); if (barraTabs) { barraTabs.style.setProperty('--c-i', String(Math.max(0, TABS.findIndex((t) => t.id === vistaId)))); barraTabs.style.setProperty('--c-n', String(TABS.length)); }
    /* La planilla es una tabla: usa todo el ancho disponible (en el teléfono no cambia nada). */
    const raiz = $('c-root'); if (raiz) raiz.classList.toggle('c-root--ancha', vistaId === 'planilla');
    document.body.classList.toggle('campo-planilla', vistaId === 'planilla');
  }
  function actualizarInsignia() {
    const n = porEnviar().length, b = $('c-badge-pendientes');
    if (b) { b.textContent = n > 99 ? '99+' : String(n); b.hidden = n === 0; }
  }

  function pintar() {
    const root = $('c-root'); if (!root) return;
    U.clear(root);
    root.classList.remove('c-root--ancha'); document.body.classList.remove('campo-planilla');   // marcarTab() los vuelve a poner en la planilla
    if (jornada.preparando) { root.appendChild(pantallaPreparando()); return; }
    if (!G4G.auth.usuario()) { root.appendChild(pantallaIngreso()); return; }
    root.append(cabecera(), el('div', { class: 'c-sinsenal', id: 'c-sinsenal', hidden: enLinea() }, 'Sin señal: puede seguir trabajando. Lo que guarde se enviará solo cuando vuelva la conexión.'),
      el('main', { id: 'c-main', class: 'c-main', tabindex: '-1' }), barra());
    pintarVista(true);
  }
  function pintarVista(arriba) {
    const main = $('c-main'); if (!main) return;
    const previa = vistaId; vistaId = tabDeHash();
    U.clear(main);
    /* Entrada suave solo al cambiar de pestaña (la clase se quita sola; el CSS se apaga con movimiento reducido). */
    if (arriba && (vistaId !== previa || !main.dataset.pintada) && !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
      main.classList.remove('c-enter'); void main.offsetWidth; main.classList.add('c-enter');
      clearTimeout(main._mt); main._mt = setTimeout(() => main.classList.remove('c-enter'), 800);
    }
    main.dataset.pintada = '1';
    const v = vistas[vistaId];
    if (v) { try { v.render(main); } catch (e) { console.error(e); main.appendChild(el('div', { class: 'callout callout--warn', role: 'alert' }, 'No se pudo mostrar esta pantalla. Cierre y vuelva a abrir la aplicación.')); } }
    marcarTab(); actualizarInsignia();
    if (arriba) window.scrollTo(0, 0);
  }

  /* ======================================================================
     Pantallas: preparando, ingreso
     ====================================================================== */
  function pantallaPreparando() {
    return el('div', { class: 'c-center', role: 'status', 'aria-live': 'polite' },
      el('img', { class: 'c-mark c-mark--lg', src: '../icons/logo-aurum80.svg', alt: '', width: 64, height: 64 }),
      el('h1', null, 'Preparando la jornada'),
      el('p', { class: 'lead' }, 'Estamos descargando la lista de operadores y pasivos para que pueda trabajar también sin señal.'),
      el('div', { class: 'c-spin', 'aria-hidden': 'true' }));
  }

  function bloqueInstalar() {
    const e = G4G.pwa.estado();
    if (e.modo === 'instalada') return el('p', { class: 'muted' }, 'La aplicación ya está instalada en este teléfono.');
    if (e.modo === 'disponible') return el('button', { type: 'button', class: 'btn c-btn c-btn--block', onclick: async () => { try { await G4G.pwa.instalar(); } catch (x) { /* nada */ } } }, ui.icon('descargar', 20), 'Instalar en este teléfono');
    if (e.modo === 'ios') return el('p', { class: 'muted' }, 'En iPhone: toque el botón Compartir del navegador y elija "Agregar a inicio".');
    if (e.modo === 'archivo') return el('p', { class: 'muted' }, 'Para instalar la aplicación, ábrala desde su dirección https.');
    return el('p', { class: 'muted' }, 'Para instalar: abra el menú del navegador y elija "Instalar aplicación" o "Agregar a pantalla de inicio".');
  }

  function pantallaIngreso() {
    const aviso = el('div', { class: 'callout callout--warn', role: 'alert', hidden: !jornada.aviso }, jornada.aviso);
    const usuario = el('input', { class: 'input', id: 'c-usuario', name: 'usuario', type: 'text', autocomplete: 'username', autocapitalize: 'none', autocorrect: 'off', spellcheck: 'false', required: true });
    const clave = el('input', { class: 'input', id: 'c-clave', name: 'clave', type: 'password', autocomplete: 'current-password', required: true });
    const entrar = el('button', { type: 'submit', class: 'btn btn--primary c-btn c-btn--block' }, 'Ingresar');
    const sinServidor = !G4G.api.activo();
    const form = el('form', { class: 'c-login__form', novalidate: true, onsubmit: async (ev) => {
      ev.preventDefault();
      aviso.hidden = true;
      if (sinServidor) { aviso.textContent = 'Esta aplicación necesita la conexión con el servidor del municipio, que aún no está configurada.'; aviso.hidden = false; return; }
      if (!enLinea()) { aviso.textContent = 'Sin señal: para ingresar necesita conexión a internet. Una vez dentro, podrá trabajar sin señal.'; aviso.hidden = false; return; }
      entrar.disabled = true; entrar.textContent = 'Ingresando…';
      jornada.aviso = ''; jornada.preparando = true;
      try {
        await G4G.auth.ingresar(usuario.value, clave.value);
        clave.value = '';
        const rol = G4G.auth.rol();
        if (rol !== 'tecnico' && rol !== 'funcionario') {
          jornada.aviso = 'Su cuenta usa la aplicación Aurum80 principal. Esta aplicación es solo para técnicos de campo y autoridades.';
          jornada.preparando = false;
          await G4G.auth.salir();
          pintar();
          return;
        }
        await prepararJornada();
      } catch (e) {
        jornada.preparando = false;
        jornada.aviso = e.message || 'No se pudo ingresar.';
        pintar();
      }
    } },
      el('label', { class: 'field' }, el('span', { class: 'field__label' }, 'Usuario'), usuario),
      el('label', { class: 'field' }, el('span', { class: 'field__label' }, 'Clave'), clave),
      aviso, entrar);
    return el('div', { class: 'c-login' },
      el('div', { class: 'c-login__top' }, el('img', { class: 'c-mark c-mark--lg', src: '../icons/logo-aurum80.svg', alt: '', width: 64, height: 64 }),
        el('h1', null, 'Aurum80 Campo'),
        el('p', { class: 'lead' }, 'Ingreso de datos para técnicos de campo y autoridades.')),
      sinServidor ? el('div', { class: 'callout callout--warn' }, 'El servidor del municipio aún no está configurado: no se puede ingresar.') : null,
      form,
      el('div', { class: 'c-login__foot' }, bloqueInstalar(), el('p', { class: 'muted small' }, 'Aurum80 · Gold4Good Bolivia 2026 · Versión ' + VERSION_TXT)));
  }

  /* Tras ingresar: baja la base. Si falla pero hay una copia, se sigue con ella. */
  async function prepararJornada() {
    jornada.preparando = true; jornada.avisoBase = '';
    pintar();
    try { await bajarBase(); }
    catch (e) {
      jornada.avisoBase = base.bajada
        ? 'No se pudo actualizar la base (' + e.message + '). Se usa la última copia del ' + U.fmtDateTime(base.bajada) + '.'
        : 'No se pudo descargar la base (' + e.message + '). Puede registrar muestras como punto nuevo; use "Actualizar base" en Cuenta cuando tenga señal.';
    }
    jornada.preparando = false;
    pintar();
    enviarCola();
  }

  /* ======================================================================
     Pestaña Pendientes
     ====================================================================== */
  const ESTADO = {
    pendiente: { txt: 'Por enviar', forma: 'triangulo', color: '#B97A00', clase: 'chip--warn' },
    enviando: { txt: 'Enviando…', forma: 'triangulo', color: '#B97A00', clase: 'chip--warn' },
    enviado: { txt: 'Enviado', forma: 'circulo', color: '#2E7D4F', clase: 'chip--ok' },
    error: { txt: 'No se pudo enviar', forma: 'cuadrado', color: '#B3261E', clase: '' }
  };
  function chipEstado(estado) {
    const e = ESTADO[estado] || ESTADO.pendiente;
    return el('span', { class: 'chip ' + e.clase }, ui.shapeSvg(e.forma, e.color, 12), e.txt);
  }
  function chipSemaforo(nivel) {
    const s = G4G.config.semaforoMuestra[nivel];
    return s ? el('span', { class: 'chip c-sem c-sem--' + nivel }, ui.shapeSvg(s.forma, s.color, 12), s.label) : null;
  }

  function filaCola(it, acciones) {
    return el('li', { class: 'c-item' },
      el('div', { class: 'c-item__top' }, el('strong', { class: 'c-item__t' }, it.etiqueta || it.qid), chipEstado(it.estado)),
      el('div', { class: 'c-item__sub' }, (it.tipo === 'muestra' ? 'Muestra' : 'Ficha') + ' · ' + horaCorta(it.creado) + (it.detalle ? ' · ' + it.detalle : '')),
      it.semaforo ? el('div', { class: 'c-item__sem' }, chipSemaforo(it.semaforo)) : null,
      it.error && it.estado !== 'enviado' ? el('div', { class: 'c-item__err' + (it.estado === 'error' ? ' is-bad' : '') }, (it.estado === 'error' ? 'Motivo: ' : '') + it.error) : null,
      it.sinFoto ? el('div', { class: 'c-item__sub' }, 'Guardada sin foto por falta de espacio.') : null,
      acciones ? el('div', { class: 'c-item__acc' }, acciones) : null);
  }

  function descartar(it) {
    if (!window.confirm('¿Descartar este registro? No se enviará y no se podrá recuperar.')) return;
    cola = cola.filter((x) => x.qid !== it.qid);
    guardarCola(); avisarCola(); pintarVista(false);
  }

  function vistaPendientes(host) {
    const yo = G4G.auth.usuario().usuario;
    const lista = porEnviar(), enviadosHoy = cola.filter((i) => i.usuario === yo && i.estado === 'enviado' && esHoy(i.creado)).sort((a, b) => b.creado - a.creado);
    const ajenos = cola.filter((i) => i.usuario !== yo && i.estado !== 'enviado');
    const ocupado = !!enviandoP;
    host.appendChild(el('h2', { class: 'c-h' }, 'Pendientes'));
    host.appendChild(el('p', { class: 'lead' }, lista.length ? (lista.length === 1 ? 'Hay 1 registro por enviar.' : 'Hay ' + lista.length + ' registros por enviar.') : 'No hay nada por enviar.'));
    host.appendChild(el('button', { type: 'button', class: 'btn btn--primary c-btn c-btn--block', disabled: !lista.length || ocupado || !enLinea(), onclick: async (ev) => { ev.currentTarget.disabled = true; await enviarCola({ errores: true }); pintarVista(false); } },
      ui.icon('subir', 20), ocupado ? 'Enviando…' : 'Enviar ahora'));
    if (!enLinea() && lista.length) host.appendChild(el('div', { class: 'callout' }, 'Sin señal: se enviarán solos cuando vuelva la conexión.'));
    if (lista.length) {
      host.appendChild(el('ul', { class: 'c-list' }, lista.slice().sort((a, b) => b.creado - a.creado).map((it) => filaCola(it, [
        it.estado === 'error' ? el('button', { type: 'button', class: 'btn c-btn', onclick: () => { it.estado = 'pendiente'; guardarCola(); avisarCola(); enviarCola(); } }, 'Reintentar') : null,
        it.estado !== 'enviando' ? el('button', { type: 'button', class: 'btn btn--danger c-btn', onclick: () => descartar(it) }, 'Descartar') : null
      ]))));
    }
    host.appendChild(el('h3', { class: 'c-sec' }, 'Mis registros del día'));
    host.appendChild(enviadosHoy.length ? el('ul', { class: 'c-list' }, enviadosHoy.map((it) => filaCola(it, null)))
      : el('div', { style: { textAlign: 'center' } }, el('img', { src: '../img/vacio-datos.svg', alt: '', width: 180, height: 120, decoding: 'async', style: { display: 'block', width: 'min(180px, 56%)', maxHeight: '22vh', objectFit: 'contain', margin: '0 auto' } }), el('p', { class: 'muted' }, 'Todavía no hay registros enviados hoy.')));
    if (ajenos.length) host.appendChild(el('div', { class: 'callout' }, 'Hay ' + ajenos.length + ' registro(s) por enviar de otra cuenta. Ingrese con esa cuenta para enviarlos.'));
  }

  /* ======================================================================
     Pestaña Cuenta
     ====================================================================== */
  function vistaCuenta(host) {
    const u = G4G.auth.usuario(), rolTxt = G4G.auth.esFuncionario() ? 'Funcionario (autoridad)' : 'Técnico de campo';
    const n = porEnviar().length;
    const act = el('button', { type: 'button', class: 'btn c-btn c-btn--block', onclick: async (ev) => {
      const b = ev.currentTarget;
      if (!enLinea()) { ui.toast('Sin señal: no se puede actualizar la base ahora.', 'warn'); return; }
      b.disabled = true; b.textContent = 'Descargando…';
      try { const r = await bajarBase(); ui.toast('Base actualizada: ' + r.operadores + ' operadores y ' + r.pasivos + ' pasivos.'); jornada.avisoBase = ''; }
      catch (e) { ui.toast('No se pudo actualizar: ' + e.message, 'warn'); }
      pintarVista(false);
    } }, ui.icon('actualizar', 20), 'Actualizar base');
    host.appendChild(el('h2', { class: 'c-h' }, 'Cuenta'));
    host.appendChild(el('section', { class: 'card' }, el('div', { class: 'card__body' }, ui.dl([
      ['Usuario', u.usuario], ['Nombre', u.nombre], ['Rol', rolTxt], ['Municipio', u.municipio],
      ['Base de la jornada', base.bajada ? U.fmtDateTime(base.bajada) + ' (' + base.operadores.length + ' operadores, ' + base.pasivos.length + ' pasivos)' : 'Sin descargar'],
      ['Por enviar', String(n)]
    ]))));
    if (jornada.avisoBase) host.appendChild(el('div', { class: 'callout callout--warn', role: 'status' }, jornada.avisoBase));
    host.appendChild(act);
    host.appendChild(el('h3', { class: 'c-sec' }, 'Aplicación'));
    host.appendChild(bloqueInstalar());
    if (G4G.pwa.hayActualizacion()) host.appendChild(el('button', { type: 'button', class: 'btn c-btn c-btn--block', onclick: () => G4G.pwa.aplicarActualizacion() }, 'Hay una versión nueva: actualizar'));
    host.appendChild(el('p', { class: 'muted' }, 'Versión ' + VERSION_TXT + ' (Aurum80 ' + G4G.config.version + ')'));
    host.appendChild(el('p', { class: 'muted' }, 'Equipo Aurum80 · ' + G4G.config.evento));
    host.appendChild(el('button', { type: 'button', class: 'btn btn--danger c-btn c-btn--block', onclick: async () => {
      const aviso = n ? 'Tiene ' + n + ' registro(s) sin enviar. Seguirán guardados en este teléfono hasta que ingrese de nuevo con señal. ¿Cerrar sesión?' : '¿Cerrar sesión?';
      if (!window.confirm(aviso)) return;
      base = { operadores: [], pasivos: [], bajada: null, usuario: '' }; quitar(K_BASE);   // los datos de la base no quedan en el teléfono
      jornada.aviso = ''; jornada.avisoBase = '';
      await G4G.auth.salir();
    } }, ui.icon('salir', 20), 'Cerrar sesión'));
  }

  /* ======================================================================
     Arranque
     ====================================================================== */
  function arrancar() {
    registrarVista('pendientes', { subtitulo: 'Envío y registros del día', render: vistaPendientes });
    registrarVista('cuenta', { subtitulo: 'Cuenta y aplicación', render: vistaCuenta });

    G4G.bus.on('auth:changed', () => { if (!jornada.preparando) pintar(); });
    G4G.bus.on('cola:changed', () => { actualizarInsignia(); if (G4G.auth.usuario() && !jornada.preparando && (vistaId === 'pendientes' || vistaId === 'cuenta')) pintarVista(false); });
    G4G.bus.on('pwa:changed', () => { if (G4G.auth.usuario() && vistaId === 'cuenta' && !jornada.preparando) pintarVista(false); else if (!G4G.auth.usuario() && !jornada.preparando) pintar(); });
    window.addEventListener('hashchange', () => { if (G4G.auth.usuario() && !jornada.preparando) pintarVista(true); });
    window.addEventListener('online', () => { actualizarRed(); enviarCola(); });
    window.addEventListener('offline', actualizarRed);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { actualizarRed(); enviarCola(); } });

    G4G.pwa.iniciar();   // registra sw.js (alcance /campo/)
    pintar();
    if (G4G.auth.usuario()) {
      enviarCola();
      /* Con sesión abierta y señal, se refresca la base si no hay copia o tiene más de 12 horas. */
      if (enLinea() && (!base.bajada || Date.now() - base.bajada > 12 * 3600e3)) bajarBase().then(() => { if (vistaId === 'muestra' || vistaId === 'fichas' || vistaId === 'cuenta') pintarVista(false); }).catch(() => {});
    }
  }

  G4G.campo = {
    VERSION, TABS, el, ui, U, enLinea, hoy, esHoy, nuevoId, idFicha, idMuestra, validarCoord,
    ubicacion, posicionRapida, decodificar, aLienzo, aJpeg,
    getBase: () => base, upsertLocal, guardarBase, bajarBase,
    registrar, encolar, quitarDeCola, enviarCola, chipSemaforo, chipEstado, icono, registrarIcono,
    leerLote: () => leerJSON(K_LOTE, ''), guardarLote: (v) => escribirJSON(K_LOTE, String(v || '')),
    registrarVista, navegar, repintar: (arriba) => pintarVista(!!arriba), vistaActual: () => vistaId, itemDeCola: (qid) => cola.find((i) => i.qid === qid) || null,
    avisoBase: () => jornada.avisoBase, arrancar
  };
})();
