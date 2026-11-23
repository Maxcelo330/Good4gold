/* Módulo: Consultar. Directorio de operadores mineros para el público y los
   funcionarios: filtros de un toque, tarjetas o tabla, y exportación. */
(function () {
  const G4G = (window.G4G = window.G4G || {});
  const U = G4G.util, { el } = U;
  const ui = () => G4G.ui;
  const f = { q: '', estado: '', depto: '', viejos: false, vista: 'tarjetas' };
  let raiz = null;

  const ORDEN_ATENCION = { no_legal: 0, proceso: 1, sin_dato: 2, legal: 3 };

  function filtrar() {
    return G4G.store.state.operadores.filter((o) => {
      if (f.estado && o.estado_legal !== f.estado) return false;
      if (f.depto && o.departamento !== f.depto) return false;
      if (f.viejos && !G4G.store.estaDesactualizado(o)) return false;
      if (f.q && !U.norm(o.nombre + ' ' + (o.municipio || '') + ' ' + (o.departamento || '') + ' ' + o.id).includes(U.norm(f.q))) return false;
      return true;
    });
  }

  function tarjeta(o) {
    const S = G4G.store, a = S.avance(o), e = G4G.config.estados[o.estado_legal];
    return el('button', { type: 'button', class: 'op-card', style: { '--estado': e.color }, onclick: () => G4G.detalle.operador(o.id) },
      el('span', { class: 'op-card__top' }, ui().estadoChip(o.estado_legal), el('span', { class: 'op-card__id mono' }, o.id)),
      el('span', { class: 'op-card__name' }, o.nombre),
      el('span', { class: 'op-card__place' }, [o.municipio, o.departamento].filter(Boolean).join(', ') || 'Ubicación sin dato'),
      el('span', { class: 'op-card__req' }, el('span', { class: 'progress progress--sm' }, ui().meter(a.cumplidos, a.total), el('span', null, `${a.cumplidos}/${a.total}`)),
        el('span', { class: 'op-card__reqtxt' }, a.faltan.length ? `Le falta: ${a.faltan.slice(0, 2).map((r) => r.label.toLowerCase()).join(', ')}${a.faltan.length > 2 ? '…' : ''}` : (a.sinDato.length ? 'Requisitos sin verificar' : 'Requisitos completos'))),
      el('span', { class: 'op-card__foot' }, G4G.detalle.frescura(o), el('span', { class: 'op-card__go' }, 'Ver ficha →')));
  }

  function render(root) {
    raiz = root;
    const S = G4G.store, ops = S.state.operadores;
    const cs = ops.reduce((a, o) => { a[o.estado_legal] = (a[o.estado_legal] || 0) + 1; return a; }, {});
    const deptos = [...new Set(ops.map((o) => o.departamento).filter(Boolean))].sort();
    const counter = el('span', { class: 'toolbar__count' });
    const resultados = el('div');

    const columnas = [
      { key: 'nombre', label: 'Operador', render: (o) => el('div', null, el('div', { class: 'cell-main' }, o.nombre), el('div', { class: 'cell-sub' }, `${o.id} · ${o.tipo || 'Sin tipo'}`)), sortValue: (o) => o.nombre },
      { key: 'estado_legal', label: 'Situación legal', render: (o) => ui().estadoChip(o.estado_legal), sortValue: (o) => ORDEN_ATENCION[o.estado_legal] },
      { key: 'depto', label: 'Ubicación', render: (o) => el('div', null, el('div', null, o.municipio || '—'), el('div', { class: 'cell-sub' }, o.departamento || '—')), sortValue: (o) => (o.departamento || '') + (o.municipio || '') },
      { key: 'req', label: 'Requisitos', sortValue: (o) => S.avance(o).cumplidos, render: (o) => { const a = S.avance(o); return el('div', { class: 'progress progress--sm' }, ui().meter(a.cumplidos, a.total), el('span', null, `${a.cumplidos}/${a.total}`)); } },
      { key: 'pas', label: 'Pasivos', align: 'right', sortValue: (o) => S.pasivosDe(o.id).length, render: (o) => S.pasivosDe(o.id).length || '—' },
      { key: 'act', label: 'Actualizado', sortValue: (o) => o.actualizado || '', render: (o) => G4G.detalle.frescura(o) }
    ];
    let tabla = null;
    function pintar() {
      const filas = filtrar().sort((a, b) => ORDEN_ATENCION[a.estado_legal] - ORDEN_ATENCION[b.estado_legal] || a.nombre.localeCompare(b.nombre, 'es'));
      counter.textContent = `${filas.length} de ${ops.length} operadores`;
      U.clear(resultados);
      if (f.vista === 'tabla') {
        tabla = ui().table({ columns: columnas, rows: filas, sort: 'estado_legal', empty: 'Ningún operador coincide con la búsqueda.', onRow: (o) => G4G.detalle.operador(o.id) });
        resultados.appendChild(ui().card(null, tabla.node, null, 'card--flush'));
      } else {
        resultados.appendChild(filas.length ? el('div', { class: 'op-cards' }, filas.slice(0, 120).map(tarjeta))
          : el('div', { class: 'empty-cta' }, el('p', null, 'Ningún operador coincide con la búsqueda.'), el('p', { class: 'muted' }, '¿Viste actividad minera que no aparece en el registro?'), ui().button('Hacer una denuncia', { kind: 'primary', icon: 'denuncias', onclick: () => G4G.app.go('denuncias') })));
      }
    }

    const exportar = () => {
      const filas = filtrar(), rq = G4G.config.requisitos;
      const cols = [{ key: 'id', label: 'id' }, { key: 'nombre', label: 'nombre' }, { key: 'tipo', label: 'tipo' }, { label: 'situacion_legal', get: (o) => G4G.config.estados[o.estado_legal].label },
        { key: 'departamento', label: 'departamento' }, { key: 'municipio', label: 'municipio' }, { key: 'lat', label: 'lat' }, { key: 'lng', label: 'lng' }, { key: 'actualizado', label: 'actualizado' },
        { label: 'requisitos_cumplidos', get: (o) => S.avance(o).cumplidos + '/' + rq.length },
        { label: 'requisitos_faltantes', get: (o) => S.avance(o).faltan.map((r) => r.label).join(' | ') }];
      U.download('operadores-verificacion.csv', 'text/csv;charset=utf-8', U.toCSV(filas, cols));
      ui().toast(`Se exportaron ${filas.length} operadores.`);
    };

    /* Filtros de un toque por situación legal */
    const chips = el('div', { class: 'filter-chips', role: 'group', 'aria-label': 'Filtrar por situación legal' },
      [['', 'Todos', null, ops.length], ...G4G.store.estadosVisibles().map(([k, e]) => [k, e.label, e, cs[k] || 0])]
        .map(([k, label, e, n]) => el('button', {
          type: 'button', class: 'filter-chip' + (f.estado === k ? ' is-on' : ''), 'aria-pressed': String(f.estado === k),
          onclick: (ev) => { f.estado = k; chips.querySelectorAll('.filter-chip').forEach((c) => { c.classList.remove('is-on'); c.setAttribute('aria-pressed', 'false'); }); ev.currentTarget.classList.add('is-on'); ev.currentTarget.setAttribute('aria-pressed', 'true'); pintar(); }
        }, e ? ui().shapeSvg(e.forma, e.color, 12) : null, label, el('span', { class: 'filter-chip__n' }, n))));
    const vistaSeg = el('div', { class: 'seg', role: 'group', 'aria-label': 'Vista' }, [['tarjetas', 'Tarjetas'], ['tabla', 'Tabla']].map(([v, l]) => el('button', {
      type: 'button', class: 'seg__btn' + (f.vista === v ? ' is-on' : ''), 'aria-pressed': String(f.vista === v),
      onclick: (e) => { f.vista = v; vistaSeg.querySelectorAll('.seg__btn').forEach((b) => { b.classList.remove('is-on'); b.setAttribute('aria-pressed', 'false'); }); e.currentTarget.classList.add('is-on'); e.currentTarget.setAttribute('aria-pressed', 'true'); pintar(); }
    }, l)));

    root.appendChild(el('div', { class: 'consult-head' },
      el('div', { class: 'search-big search-big--compact' }, el('span', { class: 'search-big__icon', 'aria-hidden': 'true' }, ui().icon('buscar', 20)),
        el('input', { class: 'search-big__input', type: 'search', placeholder: 'Buscar por nombre, municipio o departamento…', value: f.q, 'aria-label': 'Buscar operador', oninput: U.debounce((e) => { f.q = e.target.value; pintar(); }, 150) })),
      chips));
    root.appendChild(el('div', { class: 'toolbar' },
      el('select', { class: 'input', 'aria-label': 'Departamento', onchange: (e) => { f.depto = e.target.value; pintar(); } }, el('option', { value: '' }, 'Todos los departamentos'), deptos.map((d) => el('option', { value: d, selected: f.depto === d }, d))),
      el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: f.viejos, onchange: (e) => { f.viejos = e.target.checked; pintar(); } }), 'Solo con datos desactualizados'),
      counter, el('span', { class: 'spacer' }), vistaSeg, ui().button('Exportar CSV', { icon: 'descargar', onclick: exportar })));
    root.appendChild(resultados);
    pintar();
  }

  function onShow(root, params) {
    if (params && params.estado !== undefined) { f.estado = params.estado; f.q = ''; U.clear(root); render(root); }
  }

  G4G.app.register({ id: 'operadores', titulo: 'Consultar', icono: 'operadores', orden: 2, grupo: 'ciudadania', subtitulo: 'Situación legal de cooperativas y empresas mineras y qué requisitos les faltan', render, onShow });
})();
