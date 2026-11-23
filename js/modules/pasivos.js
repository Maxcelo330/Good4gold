/* Módulo: Pasivos. Priorización de colas, relaves y desmontes (riesgo × valor). */
(function () {
  const G4G = (window.G4G = window.G4G || {});
  const U = G4G.util, { el } = U;
  const ui = () => G4G.ui;
  const f = { clase: '', q: '' };
  let seleccionado = null;

  function filtrar() {
    return G4G.store.pasivosEvaluados().filter((p) => {
      if (f.clase && p.clase.id !== f.clase) return false;
      if (f.q && !U.norm((p.nombre || '') + ' ' + p.id + ' ' + (p._op ? p._op.nombre : '')).includes(U.norm(f.q))) return false;
      return true;
    });
  }

  function render(root) {
    const todos = G4G.store.pasivosEvaluados();
    const counter = el('span', { class: 'toolbar__count' });
    const scatterHost = el('div', { class: 'scatter-host' });
    const pintar = () => { U.clear(scatterHost); scatterHost.appendChild(G4G.charts.dispersion(filtrar(), { selected: seleccionado, onSelect: (p) => { seleccionado = p.id; pintar(); G4G.detalle.pasivo(p.id); } })); };

    const columnas = [
      { key: 'rank', label: '#', sortable: false, width: '38px', render: (p) => todos.indexOf(p) + 1 },
      { key: 'nombre', label: 'Pasivo', sortValue: (p) => p.nombre || p.id, render: (p) => el('div', null, el('div', { class: 'cell-main' }, p.nombre || p.id), el('div', { class: 'cell-sub' }, `${p.id} · ${p.tipo || 'Sin tipo'}`)) },
      { key: 'op', label: 'Responsable', sortValue: (p) => (p._op ? p._op.nombre : ''), render: (p) => p._op ? el('div', null, el('div', null, p._op.nombre), el('div', { class: 'cell-sub' }, G4G.config.estados[p._op.estado_legal].label)) : el('span', { class: 'muted' }, 'Sin registrar') },
      { key: 'riesgo', label: 'Riesgo', sortValue: (p) => p.riesgo, render: (p) => el('div', { class: 'progress progress--sm' }, ui().meter(p.riesgo, 100, { tone: 'risk' }), el('span', null, p.riesgo)) },
      { key: 'valor', label: 'Valor', align: 'right', sortValue: (p) => p.valor, render: (p) => p.valor === null ? el('span', { class: 'muted' }, 'Sin dato') : p.valor },
      { key: 'clase', label: 'Clasificación', sortValue: (p) => p.clase.nivel * 1000 - p.riesgo, render: (p) => ui().claseChip(p.clase) },
      { key: 'vol', label: 'Volumen m³', align: 'right', sortValue: (p) => p.volumen_m3, render: (p) => U.fmt(p.volumen_m3) },
      { key: 'rio', label: 'A un río', align: 'right', sortValue: (p) => p.dist_rio_m, render: (p) => p.dist_rio_m == null ? '—' : U.fmt(p.dist_rio_m) + ' m' }
    ];
    const tabla = ui().table({
      columns: columnas, rows: filtrar(), sort: 'clase', empty: 'Ningún pasivo coincide con los filtros.',
      onRow: (p) => { seleccionado = p.id; pintar(); G4G.detalle.pasivo(p.id); },
      onRender: (rows) => { counter.textContent = `${rows.length} de ${todos.length} pasivos`; }
    });
    const refrescar = () => { tabla.update(filtrar()); pintar(); };

    const exportar = () => {
      const cols = [{ key: 'id', label: 'id' }, { key: 'nombre', label: 'nombre' }, { key: 'tipo', label: 'tipo' }, { label: 'operador', get: (p) => (p._op ? p._op.nombre : '') },
        { key: 'lat', label: 'lat' }, { key: 'lng', label: 'lng' }, { key: 'volumen_m3', label: 'volumen_m3' }, { key: 'dist_rio_m', label: 'dist_rio_m' }, { key: 'ley_au_gt', label: 'ley_au_gt' },
        { key: 'riesgo', label: 'riesgo_0_100' }, { key: 'valor', label: 'valor_0_100' }, { label: 'clasificacion', get: (p) => p.clase.label }];
      U.download('pasivos-priorizados.csv', 'text/csv;charset=utf-8', U.toCSV(filtrar(), cols));
      ui().toast('Ranking exportado.');
    };

    const clases = [['', 'Toda clasificación'], ['prioridad1', 'Prioridad 1'], ['muestreo_urgente', 'Muestreo urgente'], ['remediar', 'Remediar o contener'], ['oportunidad', 'Oportunidad'], ['monitoreo', 'Monitoreo'], ['sin_dato', 'Sin dato de ley']];
    root.appendChild(el('div', { class: 'toolbar' },
      el('input', { class: 'input', type: 'search', placeholder: 'Buscar pasivo u operador…', value: f.q, oninput: U.debounce((e) => { f.q = e.target.value; refrescar(); }, 150) }),
      el('select', { class: 'input', onchange: (e) => { f.clase = e.target.value; refrescar(); } }, clases.map(([v, l]) => el('option', { value: v, selected: f.clase === v }, l))),
      counter, el('span', { class: 'spacer' }), ui().button('Exportar ranking', { icon: 'descargar', onclick: exportar })));

    root.appendChild(el('div', { class: 'grid grid--scatter' },
      ui().card('Riesgo y valor recuperable', [scatterHost, el('p', { class: 'muted small' }, 'Cada punto es un pasivo. Arriba a la derecha: riesgo y valor altos. Los umbrales se configuran en config.js.')]),
      ui().card('Cómo se calcula', el('div', { class: 'method' },
        el('p', null, el('strong', null, 'Riesgo (0–100): '), 'volumen, cercanía a ríos y a población, estado de la estructura, uso de mercurio y falta de un responsable legal.'),
        el('p', null, el('strong', null, 'Valor (índice 0–100): '), 'oro recuperable = volumen × densidad × ley × recuperación. Sin ley medida no se inventa: queda "sin dato" y se pide muestreo.'),
        el('p', null, el('strong', null, 'Uso: '), 'ordena dónde inspeccionar y dónde muestrear primero. Reprocesar exige licencia ambiental y control del mercurio.'),
        el('div', { class: 'note' }, 'Pesos y supuestos de demostración: deben validarse con especialistas antes de usarse en decisiones reales.')))));

    pintar();
    root.appendChild(ui().card(null, tabla.node, null, 'card--flush'));
  }

  G4G.app.register({ id: 'pasivos', titulo: 'Pasivos', icono: 'pasivos', orden: 11, grupo: 'tecnico', subtitulo: 'Colas y relaves priorizados por riesgo y valor', render });
})();
