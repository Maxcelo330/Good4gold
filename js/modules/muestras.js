/* Módulo: Muestras (solo funcionarios). Lista de las muestras que toma el equipo de campo, con su resultado en semáforo.
   Son resultados de tamizaje: orientan, no reemplazan al laboratorio acreditado. */
(function () {
  const G4G = (window.G4G = window.G4G || {});
  const U = G4G.util, { el } = U;
  const ui = () => G4G.ui, A = () => G4G.autoridad;
  const AVISO = 'Resultados de tamizaje de campo: orientan, no reemplazan al laboratorio acreditado.';
  const f = { sem: '', q: '' };
  const MATRIZ = { agua: 'Agua', lodo: 'Lodo o sedimento' };
  let raiz = null, resp = null, cargando = false, ticket = 0, tabla = null, mapa = null, refs = null;

  const datos = () => (resp && resp.datos) || [];
  const sem = (m) => U.norm(m.semaforo);
  const num = (v) => U.parseNum(v);
  const ppb = (v) => { const n = num(v); return n === null ? '—' : U.fmt(n, 1); };
  const lab = (m) => U.parseBool(m.confirmado_lab) === true;
  const lugar = (m) => m.lugar || (num(m.lat) !== null ? U.fmtCoord(num(m.lat), num(m.lng)) : 'Sin lugar');

  function filtrar() {
    return datos().filter((m) => {
      if (f.sem && sem(m) !== f.sem) return false;
      if (f.q && !U.norm([m.id, m.lugar, m.pasivo_id, m.operador_id, m.tomada_por, m.notas].join(' ')).includes(U.norm(f.q))) return false;
      return true;
    });
  }

  /* Texto de una celda de CSV que podría leerse como fórmula en una hoja de cálculo. */
  const seguro = (v) => (typeof v === 'string' && /^[=+\-@]/.test(v) ? "'" + v : v);
  function exportar() {
    const filas = filtrar();
    if (!filas.length) { ui().toast('No hay muestras para exportar con este filtro.', 'warn'); return; }
    const S = G4G.config.semaforoMuestra;
    const cols = [{ key: 'id', label: 'id' }, { label: 'fecha', get: (m) => m.fecha }, { label: 'lugar', get: (m) => seguro(m.lugar) }, { key: 'lat', label: 'lat' }, { key: 'lng', label: 'lng' },
      { key: 'pasivo_id', label: 'pasivo_id' }, { key: 'operador_id', label: 'operador_id' }, { key: 'matriz', label: 'matriz' }, { key: 'hg2_ppb', label: 'hg2_ppb' }, { key: 'hg_total_ppb', label: 'hg_total_ppb' },
      { key: 'ch3hg_ppb', label: 'ch3hg_ppb' }, { key: 'nivel2', label: 'nivel2' }, { label: 'resultado', get: (m) => (S[sem(m)] ? S[sem(m)].label : '') }, { key: 'lote_reactivo', label: 'lote_reactivo' },
      { label: 'confirmado_lab', get: (m) => (lab(m) ? 'si' : 'no') }, { label: 'notas', get: (m) => seguro(m.notas) }, { label: 'tomada_por', get: (m) => seguro(m.tomada_por) }];
    U.download('muestras-de-campo.csv', 'text/csv;charset=utf-8', U.toCSV(filas, cols));
    ui().toast(`${filas.length} muestra${filas.length > 1 ? 's' : ''} exportada${filas.length > 1 ? 's' : ''}. ${AVISO}`);
  }

  /* ---- Ficha ---- */
  function abrir(m) {
    const foto = el('div', { class: 'buzon__foto' });
    if (m.tieneFoto) {
      foto.appendChild(el('p', { class: 'muted' }, 'Cargando foto…'));
      G4G.api.foto(G4G.auth.token(), m.id, 'muestras').then((r) => { U.clear(foto); foto.appendChild(el('img', { class: 'photo', src: r.foto, alt: 'Foto de la muestra' })); })
        .catch((e) => { U.clear(foto); foto.appendChild(el('p', { class: 'muted' }, 'No se pudo cargar la foto: ' + e.message)); });
    }
    const lat = num(m.lat), lng = num(m.lng);
    const pas = m.pasivo_id ? G4G.store.getPasivo(String(m.pasivo_id).trim()) : null;
    const op = m.operador_id ? G4G.store.getOperador(String(m.operador_id).trim()) : null;
    ui().drawer.open({
      kicker: `Muestra · ${m.id}`, title: lugar(m), subtitle: A().fechaHora(m.fecha),
      body: el('div', null,
        el('div', { class: 'note' }, AVISO),
        el('div', { class: 'row-gap' }, A().chipSemaforo(m.semaforo), lab(m) ? el('span', { class: 'chip chip--ok' }, 'Confirmada en laboratorio') : el('span', { class: 'chip' }, 'Sin confirmar en laboratorio')),
        foto,
        ui().dl([['Tipo de muestra', MATRIZ[U.norm(m.matriz)] || m.matriz], ['Mercurio Hg2+ (ppb)', ppb(m.hg2_ppb)], ['Mercurio total (ppb)', ppb(m.hg_total_ppb)], ['Metilmercurio (ppb)', ppb(m.ch3hg_ppb)],
          ['Segundo nivel', m.nivel2 || null], ['Lote del reactivo', m.lote_reactivo || null], ['Tomada por', m.tomada_por || null], ['Notas', m.notas || null],
          ['Pasivo', pas ? el('button', { type: 'button', class: 'link', onclick: () => G4G.detalle.pasivo(pas.id) }, pas.nombre || pas.id) : (m.pasivo_id || null)],
          ['Operador', op ? el('button', { type: 'button', class: 'link', onclick: () => G4G.detalle.operador(op.id) }, op.nombre) : (m.operador_id || null)],
          ['Ubicación', lat === null ? null : el('span', { class: 'mono' }, U.fmtCoord(lat, lng))]])),
      footer: [lat !== null ? el('a', { class: 'btn', href: A().enlaceMapa(lat, lng), target: '_blank', rel: 'noopener' }, ui().icon('ubicacion', 16), 'Abrir en Google Maps') : null,
        ui().button('Cerrar', { onclick: () => ui().drawer.close() })].filter(Boolean)
    });
  }

  /* ---- Mapa pequeño ---- */
  function iconoSemaforo(e) {
    const s = 22, c = s / 2, col = e ? e.color : '#76726A', forma = e ? e.forma : 'anillo';
    const g = forma === 'circulo' ? `<circle cx="${c}" cy="${c}" r="${c - 3}" fill="${col}" stroke="#fff" stroke-width="2"/>`
      : forma === 'triangulo' ? `<path d="M${c} 2.5 L${s - 2.5} ${s - 3.5} L2.5 ${s - 3.5} Z" fill="${col}" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>`
        : forma === 'cuadrado' ? `<rect x="4" y="4" width="${s - 8}" height="${s - 8}" fill="${col}" stroke="#fff" stroke-width="2"/>`
          : `<circle cx="${c}" cy="${c}" r="${c - 4}" fill="#fff" stroke="${col}" stroke-width="3"/>`;
    return L.divIcon({ className: 'mk', iconSize: [s, s], iconAnchor: [c, c], html: `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">${g}</svg>` });
  }
  function dibujarMapa() {
    if (mapa) { try { mapa.stop(); mapa._animatingZoom = false; mapa.remove(); } catch (e) { /* ya no existe */ } mapa = null; }
    U.clear(refs.mapaHost);
    const puntos = filtrar().filter((m) => num(m.lat) !== null && num(m.lng) !== null);
    refs.mapaCard.hidden = !puntos.length;
    if (!puntos.length || typeof L === 'undefined') return;
    const div = el('div', { class: 'amuestras__map', role: 'application', 'aria-label': 'Mapa con las muestras tomadas' });
    refs.mapaHost.appendChild(div);
    mapa = L.map(div, { center: G4G.config.mapa.centro, zoom: G4G.config.mapa.zoom, zoomControl: false, scrollWheelZoom: false });
    L.control.zoom({ position: 'topright' }).addTo(mapa);
    G4G.basemap.crear(mapa, {});
    puntos.forEach((m) => {
      const e = G4G.config.semaforoMuestra[sem(m)];
      L.marker([num(m.lat), num(m.lng)], { icon: iconoSemaforo(e), title: lugar(m), keyboard: true })
        .bindTooltip(el('div', null, el('strong', null, lugar(m)), el('br'), e ? e.label : 'Sin resultado'), { direction: 'top', offset: [0, -8] })
        .on('click', () => abrir(m)).addTo(mapa);
    });
    mapa.fitBounds(L.latLngBounds(puntos.map((m) => [num(m.lat), num(m.lng)])).pad(0.3), { maxZoom: 13, animate: false });
    setTimeout(() => { if (mapa) mapa.invalidateSize(); }, 60);
  }

  /* ---- Pantalla ---- */
  async function cargar(forzar) {
    const mi = ++ticket;
    cargando = true; pintarEstado();
    const r = await A().muestras(forzar);
    if (mi !== ticket) return;
    resp = r; cargando = false; pintar();
  }

  function pintarEstado() {
    if (!refs) return;
    refs.cargar.disabled = cargando; refs.cargar.textContent = cargando ? 'Actualizando…' : 'Actualizar';
  }

  /* Un cuadro por semáforo: sirve también de filtro. */
  function resumen() {
    const todas = datos(), S = G4G.config.semaforoMuestra;
    const tile = (k, label, n, forma, color) => {
      const on = f.sem === k;
      return el('button', { type: 'button', class: 'asem' + (on ? ' is-on' : ''), 'aria-pressed': String(on), style: color ? { borderTopColor: color } : null, onclick: () => { f.sem = on ? '' : k; pintar(); } },
        el('span', { class: 'asem__label' }, forma ? ui().shapeSvg(forma, color, 14) : null, label), el('span', { class: 'asem__n' }, U.fmt(n)),
        el('span', { class: 'asem__sub' }, todas.length && k ? `${U.pct(n, todas.length)}% del total` : 'muestras'));
    };
    return el('div', { class: 'asems' }, tile('', 'Todas', todas.length, null, null),
      Object.entries(S).map(([k, v]) => tile(k, v.label, todas.filter((m) => sem(m) === k).length, v.forma, v.color)));
  }

  function columnas() {
    return [
      { key: 'fecha', label: 'Fecha', sortValue: (m) => A().ms(m.fecha) || 0, render: (m) => A().fechaHora(m.fecha) },
      { key: 'lugar', label: 'Lugar', sortValue: (m) => lugar(m), render: (m) => el('div', null, el('div', { class: 'cell-main' }, lugar(m)), el('div', { class: 'cell-sub' }, [m.pasivo_id ? 'Pasivo ' + m.pasivo_id : null, m.id].filter(Boolean).join(' · '))) },
      { key: 'matriz', label: 'Tipo', sortValue: (m) => String(m.matriz || ''), render: (m) => MATRIZ[U.norm(m.matriz)] || m.matriz || '—' },
      { key: 'hg2', label: 'Hg2+ (ppb)', align: 'right', sortValue: (m) => num(m.hg2_ppb), render: (m) => ppb(m.hg2_ppb) },
      { key: 'sem', label: 'Resultado', sortValue: (m) => ['verde', 'amarillo', 'rojo'].indexOf(sem(m)), render: (m) => A().chipSemaforo(m.semaforo) },
      { key: 'lab', label: 'Laboratorio', sortValue: (m) => (lab(m) ? 1 : 0), render: (m) => (lab(m) ? 'Confirmada' : el('span', { class: 'muted' }, 'Sin confirmar')) },
      { key: 'por', label: 'Tomada por', sortValue: (m) => String(m.tomada_por || ''), render: (m) => m.tomada_por || '—' }
    ];
  }

  function pintar() {
    if (!raiz) return;
    U.clear(raiz); tabla = null;
    refs = { cargar: ui().button('Actualizar', { icon: 'actualizar', onclick: () => cargar(true) }), mapaHost: el('div'), cuenta: el('span', { class: 'toolbar__count' }) };
    refs.mapaCard = ui().card('Dónde se tomaron', [refs.mapaHost, el('p', { class: 'muted small' }, 'Forma y color: círculo verde sin alerta, triángulo amarillo por confirmar, cuadrado rojo prioridad.')]);
    refs.mapaCard.hidden = true;
    pintarEstado();
    raiz.appendChild(el('div', { class: 'note' }, AVISO));
    const aviso = resp ? A().avisoServidor(resp, 'muestras') : null;
    if (aviso) raiz.appendChild(aviso);
    if (cargando && !resp) { raiz.appendChild(ui().empty('Cargando muestras…')); return; }
    if (!resp || resp.sinServidor || (resp.error && !resp.datos)) { raiz.appendChild(el('div', { class: 'toolbar' }, refs.cargar)); return; }

    raiz.appendChild(resumen());
    raiz.appendChild(el('div', { class: 'toolbar' },
      el('input', { class: 'input', type: 'search', placeholder: 'Buscar por lugar, pasivo o quien tomó…', 'aria-label': 'Buscar', value: f.q, oninput: U.debounce((e) => { f.q = e.target.value; actualizarTabla(); dibujarMapa(); }, 200) }),
      refs.cuenta, el('span', { class: 'spacer' }), ui().button('Exportar CSV', { icon: 'descargar', onclick: exportar }), refs.cargar));
    raiz.appendChild(refs.mapaCard);
    tabla = ui().table({ columns: columnas(), rows: filtrar(), sort: 'fecha', dir: -1, onRow: abrir, empty: datos().length ? 'Ninguna muestra coincide con el filtro.' : G4G.ilu.vacio('vacio-datos', 'Todavía no hay muestras registradas. Aparecerán aquí cuando el equipo de campo las envíe.'),
      onRender: (rows) => { refs.cuenta.textContent = `${rows.length} de ${datos().length} muestras`; } });
    raiz.appendChild(ui().card(null, tabla.node, null, 'card--flush'));
    dibujarMapa();
  }
  function actualizarTabla() { if (tabla) tabla.update(filtrar()); }

  function render(root) { raiz = root; const previo = A().peek('muestras'); resp = previo ? { datos: previo } : null; cargando = !previo && G4G.api.activo(); pintar(); cargar(false); }
  function onShow() { if (resp && !cargando && G4G.api.activo()) cargar(false); }

  G4G.app.register({ id: 'muestras', titulo: 'Muestras', icono: 'muestras', orden: 19, grupo: 'tecnico', subtitulo: 'Resultados de tamizaje de campo en semáforo', render, onShow });
})();
