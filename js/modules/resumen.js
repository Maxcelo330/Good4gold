/* Módulo: Resumen. Lectura rápida del estado de la base y qué atender. */
(function () {
  const G4G = (window.G4G = window.G4G || {});
  const U = G4G.util, { el } = U;
  const ui = () => G4G.ui;

  function conteos(lista, key) {
    return lista.reduce((acc, r) => { const k = key(r); acc[k] = (acc[k] || 0) + 1; return acc; }, {});
  }

  function render(root) {
    const S = G4G.store, st = S.state, ops = st.operadores;
    const cs = conteos(ops, (o) => o.estado_legal), n = ops.length;
    const pas = S.pasivosEvaluados();

    root.appendChild(el('div', { class: 'kpis' },
      ui().kpi('Operadores registrados', U.fmt(n), `${U.fmt(pas.length)} pasivos asociados`),
      ui().kpi('Legales', U.fmt(cs.legal || 0), `${U.pct(cs.legal || 0, n)}% del total`, 'ok'),
      ui().kpi('En proceso', U.fmt(cs.proceso || 0), `${U.pct(cs.proceso || 0, n)}% · faltan requisitos`, 'mid'),
      ui().kpi('No legales', U.fmt(cs.no_legal || 0), `${U.pct(cs.no_legal || 0, n)}% del total`, 'bad'),
      ui().kpi('Sin verificar', U.fmt(cs.sin_dato || 0), 'Falta dato del regulador', 'unk')));

    /* Situación legal + por departamento */
    const porDepto = {};
    ops.forEach((o) => { const d = o.departamento || 'Sin departamento'; (porDepto[d] = porDepto[d] || { label: d, total: 0, conteos: {} }); porDepto[d].total++; porDepto[d].conteos[o.estado_legal] = (porDepto[d].conteos[o.estado_legal] || 0) + 1; });
    const grupos = Object.values(porDepto).sort((a, b) => b.total - a.total);

    root.appendChild(el('div', { class: 'grid grid--2' },
      ui().card('Situación legal de los operadores', G4G.charts.barraApilada(cs)),
      ui().card('Operadores por departamento', grupos.length ? G4G.charts.barrasPorGrupo(grupos) : ui().empty('Sin datos.'))));

    /* Pasivos a priorizar + para verificar */
    const top = pas.slice(0, 6);
    const lista = el('ol', { class: 'rank' }, top.map((p, i) => el('li', null,
      el('button', { type: 'button', class: 'rank__row', onclick: () => G4G.detalle.pasivo(p.id) },
        el('span', { class: 'rank__n' }, i + 1),
        el('span', { class: 'rank__main' }, el('span', { class: 'rank__name' }, p.nombre || p.id), el('span', { class: 'rank__sub' }, p._op ? p._op.nombre : 'Sin responsable registrado')),
        el('span', { class: 'rank__scores' }, ui().meter(p.riesgo, 100, { tone: 'risk' }), el('span', { class: 'rank__pts' }, p.riesgo)),
        ui().claseChip(p.clase)))));
    const verMas = ui().button('Ver todos los pasivos', { onclick: () => G4G.app.go('pasivos') });

    const issues = S.validar();
    const nuevas = st.denuncias.filter((d) => d.estado === 'nueva').length;
    const atencion = [];
    if (nuevas) atencion.push(['denuncias', `${nuevas} denuncia${nuevas > 1 ? 's' : ''} nueva${nuevas > 1 ? 's' : ''} sin revisar`, 'denuncias']);
    issues.filter((i) => i.sev !== 'info').forEach((i) => atencion.push([i.sev, `${i.ids.length} · ${i.titulo}`, 'datos']));
    issues.filter((i) => i.codigo === 'sin-ley').forEach((i) => atencion.push(['info', `${i.ids.length} · ${i.titulo}`, 'pasivos']));

    root.appendChild(el('div', { class: 'grid grid--2' },
      ui().card('Pasivos a priorizar', top.length ? [lista, verMas] : ui().empty('Todavía no hay pasivos cargados. Cárguelos en la sección Datos.')),
      ui().card('Para verificar', atencion.length
        ? el('ul', { class: 'attn' }, atencion.map(([sev, txt, destino]) => el('li', { class: 'attn--' + sev },
          el('span', { class: 'attn__dot', 'aria-hidden': 'true' }), el('span', { class: 'attn__txt' }, txt),
          el('button', { type: 'button', class: 'link', onclick: () => G4G.app.go(destino) }, 'Revisar'))))
        : ui().empty('Todo en orden: no hay pendientes de verificación.'))));

    const comp = S.completitud();
    root.appendChild(ui().card('Calidad de la base', el('div', { class: 'quality' },
      el('div', null, el('div', { class: 'quality__label' }, 'Operadores: datos completos'), el('div', { class: 'progress' }, ui().meter(comp.operadores), el('span', null, comp.operadores + '%'))),
      el('div', null, el('div', { class: 'quality__label' }, 'Pasivos: datos completos'), el('div', { class: 'progress' }, ui().meter(comp.pasivos), el('span', null, comp.pasivos + '%'))),
      el('p', { class: 'muted' }, 'Los vacíos de datos son parte del diagnóstico: el método los muestra en lugar de ocultarlos.'))));
  }

  G4G.app.register({ id: 'resumen', titulo: 'Resumen', icono: 'resumen', orden: 10, grupo: 'tecnico', subtitulo: 'Estado de la base de datos y prioridades', render });
})();
