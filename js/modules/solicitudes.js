/* Módulo: Solicitudes de programas (solo funcionarios).
   Cooperativas y empresas se inscriben a programas desde su sección; aquí la autoridad las responde.
   La cooperativa ve el estado y la nota que se escriben en esta ficha. */
(function () {
  const G4G = (window.G4G = window.G4G || {});
  const U = G4G.util, { el } = U;
  const ui = () => G4G.ui, A = () => G4G.autoridad;
  let raiz = null, resp = null, cargando = false, filtro = 'todas', ticket = 0;

  const ESTADOS = () => G4G.config.estadosInscripcion;
  const programa = (id) => (G4G.config.programas[id] || {}).corto || id || '—';
  const estado = (x) => (ESTADOS()[x.estado] ? x.estado : 'pendiente');
  const datos = () => (resp && resp.datos) || [];
  /* Para que quien responde sepa qué verá la cooperativa. */
  const AYUDA = {
    pendiente: 'Recibida: todavía no se respondió.',
    en_revision: 'En revisión: la autoridad está viendo si corresponde.',
    aceptada: 'Aceptada: la cooperativa verá que su solicitud fue aceptada.',
    no_aplica: 'No corresponde por ahora: explique el motivo en la nota, con un tono amable y sin juzgar.'
  };
  const FORMA = { pendiente: 'anillo', en_revision: 'triangulo', aceptada: 'circulo', no_aplica: 'cuadrado' };
  const COLOR = { pendiente: 'var(--ink-2)', en_revision: 'var(--mid)', aceptada: 'var(--ok)', no_aplica: 'var(--unk)' };
  const chipEstado = (id) => el('span', { class: 'chip chip--estado' }, ui().shapeSvg(FORMA[id] || 'anillo', COLOR[id] || '#76726A', 12), (ESTADOS()[id] || { label: id }).label);

  async function cargar(forzar) {
    const mi = ++ticket;
    cargando = true; pintar();
    const r = await A().inscripciones(forzar);
    if (mi !== ticket) return;
    resp = r; cargando = false; pintar();
  }

  async function guardar(x, nuevo, nota) {
    try {
      await G4G.api.estadoInscripcion(G4G.auth.token(), x.id, nuevo, nota);
      x.estado = nuevo; x.nota = nota; x.atendido_por = G4G.auth.usuario().usuario;
      A().invalidar('inscripciones');
      ui().toast('Solicitud actualizada: ' + ESTADOS()[nuevo].label.toLowerCase() + '.');
      pintar();
      return true;
    } catch (e) {
      if (e.codigo === 'sesion') G4G.auth.vencida();
      ui().toast('No se pudo guardar: ' + e.message, 'warn');
      return false;
    }
  }

  function abrir(x) {
    let elegido = estado(x);
    const nota = el('textarea', { class: 'input', rows: 3, maxlength: 600, placeholder: 'Mensaje para la cooperativa: qué sigue, qué falta o por qué no corresponde por ahora.' }, x.nota || '');
    const ayuda = el('p', { class: 'muted small' }, AYUDA[elegido]);
    const botones = el('div', { class: 'seg seg--wrap', role: 'group', 'aria-label': 'Estado de la solicitud' });
    const pintarBotones = () => {
      U.clear(botones);
      Object.entries(ESTADOS()).forEach(([k, v]) => botones.appendChild(el('button', { type: 'button', class: 'seg__btn' + (elegido === k ? ' is-on' : ''), 'aria-pressed': String(elegido === k),
        onclick: () => { elegido = k; ayuda.textContent = AYUDA[k] || ''; pintarBotones(); } }, v.label)));
    };
    pintarBotones();
    const op = x.operador_id ? G4G.store.getOperador(String(x.operador_id).trim()) : null;
    const guardarBtn = ui().button('Guardar respuesta', { kind: 'primary' });
    guardarBtn.addEventListener('click', async () => {
      guardarBtn.disabled = true; guardarBtn.textContent = 'Guardando…';
      if (await guardar(x, elegido, nota.value.trim())) ui().drawer.close();
      else { guardarBtn.disabled = false; guardarBtn.textContent = 'Guardar respuesta'; }
    });
    ui().drawer.open({
      kicker: `Solicitud · ${x.id}`, title: x.operador_nombre || 'Cooperativa o empresa', subtitle: programa(x.programa) + ' · ' + A().fechaHora(x.creado),
      body: el('div', null,
        el('div', { class: 'row-gap' }, chipEstado(estado(x))),
        ui().dl([['Programa', (G4G.config.programas[x.programa] || {}).label || x.programa], ['Enviada', A().fechaHora(x.creado)],
          ['Mensaje de la cooperativa', x.mensaje || 'No escribió un mensaje.'], ['Atendida por', x.atendido_por || null], ['Última respuesta', x.atendido_en ? A().fechaHora(x.atendido_en) : null]]),
        op ? el('div', { class: 'row-gap' }, ui().button('Ver la cooperativa en el registro', { icon: 'operadores', onclick: () => G4G.detalle.operador(op.id) })) : null,
        el('h4', null, 'Su respuesta'),
        ui().field('Estado', botones, 'La cooperativa verá el estado y la nota en su sección.'), ayuda,
        ui().field('Nota para la cooperativa', nota)),
      footer: [guardarBtn, ui().button('Cerrar', { onclick: () => ui().drawer.close() })]
    });
  }

  function pintar() {
    if (!raiz) return;
    U.clear(raiz);
    const todas = datos();
    const cuenta = (k) => todas.filter((x) => estado(x) === k).length;
    const filtros = [['todas', 'Todas', todas.length], ...Object.entries(ESTADOS()).map(([k, v]) => [k, v.label, cuenta(k)])];
    /* Sin datos (error o sin servidor) los filtros con ceros no aportan: solo queda Actualizar. */
    const hayDatos = !(cargando && !resp) && !(resp && (resp.sinServidor || (resp.error && !resp.datos)));
    raiz.appendChild(el('div', { class: 'toolbar' },
      !hayDatos ? null : el('div', { class: 'achips', role: 'group', 'aria-label': 'Filtrar por estado' }, filtros.map(([k, l, n]) => el('button', { type: 'button', class: 'achip' + (filtro === k ? ' is-on' : ''), 'aria-pressed': String(filtro === k), onclick: () => { filtro = k; pintar(); } },
        l, el('span', { class: 'achip__n' }, n)))),
      el('span', { class: 'spacer' }), ui().button(cargando ? 'Actualizando…' : 'Actualizar', { icon: 'actualizar', disabled: cargando, onclick: () => cargar(true) })));
    raiz.appendChild(el('p', { class: 'muted small' }, 'Cooperativas y empresas piden entrar a un programa desde su sección. Respóndales con un estado y una nota clara.'));

    const aviso = resp ? A().avisoServidor(resp, 'solicitudes') : null;
    if (aviso) raiz.appendChild(aviso);
    if (cargando && !resp) { raiz.appendChild(ui().empty('Cargando solicitudes…')); return; }
    if (resp && resp.sinServidor) return;
    if (resp && resp.error && !resp.datos) return;

    const ver = todas.filter((x) => filtro === 'todas' || estado(x) === filtro)
      .sort((a, b) => (estado(a) === 'pendiente' ? 0 : 1) - (estado(b) === 'pendiente' ? 0 : 1) || (A().ms(b.creado) || 0) - (A().ms(a.creado) || 0));
    raiz.appendChild(ui().card(null, ver.length
      ? el('ul', { class: 'denlist' }, ver.map((x) => el('li', null, el('button', { type: 'button', class: 'denlist__row asol', onclick: () => abrir(x) },
        el('span', { class: 'asol__ico', 'aria-hidden': 'true' }, ui().icon('solicitudes', 20)),
        el('span', { class: 'denlist__main' },
          el('span', { class: 'cell-main' }, x.operador_nombre || 'Cooperativa o empresa'),
          el('span', { class: 'cell-sub' }, `${programa(x.programa)} · ${A().fechaHora(x.creado)}`),
          x.mensaje ? el('span', { class: 'asol__msg' }, x.mensaje) : null),
        chipEstado(estado(x))))))
      : ui().empty(G4G.ilu.vacio('vacio-denuncias', todas.length ? 'No hay solicitudes con este estado.' : 'Todavía no llegaron solicitudes. Aparecerán aquí cuando una cooperativa o empresa se inscriba a un programa.'))));
  }

  function render(root) { raiz = root; const previo = A().peek('inscripciones'); resp = previo ? { datos: previo } : null; cargar(false); }
  function onShow() { if (resp && !cargando && G4G.api.activo()) cargar(false); }

  G4G.app.register({ id: 'solicitudes', titulo: 'Solicitudes de programas', corto: 'Solicitudes', icono: 'solicitudes', orden: 16, grupo: 'tecnico', subtitulo: 'Pedidos de cooperativas y empresas para entrar a un programa', render, onShow });
})();
