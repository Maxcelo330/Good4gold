/* Componentes de interfaz reutilizables (sin dependencias). */
(function () {
  const G4G = (window.G4G = window.G4G || {});
  const { el, svg, clear } = G4G.util;

  const ICONOS = {
    inicio:     'M3 11 12 4l9 7M5 10v10h5v-6h4v6h5V10',
    buscar:     'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20.5 20.5 16 16',
    resumen:    'M4 4h7v7H4zM13 4h7v4h-7zM13 11h7v9h-7zM4 13h7v7H4z',
    mapa:       'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14',
    operadores: 'M4 20V8l8-4 8 4v12M9 20v-6h6v6M8 10h.01M12 10h.01M16 10h.01',
    pasivos:    'M2 19h20L15 7l-3.5 6-2.5-3.5zM2 19v0',
    denuncias:  'M4 8h3l2-3h6l2 3h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
    datos:      'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
    cerrar:     'M6 6l12 12M18 6 6 18',
    gps:        'M12 2v3M12 19v3M2 12h3M19 12h3M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    descargar:  'M12 4v11M7 11l5 5 5-5M5 20h14',
    subir:      'M12 16V5M7 9l5-5 5 5M5 20h14',
    alerta:     'M12 3 2 20h20zM12 10v5M12 18h.01',
    candado:    'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3',
    imprimir:   'M7 9V3h10v6M7 17H4v-6h16v6h-3M7 14h10v7H7z',
    usuario:    'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5',
    ajustes:    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
    celular:    'M7 2h10v20H7zM11 18h2',
    salir:      'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
    editar:     'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
    mas:        'M12 5v14M5 12h14',
    buzon:      'M3 13h5l1.5 3h5L16 13h5M3 13l3-8h12l3 8v6H3z',
    zona:       'M4 9l5-5 9 3 3 8-6 6-9-2zM12 12h.01',
    actualizar: 'M20 12a8 8 0 1 1-2.5-5.8M20 4v5h-5',
    tramites:   'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7',
    programas:  'M5 19c0-8 5-14 14-14 0 9-6 14-14 14zM5 19c3-4 6-6 9-8',
    muestras:   'M9 3h6M10 3v6L5 19a1 1 0 0 0 .9 1.5h12.2A1 1 0 0 0 19 19l-5-10V3M8 14h8',
    riesgos:    'M12 3 3 8v6c0 4 4 6.5 9 7.5 5-1 9-3.5 9-7.5V8zM12 9v5M12 17h.01',
    solicitudes:'M5 4h14v16H5zM9 9h6M9 13h6M9 17h3',
    monitoreo:  'M3 12s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    miestado:   'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12l3 3 5-6',
    menu:       'M4 7h16M4 12h16M4 17h16',
    info:       'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5h.01',
    ubicacion:  'M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
    camara:     'M4 8h3l2-3h6l2 3h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
    enviar:     'M4 12 20 4l-4 16-4-6zM12 14l8-10',
    novedades:  'M4 5h13v13a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2zM17 9h3v9a2 2 0 0 1-2 2M7.5 9h6M7.5 12.5h6M7.5 16h3.5'  };
  function icon(name, size = 18) {
    return svg('svg', { viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' }, svg('path', { d: ICONOS[name] || '' }));
  }

  /* Forma + color: el estado nunca depende solo del color. */
  function shapeSvg(forma, color, size = 14) {
    const s = size, c = s / 2, w = 1.6;
    const g = { viewBox: `0 0 ${s} ${s}`, width: s, height: s, 'aria-hidden': 'true', class: 'shape' };
    if (forma === 'circulo') return svg('svg', g, svg('circle', { cx: c, cy: c, r: c - 1, fill: color }));
    if (forma === 'triangulo') return svg('svg', g, svg('path', { d: `M${c} 1.2 L${s - 1} ${s - 1.4} L1 ${s - 1.4} Z`, fill: color }));
    if (forma === 'cuadrado') return svg('svg', g, svg('rect', { x: 1.5, y: 1.5, width: s - 3, height: s - 3, fill: color }));
    if (forma === 'hexagono') return svg('svg', g, svg('polygon', { points: puntosHexagono(c, c, c - 0.8), fill: color }));
    return svg('svg', g, svg('circle', { cx: c, cy: c, r: c - 1.6, fill: 'none', stroke: color, 'stroke-width': w + 0.4 }));
  }
  /* Hexágono de punta arriba (marcador de los pasivos): centro (cx, cy) y radio r. */
  function puntosHexagono(cx, cy, r) {
    return [-90, -30, 30, 90, 150, 210].map((a) => (cx + r * Math.cos((a * Math.PI) / 180)).toFixed(2) + ',' + (cy + r * Math.sin((a * Math.PI) / 180)).toFixed(2)).join(' ');
  }
  function estadoChip(id) {
    const e = G4G.config.estados[id] || G4G.config.estados.sin_dato;
    return el('span', { class: 'chip chip--estado' }, shapeSvg(e.forma, e.color, 12), e.label);
  }
  function claseChip(clase) {
    return el('span', { class: 'chip chip--clase n' + clase.nivel, title: clase.label }, clase.corto || clase.label);
  }
  function estadoDenunciaChip(id) {
    const e = G4G.config.estadosDenuncia[id] || G4G.config.estadosDenunciaPublico[id] || { label: id };
    return el('span', { class: 'chip chip--den d-' + id }, e.label);
  }

  function meter(value, max = 100, opts = {}) {
    const p = Math.max(0, Math.min(100, (value / max) * 100));
    return el('span', { class: 'meter ' + (opts.tone || ''), role: 'meter', 'aria-valuenow': Math.round(value), 'aria-valuemin': 0, 'aria-valuemax': max },
      el('span', { class: 'meter__fill', style: { width: p + '%' } }));
  }

  function kpi(label, value, sub, tone) {
    return el('div', { class: 'kpi' + (tone ? ' kpi--' + tone : '') },
      el('div', { class: 'kpi__label' }, label),
      el('div', { class: 'kpi__value' }, value),
      sub ? el('div', { class: 'kpi__sub' }, sub) : null);
  }

  function card(title, body, actions, cls) {
    return el('section', { class: 'card ' + (cls || '') },
      (title || actions) ? el('header', { class: 'card__head' }, el('h3', null, title), actions ? el('div', { class: 'card__actions' }, actions) : null) : null,
      el('div', { class: 'card__body' }, body));
  }
  /* Un mensaje que empieza con "Cargando" lleva el brillo de esqueleto (css/motion.css) y se anuncia como estado. */
  const empty = (msg) => (/^Cargando/i.test(String(msg))
    ? el('div', { class: 'empty empty--loading', role: 'status', 'aria-busy': 'true' }, msg)
    : el('div', { class: 'empty' }, msg));
  /* n líneas de esqueleto para mientras llegan los datos: ui.skeleton(3). */
  const skeleton = (n = 3) => el('div', { class: 'skeletons', 'aria-hidden': 'true' }, Array.from({ length: n }, () => el('span', { class: 'skeleton skeleton--line' })));
  /* Vibración corta al tocar o confirmar. Solo con soporte, tras un toque real y sin movimiento reducido. */
  function haptico(ms) {
    try {
      if (!navigator.vibrate) return;
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
      navigator.vibrate(ms || 8);
    } catch (e) { /* sin vibración */ }
  }

  function button(label, opts = {}) {
    return el('button', { type: 'button', class: 'btn ' + (opts.kind ? 'btn--' + opts.kind : ''), onclick: opts.onclick, disabled: opts.disabled, title: opts.title },
      opts.icon ? icon(opts.icon, 16) : null, label);
  }

  /* ---- Tabla ordenable ---- */
  function table(opts) {
    const state = { sort: opts.sort || null, dir: opts.dir || 1, rows: opts.rows || [] };
    const root = el('div', { class: 'tbl-wrap' });
    function render() {
      const cols = opts.columns;
      let rows = state.rows.slice();
      if (state.sort) {
        const c = cols.find((x) => x.key === state.sort);
        const val = (r) => (c.sortValue ? c.sortValue(r) : (c.get ? c.get(r) : r[c.key]));
        rows.sort((a, b) => {
          const va = val(a), vb = val(b);
          if (va == null && vb == null) return 0;
          if (va == null) return 1;
          if (vb == null) return -1;
          return (typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'es')) * state.dir;
        });
      }
      const thead = el('thead', null, el('tr', null, cols.map((c) => el('th', {
        class: (c.align === 'right' ? 'num ' : '') + (c.sortable === false ? '' : 'sortable ') + (state.sort === c.key ? 'sorted' : ''),
        'aria-sort': state.sort === c.key ? (state.dir === 1 ? 'ascending' : 'descending') : null,
        style: c.width ? { width: c.width } : null,
        onclick: c.sortable === false ? null : () => { state.dir = state.sort === c.key ? -state.dir : 1; state.sort = c.key; render(); }
      }, c.label, state.sort === c.key ? el('span', { class: 'sort-mark' }, state.dir === 1 ? ' ▲' : ' ▼') : null))));
      const tbody = el('tbody', null, rows.map((r) => el('tr', {
        class: opts.onRow ? 'clickable' : '', tabindex: opts.onRow ? 0 : null,
        onclick: opts.onRow ? () => opts.onRow(r) : null,
        onkeydown: opts.onRow ? (e) => { if (e.key === 'Enter') opts.onRow(r); } : null
      }, cols.map((c) => el('td', { class: (c.align === 'right' ? 'num ' : '') + (c.mono ? 'mono ' : '') + (c.className || ''), 'data-label': c.label },
        c.render ? c.render(r) : (c.get ? c.get(r) : r[c.key]))))));
      clear(root);
      root.appendChild(rows.length ? el('table', { class: 'tbl' }, thead, tbody) : empty(opts.empty || 'Sin resultados.'));
      if (opts.onRender) opts.onRender(rows);
    }
    render();
    return { node: root, update(rows) { state.rows = rows; render(); }, get rows() { return state.rows; } };
  }

  /* ---- Panel lateral de detalle ---- */
  let drawerEl = null;
  function drawerInit(host) {
    drawerEl = el('aside', { class: 'drawer', 'aria-hidden': 'true', role: 'dialog', 'aria-label': 'Detalle' });
    const scrim = el('div', { class: 'scrim', onclick: () => drawerClose() });
    host.appendChild(scrim); host.appendChild(drawerEl);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') drawerClose(); });
  }
  function drawerOpen(o) {
    clear(drawerEl);
    drawerEl.appendChild(el('header', { class: 'drawer__head' },
      el('div', null, o.kicker ? el('div', { class: 'kicker' }, o.kicker) : null, el('h2', null, o.title), o.subtitle ? el('div', { class: 'drawer__sub' }, o.subtitle) : null),
      el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Cerrar', onclick: drawerClose }, icon('cerrar'))));
    drawerEl.appendChild(el('div', { class: 'drawer__body' }, o.body));
    if (o.footer) drawerEl.appendChild(el('footer', { class: 'drawer__foot' }, o.footer));
    drawerEl.setAttribute('aria-hidden', 'false');
    document.body.classList.add('drawer-open');
    drawerEl.querySelector('.icon-btn').focus({ preventScroll: true });
  }
  function drawerClose() {
    if (!drawerEl) return;
    drawerEl.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('drawer-open');
  }

  /* ---- Toast y tooltip ---- */
  let toastHost = null;
  function toast(msg, kind) {
    if (!toastHost) { toastHost = el('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' }); document.body.appendChild(toastHost); }
    const t = el('div', { class: 'toast ' + (kind || '') }, msg);
    toastHost.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 4200);
  }
  let tipEl = null;
  const tip = {
    show(content, evt) {
      if (!tipEl) { tipEl = el('div', { class: 'tip', role: 'tooltip' }); document.body.appendChild(tipEl); }
      clear(tipEl); tipEl.appendChild(content instanceof Node ? content : document.createTextNode(content));
      tipEl.style.display = 'block';
      const pad = 14, r = tipEl.getBoundingClientRect();
      let x = evt.clientX + pad, y = evt.clientY + pad;
      if (x + r.width > window.innerWidth - 8) x = evt.clientX - r.width - pad;
      if (y + r.height > window.innerHeight - 8) y = evt.clientY - r.height - pad;
      tipEl.style.left = Math.max(8, x) + 'px'; tipEl.style.top = Math.max(8, y) + 'px';
    },
    hide() { if (tipEl) tipEl.style.display = 'none'; }
  };

  /* ---- Campos de formulario ---- */
  function field(label, input, hint) {
    return el('label', { class: 'field' }, el('span', { class: 'field__label' }, label), input, hint ? el('span', { class: 'field__hint' }, hint) : null);
  }
  function dl(pairs) {
    return el('dl', { class: 'dl' }, pairs.filter(Boolean).map(([k, v]) => [el('dt', null, k), el('dd', null, v === null || v === undefined || v === '' ? '—' : v)]));
  }

  G4G.ui = { icon, shapeSvg, puntosHexagono, estadoChip, claseChip, estadoDenunciaChip, meter, kpi, card, empty, button, table, drawer: { init: drawerInit, open: drawerOpen, close: drawerClose }, toast, tip, field, dl, skeleton, haptico };
})();
