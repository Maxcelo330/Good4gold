/* Módulo: Denuncias recibidas (solo funcionarios). Con backend lee la hoja
   "Denuncias" y permite cambiar su estado y anotar el seguimiento. Sin backend
   muestra las denuncias guardadas en este dispositivo.
   Acciones principales de cada ficha:
   - Aceptar y crear punto por verificar: la denuncia pasa a ser un punto en el registro (sin juzgar a nadie),
     para visitarlo y comprobar su situación.
   - Descartar: se cierra con una nota. */
(function () {
  const G4G = (window.G4G = window.G4G || {});
  const U = G4G.util, { el } = U;
  const ui = () => G4G.ui;
  let raiz = null, lista = null, cargando = false, error = null, filtro = 'abiertas';

  async function cargar() {
    if (!G4G.api.activo()) { lista = G4G.store.state.denuncias.map((d) => Object.assign({ local: true, tieneFoto: !!d.foto }, d)); pintar(); return; }
    cargando = true; error = null; pintar();
    try { lista = (await G4G.api.denuncias(G4G.auth.token())).denuncias; }
    catch (e) { error = e.message; if (e.codigo === 'sesion') G4G.auth.vencida(); }
    finally { cargando = false; pintar(); }
  }

  /* Cambia el estado de la denuncia. Devuelve true si se guardó. */
  async function cambiar(d, estado, nota) {
    if (d.local) { G4G.store.updateDenuncia(d.id, { estado }); d.estado = estado; ui().toast('Estado actualizado en este dispositivo.'); pintar(); return true; }
    try {
      await G4G.api.estadoDenuncia(G4G.auth.token(), d.id, estado, nota);
      d.estado = estado; if (nota !== undefined) d.nota = nota; d.atendido_por = G4G.auth.usuario().usuario;
      ui().toast(`Denuncia ${d.codigo}: ${G4G.config.estadosDenuncia[estado].label.toLowerCase()}.`); pintar();
      G4G.store.cargarDenunciasRed().catch(() => {});   // el mapa cambia de color si corresponde
      return true;
    } catch (e) {
      if (e.codigo === 'sesion') G4G.auth.vencida();
      ui().toast('No se pudo actualizar: ' + e.message, 'warn');
      return false;
    }
  }

  /* El servidor deja escrito en la nota: "Convertida en punto por verificar OP-012." */
  const puntoDe = (d) => { const m = /Convertida en punto por verificar\s+([A-Za-z0-9_-]+)/i.exec(d.nota || ''); return m ? m[1] : null; };

  /* Crea el punto por verificar en el registro y refresca la base para que aparezca en el mapa. */
  async function aceptar(d, nota) {
    try {
      const r = await G4G.api.aceptarDenuncia(G4G.auth.token(), d.id, nota || '');
      d.estado = 'atendida'; d.atendido_por = G4G.auth.usuario().usuario;
      d.nota = (nota ? nota + ' · ' : '') + 'Convertida en punto por verificar ' + r.id + '.';
      ui().toast(r.repetida ? `Esta denuncia ya estaba convertida en el punto ${r.id}.` : `Punto por verificar creado: ${r.id}. Ya aparece en el registro y en el mapa.`);
      pintar();
      /* La base trae el punto nuevo; al cambiar, el mapa y el resumen se redibujan solos. */
      G4G.store.sincronizar().catch(() => {});
      G4G.store.cargarDenunciasRed().catch(() => {});
      return r;
    } catch (e) {
      if (e.codigo === 'sesion') G4G.auth.vencida();
      ui().toast('No se pudo crear el punto por verificar: ' + e.message, 'warn');
      return null;
    }
  }

  /* Ficha de una denuncia: foto (se pide al servidor), cercanía al registro, acciones y seguimiento. */
  function abrir(d) {
    const foto = el('div', { class: 'buzon__foto' });
    if (d.local && d.foto) foto.appendChild(el('img', { class: 'photo', src: d.foto, alt: 'Foto de la denuncia' }));
    else if (d.tieneFoto) {
      foto.appendChild(el('p', { class: 'muted' }, 'Cargando foto…'));
      G4G.api.foto(G4G.auth.token(), d.id).then((r) => { U.clear(foto); foto.appendChild(el('img', { class: 'photo', src: r.foto, alt: 'Foto de la denuncia' })); })
        .catch((e) => { U.clear(foto); foto.appendChild(el('p', { class: 'muted' }, 'No se pudo cargar la foto: ' + e.message)); });
    }
    const cerca = G4G.store.state.operadores.map((o) => ({ o, km: o.lat == null ? Infinity : U.haversineKm(d, o) }))
      .filter((x) => x.km <= G4G.config.radioCercaniaKm).sort((a, b) => a.km - b.km).slice(0, 6);
    const estado = el('select', { class: 'input' }, Object.entries(G4G.config.estadosDenuncia).map(([k, v]) => el('option', { value: k, selected: d.estado === k }, v.label)));
    const nota = el('textarea', { class: 'input', rows: 3, placeholder: 'Qué se hizo: visita, inspección, derivación…' }, d.nota || '');
    const punto = puntoDe(d);

    /* Acciones principales: aceptar o descartar, con confirmación en la misma ficha. */
    const acciones = el('div', { class: 'aact' });
    const mostrarAcciones = () => {
      U.clear(acciones);
      if (punto) {
        U.append(acciones, [el('div', { class: 'callout aact__done' }, el('strong', null, 'Ya es un punto por verificar. '), `Quedó registrado como ${punto}. Falta visitarlo y comprobar su situación.`),
          G4G.store.getOperador(punto) ? el('div', { class: 'row-gap' }, ui().button('Ver el punto', { icon: 'operadores', onclick: () => G4G.detalle.operador(punto) })) : null]);
        return;
      }
      U.append(acciones, [
        d.local ? el('div', { class: 'callout' }, 'Crear un punto por verificar necesita conexión con el servidor del municipio. Esta denuncia está solo en este dispositivo.')
          : ui().button('Aceptar y crear punto por verificar', { kind: 'primary', icon: 'ubicacion', onclick: () => confirmar('aceptar') }),
        d.estado !== 'descartada' ? ui().button('Descartar', { kind: 'danger', onclick: () => confirmar('descartar') }) : null,
        d.estado === 'atendida' ? el('p', { class: 'muted small' }, 'Marcada como atendida, pero todavía no es un punto en el registro.') : null]);
    };
    const confirmar = (que) => {
      U.clear(acciones);
      const textoEnviar = que === 'aceptar' ? 'Sí, crear punto por verificar' : 'Sí, descartar';
      const enviar = ui().button(textoEnviar, { kind: que === 'aceptar' ? 'primary' : 'danger' });
      const cancelar = ui().button('Cancelar', { onclick: mostrarAcciones });
      enviar.addEventListener('click', async () => {
        enviar.disabled = true; cancelar.disabled = true; enviar.textContent = 'Guardando…';
        if (que === 'aceptar') {
          const r = await aceptar(d, nota.value.trim());
          if (r) { ui().drawer.close(); abrir(d); return; }
        } else {
          const ok = await cambiar(d, 'descartada', d.local ? undefined : nota.value.trim());
          if (ok) { ui().drawer.close(); return; }
        }
        enviar.disabled = false; cancelar.disabled = false; enviar.textContent = textoEnviar;
      });
      U.append(acciones, [el('div', { class: 'callout' + (que === 'aceptar' ? '' : ' callout--warn') },
        que === 'aceptar'
          ? [el('strong', null, '¿Crear un punto por verificar? '), 'Se agrega un punto al registro en el lugar de la denuncia para comprobar su situación en campo. No implica ninguna sanción ni dice nada sobre personas: es el primer paso para revisar el lugar. La denuncia queda como atendida. Puede escribir una nota más abajo.']
          : [el('strong', null, '¿Descartar esta denuncia? '), 'Se cierra sin crear ningún punto. Conviene dejar escrito el motivo en la nota de más abajo (por ejemplo: ya registrada, ubicación errónea, sin actividad).']),
        el('div', { class: 'row-gap' }, enviar, cancelar)]);
    };
    mostrarAcciones();

    ui().drawer.open({
      kicker: `Denuncia · ${d.codigo || d.id}`, title: d.tipo, subtitle: d.recibido ? 'Recibida ' + fecha(d.recibido) : fecha(d.creado),
      body: el('div', null,
        el('div', { class: 'row-gap' }, ui().estadoDenunciaChip(d.estado), punto ? el('span', { class: 'chip chip--ok' }, 'Punto por verificar ' + punto) : null),
        acciones, foto,
        ui().dl([['Descripción', d.descripcion], ['Ubicación', el('span', { class: 'mono' }, U.fmtCoord(d.lat, d.lng))], ['Precisión', d.precision ? `± ${U.fmt(d.precision)} m` : 'No disponible'],
          ['Atendida por', d.atendido_por || null]]),
        el('h4', null, 'Operaciones registradas a menos de ' + G4G.config.radioCercaniaKm + ' km'),
        cerca.length ? el('ul', { class: 'linklist' }, cerca.map((c) => el('li', null, el('button', { type: 'button', class: 'link', onclick: () => G4G.detalle.operador(c.o.id) }, c.o.nombre),
          el('span', { class: 'muted' }, ` · ${U.fmt(c.km, 1)} km `), ui().estadoChip(c.o.estado_legal))))
          : el('div', { class: 'callout callout--warn' }, 'Ninguna operación registrada cerca: lugar sin registro. Conviene verificarlo en campo.'),
        el('h4', null, 'Seguimiento'), ui().field('Estado', estado), d.local ? null : ui().field('Nota interna', nota)),
      footer: [
        ui().button('Guardar seguimiento', { kind: 'primary', onclick: async () => { if (await cambiar(d, estado.value, d.local ? undefined : nota.value)) ui().drawer.close(); } }),
        ui().button('Ver en el mapa', { icon: 'mapa', onclick: () => G4G.app.go('mapa', { foco: { lat: d.lat, lng: d.lng, id: d.id } }) })]
    });
  }
  const fecha = (v) => { if (!v) return ''; const t = typeof v === 'number' ? v : Date.parse(v); return Number.isNaN(t) ? String(v) : U.fmtDateTime(t); };

  /* Para que el mapa abra la misma ficha de seguimiento. */
  G4G.buzon = { abrir: (d) => abrir(d) };

  function pintar() {
    if (!raiz) return;
    U.clear(raiz);
    const todas = lista || [];
    const abiertas = todas.filter((d) => d.estado === 'nueva' || d.estado === 'en_revision');
    const ver = filtro === 'abiertas' ? abiertas : todas;
    const seg = el('div', { class: 'seg', role: 'group', 'aria-label': 'Filtro' }, [['abiertas', `Por atender (${abiertas.length})`], ['todas', `Todas (${todas.length})`]].map(([k, l]) => el('button', {
      type: 'button', class: 'seg__btn' + (filtro === k ? ' is-on' : ''), 'aria-pressed': String(filtro === k), onclick: () => { filtro = k; pintar(); } }, l)));
    raiz.appendChild(el('div', { class: 'toolbar' }, seg, el('span', { class: 'spacer' }), ui().button(cargando ? 'Actualizando…' : 'Actualizar', { disabled: cargando, onclick: cargar })));
    raiz.appendChild(el('p', { class: 'muted small' }, 'Cada denuncia sirve para verificar un lugar, no para castigar. Al aceptarla se crea un punto por verificar en el registro.'));
    if (!G4G.api.activo()) raiz.appendChild(el('div', { class: 'callout' }, el('strong', null, 'Modo demostración. '), 'Sin servidor configurado solo se ven las denuncias hechas en este dispositivo. Con el backend, llegan aquí las de toda la ciudadanía.'));
    if (error) raiz.appendChild(el('div', { class: 'callout callout--warn' }, 'No se pudieron cargar las denuncias: ' + error));
    if (cargando && !lista) { raiz.appendChild(ui().empty('Cargando denuncias…')); return; }
    raiz.appendChild(ui().card(null, ver.length ? el('ul', { class: 'denlist' }, ver.map((d) => {
      const punto = puntoDe(d);
      return el('li', null,
        el('button', { type: 'button', class: 'denlist__row', onclick: () => abrir(d) },
          d.local && d.foto ? el('img', { src: d.foto, alt: '', class: 'denlist__thumb' }) : el('span', { class: 'denlist__thumb denlist__thumb--empty' }, ui().icon(d.tieneFoto ? 'denuncias' : 'alerta', 20)),
          el('span', { class: 'denlist__main' }, el('span', { class: 'cell-main' }, d.tipo), el('span', { class: 'cell-sub' }, `${d.codigo || d.id} · ${fecha(d.recibido || d.creado)}`),
            punto ? el('span', { class: 'cell-sub' }, 'Ya es punto por verificar ' + punto) : null),
          ui().estadoDenunciaChip(d.estado)));
    })) : ui().empty(G4G.ilu.vacio('vacio-denuncias', filtro === 'abiertas' ? 'No hay denuncias por atender.' : 'Todavía no llegaron denuncias.'))));
  }

  function render(root) { raiz = root; if (!G4G.api.activo() || (!lista && !cargando)) cargar(); else pintar(); }
  G4G.bus.on('auth:changed', () => { lista = null; error = null; });
  function onShow() { if (lista && !cargando && G4G.api.activo()) cargar(); }

  G4G.app.register({ id: 'buzon', titulo: 'Denuncias recibidas', corto: 'Denuncias', icono: 'buzon', orden: 14, grupo: 'tecnico', movil: ['funcionario'], subtitulo: 'Reportes de la ciudadanía para verificar y atender', render, onShow });
})();
