/* Módulo: Denuncias recibidas (solo funcionarios). Con backend lee la hoja
   "Denuncias" y permite cambiar su estado y anotar el seguimiento. Sin backend
   muestra las denuncias guardadas en este dispositivo. */
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

  async function cambiar(d, estado, nota) {
    if (d.local) { G4G.store.updateDenuncia(d.id, { estado }); d.estado = estado; ui().toast('Estado actualizado en este dispositivo.'); pintar(); return; }
    try {
      await G4G.api.estadoDenuncia(G4G.auth.token(), d.id, estado, nota);
      d.estado = estado; if (nota !== undefined) d.nota = nota; d.atendido_por = G4G.auth.usuario().usuario;
      ui().toast(`Denuncia ${d.codigo}: ${G4G.config.estadosDenuncia[estado].label.toLowerCase()}.`); pintar();
      G4G.store.cargarDenunciasRed().catch(() => {});   // el mapa cambia de color si corresponde
    } catch (e) { ui().toast('No se pudo actualizar: ' + e.message, 'warn'); }
  }

  /* Ficha de una denuncia: foto (se pide al servidor), cercanía al registro y seguimiento. */
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
    ui().drawer.open({
      kicker: `Denuncia · ${d.codigo || d.id}`, title: d.tipo, subtitle: d.recibido ? 'Recibida ' + fecha(d.recibido) : fecha(d.creado),
      body: el('div', null, foto,
        ui().dl([['Descripción', d.descripcion], ['Ubicación', el('span', { class: 'mono' }, U.fmtCoord(d.lat, d.lng))], ['Precisión', d.precision ? `± ${U.fmt(d.precision)} m` : 'No disponible'],
          ['Atendida por', d.atendido_por || null]]),
        el('h4', null, 'Operaciones registradas a menos de ' + G4G.config.radioCercaniaKm + ' km'),
        cerca.length ? el('ul', { class: 'linklist' }, cerca.map((c) => el('li', null, el('button', { type: 'button', class: 'link', onclick: () => G4G.detalle.operador(c.o.id) }, c.o.nombre),
          el('span', { class: 'muted' }, ` · ${U.fmt(c.km, 1)} km `), ui().estadoChip(c.o.estado_legal))))
          : el('div', { class: 'callout callout--warn' }, 'Ninguna operación registrada cerca: posible actividad no registrada. Priorizar visita.'),
        el('h4', null, 'Seguimiento'), ui().field('Estado', estado), d.local ? null : ui().field('Nota interna', nota)),
      footer: [
        ui().button('Guardar seguimiento', { kind: 'primary', onclick: () => { cambiar(d, estado.value, d.local ? undefined : nota.value); ui().drawer.close(); } }),
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
    if (!G4G.api.activo()) raiz.appendChild(el('div', { class: 'callout' }, el('strong', null, 'Modo demostración. '), 'Sin servidor configurado solo se ven las denuncias hechas en este dispositivo. Con el backend, llegan aquí las de toda la ciudadanía.'));
    if (error) raiz.appendChild(el('div', { class: 'callout callout--warn' }, 'No se pudieron cargar las denuncias: ' + error));
    if (cargando && !lista) { raiz.appendChild(ui().empty('Cargando denuncias…')); return; }
    raiz.appendChild(ui().card(null, ver.length ? el('ul', { class: 'denlist' }, ver.map((d) => el('li', null,
      el('button', { type: 'button', class: 'denlist__row', onclick: () => abrir(d) },
        d.local && d.foto ? el('img', { src: d.foto, alt: '', class: 'denlist__thumb' }) : el('span', { class: 'denlist__thumb denlist__thumb--empty' }, ui().icon(d.tieneFoto ? 'denuncias' : 'alerta', 20)),
        el('span', { class: 'denlist__main' }, el('span', { class: 'cell-main' }, d.tipo), el('span', { class: 'cell-sub' }, `${d.codigo || d.id} · ${fecha(d.recibido || d.creado)}`)),
        ui().estadoDenunciaChip(d.estado))))) : ui().empty(filtro === 'abiertas' ? 'No hay denuncias por atender.' : 'Todavía no llegaron denuncias.')));
  }

  function render(root) { raiz = root; if (!G4G.api.activo() || (!lista && !cargando)) cargar(); else pintar(); }
  G4G.bus.on('auth:changed', () => { lista = null; error = null; });
  function onShow() { if (lista && !cargando && G4G.api.activo()) cargar(); }

  G4G.app.register({ id: 'buzon', titulo: 'Denuncias recibidas', icono: 'buzon', orden: 14, grupo: 'tecnico', subtitulo: 'Reportes de la ciudadanía para verificar y atender', render, onShow });
})();
