/* Módulo: Monitoreo (solo funcionarios).
   Lista de pasivos ordenada por prioridad, con una pregunta simple por fila: ¿ya tiene muestra?
   El satélite y el puntaje ubican; solo la muestra mide. */
(function () {
  const G4G = (window.G4G = window.G4G || {});
  const U = G4G.util, { el } = U;
  const ui = () => G4G.ui, A = () => G4G.autoridad;
  const f = { q: '', sinMuestra: false, alta: false };
  let ultimas = new Map();      // pasivo_id -> muestra más reciente
  let resp = null, ticket = 0, tabla = null, refs = null;

  /* Muestra más reciente de cada pasivo. */
  function indexar(muestras) {
    const m = new Map();
    (muestras || []).forEach((x) => {
      const id = String(x.pasivo_id || '').trim(); if (!id) return;
      const t = A().ms(x.fecha) || 0, previa = m.get(id);
      if (!previa || t >= previa._t) m.set(id, Object.assign({}, x, { _t: t }));
    });
    return m;
  }
  /* 'registro': hay una muestra con resultado en la lista; 'marcada': el pasivo dice que tiene muestra; 'pendiente': ninguna. */
  const situacion = (p) => (ultimas.has(String(p.id)) ? 'registro' : (p.muestra ? 'marcada' : 'pendiente'));

  function filtrar() {
    return G4G.store.pasivosEvaluados().filter((p) => {
      if (f.sinMuestra && situacion(p) !== 'pendiente') return false;
      if (f.alta && p.clase.nivel !== 1) return false;
      if (f.q && !U.norm((p.nombre || '') + ' ' + p.id + ' ' + (p._op ? p._op.nombre : '')).includes(U.norm(f.q))) return false;
      return true;
    });
  }

  /* Ayuda para pedir la muestra: no hay acción en el servidor, se coordina con el técnico de campo. */
  function programar(p) {
    const coord = p.lat == null ? null : U.fmtCoord(p.lat, p.lng);
    ui().drawer.open({
      kicker: `Pasivo · ${p.id}`, title: 'Pedir una muestra', subtitle: p.nombre || p.id,
      body: el('div', null,
        el('div', { class: 'row-gap' }, ui().claseChip(p.clase)),
        el('p', { class: 'lead' }, el('strong', null, 'Pida al técnico de campo abrir Aurum80 Campo en este punto.'), ' Allí toma la muestra, la fotografía y la registra con su ubicación.'),
        el('p', { class: 'muted' }, p.clase.detalle),
        coord
          ? [el('h4', null, 'Dónde'),
            el('div', { class: 'acoord' }, el('span', { class: 'mono acoord__txt' }, coord), ui().button('Copiar coordenadas', { onclick: () => A().copiar(`${p.lat}, ${p.lng}`) })),
            el('div', { class: 'row-gap' },
              el('a', { class: 'btn btn--primary', href: A().enlaceMapa(p.lat, p.lng), target: '_blank', rel: 'noopener' }, ui().icon('ubicacion', 16), 'Abrir en Google Maps'),
              el('a', { class: 'btn', href: 'campo/', target: '_blank', rel: 'noopener' }, ui().icon('camara', 16), 'Abrir Aurum80 Campo'))]
          : el('div', { class: 'callout callout--warn' }, 'Este pasivo no tiene coordenadas registradas. Complételas en Registrar datos antes de enviar al técnico.'),
        el('div', { class: 'note' }, 'El satélite y el puntaje ubican; solo la muestra mide. Una muestra de campo orienta y no reemplaza al laboratorio acreditado.')),
      footer: [ui().button('Ver en detalle', { onclick: () => G4G.detalle.pasivo(p.id) }), ui().button('Cerrar', { onclick: () => ui().drawer.close() })]
    });
  }

  function celdaMuestra(p) {
    const s = situacion(p);
    if (s === 'registro') { const m = ultimas.get(String(p.id)); return el('div', null, el('div', { class: 'cell-main' }, 'Última muestra'), el('div', { class: 'cell-sub' }, A().fechaHora(m.fecha))); }
    if (s === 'marcada') return el('div', null, el('div', { class: 'cell-main' }, 'Muestra tomada'), el('div', { class: 'cell-sub' }, 'Sin resultado en la lista'));
    return el('span', { class: 'chip chip--warn' }, ui().shapeSvg('triangulo', '#B97A00', 12), 'Muestra pendiente');
  }

  function columnas(todos) {
    return [
      { key: 'rank', label: '#', sortable: false, width: '38px', render: (p) => todos.indexOf(p) + 1 },
      { key: 'nombre', label: 'Pasivo', sortValue: (p) => p.nombre || p.id, render: (p) => el('div', null, el('div', { class: 'cell-main' }, p.nombre || p.id), el('div', { class: 'cell-sub' }, p._op ? p._op.nombre : 'Sin responsable registrado')) },
      { key: 'clase', label: 'Prioridad', sortValue: (p) => p.clase.nivel * 1000 - p.riesgo, render: (p) => ui().claseChip(p.clase) },
      { key: 'muestra', label: 'Muestra', sortValue: (p) => (situacion(p) === 'pendiente' ? 0 : 1), render: celdaMuestra },
      { key: 'res', label: 'Resultado', sortValue: (p) => { const m = ultimas.get(String(p.id)); return m ? ['verde', 'amarillo', 'rojo'].indexOf(U.norm(m.semaforo)) : -1; },
        render: (p) => { const m = ultimas.get(String(p.id)); return m ? A().chipSemaforo(m.semaforo) : el('span', { class: 'muted' }, '—'); } },
      { key: 'acc', label: 'Acciones', sortable: false, render: (p) => el('div', { class: 'amini' },
        ui().button('Ver en detalle', { onclick: () => G4G.detalle.pasivo(p.id) }),
        ui().button('Pedir muestra', { icon: 'ubicacion', onclick: () => programar(p) })) }
    ];
  }

  function actualizar() {
    if (!tabla) return;
    const rows = filtrar(), todos = G4G.store.pasivosEvaluados();
    refs.cuenta.textContent = `${rows.length} de ${todos.length} pasivos`;
    const sin = todos.filter((p) => situacion(p) === 'pendiente').length;
    refs.resumen.textContent = todos.length ? `${sin} de ${todos.length} pasivos todavía no tienen muestra.` : '';
    tabla.update(rows);
  }

  async function cargar(forzar) {
    const mi = ++ticket;
    refs.estado.textContent = G4G.api.activo() ? 'Leyendo muestras…' : '';
    const r = await A().muestras(forzar);
    if (mi !== ticket || !refs) return;
    resp = r; ultimas = indexar(r.datos); refs.estado.textContent = '';
    U.clear(refs.aviso);
    /* Sin servidor o con error no se rompe nada: se usa solo el dato "muestra" de cada pasivo. */
    if (r.sinServidor) refs.aviso.appendChild(el('div', { class: 'callout' }, 'Modo demostración: sin servidor no se leen las muestras registradas. Se usa solo el dato "muestra" de cada pasivo.'));
    else if (r.error) refs.aviso.appendChild(el('div', { class: 'callout callout--warn' }, `No se pudo leer la lista de muestras (${r.error}). Se usa solo el dato "muestra" de cada pasivo.`));
    actualizar();
  }

  function chip(texto, clave) {
    const b = el('button', { type: 'button', class: 'achip' + (f[clave] ? ' is-on' : ''), 'aria-pressed': String(f[clave]), onclick: () => { f[clave] = !f[clave]; b.classList.toggle('is-on', f[clave]); b.setAttribute('aria-pressed', String(f[clave])); actualizar(); } }, texto);
    return b;
  }

  function render(root) {
    const todos = G4G.store.pasivosEvaluados();
    refs = { cuenta: el('span', { class: 'toolbar__count' }), resumen: el('p', { class: 'lead' }), estado: el('span', { class: 'muted small', role: 'status' }), aviso: el('div') };
    const previo = A().peek('muestras'); if (previo) ultimas = indexar(previo);
    tabla = ui().table({ columns: columnas(todos), rows: filtrar(), sort: 'clase', empty: todos.length ? 'Ningún pasivo coincide con los filtros.' : G4G.ilu.vacio('vacio-datos', 'Todavía no hay pasivos cargados. Cárguelos en la sección Datos.') });
    root.append(
      refs.resumen,
      el('div', { class: 'note' }, 'El satélite y el puntaje ubican; solo la muestra mide. Una muestra de campo orienta y no reemplaza al laboratorio acreditado.'),
      refs.aviso,
      el('div', { class: 'toolbar' },
        el('input', { class: 'input', type: 'search', placeholder: 'Buscar pasivo u operador…', 'aria-label': 'Buscar', value: f.q, oninput: U.debounce((e) => { f.q = e.target.value; actualizar(); }, 150) }),
        chip('Solo sin muestra', 'sinMuestra'), chip('Solo prioridad alta', 'alta'),
        refs.cuenta, refs.estado, el('span', { class: 'spacer' }), ui().button('Actualizar', { icon: 'actualizar', onclick: () => cargar(true) })),
      ui().card(null, tabla.node, null, 'card--flush'));
    actualizar();
    cargar(false);
  }

  G4G.app.register({ id: 'monitoreo', titulo: 'Monitoreo', icono: 'monitoreo', orden: 17, grupo: 'tecnico', subtitulo: 'Qué pasivos necesitan muestra y cómo salió la última', render });
})();
