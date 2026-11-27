/* Módulo: Trámites para ser legal. Lista paso a paso (stepper vertical) con lo que dice G4G.normativa.tramites.
   Nada de leyes ni trámites va escrito aquí: todo sale de G4G.normativa.
   Con sesión de cooperativa o empresa, cada paso se marca según su ficha y se destaca el siguiente pendiente. */
(function () {
  const G4G = (window.G4G = window.G4G || {});
  const U = G4G.util, { el } = U;
  const ui = () => G4G.ui;

  let ctx = null;
  G4G.bus.on('miestado:viejo', () => { if (ctx && ctx.t) ctx.t = 1; });

  const lista = () => ((G4G.normativa || {}).tramites || []).slice().sort((a, b) => (a.n || 0) - (b.n || 0));

  /* Estado de cada requisito de la ficha: { id: 'listo' | 'proceso' | 'faltante' }. */
  const mapaEstados = (op) => Object.fromEntries(op.requisitos.map((r) => [r.id, r.estado]));

  function paso(t, i, estados, idSiguiente) {
    const P = G4G.inicio;
    const clave = t.requisito && estados ? estados[t.requisito] : null;
    const esSig = !!idSiguiente && (t.id || i) === idSiguiente;
    const cls = ['p2-paso', clave ? 'is-' + clave : '', esSig ? 'is-siguiente' : ''].filter(Boolean).join(' ');
    const enlace = P.urlSegura(t.url);
    const referencial = P.esReferencial(t);
    const etiquetas = [esSig ? el('span', { class: 'p2-estado p2-estado--siguiente' }, 'Siguiente paso') : null,
      clave ? G4G.miestado.chipRequisito(clave) : null, referencial ? P.rotuloReferencial() : null].filter(Boolean);
    return el('li', { class: cls, 'aria-current': esSig ? 'step' : null },
      el('span', { class: 'p2-paso__n', 'aria-hidden': 'true' }, String(t.n || i + 1)),
      el('div', { class: 'p2-paso__card' },
        etiquetas.length ? el('div', { class: 'p2-paso__tags' }, etiquetas) : null,
        el('h3', { class: 'p2-paso__title' }, el('span', { class: 'visually-hidden' }, `Paso ${t.n || i + 1}: `), t.titulo),
        t.institucion ? el('div', { class: 'p2-paso__inst' }, ui().icon('operadores', 16), el('span', null, t.institucion)) : null,
        t.detalle ? el('p', { class: 'p2-paso__det' }, t.detalle) : null,
        (t.documento || t.norma) ? el('div', { class: 'p2-paso__meta' },
          t.documento ? el('span', null, el('strong', null, 'Documento: '), t.documento) : null,
          t.norma ? el('span', null, el('strong', null, 'Norma: '), t.norma) : null) : null,
        enlace ? el('a', { class: 'p2-paso__link', href: enlace, target: '_blank', rel: 'noopener noreferrer' }, 'Ver el texto de la norma ↗') : null));
  }

  function cuerpo(c) {
    const P = G4G.inicio, A = G4G.auth, items = lista();
    const op = c.datos ? c.datos.operador : null, estados = op ? mapaEstados(op) : null;
    /* Siguiente paso: el primero (en orden) cuyo requisito aún no está listo. */
    let idSig = null;
    if (estados) {
      const i = items.findIndex((t) => t.requisito && estados[t.requisito] && estados[t.requisito] !== 'listo');
      if (i >= 0) idSig = items[i].id || i;
    }
    const partes = [];

    partes.push(el('div', { class: 'p2-aviso' }, ui().icon('info', 20),
      el('span', null, el('strong', null, 'Esto es una orientación. '), 'No reemplaza la asesoría de las instituciones oficiales: confirma siempre los requisitos con ellas antes de iniciar un trámite.')));

    /* Estado de la sesión */
    if (A.esOperador()) {
      if (c.cargando) partes.push(el('div', { class: 'p2-carga', role: 'status' }, el('p', { class: 'p2-carga__txt' }, 'Cargando tu avance…'), el('div', { class: 'p2-carga__linea' })));
      else if (c.error) partes.push(el('div', { class: 'p2-aviso p2-aviso--error', role: 'alert' }, ui().icon('alerta', 20), el('span', null, c.error + ' Aun así puedes ver los pasos.')),
        el('button', { type: 'button', class: 'btn', onclick: () => cargarAvance(c, true) }, ui().icon('actualizar', 18), 'Intentar de nuevo'));
      else if (op) partes.push(el('div', { class: 'p2-aviso p2-aviso--ok' }, ui().icon('miestado', 20),
        el('span', null, el('strong', null, `Llevas ${op.cumplidos} de ${op.total} requisitos listos. `), idSig !== null ? 'Te marcamos el siguiente paso para que sepas por dónde seguir.' : 'No tienes pasos pendientes en esta lista.')));
    }

    if (!items.length) {
      partes.push(el('div', { class: 'p2-vacio' }, 'Todavía no hay trámites cargados.'));
    } else {
      partes.push(el('ol', { class: 'p2-pasos', 'aria-label': 'Pasos para ser legal' }, items.map((t, i) => paso(t, i, estados, idSig))));
    }

    const f = P.lineaFuente('', '');
    if (f) partes.push(f);

    /* Acciones según el perfil */
    if (A.esOperador()) partes.push(el('div', { class: 'p2-acciones' }, el('a', { class: 'btn btn--primary', href: '#/miestado' }, ui().icon('miestado', 18), 'Ir a Mi estado')));
    else if (A.rol() === 'publico') partes.push(el('div', { class: 'p2-acciones' }, el('a', { class: 'btn btn--primary', href: '#/ingresar' }, ui().icon('usuario', 18), 'Ingresar para ver tu avance')));
    return partes;
  }

  function pintar(c) { U.clear(c.cont); c.cont.append(...cuerpo(c)); }

  function cargarAvance(c, forzar) {
    if (!G4G.auth.esOperador() || !G4G.api.activo()) return;
    c.cargando = true; c.error = ''; pintar(c);
    G4G.miestado.cargar(!!forzar).then((d) => {
      if (ctx !== c) return;
      c.datos = d; c.cargando = false; c.t = Date.now(); pintar(c);
    }).catch((e) => {
      if (ctx !== c) return;
      c.cargando = false; c.error = G4G.miestado.mensajeDeError(e); pintar(c);
    });
  }

  function render(root) {
    root.classList.add('p2');
    const c = ctx = { cont: el('div', { class: 'p2-pasos-wrap', style: { display: 'grid', gap: '14px' } }), datos: null, cargando: false, error: '', t: 0 };
    root.appendChild(el('div', { class: 'il-intro' },
      el('p', { class: 'p2-lead', style: { marginBottom: 0 } }, 'Sigue estos pasos en orden para operar con todos tus permisos. Si algo no te queda claro, pregunta en la institución que lo emite.'),
      el('img', { class: 'il il-intro__img', src: 'img/tramites.svg', alt: '', width: 210, height: 158, decoding: 'async' })));
    root.appendChild(c.cont);
    pintar(c);
    cargarAvance(c, false);
  }

  /* Al volver a la pantalla se actualiza el avance si ya pasó un rato. */
  function onShow() { if (ctx && ctx.t && G4G.auth.esOperador() && Date.now() - ctx.t > 20000) cargarAvance(ctx, false); }

  G4G.app.register({ id: 'tramites', titulo: 'Trámites para ser legal', corto: 'Trámites', icono: 'tramites', orden: 4, grupo: 'ciudadania', movil: ['publico'], subtitulo: 'Los pasos para operar con todos tus permisos', render, onShow });
})();
