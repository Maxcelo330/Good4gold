/* Módulo: Mi estado (cooperativas y empresas con sesión).
   Muestra la situación legal, el avance de los requisitos, el siguiente paso y las inscripciones a programas.
   Tono de apoyo: se dice qué sigue, nunca se señala culpa.
   También expone G4G.miestado con ayudas que usan Trámites y Programas (cargar, normalizar, siguiente, chips). */
(function () {
  const G4G = (window.G4G = window.G4G || {});
  const U = G4G.util, { el } = U;
  const ui = () => G4G.ui;

  /* ---------- Datos: miOperador con una copia corta para no repetir llamadas ---------- */
  const VIGENCIA_MS = 20000;
  let cache = null, enCurso = null;

  /* Requisito -> 'listo' (true), 'faltante' (false) o 'proceso' (sin dato). */
  function normalizar(op) {
    op = op || {};
    const requisitos = G4G.config.requisitos.map((r) => {
      const v = U.parseBool(op['req_' + r.id]);
      return { id: r.id, label: r.label, estado: v === true ? 'listo' : v === false ? 'faltante' : 'proceso' };
    });
    return {
      id: op.id, nombre: String(op.nombre || 'Mi cooperativa o empresa'), tipo: op.tipo || '',
      municipio: op.municipio || '', departamento: op.departamento || '',
      estado_legal: G4G.importer.estadoLegal(op.estado_legal != null ? op.estado_legal : op.estado),
      actualizado: U.parseDate(op.actualizado),
      requisitos, cumplidos: requisitos.filter((r) => r.estado === 'listo').length, total: requisitos.length
    };
  }
  const claveInscripcion = (e) => U.norm(e).replace(/\s+/g, '_');
  function normalizarInscripcion(r) {
    return { id: r.id, programa: U.norm(r.programa), estado: claveInscripcion(r.estado) || 'pendiente', creado: U.parseDate(r.creado), nota: String(r.nota || '') };
  }

  function cargar(forzar) {
    const token = G4G.auth.token();
    if (!G4G.api.activo()) return Promise.reject(Object.assign(new Error('Estás en modo demostración: no hay un servidor conectado, así que aquí no hay datos de una cooperativa.'), { codigo: 'demo' }));
    if (!G4G.auth.esOperador() || !token) return Promise.reject(Object.assign(new Error('Ingresa con la cuenta de tu cooperativa o empresa para ver tu estado.'), { codigo: 'rol' }));
    if (!forzar && cache && cache.token === token && Date.now() - cache.t < VIGENCIA_MS) return Promise.resolve(cache.datos);
    if (enCurso && enCurso.token === token) return enCurso.p;
    const p = G4G.api.miOperador(token).then((r) => {
      const datos = { operador: normalizar(r.operador), inscripciones: (r.inscripciones || []).map(normalizarInscripcion) };
      cache = { token, t: Date.now(), datos };
      return datos;
    }).finally(() => { if (enCurso && enCurso.p === p) enCurso = null; });
    enCurso = { token, p };
    return p;
  }
  /* Tras enviar una solicitud: la próxima vez que se muestre una pantalla se vuelve a pedir la información. */
  const invalidar = () => { cache = null; G4G.bus.emit('miestado:viejo'); };
  G4G.bus.on('auth:changed', () => { cache = null; enCurso = null; });

  /* Si el servidor dice que la sesión ya no vale, se cierra y se avisa. Devuelve el texto para mostrar. */
  function mensajeDeError(e) {
    if (e && (e.codigo === 'permiso' || e.codigo === 'sesion')) { G4G.auth.vencida(); return 'Tu sesión venció. Vuelve a ingresar para ver tu estado.'; }
    return (e && e.message) || 'No pudimos cargar tu información.';
  }

  /* Siguiente paso: primer trámite (en orden) cuyo requisito aún no está listo; si ninguno, el primer requisito pendiente. */
  function siguiente(op) {
    const pend = (id) => op.requisitos.find((r) => r.id === id && r.estado !== 'listo');
    const tramites = ((G4G.normativa || {}).tramites || []).slice().sort((a, b) => (a.n || 0) - (b.n || 0));
    for (const t of tramites) { const r = t.requisito && pend(t.requisito); if (r) return { requisito: r, tramite: t }; }
    const r = op.requisitos.find((x) => x.estado !== 'listo');
    return r ? { requisito: r, tramite: null } : null;
  }

  /* ---------- Piezas visuales compartidas ---------- */
  function chipRequisito(clave) {
    const e = G4G.config.estadosRequisito[clave] || G4G.config.estadosRequisito.proceso;
    return el('span', { class: 'p2-estado p2-estado--' + clave }, ui().shapeSvg(e.forma, e.color, 12), e.label);
  }
  const FORMAS_INSCRIPCION = {
    pendiente: { forma: 'anillo', color: '#1F4E9C', clase: 'pendiente' },
    en_revision: { forma: 'triangulo', color: '#B97A00', clase: 'proceso' },
    aceptada: { forma: 'circulo', color: '#2E7D4F', clase: 'listo' },
    no_aplica: { forma: 'hexagono', color: '#76726A', clase: 'neutro' }
  };
  function chipInscripcion(estado) {
    const f = FORMAS_INSCRIPCION[estado] || FORMAS_INSCRIPCION.pendiente;
    const t = G4G.config.estadosInscripcion[estado] || G4G.config.estadosInscripcion.pendiente;
    return el('span', { class: 'p2-estado p2-estado--' + f.clase }, ui().shapeSvg(f.forma, f.color, 12), t.label);
  }
  const ACTIVAS = ['pendiente', 'en_revision', 'aceptada'];
  /* Última solicitud del programa (la más reciente) y si sigue activa. */
  function inscripcionDe(lista, programa) {
    const mias = (lista || []).filter((i) => i.programa === programa).sort((a, b) => String(b.creado || '').localeCompare(String(a.creado || '')));
    const actual = mias[0] || null;
    return { actual, activa: !!actual && ACTIVAS.includes(actual.estado) };
  }

  G4G.miestado = { cargar, invalidar, normalizar, siguiente, chipRequisito, chipInscripcion, inscripcionDe, mensajeDeError };

  /* ---------- Pantalla ---------- */
  let ctx = null;
  G4G.bus.on('miestado:viejo', () => { if (ctx && ctx.t) ctx.t = 1; });

  function carga() {
    return el('div', { class: 'p2-carga p2-ancho', role: 'status', 'aria-live': 'polite' },
      el('p', { class: 'p2-carga__txt' }, 'Cargando tu información…'),
      el('div', { class: 'p2-carga__linea p2-carga__linea--alta' }), el('div', { class: 'p2-carga__linea' }), el('div', { class: 'p2-carga__linea' }));
  }
  function errorVista(c, mensaje) {
    return el('div', { class: 'p2-ancho' },
      el('div', { class: 'p2-aviso p2-aviso--error', role: 'alert' }, ui().icon('alerta', 20), el('span', null, mensaje)),
      el('div', { class: 'p2-acciones' },
        el('button', { type: 'button', class: 'btn btn--primary', onclick: () => recargar(c, false, true) }, ui().icon('actualizar', 18), 'Intentar de nuevo'),
        el('a', { class: 'btn', href: '#/inicio' }, ui().icon('inicio', 18), 'Ir al inicio')));
  }

  function bloqueResumen(o) {
    const lugar = [o.tipo, o.municipio, o.departamento].filter(Boolean).join(' · ');
    const mensaje = o.cumplidos === o.total ? 'Tienes todos los requisitos listos. Gracias por mantener tu información al día.'
      : o.estado_legal === 'no_legal' ? 'Te acompañamos a regularizar tu situación. Sigue los pasos de abajo, uno por uno.'
      : o.estado_legal === 'legal' ? 'Tu operación figura como legal. Quedan requisitos por completar o confirmar.'
      : 'Vas avanzando. Te mostramos qué sigue para completar los requisitos, paso a paso.';
    const medidor = ui().meter(o.cumplidos, o.total);
    medidor.setAttribute('aria-label', `${o.cumplidos} de ${o.total} requisitos listos`);
    return el('section', { class: 'p2-resumen', 'aria-label': 'Resumen' },
      el('img', { class: 'il il-resumen', src: 'img/mi-estado.svg', alt: '', width: 112, height: 84, decoding: 'async' }),
      el('h2', { class: 'p2-resumen__nombre' }, o.nombre),
      lugar ? el('p', { class: 'p2-resumen__lugar' }, lugar) : null,
      el('div', { class: 'row-gap' }, ui().estadoChip(o.estado_legal), el('span', { class: 'muted small' }, 'Situación legal registrada')),
      el('div', { class: 'p2-prog' },
        el('div', { class: 'p2-prog__fila' }, el('span', { class: 'p2-prog__n' }, String(o.cumplidos), el('small', null, ` de ${o.total}`)), el('span', { class: 'muted small' }, 'requisitos listos')),
        medidor),
      el('p', { class: 'p2-prog__txt' }, mensaje),
      o.actualizado ? el('p', { class: 'muted small', style: { margin: 0 } }, 'Datos actualizados el ' + U.fmtDate(o.actualizado) + '.') : null);
  }

  function bloqueSiguiente(o) {
    const s = siguiente(o);
    if (!s) {
      return el('section', { class: 'p2-siguiente p2-siguiente--listo', 'aria-label': 'Siguiente paso' },
        el('p', { class: 'p2-siguiente__kicker' }, 'Todo al día'),
        el('h3', { class: 'p2-siguiente__title' }, 'Tus requisitos están listos'),
        el('p', null, 'No tienes pasos pendientes. Si algo cambia en tu operación, avisa a la autoridad para actualizar tu ficha.'),
        el('a', { class: 'btn', href: '#/tramites' }, ui().icon('tramites', 18), 'Ver los trámites'));
    }
    const t = s.tramite, falta = s.requisito.estado === 'faltante';
    return el('section', { class: 'p2-siguiente', 'aria-label': 'Siguiente paso' },
      el('p', { class: 'p2-siguiente__kicker' }, 'Siguiente paso'),
      el('h3', { class: 'p2-siguiente__title' }, t ? t.titulo : s.requisito.label),
      el('div', { class: 'row-gap', style: { margin: 0 } }, chipRequisito(s.requisito.estado), t && t.institucion ? el('span', { class: 'muted small' }, 'Dónde: ' + t.institucion) : null),
      el('p', null, falta ? 'Este requisito aún no está listo. Te mostramos cómo avanzar.' : 'Este requisito está en proceso o falta confirmarlo. Revisa qué necesitas para cerrarlo.'),
      el('a', { class: 'btn btn--primary', href: '#/tramites' }, ui().icon('tramites', 18), 'Ver cómo hacerlo'));
  }

  function bloqueRequisitos(o) {
    return el('section', { class: 'p2-bloque', 'aria-label': 'Requisitos' },
      el('h3', null, 'Tus requisitos'),
      el('ul', { class: 'p2-reqs' }, o.requisitos.map((r) => {
        const e = G4G.config.estadosRequisito[r.estado];
        return el('li', null, ui().shapeSvg(e.forma, e.color, 16), el('span', { class: 'p2-reqs__label' }, r.label), chipRequisito(r.estado));
      })));
  }

  function bloqueInscripciones(c, d) {
    const prog = 'biorremediacion', { actual, activa } = inscripcionDe(d.inscripciones, prog);
    const nombre = (p) => (G4G.config.programas[p] || {}).label || p;
    const lista = d.inscripciones.length
      ? el('ul', { class: 'p2-ins' }, d.inscripciones.map((i) => el('li', null,
          el('span', { class: 'p2-ins__prog' }, nombre(i.programa)),
          el('div', { class: 'row-gap', style: { margin: 0 } }, chipInscripcion(i.estado), i.creado ? el('span', { class: 'muted small' }, 'Enviada el ' + U.fmtDate(i.creado)) : null),
          i.nota ? el('p', { class: 'small', style: { margin: 0 } }, 'Mensaje de la autoridad: ' + i.nota) : null)))
      : el('div', { class: 'p2-vacio' }, 'Todavía no te inscribiste a ningún programa.');
    const boton = el('button', { type: 'button', class: 'btn btn--primary' }, ui().icon('programas', 18), el('span', null, activa ? 'Ya enviaste tu solicitud' : 'Inscribirme al programa de biorremediación'));
    if (activa) boton.disabled = true;
    else boton.addEventListener('click', async () => {
      const txt = boton.lastChild, antes = txt.textContent;
      boton.disabled = true; txt.textContent = 'Enviando…';
      try {
        const ok = await G4G.programas.enviar('');
        if (ok) recargar(c, true, true);
      } finally { boton.disabled = activa; txt.textContent = antes; }
    });
    return el('section', { class: 'p2-bloque', 'aria-label': 'Inscripciones' },
      el('div', { class: 'p2-bloque__head' }, el('h3', null, 'Mis inscripciones')),
      lista,
      el('p', { class: 'p2-fuente', style: { margin: 0 } }, 'Programa piloto de Aurum80, sujeto a convocatoria. Inscribirte envía una solicitud; no garantiza un cupo.'),
      actual && actual.estado === 'no_aplica' ? el('p', { class: 'small', style: { margin: 0 } }, 'Si tu situación cambia, puedes enviar una nueva solicitud.') : null,
      el('div', { class: 'p2-acciones', style: { marginTop: 0 } }, boton, el('a', { class: 'btn', href: '#/programas' }, ui().icon('info', 18), 'Conocer el programa')));
  }

  function pintar(c, d) {
    U.clear(c.cont);
    /* Dos columnas en pantalla ancha (resumen + inscripciones | siguiente paso + requisitos); en celular, un solo flujo en este orden. */
    c.cont.append(
      el('div', { class: 'p2-col' }, bloqueResumen(d.operador), bloqueInscripciones(c, d)),
      el('div', { class: 'p2-col' }, bloqueSiguiente(d.operador), bloqueRequisitos(d.operador)),
      el('div', { class: 'p2-ancho p2-acciones' },
        el('button', { type: 'button', class: 'btn', onclick: (e) => { e.currentTarget.disabled = true; recargar(c, false, true); } }, ui().icon('actualizar', 18), 'Actualizar mi información')));
  }

  /* silencioso: no borra lo que ya se ve (se usa al volver a la pantalla o tras inscribirse). */
  function recargar(c, silencioso, forzar) {
    if (!c || ctx !== c) return;
    if (!silencioso) { U.clear(c.cont); c.cont.appendChild(carga()); }
    cargar(forzar).then((d) => {
      if (ctx !== c) return;
      c.t = Date.now(); pintar(c, d);
    }).catch((e) => {
      if (ctx !== c) return;
      const m = mensajeDeError(e);
      if (silencioso && c.t) { ui().toast(m, 'warn'); return; }
      U.clear(c.cont); c.cont.appendChild(errorVista(c, m));
    });
  }

  function render(root) {
    root.classList.add('p2');
    const c = ctx = { cont: el('div', { class: 'p2-miestado' }), t: 0 };
    root.appendChild(c.cont);
    recargar(c, false, false);
  }
  /* Al volver a la pantalla se actualiza en silencio si ya pasó un rato. */
  function onShow() {
    if (ctx && ctx.t && Date.now() - ctx.t > VIGENCIA_MS) recargar(ctx, true, false);
  }

  G4G.app.register({ id: 'miestado', titulo: 'Mi estado', icono: 'miestado', orden: 6, grupo: 'cooperativa', movil: ['operador'], subtitulo: 'Tu avance, tus requisitos y tus inscripciones', render, onShow });
})();
