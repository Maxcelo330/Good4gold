/* Módulo: Mapa. Interactivo para el público:
   - toca cualquier punto: "¿Qué hay aquí?" con las operaciones cercanas y
     un botón para denunciar en ese mismo punto;
   - busca una operación y el mapa vuela hasta ella;
   - "Mi ubicación" centra el mapa donde estás;
   - cambia entre mapa, satélite (útil para ver diques de colas) y relieve. */
(function () {
  const G4G = (window.G4G = window.G4G || {});
  const U = G4G.util, { el } = U;
  const ui = () => G4G.ui;

  let map = null, base = null, refs = null, yo = null, resaltado = null;
  const grupos = { operadores: null, pasivos: null, denuncias: null };
  const agua = { principales: null, detalle: null, estado: null };
  let aguaPendiente = false;
  const vista = { visible: { legal: true, proceso: true, no_legal: true, sin_dato: true, pasivos: true, denuncias: true, rios: true, detalle: true }, depto: '' };

  /* ---- Ríos, quebradas y canales ---- */
  const ESTILO = {
    river:  { color: '#1E88E5', weight: 2.6, opacity: 0.95 },
    stream: { color: '#4FA3E0', weight: 1.5, opacity: 0.9 },
    canal:  { color: '#00897B', weight: 2.2, opacity: 0.95, dashArray: '7 5' },
    drain:  { color: '#00897B', weight: 1.4, opacity: 0.9, dashArray: '4 4' },
    ditch:  { color: '#00897B', weight: 1.4, opacity: 0.9, dashArray: '4 4' }
  };
  const TIPO_TXT = { river: 'Río', stream: 'Quebrada o arroyo', canal: 'Canal', drain: 'Drenaje', ditch: 'Zanja' };

  function dibujarPrincipales() {
    if (!map) return;
    agua.principales.clearLayers();
    if (!vista.visible.rios) return;
    (G4G.riosPrincipales || []).forEach((r) => r.l.forEach((l) => {
      L.polyline(l.map((c) => [c[1], c[0]]), { color: '#1E88E5', weight: Math.max(1.8, 4.2 - (r.r || 5) * 0.28), opacity: 0.95, className: 'hidro', interactive: true })
        .bindTooltip(`<strong>Río ${U.esc(r.n || 'sin nombre')}</strong>`, { sticky: true }).addTo(agua.principales);
    }));
  }
  function dibujarDetalle() {
    if (!map) return;
    agua.detalle.clearLayers();
    if (!vista.visible.detalle) return;
    G4G.hidro.vias.forEach((v) => {
      L.polyline(v.pts, Object.assign({ className: 'hidro', interactive: true }, ESTILO[v.tipo] || ESTILO.stream))
        .bindTooltip(`<strong>${U.esc(v.nombre || TIPO_TXT[v.tipo] || 'Curso de agua')}</strong><br>${TIPO_TXT[v.tipo] || ''}`, { sticky: true }).addTo(agua.detalle);
    });
  }
  function mensajeAgua(txt, tono, reintentar) {
    if (!agua.estado) return;
    agua.estado.textContent = txt || '';
    if (txt && reintentar) agua.estado.appendChild(el('button', { type: 'button', class: 'water-status__retry', onclick: reintentar }, 'Reintentar'));
    agua.estado.hidden = !txt;
    agua.estado.className = 'water-status' + (tono ? ' is-' + tono : '') + (reintentar ? ' has-action' : '');
  }
  async function cargarAgua() {
    if (!map || !vista.visible.detalle) { mensajeAgua(''); return; }
    const z = map.getZoom();
    if (z < G4G.hidro.ZOOM_MIN) { mensajeAgua(`Acércate (zoom ${G4G.hidro.ZOOM_MIN}) para ver quebradas y canales`, 'hint'); return; }
    const r = await (async () => {
      const espera = setTimeout(() => mensajeAgua('Cargando ríos y canales de esta zona… puede tardar hasta un minuto', 'busy'), 400);
      try { return await G4G.hidro.cargarDetalle(map); } finally { clearTimeout(espera); }
    })();
    if (r.estado === 'ocupado') { aguaPendiente = true; return; }
    if (r.estado === 'error') { mensajeAgua('No se pudo cargar el detalle de ríos (servidor lento o sin conexión). Se muestran los principales.', 'warn', cargarAgua); return; }
    if (r.nuevas) dibujarDetalle();
    if (aguaPendiente) { aguaPendiente = false; setTimeout(cargarAgua, 300); }
    mensajeAgua(z < G4G.hidro.ZOOM_QUEBRADAS && !G4G.hidro.cubre(map, 2) ? `Ríos y canales. Acércate más (zoom ${G4G.hidro.ZOOM_QUEBRADAS}) para ver quebradas` : '', 'hint');
  }
  function aguaCerca(latlng) {
    const a = G4G.hidro.masCercano(latlng.lat, latlng.lng);
    if (!a) return null;
    const pref = a.tipo === 'river' && a.nombre && !/^(r[ií]o|arroyo|quebrada)/i.test(a.nombre) ? 'Río ' : '';
    const nombre = a.nombre ? pref + a.nombre : (TIPO_TXT[a.tipo] || 'Curso de agua');
    const rotulo = a.fuente === 'detalle' ? 'Curso de agua más cercano' : 'Río principal más cercano';
    return el('p', { class: 'here__water' }, el('strong', null, rotulo + ': '), `${nombre}, a ${a.km < 1 ? U.fmt(a.km * 1000) + ' m' : U.fmt(a.km, 1) + ' km'}`);
  }

  function svgIcono(forma, color, s = 20) {
    const c = s / 2;
    let f;
    if (forma === 'circulo') f = `<circle cx="${c}" cy="${c}" r="${c - 3}" fill="${color}" stroke="#fff" stroke-width="2"/>`;
    else if (forma === 'triangulo') f = `<path d="M${c} 2.5 L${s - 2.5} ${s - 3.5} L2.5 ${s - 3.5} Z" fill="${color}" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>`;
    else if (forma === 'cuadrado') f = `<rect x="3.5" y="3.5" width="${s - 7}" height="${s - 7}" fill="${color}" stroke="#fff" stroke-width="2"/>`;
    else if (forma === 'anillo') f = `<circle cx="${c}" cy="${c}" r="${c - 4}" fill="#fff" stroke="${color}" stroke-width="3"/>`;
    else if (forma === 'rombo') f = `<path d="M${c} 1.5 L${s - 1.5} ${c} L${c} ${s - 1.5} L1.5 ${c} Z" fill="${color}" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>`;
    else if (forma === 'yo') f = `<circle cx="${c}" cy="${c}" r="${c - 2}" fill="#1F4E9C" fill-opacity=".18"/><circle cx="${c}" cy="${c}" r="6" fill="#1F4E9C" stroke="#fff" stroke-width="2.5"/>`;
    else f = `<circle cx="${c}" cy="${c}" r="${c - 2}" fill="${color}" stroke="#fff" stroke-width="2"/><text x="${c}" y="${c + 4.5}" text-anchor="middle" font-size="13" font-weight="700" fill="#fff" font-family="Roboto,Arial">!</text>`;
    return L.divIcon({ className: 'mk', html: `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">${f}</svg>`, iconSize: [s, s], iconAnchor: [c, c] });
  }

  const pasaDepto = (o) => !vista.depto || o.departamento === vista.depto;

  function dibujar() {
    if (!map) return;
    Object.values(grupos).forEach((g) => g.clearLayers());
    const S = G4G.store, est = G4G.config.estados;
    S.state.operadores.forEach((o) => {
      if (o.lat == null || !vista.visible[o.estado_legal] || !pasaDepto(o)) return;
      const e = est[o.estado_legal];
      L.marker([o.lat, o.lng], { icon: svgIcono(e.forma, e.color, 20), title: o.nombre, keyboard: true, riseOnHover: true })
        .bindTooltip(`<strong>${U.esc(o.nombre)}</strong><br>${e.label}`, { direction: 'top', offset: [0, -8] })
        .on('click', () => G4G.detalle.operador(o.id)).addTo(grupos.operadores);
    });
    if (vista.visible.pasivos) {
      S.pasivosEvaluados().forEach((p) => {
        if (p.lat == null || (vista.depto && p._op && p._op.departamento !== vista.depto)) return;
        const s = 14 + Math.round((p.riesgo / 100) * 12);
        L.marker([p.lat, p.lng], { icon: svgIcono('rombo', p.clase.nivel === 1 ? '#C8202F' : '#2B2824', s), title: p.nombre, keyboard: true, zIndexOffset: 200 })
          .bindTooltip(`<strong>${U.esc(p.nombre || p.id)}</strong><br>Riesgo ${p.riesgo} · ${p.clase.corto}`, { direction: 'top', offset: [0, -8] })
          .on('click', () => G4G.detalle.pasivo(p.id)).addTo(grupos.pasivos);
      });
    }
    if (vista.visible.denuncias) {
      S.state.denuncias.forEach((d) => {
        L.marker([d.lat, d.lng], { icon: svgIcono('alerta', '#1F4E9C', 24), title: d.tipo, zIndexOffset: 400 })
          .bindTooltip(`<strong>Denuncia</strong><br>${U.esc(d.tipo)}`, { direction: 'top', offset: [0, -10] })
          .on('click', () => G4G.detalle.denuncia(d.id)).addTo(grupos.denuncias);
      });
    }
  }

  function encuadrar() {
    const pts = [];
    G4G.store.state.operadores.forEach((o) => { if (o.lat != null && pasaDepto(o)) pts.push([o.lat, o.lng]); });
    if (!vista.depto) G4G.store.state.pasivos.forEach((p) => { if (p.lat != null) pts.push([p.lat, p.lng]); });
    if (pts.length) map.fitBounds(L.latLngBounds(pts).pad(0.12), { maxZoom: 10 });
  }

  /* ¿Qué hay aquí? */
  function queHayAqui(latlng) {
    const R = G4G.config.radioCercaniaKm;
    const cerca = G4G.detalle.cercanos(latlng.lat, latlng.lng, R);
    const ops = cerca.filter((c) => c.tipo === 'operador').slice(0, 4);
    const pas = cerca.filter((c) => c.tipo === 'pasivo');
    const body = el('div', { class: 'here' },
      el('div', { class: 'here__kicker' }, '¿Qué hay aquí?'),
      el('div', { class: 'here__coord mono' }, U.fmtCoord(latlng.lat, latlng.lng)),
      ops.length
        ? el('ul', { class: 'here__list' }, ops.map((c) => el('li', null,
          el('button', { type: 'button', class: 'here__item', onclick: () => { map.closePopup(); G4G.detalle.operador(c.reg.id); } },
            ui().shapeSvg(G4G.config.estados[c.reg.estado_legal].forma, G4G.config.estados[c.reg.estado_legal].color, 12),
            el('span', { class: 'here__name' }, c.reg.nombre), el('span', { class: 'here__d' }, `${U.fmt(c.d, 1)} km`)))))
        : el('p', { class: 'here__none' }, `No hay operaciones registradas a menos de ${R} km.`),
      pas.length ? el('p', { class: 'here__note' }, `${pas.length} pasivo${pas.length > 1 ? 's' : ''} minero${pas.length > 1 ? 's' : ''} en la zona.`) : null,
      aguaCerca(latlng),
      el('button', { type: 'button', class: 'btn btn--primary btn--block', onclick: () => { map.closePopup(); G4G.app.go('denuncias', { ubicacion: { lat: latlng.lat, lng: latlng.lng, origen: 'mapa' } }); } },
        ui().icon('denuncias', 16), 'Denunciar en este punto'));
    L.popup({ maxWidth: 300, minWidth: 250, className: 'here-popup', autoPanPadding: [40, 40] }).setLatLng(latlng).setContent(body).openOn(map);
  }

  function miUbicacion(btn) {
    if (!navigator.geolocation) { ui().toast('Este dispositivo no permite obtener la ubicación.', 'warn'); return; }
    btn.classList.add('is-busy');
    navigator.geolocation.getCurrentPosition((pos) => {
      btn.classList.remove('is-busy');
      const ll = L.latLng(pos.coords.latitude, pos.coords.longitude);
      if (yo) map.removeLayer(yo);
      yo = L.marker(ll, { icon: svgIcono('yo', '', 28), zIndexOffset: 600, title: 'Tu ubicación' }).addTo(map);
      map.flyTo(ll, 12, { duration: 0.8 });
      setTimeout(() => queHayAqui(ll), 900);
    }, () => { btn.classList.remove('is-busy'); ui().toast('No se pudo obtener tu ubicación. Revisa el permiso del navegador.', 'warn'); },
    { enableHighAccuracy: true, timeout: 15000 });
  }

  function volarA(o) {
    if (o.lat == null) { G4G.detalle.operador(o.id); return; }
    vista.visible[o.estado_legal] = true;
    map.flyTo([o.lat, o.lng], 13, { duration: 0.8 });
    marcar(o.lat, o.lng);
    setTimeout(() => G4G.detalle.operador(o.id), 850);
  }
  function marcar(lat, lng) {
    if (resaltado) map.removeLayer(resaltado);
    resaltado = L.circleMarker([lat, lng], { radius: 22, color: '#B07D14', weight: 3, fill: false, className: 'pulse' }).addTo(map);
    setTimeout(() => { if (resaltado) { map.removeLayer(resaltado); resaltado = null; } }, 3500);
  }

  function linea(color, grosor, punteada) {
    return U.svg('svg', { class: 'water-legend__line', viewBox: '0 0 28 8', width: 28, height: 8, 'aria-hidden': 'true' },
      U.svg('line', { x1: 1, y1: 4, x2: 27, y2: 4, stroke: color, 'stroke-width': grosor, 'stroke-linecap': 'round', 'stroke-dasharray': punteada ? '5 4' : null }));
  }
  function chipAgua(key, tipo, texto, alCambiar) {
    const st = ESTILO[tipo];
    return el('button', { type: 'button', class: 'layer-chip' + (vista.visible[key] ? ' is-on' : ''), 'aria-pressed': String(vista.visible[key]),
      onclick: (e) => { vista.visible[key] = !vista.visible[key]; e.currentTarget.classList.toggle('is-on'); e.currentTarget.setAttribute('aria-pressed', String(vista.visible[key])); alCambiar(); } },
      linea(st.color, st.weight), el('span', { class: 'layer-chip__name' }, texto));
  }

  function panel() {
    const S = G4G.store, est = G4G.config.estados;
    const cs = S.state.operadores.reduce((a, o) => { a[o.estado_legal] = (a[o.estado_legal] || 0) + 1; return a; }, {});
    const chip = (key, shape, label, n) => el('button', {
      type: 'button', class: 'layer-chip' + (vista.visible[key] ? ' is-on' : ''), 'aria-pressed': String(vista.visible[key]),
      onclick: (e) => { vista.visible[key] = !vista.visible[key]; e.currentTarget.classList.toggle('is-on'); e.currentTarget.setAttribute('aria-pressed', String(vista.visible[key])); dibujar(); }
    }, shape, el('span', { class: 'layer-chip__name' }, label), el('span', { class: 'layer-chip__n' }, n));
    const deptos = [...new Set(S.state.operadores.map((o) => o.departamento).filter(Boolean))].sort();
    const sel = el('select', { class: 'input', 'aria-label': 'Departamento', onchange: (e) => { vista.depto = e.target.value; dibujar(); encuadrar(); } },
      el('option', { value: '' }, 'Todo el país'), deptos.map((d) => el('option', { value: d, selected: vista.depto === d }, d)));
    const segBase = el('div', { class: 'seg', role: 'group', 'aria-label': 'Mapa base' }, G4G.config.mapa.capasBase.map((c, i) => el('button', {
      type: 'button', class: 'seg__btn' + (base && base.indice === i ? ' is-on' : ''), 'aria-pressed': String(!!(base && base.indice === i)),
      onclick: (e) => { base.usar(i); segBase.querySelectorAll('.seg__btn').forEach((b) => { b.classList.remove('is-on'); b.setAttribute('aria-pressed', 'false'); }); e.currentTarget.classList.add('is-on'); e.currentTarget.setAttribute('aria-pressed', 'true'); }
    }, c.nombre)));

    const body = el('div', { class: 'mappanel__body' },
      G4G.inicio.buscador({ compacto: true, placeholder: 'Buscar operación o municipio…', onElegir: volarA }),
      el('div', { class: 'mappanel__title' }, 'Mostrar'),
      el('div', { class: 'layer-chips' },
        S.estadosVisibles().map(([k, e]) => chip(k, ui().shapeSvg(e.forma, e.color, 13), e.label, cs[k] || 0)),
        chip('pasivos', ui().shapeSvg('cuadrado', '#2B2824', 13), 'Pasivos (colas)', S.state.pasivos.length),
        chip('denuncias', ui().shapeSvg('circulo', '#1F4E9C', 13), 'Denuncias', S.state.denuncias.length)),
      el('div', { class: 'mappanel__title' }, 'Agua'),
      el('div', { class: 'layer-chips' },
        chipAgua('rios', 'river', 'Ríos principales', dibujarPrincipales),
        chipAgua('detalle', 'stream', 'Quebradas y canales', () => { dibujarDetalle(); cargarAgua(); })),
      el('div', { class: 'water-legend' },
        el('span', null, linea('#1E88E5', 3), 'Río'), el('span', null, linea('#4FA3E0', 1.6), 'Quebrada'), el('span', null, linea('#00897B', 2.2, true), 'Canal')),
      el('div', { class: 'mappanel__title' }, 'Zona'), sel,
      el('div', { class: 'mappanel__title' }, 'Vista'), segBase,
      el('p', { class: 'mappanel__hint' }, el('strong', null, 'Toca el mapa'), ' para ver qué hay en un punto o denunciar ahí. Pasivos en rojo: prioridad alta.'));
    return el('div', { class: 'mappanel' + (window.innerWidth < 860 ? ' is-collapsed' : '') },
      el('button', { type: 'button', class: 'mappanel__toggle', 'aria-expanded': String(window.innerWidth >= 860), onclick: (e) => { const p = e.currentTarget.parentNode; p.classList.toggle('is-collapsed'); e.currentTarget.setAttribute('aria-expanded', String(!p.classList.contains('is-collapsed'))); } },
        ui().icon('buscar', 16), 'Buscar y filtrar', el('span', { class: 'mappanel__caret', 'aria-hidden': 'true' }, '▾')), body);
  }

  function render(root) {
    const host = el('div', { class: 'mapview' });
    const mapDiv = el('div', { class: 'mapview__map', role: 'application', 'aria-label': 'Mapa de operaciones mineras. Toque un punto para ver qué hay cerca.' });
    const badge = el('div', { class: 'mapbadge', hidden: true }, 'Sin conexión: el mapa base no está disponible. Los puntos se muestran igual.');
    const locBtn = el('button', { type: 'button', class: 'map-fab', title: 'Mi ubicación', 'aria-label': 'Centrar en mi ubicación', onclick: (e) => miUbicacion(e.currentTarget) }, ui().icon('gps', 20));
    const repBtn = el('button', { type: 'button', class: 'map-fab map-fab--wide', onclick: () => G4G.app.go('denuncias') }, ui().icon('denuncias', 18), 'Denunciar');
    refs = { panelHost: el('div', { class: 'mapview__panel' }) };
    agua.estado = el('div', { class: 'water-status', hidden: true, role: 'status' });
    host.append(mapDiv, refs.panelHost, el('div', { class: 'map-fabs' }, locBtn, repBtn), badge, agua.estado);
    root.appendChild(host);

    const c = G4G.config.mapa;
    map = L.map(mapDiv, { center: c.centro, zoom: c.zoom, zoomControl: false });
    L.control.zoom({ position: 'topright' }).addTo(map);
    base = G4G.basemap.crear(map, { onEstado: (ok) => { badge.hidden = ok; } });
    map.attributionControl.addAttribution('Ríos: © Natural Earth · detalle © OpenStreetMap');
    agua.principales = L.layerGroup().addTo(map);
    agua.detalle = L.layerGroup().addTo(map);
    grupos.operadores = L.layerGroup().addTo(map);
    grupos.pasivos = L.layerGroup().addTo(map);
    grupos.denuncias = L.layerGroup().addTo(map);
    map.on('click', (e) => queHayAqui(e.latlng));
    map.on('moveend', U.debounce(cargarAgua, 700));
    dibujarPrincipales();
    dibujarDetalle();
    refs.panelHost.appendChild(panel());
    dibujar();
    encuadrar();
  }

  function update() {
    if (!map) return;
    U.clear(refs.panelHost); refs.panelHost.appendChild(panel());
    dibujar();
  }

  function onShow(root, params) {
    setTimeout(() => { if (map) map.invalidateSize(); }, 60);
    if (params && params.foco && map) {
      const f = params.foco;
      Object.keys(vista.visible).forEach((k) => { vista.visible[k] = true; });
      vista.depto = '';
      update();
      map.setView([f.lat, f.lng], 13);
      marcar(f.lat, f.lng);
    }
  }

  G4G.mapaApi = { obtener: () => map };
  G4G.app.register({ id: 'mapa', titulo: 'Mapa', icono: 'mapa', orden: 1, grupo: 'ciudadania', subtitulo: 'Toca cualquier punto para ver qué operaciones hay cerca o denunciar ahí', persistent: true, full: true, render, update, onShow });
})();
