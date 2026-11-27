/* Módulo: Zonas de riesgo (solo funcionarios). Dos vistas del mismo dato:
   - Mapa de riesgo: círculos de atención alrededor de cada pasivo, con el color de su prioridad.
   - Zona de riesgo: tabla por municipio, de mayor a menor riesgo.
   Los círculos son una ayuda para decidir dónde mirar primero: no son un límite legal ni un alcance medido. */
(function () {
  const G4G = (window.G4G = window.G4G || {});
  const U = G4G.util, { el } = U;
  const ui = () => G4G.ui, A = () => G4G.autoridad;

  /* Radio base ajustable; cada prioridad lo escala (más alta, un poco más amplio). */
  const FACTOR = { 1: 4 / 3, 2: 1, 3: 1, 4: 2 / 3 };
  const NIVEL_TXT = { 1: 'Prioridad alta', 2: 'Remediar', 3: 'Oportunidad', 4: 'Monitoreo' };
const NIVEL_AYUDA = { 1: 'Prioridad 1 o muestreo urgente', 2: 'Remediar o contener', 3: 'Oportunidad con monitoreo', 4: 'Monitoreo o sin dato de ley' };
  const RADIOS = [1, 1.5, 3, 5];
  const est = { vista: 'mapa', radioKm: 1.5, niveles: { 1: true, 2: true, 3: true, 4: true }, rios: true };
  let map = null, base = null, refs = null, tabla = null, rootEl = null, ajustado = false;
  const capas = { rios: null, circulos: null };
const zonas_ = [];   // círculos dibujados: { c, m } (capa y radio en metros)
/* A zoom lejano un círculo de 1,5 km no se vería: se agranda a un mínimo en pantalla (16 px). */
function ajustarRadios() {
  if (!map) return;
  const z = map.getZoom();
  zonas_.forEach((x) => { const mpp = (40075016.686 * Math.cos((x.c.getLatLng().lat * Math.PI) / 180)) / Math.pow(2, z + 8); x.c.setRadius(Math.max(x.m, 16 * mpp)); });
}

  const color = (nivel) => G4G.config.pasivoColor[nivel] || G4G.config.pasivoColor[4];
  const conCoord = (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng);

  /* Marcador hexagonal (la misma forma de los pasivos en el mapa principal). */
  function icono(nivel) {
    const s = 22, c = s / 2;
    return L.divIcon({ className: 'mk', iconSize: [s, s], iconAnchor: [c, c],
      html: `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}"><polygon points="${ui().puntosHexagono(c, c, c - 1.5)}" fill="${color(nivel)}" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg>` });
  }

  function ficha(p) {
    return el('div', { class: 'here' },
      el('div', { class: 'here__kicker' }, 'Pasivo'),
      el('strong', null, p.nombre || p.id),
      el('div', { class: 'arow' }, ui().claseChip(p.clase)),
      el('p', { class: 'here__note' }, `Riesgo ${p.riesgo}/100 · ${p._op ? p._op.nombre : 'sin responsable registrado'}`),
      el('button', { type: 'button', class: 'btn btn--primary btn--block', onclick: () => { map.closePopup(); G4G.detalle.pasivo(p.id); } }, 'Ver en detalle'));
  }

  function dibujar() {
    if (!map) return;
    capas.circulos.clearLayers(); capas.rios.clearLayers(); zonas_.length = 0;
    if (est.rios) {
      (G4G.riosPrincipales || []).forEach((r) => (r.l || []).forEach((l) => L.polyline(l.map((c) => [c[1], c[0]]),
        { color: '#1E88E5', weight: Math.max(1.6, 3.6 - (r.r || 5) * 0.25), opacity: 0.85, interactive: false }).addTo(capas.rios)));
    }
    G4G.store.pasivosEvaluados().filter(conCoord).forEach((p) => {
      const n = p.clase.nivel;
      if (!est.niveles[n]) return;
      const c = color(n);
      const m = est.radioKm * 1000 * (FACTOR[n] || 1);
      const circ = L.circle([p.lat, p.lng], { radius: m, color: c, weight: 2, fillColor: c, fillOpacity: n === 1 ? 0.3 : 0.2 })
        .bindPopup(ficha(p), { maxWidth: 280, className: 'here-popup' }).addTo(capas.circulos);
      zonas_.push({ c: circ, m });
      L.marker([p.lat, p.lng], { icon: icono(n), title: p.nombre || p.id, keyboard: true, zIndexOffset: 200 })
        .bindTooltip(el('div', null, el('strong', null, p.nombre || p.id), el('br'), `${p.clase.corto} · riesgo ${p.riesgo}`), { direction: 'top', offset: [0, -8] })
        .bindPopup(ficha(p), { maxWidth: 280, className: 'here-popup' }).addTo(capas.circulos);
    });
    ajustarRadios();
  }

  function encuadrar(pasivos) {
    const pts = (pasivos || G4G.store.pasivosEvaluados()).filter(conCoord).map((p) => [p.lat, p.lng]);
    if (pts.length) map.fitBounds(L.latLngBounds(pts).pad(0.25), { maxZoom: 11 });
  }

  function leyenda() {
    U.clear(refs.leyenda);
    const pas = G4G.store.pasivosEvaluados(), cuenta = { 1: 0, 2: 0, 3: 0, 4: 0 };
    pas.forEach((p) => { cuenta[p.clase.nivel] = (cuenta[p.clase.nivel] || 0) + 1; });
    [1, 2, 3, 4].forEach((n) => {
      const b = el('button', { type: 'button', class: 'achip achip--layer' + (est.niveles[n] ? ' is-on' : ''), 'aria-pressed': String(est.niveles[n]), title: NIVEL_AYUDA[n],
        onclick: () => { est.niveles[n] = !est.niveles[n]; b.classList.toggle('is-on', est.niveles[n]); b.setAttribute('aria-pressed', String(est.niveles[n])); dibujar(); } },
      ui().shapeSvg('hexagono', color(n), 14), NIVEL_TXT[n], el('span', { class: 'achip__n' }, cuenta[n] || 0));
      refs.leyenda.appendChild(b);
    });
    const r = el('button', { type: 'button', class: 'achip achip--layer' + (est.rios ? ' is-on' : ''), 'aria-pressed': String(est.rios),
      onclick: () => { est.rios = !est.rios; r.classList.toggle('is-on', est.rios); r.setAttribute('aria-pressed', String(est.rios)); dibujar(); } },
    U.svg('svg', { viewBox: '0 0 28 8', width: 28, height: 8, 'aria-hidden': 'true' }, U.svg('line', { x1: 1, y1: 4, x2: 27, y2: 4, stroke: '#1E88E5', 'stroke-width': 3, 'stroke-linecap': 'round' })), 'Ríos principales');
    refs.leyenda.appendChild(r);
    const hay = pas.filter(conCoord).length;
    refs.vacio.hidden = hay > 0;
  }

  /* ---- Tabla por municipio ---- */
  function zonas() {
    const S = G4G.store, ops = S.state.operadores, R = G4G.config.radioCercaniaKm;
    const ids = new Set((A().peek('muestras') || []).map((m) => String(m.pasivo_id || '').trim()).filter(Boolean));
    const grupos = new Map();
    S.pasivosEvaluados().forEach((p) => {
      let op = p._op && (p._op.municipio || p._op.departamento) ? p._op : null;
      /* Sin responsable con municipio: se toma la operación registrada más cercana (hasta el radio de cercanía). */
      if (!op && conCoord(p)) {
        let mejor = null;
        ops.forEach((o) => { if (o.lat == null || !(o.municipio || o.departamento)) return; const d = U.haversineKm(p, o); if (d <= R && (!mejor || d < mejor.d)) mejor = { o, d }; });
        if (mejor) op = mejor.o;
      }
      const muni = (op && op.municipio) || '', dep = (op && op.departamento) || '', clave = muni || dep ? muni + '|' + dep : '|';
      const g = grupos.get(clave) || { clave, municipio: muni || (dep ? 'Municipio sin registrar' : 'Sin municipio registrado'), departamento: dep, pasivos: [], max: -1, maxP: null, altas: 0, sinMuestra: 0 };
      g.pasivos.push(p);
      if (p.riesgo > g.max) { g.max = p.riesgo; g.maxP = p; }
      if (p.clase.nivel === 1) g.altas++;
      if (!p.muestra && !ids.has(String(p.id))) g.sinMuestra++;
      grupos.set(clave, g);
    });
    return [...grupos.values()];
  }

  function verEnMapa(g) {
    cambiarVista('mapa');
    const pts = g.pasivos.filter(conCoord);
    if (pts.length) { map.invalidateSize(); encuadrar(pts); }
  }

  function columnas() {
    return [
      { key: 'municipio', label: 'Municipio', sortValue: (g) => g.municipio, render: (g) => el('div', null, el('div', { class: 'cell-main' }, g.municipio), el('div', { class: 'cell-sub' }, g.departamento || '—')) },
      { key: 'n', label: 'Pasivos', align: 'right', sortValue: (g) => g.pasivos.length, render: (g) => g.pasivos.length },
      { key: 'riesgo', label: 'Riesgo más alto', sortValue: (g) => g.max, render: (g) => el('div', null, el('div', { class: 'progress progress--sm' }, ui().meter(g.max, 100, { tone: 'risk' }), el('span', null, g.max)), el('div', { class: 'cell-sub' }, g.maxP.nombre || g.maxP.id)) },
      { key: 'altas', label: 'Prioridad alta', align: 'right', sortValue: (g) => g.altas, render: (g) => g.altas },
      { key: 'sin', label: 'Sin muestra', align: 'right', sortValue: (g) => g.sinMuestra, render: (g) => (g.sinMuestra ? el('span', { class: 'chip chip--warn' }, ui().shapeSvg('triangulo', '#B97A00', 12), g.sinMuestra) : el('span', { class: 'muted' }, '0')) },
      { key: 'acc', label: 'Ver', sortable: false, render: (g) => ui().button('Ver en el mapa', { icon: 'mapa', onclick: () => verEnMapa(g), disabled: !g.pasivos.some(conCoord) }) }
    ];
  }
  function pintarTabla() {
    if (!refs) return;
    const z = zonas();
    if (!tabla) { tabla = ui().table({ columns: columnas(), rows: z, sort: 'riesgo', dir: -1, empty: 'Todavía no hay pasivos cargados. Cárguelos en la sección Datos.' }); refs.tabla.appendChild(tabla.node); }
    else tabla.update(z);
  }

  function cambiarVista(v) {
    est.vista = v;
    refs.mapaWrap.hidden = v !== 'mapa'; refs.tablaWrap.hidden = v !== 'tabla';
    refs.seg.querySelectorAll('.seg__btn').forEach((b) => { const on = b.dataset.v === v; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on)); });
    if (v === 'mapa' && map) setTimeout(() => map.invalidateSize(), 30);
  }

  function render(root) {
    rootEl = root; ajustado = false;
    refs = { leyenda: el('div', { class: 'achips' }), vacio: el('div', { class: 'ariesgo__vacio', hidden: true }, 'Todavía no hay pasivos con ubicación. Cárguelos en la sección Datos.'), tabla: el('div') };
    refs.seg = el('div', { class: 'seg', role: 'group', 'aria-label': 'Vista' }, [['mapa', 'Mapa de riesgo'], ['tabla', 'Zona de riesgo']].map(([v, l]) => el('button', { type: 'button', class: 'seg__btn', 'data-v': v, onclick: () => cambiarVista(v) }, l)));
    const radio = el('select', { class: 'input', 'aria-label': 'Radio de los círculos', onchange: (e) => { est.radioKm = Number(e.target.value); dibujar(); } },
      RADIOS.map((k) => el('option', { value: k, selected: est.radioKm === k }, `Radio base ${String(k).replace('.', ',')} km`)));
    const segBase = el('div', { class: 'seg', role: 'group', 'aria-label': 'Mapa base' }, G4G.config.mapa.capasBase.map((c, i) => el('button', {
      type: 'button', class: 'seg__btn' + (i === 0 ? ' is-on' : ''), 'aria-pressed': String(i === 0),
      onclick: (e) => { base.usar(i); segBase.querySelectorAll('.seg__btn').forEach((b) => { b.classList.remove('is-on'); b.setAttribute('aria-pressed', 'false'); }); e.currentTarget.classList.add('is-on'); e.currentTarget.setAttribute('aria-pressed', 'true'); } }, c.nombre)));
    const mapDiv = el('div', { class: 'ariesgo__map', role: 'application', 'aria-label': 'Mapa de zonas de riesgo alrededor de los pasivos' });
    const aviso = el('div', { class: 'mapbadge', hidden: true }, 'Sin conexión: el mapa base no está disponible. Los círculos se muestran igual.');
    refs.mapaWrap = el('div', null,
      el('div', { class: 'toolbar' }, radio, segBase),
      refs.leyenda,
      el('div', { class: 'ariesgo__box' }, mapDiv, refs.vacio, aviso),
      el('p', { class: 'muted small' }, 'Cada círculo es una zona de atención para decidir dónde mirar primero: no es un límite legal ni mide contaminación. De lejos se agranda para verse. Toque un círculo para ver el pasivo.'));
    refs.tablaWrap = el('div', { hidden: true }, ui().card(null, refs.tabla, null, 'card--flush'),
      el('p', { class: 'muted small' }, `El municipio sale de la cooperativa responsable; si no hay, de la operación registrada más cercana (hasta ${G4G.config.radioCercaniaKm} km). El puntaje de riesgo ordena la atención con supuestos de demostración: no es una medición.`));
    root.append(el('div', { class: 'toolbar' }, refs.seg), refs.mapaWrap, refs.tablaWrap);

    const c = G4G.config.mapa;
    map = L.map(mapDiv, { center: c.centro, zoom: c.zoom, zoomControl: false });
    L.control.zoom({ position: 'topright' }).addTo(map);
    base = G4G.basemap.crear(map, { onEstado: (ok) => { aviso.hidden = ok; }, onCambio: (i) => { segBase.querySelectorAll('.seg__btn').forEach((b, j) => { b.classList.toggle('is-on', j === i); b.setAttribute('aria-pressed', String(j === i)); }); } });
    map.attributionControl.addAttribution('Ríos: © Natural Earth');
    map.on('zoomend', ajustarRadios);
    capas.rios = L.layerGroup().addTo(map);
    capas.circulos = L.layerGroup().addTo(map);
    dibujar(); leyenda(); pintarTabla();
    cambiarVista('mapa');
    encuadrar(); ajustado = G4G.store.pasivosEvaluados().some(conCoord);
    /* Las muestras mejoran la columna "Sin muestra"; si no llegan, queda con el dato de cada pasivo. */
    A().muestras().then(() => { if (refs) pintarTabla(); });
  }

  /* Cambió la base: se redibuja sin perder la vista del mapa. */
  function update() {
    if (!map) return;
    dibujar(); leyenda(); pintarTabla();
    if (!ajustado && G4G.store.pasivosEvaluados().some(conCoord)) { encuadrar(); ajustado = true; }
  }

  function onShow() { setTimeout(() => { if (map && est.vista === 'mapa') map.invalidateSize(); }, 60); }

  G4G.app.register({ id: 'riesgos', titulo: 'Zonas de riesgo', icono: 'riesgos', orden: 18, grupo: 'tecnico', subtitulo: 'Dónde mirar primero: pasivos por prioridad y por municipio', persistent: true, render, update, onShow });
})();
