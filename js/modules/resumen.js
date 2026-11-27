/* Módulo: Resumen del panel de autoridades.
   Lectura rápida: indicadores clicables arriba (cada uno lleva a su sección), qué atender primero y gráficos simples.
   Solo conteos, porcentajes y barras. Muestras y solicitudes vienen del servidor: si no responde, ese bloque se oculta.
   Aquí también viven las ayudas compartidas por las demás secciones del panel (G4G.autoridad). */
(function () {
  const G4G = (window.G4G = window.G4G || {});
  const U = G4G.util, { el } = U;
  const ui = () => G4G.ui;

  /* ------------------------------------------------------------------
     Ayudas compartidas (se usan al mostrar cada sección, no al cargar).
     ------------------------------------------------------------------ */
  const cache = {};   // clave -> { datos, ts, promesa }
  /* Pide una lista al servidor y la guarda 45 s para no repetir pedidos. Nunca lanza: devuelve
     { datos, error, sinServidor }. Sin servidor (modo demostración) no hay muestras ni solicitudes. */
  function cargar(clave, llamar, forzar) {
    if (!G4G.api.activo()) return Promise.resolve({ datos: null, sinServidor: true });
    const c = cache[clave] || (cache[clave] = { datos: null, ts: 0, promesa: null });
    if (c.promesa) return c.promesa;
    if (c.datos && !forzar && Date.now() - c.ts < 45000) return Promise.resolve({ datos: c.datos });
    c.promesa = llamar(G4G.auth.token()).then((lista) => {
      c.datos = lista; c.ts = Date.now(); return { datos: lista };
    }).catch((e) => {
      if (e && e.codigo === 'sesion') G4G.auth.vencida();
      return { datos: c.datos, error: (e && e.message) || 'No se pudo cargar.' };
    }).then((r) => { c.promesa = null; return r; });
    return c.promesa;
  }
  const lista = (r, k) => (r && Array.isArray(r[k]) ? r[k] : []);
  G4G.bus.on('auth:changed', () => { Object.keys(cache).forEach((k) => delete cache[k]); });

  /* Milisegundos de una fecha que puede venir como número o como texto ISO. */
  function ms(v) {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number') return v;
    const t = Date.parse(v);
    return Number.isNaN(t) ? null : t;
  }
  /* El "a. m."/"p. m." no se separa de la hora al cortar la línea. */
  const fechaHora = (v) => { const t = ms(v); return t === null ? (v ? String(v) : '—') : U.fmtDateTime(t).replace(/\s([ap])\.\s?m\./i, '\u00A0$1.\u00A0m.'); };

  function chipSemaforo(id) {
    const e = G4G.config.semaforoMuestra[U.norm(id)];
    if (!e) return el('span', { class: 'chip' }, 'Sin resultado');
    return el('span', { class: 'chip chip--estado' }, ui().shapeSvg(e.forma, e.color, 12), e.label);
  }

  function copiar(texto) {
    const ok = () => ui().toast('Copiado.');
    const alt = () => {
      const t = el('textarea', { style: { position: 'fixed', opacity: '0' } }, texto);
      document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); ok(); } catch (e) { ui().toast('No se pudo copiar. Seleccione el texto y cópielo.', 'warn'); }
      t.remove();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texto).then(ok, alt); else alt();
  }
  const enlaceMapa = (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`;

  /* Barras horizontales simples: [{ label, n, color, forma, onClick }]. */
  function barras(items, etiquetaVacia) {
    const max = Math.max(1, ...items.map((i) => i.n));
    const total = items.reduce((s, i) => s + i.n, 0);
    if (!total) return el('p', { class: 'muted' }, etiquetaVacia || 'Sin datos todavía.');
    return el('ul', { class: 'abars' }, items.map((i) => {
      const fila = [
        el('span', { class: 'abars__label' }, i.forma ? ui().shapeSvg(i.forma, i.color, 12) : null, i.label),
        el('span', { class: 'abars__track', 'aria-hidden': 'true' }, el('span', { class: 'abars__fill', style: { width: (i.n / max) * 100 + '%', background: i.color || 'var(--ink-2)' } })),
        el('span', { class: 'abars__n' }, U.fmt(i.n), el('small', null, ` · ${U.pct(i.n, total)}%`))];
      return el('li', null, i.onClick ? el('button', { type: 'button', class: 'abars__row', onclick: i.onClick }, fila) : el('div', { class: 'abars__row' }, fila));
    }));
  }

  /* Texto para estados de carga y error de una lista del servidor. */
  function avisoServidor(r, que) {
    if (r && r.sinServidor) return el('div', { class: 'callout' }, el('strong', null, 'Modo demostración. '), `Sin servidor configurado no hay ${que}: llegan desde la base del municipio.`);
    if (r && r.error) return el('div', { class: 'callout callout--warn' }, `No se pudieron cargar las ${que}: ${r.error} `, el('span', { class: 'muted' }, 'Revise la conexión y pulse Actualizar.'));
    return null;
  }

  G4G.autoridad = {
    muestras: (forzar) => cargar('muestras', (t) => G4G.api.muestras(t).then((r) => lista(r, 'muestras')), forzar),
    inscripciones: (forzar) => cargar('inscripciones', (t) => G4G.api.inscripciones(t).then((r) => lista(r, 'inscripciones')), forzar),
    peek: (clave) => (cache[clave] ? cache[clave].datos : null),
    invalidar: (clave) => { if (cache[clave]) cache[clave].ts = 0; },
    ms, fechaHora, chipSemaforo, copiar, enlaceMapa, barras, avisoServidor
  };

  /* ------------------------------------------------------------------
     Resumen
     ------------------------------------------------------------------ */
  const A = G4G.autoridad;
  const DIA = 86400000;
  let ticket = 0;
  const carga = { m: 'carga', i: 'carga' };   // 'carga' | 'ok' | 'oculto'

  const conteos = (lista, key) => lista.reduce((acc, r) => { const k = key(r); acc[k] = (acc[k] || 0) + 1; return acc; }, {});
  const estaAbierta = (d) => d.estado === 'nueva' || d.estado === 'en_revision';

  /* Todo lo que se calcula con los datos que ya están en el dispositivo. */
  function calcular() {
    const S = G4G.store, ops = S.state.operadores, pas = S.pasivosEvaluados(), R = G4G.config.radioCercaniaKm;
    const c = { ops, pas, estados: conteos(ops, (o) => o.estado_legal) };
    const enProceso = ops.filter((o) => o.estado_legal === 'proceso');
    c.proceso = enProceso.length;
    c.avance = enProceso.length ? Math.round(100 * enProceso.reduce((s, o) => { const a = S.avance(o); return s + (a.total ? a.cumplidos / a.total : 0); }, 0) / enProceso.length) : null;
    const dens = (G4G.api.activo() ? S.state.denunciasRed.filter((d) => d.completa) : S.state.denuncias);
    c.dens = dens;
    c.den7 = dens.filter((d) => { const t = ms(d.recibido || d.creado); return t !== null && Date.now() - t <= 7 * DIA; }).length;
    c.denEstado = conteos(dens, (d) => d.estado || 'nueva');
    c.abiertas = dens.filter(estaAbierta).length;
    c.puntos = dens.filter((d) => estaAbierta(d) && Number.isFinite(Number(d.lat)) && !ops.some((o) => o.lat != null && U.haversineKm({ lat: Number(d.lat), lng: Number(d.lng) }, o) <= R)).length;
    c.altas = pas.filter((p) => p.clase.nivel === 1).length;
    return c;
  }

  /* Pasivos que tienen muestra: el dato del propio pasivo o una muestra registrada con su código. */
  function conMuestra(muestras) {
    const ids = new Set((muestras || []).map((m) => String(m.pasivo_id || '').trim()).filter(Boolean));
    return (p) => !!p.muestra || ids.has(String(p.id));
  }

  function kpi(o) {
    return el('button', { type: 'button', class: 'akpi' + (o.tono ? ' akpi--' + o.tono : ''), onclick: () => G4G.app.go(o.destino), title: 'Abrir: ' + o.etiquetaIr },
      el('span', { class: 'akpi__label' }, o.label), el('span', { class: 'akpi__value' }, o.valor), el('span', { class: 'akpi__sub' }, o.sub));
  }

  function pintar(root) {
    U.clear(root);
    const S = G4G.store, c = calcular(), n = c.ops.length, cs = c.estados;
    const muestras = carga.m === 'ok' ? A.peek('muestras') : null;
    const inscr = carga.i === 'ok' ? A.peek('inscripciones') : null;
    const tiene = conMuestra(muestras);
    const sinMuestra = c.pas.filter((p) => !tiene(p));
    const pendientes = inscr ? inscr.filter((x) => x.estado === 'pendiente') : [];
    const sem = muestras ? conteos(muestras, (m) => U.norm(m.semaforo)) : {};

    /* 1. Indicadores */
    const kpis = [
      kpi({ label: 'Operadores registrados', valor: U.fmt(n), sub: `${U.fmt(cs.legal || 0)} legales · ${U.fmt(cs.sin_dato || 0)} sin verificar`, destino: 'operadores', etiquetaIr: 'operadores' }),
      kpi({ label: 'En proceso de regularizar', valor: U.fmt(c.proceso), sub: c.avance === null ? 'Ninguno por ahora' : `Avance promedio: ${c.avance}% de los requisitos`, tono: 'mid', destino: 'operadores', etiquetaIr: 'operadores' }),
      kpi({ label: 'Denuncias esta semana', valor: U.fmt(c.den7), sub: `${U.fmt(c.abiertas)} por atender en total`, tono: c.abiertas ? 'bad' : 'ok', destino: 'buzon', etiquetaIr: 'denuncias recibidas' }),
      kpi({ label: 'Puntos por verificar', valor: U.fmt(c.puntos), sub: `Denuncias sin operación registrada a menos de ${G4G.config.radioCercaniaKm} km`, tono: c.puntos ? 'mid' : 'ok', destino: 'buzon', etiquetaIr: 'denuncias recibidas' }),
      kpi({ label: 'Pasivos de prioridad alta', valor: U.fmt(c.altas), sub: `de ${U.fmt(c.pas.length)} pasivos (colas y relaves)`, tono: c.altas ? 'risk' : null, destino: 'pasivos', etiquetaIr: 'pasivos' }),
      kpi({ label: 'Pasivos sin muestra', valor: U.fmt(sinMuestra.length), sub: carga.m === 'ok' ? 'Solo la muestra mide el mercurio' : 'Según la ficha de cada pasivo', tono: sinMuestra.length ? 'mid' : 'ok', destino: 'monitoreo', etiquetaIr: 'monitoreo' })
    ];
    if (carga.m === 'carga') kpis.push(el('div', { class: 'akpi akpi--wait', 'aria-busy': 'true' }, el('span', { class: 'akpi__label' }, 'Muestras con alerta'), el('span', { class: 'akpi__value' }, '…'), el('span', { class: 'akpi__sub' }, 'Cargando')));
    else if (muestras) kpis.push(kpi({ label: 'Muestras con alerta', valor: U.fmt(sem.rojo || 0), sub: `${U.fmt(muestras.length)} muestras · ${U.fmt(sem.amarillo || 0)} por confirmar`, tono: sem.rojo ? 'bad' : 'ok', destino: 'muestras', etiquetaIr: 'muestras' }));
    if (carga.i === 'carga') kpis.push(el('div', { class: 'akpi akpi--wait', 'aria-busy': 'true' }, el('span', { class: 'akpi__label' }, 'Solicitudes pendientes'), el('span', { class: 'akpi__value' }, '…'), el('span', { class: 'akpi__sub' }, 'Cargando')));
    else if (inscr) kpis.push(kpi({ label: 'Solicitudes pendientes', valor: U.fmt(pendientes.length), sub: `de ${U.fmt(inscr.length)} solicitudes de programas`, tono: pendientes.length ? 'mid' : 'ok', destino: 'solicitudes', etiquetaIr: 'solicitudes de programas' }));
    root.appendChild(el('div', { class: 'akpis' }, kpis));

    /* 2. Qué atender primero */
    const nZonas = G4G.deteccion ? G4G.deteccion.cantidad() : 0;
    const issues = S.validar();
    const nuevas = S.denunciasNuevas();
    const atencion = [];
    if (nuevas) atencion.push(['denuncias', `${nuevas} denuncia${nuevas > 1 ? 's' : ''} nueva${nuevas > 1 ? 's' : ''} sin revisar`, 'buzon']);
    if (c.puntos) atencion.push(['warn', `${c.puntos} denuncia${c.puntos > 1 ? 's' : ''} en lugares sin operación registrada: conviene verificar en campo`, 'buzon']);
    if (pendientes.length) atencion.push(['warn', `${pendientes.length} solicitud${pendientes.length > 1 ? 'es' : ''} de programas por responder`, 'solicitudes']);
    if (sem.rojo) atencion.push(['error', `${sem.rojo} muestra${sem.rojo > 1 ? 's' : ''} con resultado de prioridad: confirmar en laboratorio`, 'muestras']);
    const altasSin = c.pas.filter((p) => p.clase.nivel === 1 && !tiene(p)).length;
    if (altasSin) atencion.push(['warn', `${altasSin} pasivo${altasSin > 1 ? 's' : ''} de prioridad alta sin muestra`, 'monitoreo']);
    if (nZonas) atencion.push(['info', `${nZonas} zona${nZonas > 1 ? 's' : ''} revisada${nZonas > 1 ? 's' : ''} como posible actividad minera, por verificar en campo`, 'deteccion']);
    issues.filter((i) => i.sev !== 'info').forEach((i) => atencion.push([i.sev, `${i.titulo}: ${i.ids.length}`, 'datos']));
    issues.filter((i) => i.codigo === 'sin-ley').forEach((i) => atencion.push(['info', `${i.titulo}: ${i.ids.length}`, 'pasivos']));

    const hayMuestras = carga.m === 'ok' && muestras;
    const clases = {};
    c.pas.forEach((p) => { (clases[p.clase.id] = clases[p.clase.id] || { clase: p.clase, n: 0 }).n++; });
    const itemsClase = Object.values(clases).sort((a, b) => a.clase.nivel - b.clase.nivel || b.n - a.n)
      .map((x) => ({ label: x.clase.corto, n: x.n, color: G4G.config.pasivoColor[x.clase.nivel] || G4G.config.pasivoColor[4], onClick: () => G4G.app.go('pasivos') }));
    const itemsDen = Object.entries(G4G.config.estadosDenuncia).map(([k]) => ({ label: G4G.config.estadosDenuncia[k].label, n: c.denEstado[k] || 0, color: { nueva: 'var(--ink)', en_revision: 'var(--blue)', atendida: 'var(--ok)', descartada: 'var(--unk)' }[k], onClick: () => G4G.app.go('buzon') }));
    const itemsSem = Object.entries(G4G.config.semaforoMuestra).map(([k, v]) => ({ label: v.label, n: sem[k] || 0, color: v.color, forma: v.forma, onClick: () => G4G.app.go('muestras') }));

    root.appendChild(el('div', { class: 'grid grid--2' },
      ui().card('Qué atender primero', atencion.length
        ? el('ul', { class: 'attn' }, atencion.map(([sev, txt, destino]) => el('li', { class: 'attn--' + sev },
          el('span', { class: 'attn__dot', 'aria-hidden': 'true' }), el('span', { class: 'attn__txt' }, txt),
          el('button', { type: 'button', class: 'link', onclick: () => G4G.app.go(destino) }, 'Revisar'))))
        : ui().empty('Todo en orden: no hay pendientes por ahora.')),
      el('div', { class: 'astack' },
        ui().card('Situación legal de los operadores', [G4G.charts.barraApilada(cs),
          c.avance === null ? null : el('div', { class: 'abloque' }, el('div', { class: 'quality__label' }, 'Avance promedio de los que están en proceso'), el('div', { class: 'progress' }, ui().meter(c.avance), el('span', null, c.avance + '%')))]),
        ui().card('Denuncias por estado', [A.barras(itemsDen, 'Todavía no llegaron denuncias.'), c.dens.length ? el('p', { class: 'muted small' }, `${U.fmt(c.den7)} llegaron en los últimos 7 días.`) : null]))));

    /* 3. Pasivos y muestras */
    const porDepto = {};
    c.ops.forEach((o) => { const d = o.departamento || 'Sin departamento'; (porDepto[d] = porDepto[d] || { label: d, total: 0, conteos: {} }); porDepto[d].total++; porDepto[d].conteos[o.estado_legal] = (porDepto[d].conteos[o.estado_legal] || 0) + 1; });
    const grupos = Object.values(porDepto).sort((a, b) => b.total - a.total);
    const cardDepto = ui().card('Operadores por departamento', grupos.length ? G4G.charts.barrasPorGrupo(grupos) : ui().empty('Sin datos.'));
    const top = c.pas.slice(0, 6);
    const rank = el('ol', { class: 'rank' }, top.map((p, i) => el('li', null,
      el('button', { type: 'button', class: 'rank__row', onclick: () => G4G.detalle.pasivo(p.id) },
        el('span', { class: 'rank__n' }, i + 1),
        el('span', { class: 'rank__main' }, el('span', { class: 'rank__name' }, p.nombre || p.id), el('span', { class: 'rank__sub' }, p._op ? p._op.nombre : 'Sin responsable registrado')),
        el('span', { class: 'rank__scores' }, ui().meter(p.riesgo, 100, { tone: 'risk' }), el('span', { class: 'rank__pts' }, p.riesgo)),
        ui().claseChip(p.clase)))));
    root.appendChild(el('div', { class: 'grid grid--2' },
      ui().card('Pasivos por prioridad', A.barras(itemsClase, 'Todavía no hay pasivos cargados.')),
      hayMuestras ? ui().card('Muestras por resultado', [A.barras(itemsSem, 'Todavía no hay muestras registradas.'), el('p', { class: 'muted small' }, 'Tamizaje de campo: orienta, no reemplaza al laboratorio acreditado.')]) : cardDepto));

    /* 4. Pasivos a priorizar */
    root.appendChild(el('div', { class: 'grid grid--2' },
      ui().card('Pasivos a priorizar', top.length ? [rank, el('div', { class: 'row-gap' }, ui().button('Ver todos los pasivos', { onclick: () => G4G.app.go('pasivos') }), ui().button('Ver monitoreo', { onclick: () => G4G.app.go('monitoreo') }))] : ui().empty(G4G.ilu.vacio('vacio-datos', 'Todavía no hay pasivos cargados. Cárguelos en la sección Datos.')), null, hayMuestras ? '' : 'acol-full'),
      hayMuestras ? cardDepto : null));

    /* 5. Calidad de la base */
    const comp = S.completitud();
    root.appendChild(ui().card('Calidad de la base', el('div', { class: 'quality' },
      el('div', null, el('div', { class: 'quality__label' }, 'Operadores: datos completos'), el('div', { class: 'progress' }, ui().meter(comp.operadores), el('span', null, comp.operadores + '%'))),
      el('div', null, el('div', { class: 'quality__label' }, 'Pasivos: datos completos'), el('div', { class: 'progress' }, ui().meter(comp.pasivos), el('span', null, comp.pasivos + '%'))),
      el('p', { class: 'muted' }, 'Los vacíos de datos son parte del diagnóstico: el método los muestra en lugar de ocultarlos.'))));
  }

  /* Muestras y solicitudes se piden al servidor sin frenar la pantalla; si fallan, ese bloque no aparece. */
  async function cargarServidor(root, mi) {
    if (!G4G.api.activo()) { carga.m = 'oculto'; carga.i = 'oculto'; return; }
    const hecho = (r) => (r.datos ? 'ok' : 'oculto');
    const [m, i] = await Promise.all([A.muestras(), A.inscripciones()]);
    if (mi !== ticket) return;
    carga.m = hecho(m); carga.i = hecho(i);
    pintar(root);
  }

  function render(root) {
    const mi = ++ticket;
    const activo = G4G.api.activo();
    carga.m = activo ? (A.peek('muestras') ? 'ok' : 'carga') : 'oculto';
    carga.i = activo ? (A.peek('inscripciones') ? 'ok' : 'carga') : 'oculto';
    pintar(root);
    cargarServidor(root, mi);
  }

  G4G.app.register({ id: 'resumen', reaccionaDenuncias: true, titulo: 'Resumen', icono: 'resumen', orden: 10, grupo: 'tecnico', movil: ['funcionario'], subtitulo: 'Qué atender hoy: denuncias, pasivos, muestras y solicitudes', render });
})();
