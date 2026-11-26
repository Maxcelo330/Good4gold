/* Fichas de detalle (panel lateral) para operadores, pasivos y denuncias.
   No es una sección de la barra: la usan todas las demás. */
(function () {
  const G4G = (window.G4G = window.G4G || {});
  const U = G4G.util, { el } = U;
  const ui = () => G4G.ui, store = () => G4G.store;

  const aviso = (txt) => el('div', { class: 'note note--lock' }, ui().icon('candado', 15), el('span', null, txt));

  function cercanos(lat, lng, km) {
    const out = [];
    store().state.operadores.forEach((o) => { if (o.lat != null) { const d = U.haversineKm({ lat, lng }, o); if (d <= km) out.push({ tipo: 'operador', d, reg: o }); } });
    store().state.pasivos.forEach((p) => { if (p.lat != null) { const d = U.haversineKm({ lat, lng }, p); if (d <= km) out.push({ tipo: 'pasivo', d, reg: p }); } });
    return out.sort((a, b) => a.d - b.d);
  }

  function frescura(reg) {
    const d = U.daysSince(reg.actualizado);
    const old = store().estaDesactualizado(reg);
    return el('span', { class: 'fresh' + (old ? ' is-old' : '') },
      reg.actualizado ? `${U.fmtDate(reg.actualizado)} · hace ${U.fmt(d)} días` : 'Sin fecha de actualización',
      old ? el('span', { class: 'fresh__flag' }, ' · desactualizado') : null);
  }

  function irAlMapa(reg, id) {
    ui().drawer.close();
    G4G.app.go('mapa', { foco: { lat: reg.lat, lng: reg.lng, id } });
  }

  /* ---------------- Operador ---------------- */
  function operador(id) {
    const op = store().getOperador(id); if (!op) return;
    const av = store().avance(op), pasivos = store().pasivosDe(op.id);
    const rq = store().requisitosDe(op);
    const estadoReq = { true: ['Cumple', 'ok'], false: ['Falta', 'bad'], null: ['Sin dato', 'unk'] };

    const body = el('div', null,
      aviso('Vista de verificación. Esta ficha no modifica la base de datos.'),
      el('div', { class: 'row-gap' }, ui().estadoChip(op.estado_legal), frescura(op)),
      el('h4', null, 'Requisitos para operar'),
      el('div', { class: 'progress' }, ui().meter(av.cumplidos, av.total), el('span', null, `${av.cumplidos} de ${av.total} cumplidos`)),
      el('ul', { class: 'checklist' }, rq.map((r) => {
        const [txt, cls] = estadoReq[String(r.estado)];
        return el('li', { class: cls }, el('span', { class: 'checklist__mark', 'aria-hidden': 'true' }, r.estado === true ? '✓' : r.estado === false ? '✕' : '?'), el('span', { class: 'checklist__label' }, r.label), el('span', { class: 'checklist__state' }, txt));
      })),
      (op.estado_legal === 'proceso' || op.estado_legal === 'no_legal') && av.faltan.length
        ? el('div', { class: 'callout' }, el('strong', null, 'Para regularizar falta: '), av.faltan.map((r) => r.label).join(' · '))
        : null,
      op.estado_legal === 'sin_dato' ? el('div', { class: 'callout callout--warn' }, 'Situación legal sin verificar. Falta el dato actualizado del organismo regulador.') : null,
      el('h4', null, 'Datos'),
      ui().dl([['Tipo', op.tipo], ['Departamento', op.departamento], ['Municipio', op.municipio], ['Socios', op.socios == null ? null : U.fmt(op.socios)], ['Coordenadas', el('span', { class: 'mono' }, op.lat == null ? '—' : U.fmtCoord(op.lat, op.lng))]]),
      /* Los pasivos (colas, relaves) solo los ve un funcionario. */
      G4G.auth.esFuncionario() ? [el('h4', null, `Pasivos asociados (${pasivos.length})`),
        pasivos.length
          ? el('ul', { class: 'linklist' }, pasivos.map((p) => el('li', null, el('button', { type: 'button', class: 'link', onclick: () => pasivo(p.id) }, p.nombre || p.id), el('span', { class: 'muted' }, ` · ${U.fmt(p.volumen_m3)} m³`))))
          : el('p', { class: 'muted' }, 'No hay pasivos registrados para este operador.')] : null);

    ui().drawer.open({
      kicker: `Operador · ${op.id}`, title: op.nombre, subtitle: [op.tipo, op.municipio, op.departamento].filter(Boolean).join(' · '), body,
      footer: [op.lat != null ? ui().button('Ver en el mapa', { icon: 'mapa', onclick: () => irAlMapa(op, op.id) }) : null, op.lat != null ? ui().button('Denunciar aquí', { icon: 'denuncias', onclick: () => { ui().drawer.close(); G4G.app.go('denuncias', { ubicacion: { lat: op.lat, lng: op.lng, origen: 'mapa' } }); } }) : null, editar('operadores', op.id)].filter(Boolean)
    });
  }

  /* ---------------- Pasivo ---------------- */
  function pasivo(id) {
    const p = store().pasivosEvaluados().find((x) => x.id === id); if (!p) return;
    const exp = G4G.scoring.explicar(p, p._op);
    const usd = p.oroG == null ? null : p.oroG * G4G.config.puntaje.precioUsdG;

    const body = el('div', null,
      aviso('Vista de verificación. Esta ficha no modifica la base de datos.'),
      el('div', { class: 'row-gap' }, ui().claseChip(p.clase)),
      el('p', { class: 'lead' }, el('strong', null, p.clase.label + '. '), p.clase.detalle),
      el('div', { class: 'scorepair' },
        el('div', null, el('div', { class: 'scorepair__label' }, 'Riesgo'), el('div', { class: 'scorepair__value' }, p.riesgo, el('small', null, '/100')), ui().meter(p.riesgo, 100, { tone: 'risk' })),
        el('div', null, el('div', { class: 'scorepair__label' }, 'Valor recuperable'), el('div', { class: 'scorepair__value' }, p.valor === null ? 'Sin dato' : p.valor, p.valor === null ? null : el('small', null, '/100')), ui().meter(p.valor || 0, 100, { tone: 'value' }))),
      el('h4', null, 'Por qué este riesgo'),
      el('ul', { class: 'breakdown' }, exp.map((c) => el('li', null,
        el('span', { class: 'breakdown__label' }, c.label), ui().meter(c.puntos, c.maximo, { tone: 'risk' }), el('span', { class: 'breakdown__pts' }, `${c.puntos}/${c.maximo}`)))),
      el('div', { class: 'note' }, 'El satélite ubica pero no mide mercurio. Estos puntajes usan indicadores indirectos; el contenido real se confirma solo con muestreo.'),
      el('h4', null, 'Datos del sitio'),
      ui().dl([
        ['Operador', p._op ? el('button', { type: 'button', class: 'link', onclick: () => operador(p._op.id) }, p._op.nombre) : 'Sin responsable registrado'],
        ['Tipo', p.tipo], ['Volumen estimado', p.volumen_m3 == null ? null : `${U.fmt(p.volumen_m3)} m³`],
        ['Distancia al río', p.dist_rio_m == null ? null : `${U.fmt(p.dist_rio_m)} m`], ['Distancia a población', p.dist_poblado_m == null ? null : `${U.fmt(p.dist_poblado_m)} m`],
        ['Estructura', (G4G.config.estructura[p.estructura] || {}).label], ['Uso de mercurio', p.uso_hg],
        ['Muestra tomada', p.muestra ? 'Sí' : 'No'], ['Ley de oro', p.ley_au_gt == null ? 'Sin medir' : `${U.fmt(p.ley_au_gt, 2)} g/t`],
        ['Oro recuperable (estim.)', p.oroG == null ? 'Sin dato' : `${U.fmt(p.oroG / 1000, 1)} kg · ≈ USD ${U.fmt(usd)} (supuesto)`],
        ['Detectado por', p.deteccion], ['Actualizado', frescura(p)], ['Coordenadas', el('span', { class: 'mono' }, p.lat == null ? '—' : U.fmtCoord(p.lat, p.lng))]]));

    ui().drawer.open({
      kicker: `Pasivo · ${p.id}`, title: p.nombre || p.id, subtitle: p.tipo, body,
      footer: [p.lat != null ? ui().button('Ver en el mapa', { icon: 'mapa', onclick: () => irAlMapa(p, p.id) }) : null, editar('pasivos', p.id)].filter(Boolean)
    });
  }

  /* Funcionarios: abrir el registro para editar. */
  const editar = (tabla, id) => (G4G.auth.esFuncionario() ? ui().button('Editar', { icon: 'editar', onclick: () => { ui().drawer.close(); G4G.registro.editar(tabla, id); } }) : null);

  /* ---------------- Denuncia ---------------- */
  function denuncia(id) {
    const d = store().state.denuncias.find((x) => x.id === id); if (!d) return;
    const fun = G4G.auth.esFuncionario(), conServidor = G4G.api.activo();
    const cerca = cercanos(d.lat, d.lng, G4G.config.radioCercaniaKm);
    const sel = el('select', { class: 'input', onchange: (e) => { store().updateDenuncia(d.id, { estado: e.target.value }); ui().toast('Estado actualizado en este dispositivo.'); } },
      Object.entries(G4G.config.estadosDenuncia).map(([k, v]) => el('option', { value: k, selected: d.estado === k }, v.label)));

    const body = el('div', null,
      aviso(conServidor ? 'Copia guardada en este dispositivo. La denuncia recibida está en la base del municipio.' : 'Registro guardado en este dispositivo, separado de la base de datos.'),
      d.foto ? el('img', { class: 'photo', src: d.foto, alt: 'Foto de la denuncia' }) : null,
      ui().dl([['Tipo', d.tipo], ['Fecha', U.fmtDateTime(d.creado)], ['Ubicación', el('span', { class: 'mono' }, U.fmtCoord(d.lat, d.lng))], ['Precisión', d.precision ? `± ${U.fmt(d.precision)} m` : 'No disponible'], ['Descripción', d.descripcion]]),
      /* La verificación contra el registro es trabajo del funcionario. */
      fun ? [el('h4', null, 'Verificación contra el registro'),
        cerca.length
          ? el('ul', { class: 'linklist' }, cerca.slice(0, 6).map((c) => el('li', null,
            el('button', { type: 'button', class: 'link', onclick: () => (c.tipo === 'operador' ? operador(c.reg.id) : pasivo(c.reg.id)) }, c.reg.nombre || c.reg.id),
            el('span', { class: 'muted' }, ` · ${c.tipo === 'operador' ? 'operador' : 'pasivo'} · ${U.fmt(c.d, 1)} km `), c.tipo === 'operador' ? ui().estadoChip(c.reg.estado_legal) : null)))
          : el('div', { class: 'callout callout--warn' }, `Ningún operador ni pasivo registrado en ${G4G.config.radioCercaniaKm} km. Posible actividad no registrada: priorizar visita de verificación.`)] : null,
      el('h4', null, 'Seguimiento'),
      /* El estado lo cambia el funcionario (en Denuncias recibidas, o aquí en modo demostración). */
      fun && !conServidor ? ui().field('Estado', sel)
        : ui().dl([['Envío', d.envio === 'pendiente' ? 'Sin enviar: se enviará sola al volver la señal' : d.envio === 'enviada' ? 'Enviada a la autoridad' : 'Guardada en este dispositivo'], ['Estado', ui().estadoDenunciaChip(d.estado)]]));

    ui().drawer.open({
      kicker: `Denuncia · ${d.codigo || d.id}`, title: d.tipo, subtitle: U.fmtDateTime(d.creado), body,
      footer: [
        ui().button('Ver en el mapa', { icon: 'mapa', onclick: () => irAlMapa(d, d.id) }),
        ui().button('Eliminar', { kind: 'danger', onclick: () => { if (confirm('¿Eliminar esta denuncia de este dispositivo?')) { store().removeDenuncia(d.id); ui().drawer.close(); } } })
      ]
    });
  }

  /* Denuncia hecha en otro dispositivo, vista por el público: solo campos no sensibles. */
  function denunciaRed(p) {
    const est = (G4G.config.estadosDenunciaPublico[p.estado] || (G4G.config.estadosDenuncia[p.estado]) || { label: p.estado }).label;
    const fecha = typeof p.fecha === 'number' ? U.fmtDateTime(p.fecha) : U.fmtDate(p.fecha);
    const body = el('div', null,
      aviso('Denuncia de la ciudadanía. Aquí solo se muestran el tipo, la fecha y el estado: nunca datos de quien la hizo ni su foto.'),
      ui().dl([['Tipo', p.tipo], ['Fecha', fecha], ['Estado', est], ['Código', el('span', { class: 'mono' }, p.codigo)], ['Ubicación', el('span', { class: 'mono' }, U.fmtCoord(p.lat, p.lng))]]),
      el('p', { class: 'muted small' }, 'Una persona del municipio revisa cada denuncia. Registrarla sirve para verificar, no para castigar.'));
    ui().drawer.open({ kicker: `Denuncia · ${p.codigo}`, title: p.tipo, subtitle: fecha, body,
      footer: [ui().button('Denunciar en este punto', { icon: 'denuncias', onclick: () => { ui().drawer.close(); G4G.app.go('denuncias', { ubicacion: { lat: p.lat, lng: p.lng, origen: 'mapa' } }); } })] });
  }

  G4G.detalle = { operador, pasivo, denuncia, denunciaRed, cercanos, frescura };
})();
