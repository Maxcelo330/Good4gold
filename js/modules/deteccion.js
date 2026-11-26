/* Módulo: Detecciones revisadas (solo funcionarios).
   Muestra en un mapa y en una lista las zonas que una persona marcó como
   "Parece actividad minera" en el visor de imágenes satelitales.

   CONFIDENCIAL (decisión D-002): son zonas "por verificar". Este archivo NO trae
   datos; las zonas entran por:
     (a) el botón "Cargar archivo de zonas (GeoJSON)": se lee un archivo local y se
         guarda solo en este dispositivo (localStorage, clave g4g_zonas_revisadas_v1);
     (b) G4G.config.deteccion.url (opcional): dirección de un GeoJSON publicado;
     (c) la variable global opcional window.G4G_ZONAS_REVISADAS (FeatureCollection),
         por si alguien agrega un archivo js/data/zonas-revisadas.js (no se incluye).
   Al estar en el grupo 'tecnico', la sección no se construye ni se muestra sin sesión. */
(function () {
  const G4G = (window.G4G = window.G4G || {});
  const U = G4G.util, { el } = U;
  const ui = () => G4G.ui;

  const CLAVE = 'g4g_zonas_revisadas_v1';
  const MAX_BYTES = 15 * 1024 * 1024;
  const AVISO = 'Posible actividad minera revisada por una persona sobre imagen satelital de 20 m: por verificar en campo; registro AJAM aún no consultado. No indica legalidad ni presencia de mercurio.';
  const MOTIVOS = {
    no_feature: 'que no eran una zona (Feature)',
    sin_geometria: 'con geometría no admitida (solo Polygon y MultiPolygon con coordenadas válidas)',
    sin_id: 'sin identificador (id)',
    id_repetido: 'con identificador repetido'
  };
  const VEREDICTOS = { probable_mineria: ['Parece actividad minera', 'n2'], dudoso: ['Dudosa', 'n3'], probable_no_mineria: ['No parece actividad minera', 'n4'] };
  const COLOR = { linea: '#E0A82A', relleno: '#B07D14', sel: '#FFFFFF' };

  let raiz = null, map = null, base = null, grupo = null, capas = new Map();
  let datos = null;                       // { features, generado, aviso, cargado, archivo, origen, descartadas, motivos, fuera, deDispositivo }
  let seleccion = null;
  let orden = { clave: 'puntaje', dir: -1 };
  let estadoUrl = '';                     // texto de estado de la descarga por URL
  let listaHost = null, badge = null;

  /* ---------------- Validación ---------------- */
  const posOk = (p) => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90;
  const anilloOk = (r) => Array.isArray(r) && r.length >= 4 && r.every(posOk);
  const poligonoOk = (rs) => Array.isArray(rs) && rs.length >= 1 && rs.every(anilloOk);
  function geometriaOk(g) {
    if (!g || typeof g !== 'object') return false;
    if (g.type === 'Polygon') return poligonoOk(g.coordinates);
    if (g.type === 'MultiPolygon') return Array.isArray(g.coordinates) && g.coordinates.length >= 1 && g.coordinates.every(poligonoOk);
    return false;
  }
  function posiciones(g) {
    const polis = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    const out = [];
    polis.forEach((rs) => rs.forEach((r) => r.forEach((p) => out.push(p))));
    return out;
  }
  function centroDe(f) {
    const p = f.properties || {};
    const lat = U.parseNum(p.lat), lng = U.parseNum(p.lng);
    if (lat != null && lng != null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
    const ps = posiciones(f.geometry);
    const xs = ps.map((q) => q[0]), ys = ps.map((q) => q[1]);
    return { lat: (Math.min(...ys) + Math.max(...ys)) / 2, lng: (Math.min(...xs) + Math.max(...xs)) / 2 };
  }

  /* Revisa un objeto GeoJSON. No lanza: devuelve { error } o el resultado. */
  function validar(obj) {
    if (!obj || typeof obj !== 'object' || obj.type !== 'FeatureCollection' || !Array.isArray(obj.features)) {
      return { error: 'El archivo no es una colección de zonas (GeoJSON de tipo FeatureCollection).' };
    }
    const vistos = new Set(), validas = [], motivos = {};
    let fuera = 0;
    const lim = G4G.config.limites;
    const descartar = (m) => { motivos[m] = (motivos[m] || 0) + 1; };
    obj.features.forEach((f) => {
      if (!f || f.type !== 'Feature') return descartar('no_feature');
      if (!geometriaOk(f.geometry)) return descartar('sin_geometria');
      const id = f.properties && f.properties.id != null ? String(f.properties.id).trim() : '';
      if (!id) return descartar('sin_id');
      if (vistos.has(id)) return descartar('id_repetido');
      vistos.add(id);
      const props = Object.assign({}, f.properties, { id });
      const c = centroDe({ geometry: f.geometry, properties: props });
      if (lim && (c.lat < lim.latMin || c.lat > lim.latMax || c.lng < lim.lngMin || c.lng > lim.lngMax)) fuera++;
      validas.push({ type: 'Feature', geometry: f.geometry, properties: props });
    });
    const descartadas = Object.values(motivos).reduce((a, b) => a + b, 0);
    if (!validas.length) return { error: `El archivo no trae ninguna zona válida${descartadas ? ` (${descartadas} ignorada${descartadas > 1 ? 's' : ''})` : ''}.` };
    return {
      features: validas, descartadas, motivos, fuera,
      generado: typeof obj.generado === 'string' ? obj.generado : null,
      aviso: typeof obj.aviso === 'string' ? obj.aviso : null
    };
  }

  /* ---------------- Almacenamiento (solo este dispositivo) ---------------- */
  function leerGuardado() {
    try {
      const txt = localStorage.getItem(CLAVE);
      if (!txt) return null;
      const r = JSON.parse(txt);
      const v = validar({ type: 'FeatureCollection', features: r.features });
      if (v.error) return null;
      return Object.assign(v, { generado: r.generado || null, aviso: r.aviso || null, cargado: r.cargado, archivo: r.archivo, origen: r.origen, descartadas: r.descartadas || 0, motivos: r.motivos || {}, fuera: r.fuera || 0, deDispositivo: true });
    } catch (e) { return null; }
  }
  /* Devuelve true si quedó guardado en el dispositivo. */
  function guardar(d) {
    try {
      localStorage.setItem(CLAVE, JSON.stringify({ v: 1, generado: d.generado, aviso: d.aviso, cargado: d.cargado, archivo: d.archivo, origen: d.origen, descartadas: d.descartadas, motivos: d.motivos, fuera: d.fuera, features: d.features }));
      return true;
    } catch (e) { return false; }
  }
  function quitarGuardado() { try { localStorage.removeItem(CLAVE); } catch (e) { /* nada */ } }

  function cargarFuente() {
    datos = leerGuardado();
    if (!datos && window.G4G_ZONAS_REVISADAS) {
      const v = validar(window.G4G_ZONAS_REVISADAS);
      if (!v.error) datos = Object.assign(v, { cargado: null, archivo: 'Incluido con la aplicación', origen: 'sitio', deDispositivo: false });
    }
  }

  /* Acepta un objeto ya leído: valida, guarda y muestra. */
  function incorporar(obj, archivo, origen) {
    const v = validar(obj);
    if (v.error) { ui().toast(v.error, 'warn'); return false; }
    const d = Object.assign(v, { cargado: Date.now(), archivo, origen, deDispositivo: true });
    const guardado = guardar(d);
    datos = d; seleccion = null;
    const ign = d.descartadas ? ` ${d.descartadas} ignorada${d.descartadas > 1 ? 's' : ''} por no ser válida${d.descartadas > 1 ? 's' : ''}.` : '';
    if (guardado) ui().toast(`Se cargaron ${d.features.length} zona${d.features.length > 1 ? 's' : ''} de "${archivo}".${ign} Quedan solo en este dispositivo.`);
    else ui().toast(`Se cargaron ${d.features.length} zonas, pero no caben en el almacenamiento de este dispositivo (límite del navegador, cerca de 5 MB): se ven ahora y se perderán al recargar la página. Cargue un archivo más pequeño.`, 'warn');
    pintar();
    return true;
  }

  async function alElegirArchivo(file) {
    if (!file) return;
    if (file.size > MAX_BYTES) { ui().toast('El archivo pesa más de 15 MB; es demasiado grande para este dispositivo.', 'warn'); return; }
    let obj;
    try { obj = JSON.parse(await file.text()); }
    catch (e) { ui().toast('No se pudo leer "' + file.name + '": no es un archivo GeoJSON válido.', 'warn'); return; }
    incorporar(obj, file.name, 'archivo');
  }

  /* Descarga opcional desde G4G.config.deteccion.url */
  const urlConfigurada = () => ((G4G.config.deteccion || {}).url || '').trim();
  async function traerDeUrl() {
    const url = urlConfigurada();
    if (!url) return;
    estadoUrl = 'Descargando las zonas…'; actualizarEstadoUrl();
    const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 30000);
    try {
      const res = await fetch(url, { cache: 'no-store', signal: ctrl.signal });
      if (!res.ok) throw new Error('El servidor respondió con error (HTTP ' + res.status + ').');
      const obj = await res.json();
      estadoUrl = '';
      let host = url; try { host = new URL(url, location.href).host || url; } catch (e) { /* nada */ }
      incorporar(obj, host, 'url');
    } catch (e) {
      estadoUrl = e.name === 'AbortError' ? 'La descarga tardó demasiado.' : (e instanceof SyntaxError ? 'La dirección no devolvió un GeoJSON válido.' : (e instanceof TypeError ? 'Sin conexión con la dirección configurada.' : e.message));
      actualizarEstadoUrl();
      ui().toast('No se pudieron traer las zonas: ' + estadoUrl, 'warn');
    } finally { clearTimeout(t); }
  }
  function actualizarEstadoUrl() {
    const n = raiz && raiz.querySelector('[data-estado-url]');
    if (n) n.textContent = estadoUrl;
  }

  /* ---------------- Filas y formato ---------------- */
  function filas() {
    return datos.features.map((f) => {
      const p = f.properties, c = centroDe(f);
      return { f, id: p.id, origen: p.origen || '', area: U.parseNum(p.area_ha), puntaje: U.parseNum(p.puntaje_modelo), poblado: p.poblado_cercano || '', pobladoM: U.parseNum(p.dist_poblado_m), rio: U.parseNum(p.dist_rio_m), fecha: p.fecha_revision || '', nota: p.nota_revision || '', lat: c.lat, lng: c.lng };
    });
  }
  function fmtFecha(s) {
    if (!s) return '—';
    const m = String(s).match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/);
    return m ? `${U.fmtDate(m[1])} ${m[2]}` : U.fmtDate(String(s).slice(0, 10));
  }
  const metros = (n) => (n == null ? '—' : U.fmt(n) + ' m');
  const ORDENES = [
    ['puntaje', -1, 'Puntaje (mayor primero)'], ['area', -1, 'Área (mayor primero)'], ['rio', 1, 'Más cerca de un río'],
    ['fecha', -1, 'Revisión más reciente'], ['id', 1, 'Zona (A a Z)'], ['poblado', 1, 'Poblado (A a Z)']
  ];
  function ordenadas() {
    const k = orden.clave, d = orden.dir;
    return filas().sort((a, b) => {
      const va = a[k], vb = b[k];
      if (va == null || va === '') return vb == null || vb === '' ? 0 : 1;
      if (vb == null || vb === '') return -1;
      return (typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'es', { numeric: true })) * d;
    });
  }

  /* ---------------- Descargas ---------------- */
  const sello = () => new Date().toISOString().slice(0, 10).replace(/-/g, '');
  function descargarGeoJSON() {
    const fc = { type: 'FeatureCollection', generado: datos.generado, aviso: datos.aviso || AVISO, features: datos.features };
    U.download(`detecciones-revisadas-${sello()}.geojson`, 'application/geo+json;charset=utf-8', JSON.stringify(fc));
    ui().toast('GeoJSON descargado. Es un dato confidencial: guárdelo con cuidado.');
  }
  /* Evita que Excel interprete un texto como fórmula. */
  const seguro = (s) => { s = s == null ? '' : String(s); return /^[=+\-@\t\r]/.test(s) ? "'" + s : s; };
  function descargarCSV() {
    const cols = [
      { label: 'id', get: (r) => seguro(r.id) }, { label: 'origen', get: (r) => seguro(r.origen) },
      { label: 'lat', get: (r) => r.lat }, { label: 'lng', get: (r) => r.lng },
      { label: 'area_ha', get: (r) => r.area }, { label: 'puntaje_modelo', get: (r) => r.puntaje },
      { label: 'poblado_cercano', get: (r) => seguro(r.poblado) }, { label: 'dist_rio_m', get: (r) => r.rio },
      { label: 'dist_poblado_m', get: (r) => r.pobladoM }, { label: 'fecha_revision', get: (r) => seguro(r.fecha) },
      { label: 'nota_revision', get: (r) => seguro(r.nota) }
    ];
    U.download(`detecciones-revisadas-${sello()}.csv`, 'text/csv;charset=utf-8', U.toCSV(ordenadas(), cols));
    ui().toast('CSV descargado. Es un dato confidencial: guárdelo con cuidado.');
  }

  /* ---------------- Mapa ---------------- */
  const iconoZona = (sel) => L.divIcon({
    className: 'mk', iconSize: [40, 40], iconAnchor: [20, 20],
    html: `<svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><path d="M20 8 L32 20 L20 32 L8 20 Z" fill="${COLOR.relleno}" stroke="${sel ? '#1D1B18' : '#fff'}" stroke-width="${sel ? 3.5 : 2.5}" stroke-linejoin="round"/><circle cx="20" cy="20" r="2.6" fill="#fff"/></svg>`
  });
  const estiloPoli = (sel) => (sel
    ? { color: COLOR.sel, weight: 4, opacity: 1, fillColor: COLOR.relleno, fillOpacity: 0.5 }
    : { color: COLOR.linea, weight: 2.5, opacity: 1, fillColor: COLOR.relleno, fillOpacity: 0.28 });

  function dibujarMapa(lista, mapaDiv) {
    map = L.map(mapaDiv, { zoomControl: false, center: G4G.config.mapa.centro, zoom: G4G.config.mapa.zoom });
    L.control.zoom({ position: 'topright' }).addTo(map);
    base = G4G.basemap.crear(map, { porDefecto: 1, onEstado: (ok) => { if (badge) badge.hidden = ok; } });
    grupo = L.featureGroup().addTo(map);
    capas = new Map();
    lista.forEach((r) => {
      const tip = `<strong>Zona ${U.esc(r.id)}</strong><br>${r.area == null ? '' : U.fmt(r.area, 1) + ' ha · '}posible actividad minera, por verificar`;
      const poli = L.geoJSON(r.f.geometry, { style: () => estiloPoli(false) });
      poli.bindTooltip(tip, { sticky: true });
      const mk = L.marker([r.lat, r.lng], { icon: iconoZona(false), title: 'Zona ' + r.id, keyboard: true, riseOnHover: true, zIndexOffset: 300 });
      mk.bindTooltip(tip, { direction: 'top', offset: [0, -14] });
      const abrir = () => seleccionar(r.id, { ficha: true });
      poli.on('click', abrir); mk.on('click', abrir);
      grupo.addLayer(poli); grupo.addLayer(mk);
      capas.set(r.id, { poli, mk });
    });
    verTodas(false);
  }
  function verTodas(animar) {
    if (!map || !grupo) return;
    const b = grupo.getBounds();
    if (!b.isValid()) return;
    map.invalidateSize();
    if (animar) map.flyToBounds(b, { padding: [40, 40], maxZoom: 15, duration: 0.8 });
    else map.fitBounds(b, { padding: [40, 40], maxZoom: 15 });
  }

  /* ---------------- Selección y ficha ---------------- */
  function seleccionar(id, opc = {}) {
    const fila = filas().find((r) => r.id === id);
    if (!fila) return;
    if (seleccion && capas.has(seleccion)) { const c = capas.get(seleccion); c.poli.setStyle(estiloPoli(false)); c.mk.setIcon(iconoZona(false)); c.mk.setZIndexOffset(300); }
    seleccion = id;
    const c = capas.get(id);
    if (c) {
      c.poli.setStyle(estiloPoli(true)); c.poli.bringToFront();
      c.mk.setIcon(iconoZona(true)); c.mk.setZIndexOffset(900);
      map.flyToBounds(c.poli.getBounds(), { padding: [60, 60], maxZoom: 16, duration: 0.8 });
    }
    if (listaHost) {
      listaHost.querySelectorAll('tr[data-id]').forEach((tr) => tr.classList.toggle('is-selected', tr.dataset.id === id));
      const tr = listaHost.querySelector(`tr[data-id="${CSS.escape(id)}"]`);
      if (tr && !opc.ficha) tr.scrollIntoView({ block: 'nearest' });
    }
    if (opc.ficha) ficha(fila);
  }

  function opinion(o) {
    if (!o || typeof o !== 'object') return el('p', { class: 'muted' }, 'Sin opinión de Claude para esta zona.');
    const v = VEREDICTOS[o.veredicto] || [o.veredicto || 'Sin veredicto', 'n4'];
    return el('div', { class: 'zficha__op' },
      el('div', { class: 'row-gap' }, el('span', { class: 'chip chip--clase ' + v[1] }, v[0]), o.confianza ? el('span', { class: 'muted small' }, 'Confianza ' + o.confianza) : null),
      o.que_parece ? el('p', null, o.que_parece) : null,
      el('p', { class: 'muted small' }, 'Es una lectura automática de apoyo; la decisión es de la persona que revisa.'));
  }

  function ficha(r) {
    const p = r.f.properties;
    const body = el('div', { class: 'zficha' },
      el('div', { class: 'note' }, ui().icon('alerta', 15), el('span', null, AVISO)),
      el('div', { class: 'row-gap' }, el('span', { class: 'chip chip--warn' }, 'Posible actividad minera'), el('span', { class: 'chip' }, 'Por verificar en campo')),
      el('div', { class: 'scorepair' },
        el('div', null, el('div', { class: 'scorepair__label' }, 'Área'), el('div', { class: 'scorepair__value' }, r.area == null ? '—' : U.fmt(r.area, 1), el('small', null, 'ha'))),
        el('div', null, el('div', { class: 'scorepair__label' }, 'Puntaje del modelo'), el('div', { class: 'scorepair__value' }, r.puntaje == null ? '—' : U.fmt(r.puntaje), el('small', null, '/100')), r.puntaje == null ? null : ui().meter(r.puntaje, 100, { tone: 'value' }))),
      el('p', { class: 'muted small' }, 'Puntaje relativo, no es una probabilidad: sirve para ordenar zonas, no para afirmar que hay minería.'),
      el('h4', null, 'Ubicación'),
      ui().dl([
        ['Coordenadas', el('span', { class: 'mono' }, U.fmtCoord(r.lat, r.lng))],
        ['Poblado cercano', r.poblado ? (r.pobladoM == null ? r.poblado : `${r.poblado}, a ${U.fmt(r.pobladoM)} m`) : (r.pobladoM == null ? null : `a ${U.fmt(r.pobladoM)} m`)],
        ['Distancia a un río', r.rio == null ? null : (r.rio === 0 ? '0 m (junto al cauce o sobre él)' : U.fmt(r.rio) + ' m')]]),
      el('h4', null, 'Revisión'),
      ui().dl([
        ['Origen', r.origen], ['Fecha de revisión', fmtFecha(r.fecha)], ['Cómo se detectó', p.deteccion],
        ['Estado de verificación', p.estado_verificacion || 'Por verificar en campo; registro AJAM aún no consultado']]),
      el('h4', null, 'Nota de la persona que revisó'),
      r.nota ? el('p', { class: 'zficha__nota' }, r.nota) : el('p', { class: 'muted' }, 'Sin nota.'),
      el('h4', null, 'Opinión de Claude'),
      opinion(p.opinion_claude));
    ui().drawer.open({
      kicker: 'Detección revisada', title: 'Zona ' + r.id, subtitle: 'Parece actividad minera, por verificar', body,
      footer: [ui().button('Ver en el mapa', { icon: 'mapa', onclick: () => {
        ui().drawer.close();
        const w = raiz.querySelector('.zmap-wrap'); if (w) w.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (map && capas.get(r.id)) map.flyToBounds(capas.get(r.id).poli.getBounds(), { padding: [60, 60], maxZoom: 16, duration: 0.8 });
      } })]
    });
  }

  /* ---------------- Lista ordenable ---------------- */
  function pintarLista() {
    if (!listaHost) return;
    const cols = [
      ['id', 'Zona', (r) => el('span', { class: 'cell-main' }, r.id)],
      ['origen', 'Origen', (r) => r.origen || '—'],
      ['area', 'Área (ha)', (r) => (r.area == null ? '—' : U.fmt(r.area, 1)), true],
      ['puntaje', 'Puntaje del modelo', (r) => (r.puntaje == null ? '—' : el('div', { class: 'progress progress--sm' }, ui().meter(r.puntaje, 100, { tone: 'value' }), el('span', null, U.fmt(r.puntaje)))), true],
      ['poblado', 'Poblado cercano', (r) => r.poblado || '—'],
      ['rio', 'Distancia a un río', (r) => metros(r.rio), true],
      ['fecha', 'Revisión', (r) => fmtFecha(r.fecha)]
    ];
    const rows = ordenadas();
    const thead = el('thead', null, el('tr', null, cols.map(([k, label, , num]) => el('th', {
      class: (num ? 'num ' : '') + 'sortable ' + (orden.clave === k ? 'sorted' : ''), tabindex: 0, 'aria-sort': orden.clave === k ? (orden.dir === 1 ? 'ascending' : 'descending') : null,
      onclick: () => cambiarOrden(k), onkeydown: (e) => { if (e.key === 'Enter') cambiarOrden(k); }
    }, label, orden.clave === k ? el('span', { class: 'sort-mark' }, orden.dir === 1 ? ' ▲' : ' ▼') : null))));
    const tbody = el('tbody', null, rows.map((r) => el('tr', {
      class: 'clickable' + (seleccion === r.id ? ' is-selected' : ''), 'data-id': r.id, tabindex: 0,
      onclick: () => seleccionar(r.id, { ficha: true }), onkeydown: (e) => { if (e.key === 'Enter') seleccionar(r.id, { ficha: true }); }
    }, cols.map(([k, label, fn, num]) => el('td', { class: (num ? 'num ' : '') + 'zc-' + k, 'data-label': label }, fn(r))))));
    U.clear(listaHost);
    listaHost.appendChild(el('table', { class: 'tbl ztbl' }, thead, tbody));
    const sel = raiz.querySelector('select[data-orden]');
    if (sel) sel.value = orden.clave + ':' + orden.dir;
  }
  function cambiarOrden(clave, dir) {
    if (dir != null) orden = { clave, dir };
    else if (orden.clave === clave) orden = { clave, dir: -orden.dir };
    else orden = { clave, dir: (ORDENES.find((o) => o[0] === clave) || [0, 1])[1] };
    pintarLista();
  }

  /* ---------------- Pantalla ---------------- */
  function botones() {
    const input = el('input', { type: 'file', accept: '.geojson,.json,application/geo+json,application/json', class: 'visually-hidden', id: 'archivo-zonas', onchange: (e) => { alElegirArchivo(e.target.files[0]); e.target.value = ''; } });
    const b = [
      el('label', { class: 'btn btn--primary', for: 'archivo-zonas', tabindex: 0, onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } } }, ui().icon('subir', 16), 'Cargar archivo de zonas (GeoJSON)'), input
    ];
    if (datos) {
      b.push(ui().button('Descargar GeoJSON', { icon: 'descargar', onclick: descargarGeoJSON }), ui().button('Descargar CSV', { icon: 'descargar', onclick: descargarCSV }));
    }
    if (urlConfigurada()) b.push(ui().button('Actualizar desde la dirección configurada', { onclick: traerDeUrl }));
    if (datos && datos.deDispositivo) {
      b.push(ui().button('Quitar las zonas de este dispositivo', { kind: 'danger', onclick: () => {
        if (!confirm('¿Quitar las zonas guardadas en este dispositivo? El archivo original no se borra y puede volver a cargarse.')) return;
        quitarGuardado(); datos = null; seleccion = null; cargarFuente();
        ui().toast('Se quitaron las zonas de este dispositivo.'); pintar();
      } }));
    }
    return el('div', { class: 'row-gap zacciones' }, b, el('span', { class: 'muted small', 'data-estado-url': '' }, estadoUrl));
  }

  function informeCarga() {
    const partes = [];
    if (datos.cargado) partes.push(`Cargado el ${U.fmtDateTime(datos.cargado)} desde "${datos.archivo}".`);
    else partes.push(`Origen: ${datos.archivo}.`);
    partes.push(`${datos.features.length} zona${datos.features.length > 1 ? 's' : ''} válida${datos.features.length > 1 ? 's' : ''}.`);
    if (datos.descartadas) partes.push(`${datos.descartadas} ignorada${datos.descartadas > 1 ? 's' : ''}: ` + Object.entries(datos.motivos).map(([m, n]) => `${n} ${MOTIVOS[m] || m}`).join('; ') + '.');
    if (datos.fuera) partes.push(`${datos.fuera} cae${datos.fuera > 1 ? 'n' : ''} fuera de los límites de Bolivia: revise las coordenadas.`);
    if (!datos.deDispositivo) partes.push('Estas zonas vienen incluidas con la aplicación y no se pueden quitar desde aquí.');
    return el('p', { class: 'muted small zinforme' }, partes.join(' '));
  }

  function vacio() {
    return ui().card(null, el('div', { class: 'zvacio' },
      el('div', { class: 'zvacio__icono', 'aria-hidden': 'true' }, ui().icon('zona', 34)),
      el('h2', null, 'Aún no hay zonas cargadas en este dispositivo'),
      el('p', null, 'Aquí se muestran las zonas que una persona marcó como "Parece actividad minera" en el visor de imágenes satelitales. El visor genera un archivo GeoJSON y se carga con el botón de arriba.'),
      el('p', { class: 'muted small' }, 'Son datos confidenciales por verificar en campo: quedan solo en este dispositivo y solo las ven los funcionarios con sesión iniciada.')));
  }

  function pintar() {
    if (!raiz) return;
    if (map) { map.remove(); map = null; base = null; grupo = null; capas = new Map(); }
    U.clear(raiz);
    raiz.appendChild(botones());
    if (!datos) { raiz.appendChild(vacio()); return; }

    const lista = ordenadas();
    const ha = lista.reduce((a, r) => a + (r.area || 0), 0);
    const gen = datos.generado ? datos.generado.slice(0, 10) : null;
    raiz.appendChild(el('div', { class: 'note zaviso' }, ui().icon('alerta', 15), el('span', null, AVISO)));
    raiz.appendChild(el('div', { class: 'kpis kpis--3' },
      ui().kpi('Zonas', U.fmt(lista.length), 'por verificar'),
      ui().kpi('Hectáreas', U.fmt(ha, 1), 'suma de las áreas'),
      el('div', { class: 'kpi kpi--fecha' }, el('div', { class: 'kpi__label' }, 'Archivo generado'), el('div', { class: 'kpi__value' }, gen ? U.fmtDate(gen) : '—'), el('div', { class: 'kpi__sub' }, datos.generado && datos.generado.length > 10 ? 'a las ' + datos.generado.slice(11, 16) : 'sin fecha en el archivo'))));
    raiz.appendChild(informeCarga());

    const mapaDiv = el('div', { class: 'zmap', role: 'application', 'aria-label': 'Mapa de las zonas revisadas. Toque una zona para ver su ficha.' });
    badge = el('div', { class: 'mapbadge', hidden: true }, 'Sin conexión: el mapa base no está disponible. Las zonas se muestran igual.');
    const segBase = el('div', { class: 'seg', role: 'group', 'aria-label': 'Mapa base' }, G4G.config.mapa.capasBase.map((c, i) => el('button', {
      type: 'button', class: 'seg__btn', 'data-i': i, 'aria-pressed': 'false',
      onclick: () => { base.usar(i); marcarBase(); }
    }, c.nombre)));
    const marcarBase = () => segBase.querySelectorAll('.seg__btn').forEach((b) => { const on = base && Number(b.dataset.i) === base.indice; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on)); });
    raiz.appendChild(ui().card('Mapa de zonas', el('div', { class: 'zmap-wrap' }, mapaDiv, badge),
      [segBase, ui().button('Ver todas', { icon: 'mapa', onclick: () => verTodas(true) })], 'zcard'));

    listaHost = el('div', { class: 'tbl-wrap zlista' });
    const sel = el('select', { class: 'input', 'data-orden': '', 'aria-label': 'Ordenar la lista', onchange: (e) => { const [k, d] = e.target.value.split(':'); cambiarOrden(k, Number(d)); } },
      ORDENES.map(([k, d, label]) => el('option', { value: k + ':' + d }, label)));
    raiz.appendChild(ui().card('Zonas revisadas', [el('label', { class: 'zorden' }, el('span', null, 'Ordenar por'), sel), listaHost], null, 'card--flush zcard zcard--lista'));
    pintarLista();

    dibujarMapa(lista, mapaDiv);
    marcarBase();
    if (seleccion && capas.has(seleccion)) { const c = capas.get(seleccion); c.poli.setStyle(estiloPoli(true)); c.mk.setIcon(iconoZona(true)); }
  }

  function render(root) {
    raiz = root;
    cargarFuente();
    pintar();
    if (!datos && urlConfigurada()) traerDeUrl();
  }
  function onShow() { setTimeout(() => { if (map) map.invalidateSize(); }, 60); }

  /* Al cerrar sesión no queda nada de las zonas en pantalla (la sección vuelve a construirse al ingresar). */
  G4G.bus.on('auth:changed', () => {
    if (G4G.auth.esFuncionario()) return;
    if (map) { map.remove(); map = null; base = null; grupo = null; capas = new Map(); }
    listaHost = null; badge = null; seleccion = null;
    const m = G4G.app.modulos.find((x) => x.id === 'deteccion');
    if (m && m.seccion) { U.clear(m.seccion); m.construido = false; }
    ui().drawer.close();
  });

  G4G.deteccion = { validar, cantidad: () => { try { const d = leerGuardado(); return d ? d.features.length : (window.G4G_ZONAS_REVISADAS && !validar(window.G4G_ZONAS_REVISADAS).error ? validar(window.G4G_ZONAS_REVISADAS).features.length : 0); } catch (e) { return 0; } }, clave: CLAVE };
  G4G.app.register({ id: 'deteccion', titulo: 'Detecciones revisadas', icono: 'zona', orden: 15, grupo: 'tecnico', subtitulo: 'Zonas marcadas como posible actividad minera en imágenes satelitales, por verificar', render, onShow });
})();
