/* Módulo: Configuración. Instalar en el celular, uso sin conexión, mapa base,
   cuenta y datos guardados en el dispositivo. Visible para todos. */
(function () {
  const G4G = (window.G4G = window.G4G || {});
  const U = G4G.util, { el } = U;
  const ui = () => G4G.ui;
  let raiz = null;

  function pasos(lista) { return el('ol', { class: 'install__steps' }, lista.map((p) => el('li', null, p))); }

  function tarjetaInstalar() {
    const e = G4G.pwa.estado();
    let cuerpo;
    if (e.modo === 'instalada') cuerpo = [el('div', { class: 'install__ok' }, ui().icon('celular', 22), el('strong', null, 'La aplicación ya está instalada en este dispositivo.')),
      el('p', { class: 'muted' }, 'Ábrela desde el ícono de Aurum80 en tu pantalla de inicio.')];
    else if (e.modo === 'disponible') cuerpo = [el('p', null, 'Instálala como una aplicación: queda un ícono en tu pantalla de inicio, se abre a pantalla completa y funciona aunque no haya señal (el mapa base necesita internet).'),
      el('button', { type: 'button', class: 'btn btn--primary btn--big', onclick: async () => { const ok = await G4G.pwa.instalar(); if (!ok) ui().toast('Instalación cancelada. Puedes intentarlo cuando quieras.'); pintar(); } }, ui().icon('descargar', 18), 'Instalar aplicación')];
    else if (e.modo === 'ios') cuerpo = [el('p', null, 'En iPhone o iPad se instala desde Safari:'),
      pasos(['Abre esta página en Safari.', ['Toca el botón ', el('strong', null, 'Compartir'), ' (cuadro con flecha hacia arriba).'], ['Elige ', el('strong', null, 'Agregar a inicio'), ' y confirma con ', el('strong', null, 'Agregar'), '.']])];
    else if (e.modo === 'archivo') cuerpo = [el('div', { class: 'callout' }, 'La instalación se activa cuando la página está publicada (por ejemplo en GitHub Pages, con dirección https://). Abierta como archivo desde la computadora no se puede instalar.'),
      el('p', { class: 'muted small' }, 'Cuando esté publicada, abre la dirección en tu celular y vuelve a esta sección.')];
    else cuerpo = [el('p', null, 'Tu navegador no ofreció el botón automático. Puedes instalarla desde su menú:'),
      pasos(e.android
        ? [['Abre esta página en ', el('strong', null, 'Chrome'), '.'], ['Toca el menú ', el('strong', null, '⋮'), ' (arriba a la derecha).'], ['Elige ', el('strong', null, 'Instalar aplicación'), ' o ', el('strong', null, 'Agregar a pantalla principal'), '.']]
        : [['En Chrome o Edge, busca el ícono de instalar en la barra de direcciones'], ['o abre el menú y elige ', el('strong', null, 'Instalar Aurum80'), '.']])];
    return ui().card('Instalar en el celular', el('div', { class: 'install' }, el('div', { class: 'install__icon' }, el('img', { src: 'icons/icon-192.png', alt: '', width: 64, height: 64 })), el('div', null, cuerpo)));
  }

  function tarjetaSinConexion() {
    const sw = G4G.pwa.conServiceWorker(), online = navigator.onLine;
    const pend = G4G.store.state.denuncias.filter((d) => d.envio === 'pendiente').length;
    return ui().card('Uso sin conexión', el('div', null,
      ui().dl([
        ['Conexión ahora', online ? 'En línea' : 'Sin conexión'],
        ['Aplicación guardada', sw ? 'Sí: abre aunque no haya señal' : (G4G.pwa.servible() ? 'Preparando…' : 'No disponible al abrir como archivo')],
        ['Datos del registro', `Última copia: ${U.fmtDateTime(G4G.store.state.meta.cargado)}`],
        G4G.api.activo() ? ['Denuncias por enviar', pend ? `${pend} (se envían solas al volver la señal)` : 'Ninguna'] : null]),
      el('div', { class: 'row-gap' },
        ui().button('Actualizar datos ahora', { icon: 'descargar', onclick: async (e) => { e.currentTarget.disabled = true; const r = await G4G.store.sincronizar(); ui().toast(r.estado === 'ok' ? 'Datos actualizados.' : r.estado === 'sin-fuente' ? 'No hay base en línea configurada.' : 'No se pudo actualizar: ' + (r.mensaje || r.estado), r.estado === 'ok' ? '' : 'warn'); pintar(); } }),
        sw ? ui().button(G4G.pwa.hayActualizacion() ? 'Instalar nueva versión' : 'Buscar nueva versión', { onclick: async () => {
          if (G4G.pwa.hayActualizacion()) return G4G.pwa.aplicarActualizacion();
          const hay = await G4G.pwa.buscarActualizacion(); ui().toast(hay ? 'Hay una versión nueva. Toca de nuevo para instalarla.' : 'Ya tienes la versión más reciente.'); pintar();
        } }) : null)));
  }

  function tarjetaMapa() {
    const capas = G4G.config.mapa.capasBase, actual = Number(localStorage.getItem('g4g.mapabase') || 0);
    const seg = el('div', { class: 'seg', role: 'group', 'aria-label': 'Mapa base predeterminado' }, capas.map((c, i) => el('button', {
      type: 'button', class: 'seg__btn' + (actual === i ? ' is-on' : ''), 'aria-pressed': String(actual === i),
      onclick: () => { try { localStorage.setItem('g4g.mapabase', String(i)); } catch (e) { /* nada */ } ui().toast(`Mapa base: ${c.nombre}. Se aplica al abrir el mapa.`); pintar(); }
    }, c.nombre)));
    return ui().card('Mapa', el('div', null, ui().field('Mapa base al abrir', seg, 'Satélite ayuda a reconocer el terreno y los cursos de agua.')));
  }

  function tarjetaCuenta() {
    const u = G4G.auth.usuario();
    return ui().card('Cuenta', u
      ? el('div', null, ui().dl([['Sesión', [u.nombre, u.municipio].filter(Boolean).join(' · ')], ['Perfil', { funcionario: 'Autoridad del municipio', tecnico: 'Técnico de campo', operador: 'Cooperativa o empresa' }[u.rol] || 'Sesión iniciada']]), el('div', { class: 'row-gap' }, ui().button('Cerrar sesión', { icon: 'salir', onclick: () => G4G.auth.salir() })))
      : el('div', null, el('p', null, 'Estás en la consulta pública: puedes consultar, ver el mapa y denunciar sin cuenta.'),
        el('div', { class: 'row-gap' }, ui().button('Ingresar a mi cuenta', { icon: 'candado', onclick: () => G4G.app.go('ingresar') }))));
  }

  function tarjetaDispositivo() {
    const n = G4G.store.state.denuncias.length;
    return ui().card('Datos en este dispositivo', el('div', null,
      el('p', { class: 'muted' }, 'La app guarda una copia del registro público y sus denuncias para funcionar sin señal. Nada de esto se comparte con otras personas.'),
      el('div', { class: 'row-gap' },
        ui().button(`Borrar mis denuncias guardadas (${n})`, { kind: 'danger', disabled: !n, onclick: () => {
          const pend = G4G.store.state.denuncias.filter((d) => d.envio === 'pendiente').length;
          if (!confirm(pend ? `Hay ${pend} denuncias sin enviar. Si las borras, se perderán. ¿Continuar?` : '¿Borrar las denuncias guardadas en este dispositivo?')) return;
          G4G.store.state.denuncias.slice().forEach((d) => G4G.store.removeDenuncia(d.id)); ui().toast('Denuncias borradas de este dispositivo.'); pintar();
        } }),
        ui().button('Borrar copia del registro', { onclick: async () => { if (!confirm('Se borrará la copia guardada y se volverá a descargar. ¿Continuar?')) return; try { localStorage.removeItem('g4g.dataset.v1'); } catch (e) { /* nada */ } location.reload(); } }))));
  }

  function tarjetaAcerca() {
    return ui().card('Acerca de', el('div', null, ui().dl([
      ['Aplicación', `${G4G.config.nombre} · versión ${G4G.config.version}`],
      ['Datos', G4G.api.activo() ? 'Base del municipio (servidor)' : (G4G.store.state.meta.origen === 'demo' ? 'Simulados (demostración)' : G4G.store.state.meta.archivo || 'Archivo cargado')],
      ['Mapas', 'Esri, OpenStreetMap y Natural Earth (ver atribución en el mapa)'],
      ['Proyecto', 'Gold4Good Bolivia 2026 · Desafío ORO-4.2']])));
  }

  function pintar() {
    if (!raiz) return;
    U.clear(raiz);
    raiz.appendChild(el('div', { class: 'grid grid--2 settings' }, tarjetaInstalar(), tarjetaSinConexion(), tarjetaCuenta(), tarjetaMapa(), tarjetaDispositivo(), tarjetaAcerca()));
  }

  function render(root) { raiz = root; pintar(); }
  G4G.bus.on('pwa:changed', () => { if (raiz && !raiz.hidden) pintar(); });
  window.addEventListener('online', () => { if (raiz && !raiz.hidden) pintar(); });
  window.addEventListener('offline', () => { if (raiz && !raiz.hidden) pintar(); });

  G4G.app.register({ id: 'configuracion', titulo: 'Configuración', icono: 'ajustes', orden: 90, grupo: 'app', subtitulo: 'Instalar en el celular, uso sin conexión y preferencias', render, onShow: () => pintar() });
})();
