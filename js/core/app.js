/* ==========================================================================
   Núcleo de la aplicación: registro de módulos, enrutador y estructura.
   Para agregar una sección nueva: crear js/modules/<nombre>.js que llame a
   G4G.app.register({ id, titulo, icono, orden, grupo, subtitulo, render(root) })
   y añadir el <script> en index.html. Nada más cambia.
   grupo: 'ciudadania' (público), 'tecnico' (solo funcionarios con sesión) o
   'app' (ajustes). oculto: true = no aparece en el menú (p. ej. Ingresar).
   ========================================================================== */
(function () {
  const G4G = (window.G4G = window.G4G || {});
  const { el, clear } = G4G.util;

  const GRUPOS = { ciudadania: 'Ciudadanía', cooperativa: 'Mi cooperativa', tecnico: 'Autoridades', app: 'Aplicación' };
  const modulos = [];
  let activo = null, host = null, titulo = null, subtitulo = null, chipOrigen = null, chipConn = null, cuenta = null, pie = null, nav = null, pendiente = null, retorno = null;

  /* Cada módulo se registra con { id, titulo, icono, orden, grupo, render, ... }.
     movil: lista de perfiles ('publico' | 'operador' | 'funcionario') para los que el módulo va en la barra inferior del celular;
     el resto de secciones se abren desde el botón "Más". */
  function register(mod) {
    mod.grupo = mod.grupo || 'ciudadania';
    if (mod.grupo === 'tecnico') mod.soloFuncionario = true;
    if (mod.grupo === 'cooperativa') mod.soloOperador = true;
    modulos.push(mod); modulos.sort((a, b) => a.orden - b.orden);
  }
  const inicio = () => (modulos[0] ? modulos[0].id : 'inicio');
  const rutaActual = () => (location.hash.replace(/^#\/?/, '') || inicio());
  const permitido = (m) => (!m.soloFuncionario || G4G.auth.esFuncionario()) && (!m.soloOperador || G4G.auth.esOperador());
  /* Perfil para la barra del celular: quien no tiene sesión, o es técnico de campo, ve el público. */
  const perfil = () => (G4G.auth.esFuncionario() ? 'funcionario' : G4G.auth.esOperador() ? 'operador' : 'publico');
  /* A dónde se lleva a cada perfil justo después de ingresar. */
  const destinoTrasIngresar = () => (G4G.auth.esFuncionario() ? 'resumen' : G4G.auth.esOperador() ? 'miestado' : 'ingresar');

  function mostrar(id, params) {
    let mod = modulos.find((m) => m.id === id) || modulos[0];
    /* Una sección con acceso restringido sin sesión lleva a Ingresar y luego vuelve. */
    if (!permitido(mod)) { retorno = mod.id; mod = modulos.find((m) => m.id === 'ingresar') || modulos[0]; }
    const previo = activo;
    const aplicar = () => {
      activo = mod;
      modulos.forEach((m) => { if (m.seccion) m.seccion.hidden = m.id !== mod.id; });
      nav.querySelectorAll('a[data-id]').forEach((a) => {
        const on = a.dataset.id === mod.id;
        a.classList.toggle('is-active', on);
        if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
      });
      const mas = nav.querySelector('.nav__mas');
      if (mas) mas.classList.toggle('is-active', !!mod && !(mod.movil || []).includes(perfil()) && mod.id !== 'ingresar');
      cerrarMas();
      titulo.textContent = mod.titulo; subtitulo.textContent = mod.subtitulo || '';
      document.title = `${mod.titulo} · ${G4G.config.nombre}`;
      host.classList.toggle('is-full', !!mod.full);
      document.body.dataset.vista = mod.id;
      construir(mod, params);
      window.scrollTo(0, 0);
      if (G4G.motion) G4G.motion.indicador(nav);
    };
    /* motion.js (si está) anima el cambio: View Transitions o fundido; sin él, se cambia directo. */
    if (G4G.motion && G4G.motion.transicion) G4G.motion.transicion(aplicar, { desde: previo, hacia: mod }); else aplicar();
  }

  function construir(mod, params) {
    if (!mod.seccion) { mod.seccion = el('section', { class: 'view view--' + mod.id, id: 'vista-' + mod.id }); host.appendChild(mod.seccion); mod.construido = false; }
    if (!mod.construido) { mod.seccion.hidden = false; protegido(mod, () => mod.render(mod.seccion, params)); mod.construido = true; mod.sucio = false; }
    else if (mod.sucio) refrescar(mod);
    if (mod.onShow) protegido(mod, () => mod.onShow(mod.seccion, params));
    if (G4G.motion) G4G.motion.contadores(mod.seccion);
  }
  function refrescar(mod) {
    mod.sucio = false;
    if (mod.persistent && mod.update) protegido(mod, () => mod.update(mod.seccion));
    else { clear(mod.seccion); protegido(mod, () => mod.render(mod.seccion)); }
    if (G4G.motion) G4G.motion.contadores(mod.seccion);
  }
  function protegido(mod, fn) {
    try { fn(); } catch (e) {
      console.error(e);
      mod.seccion.appendChild(el('div', { class: 'callout callout--warn' }, `Error en el módulo "${mod.titulo}": ${e.message}`));
    }
  }

  function go(id, params) {
    if (rutaActual() === id) mostrar(id, params);
    else { pendiente = params; location.hash = '#/' + id; }
  }

  function actualizarOrigen() {
    const meta = G4G.store.state.meta;
    chipOrigen.className = 'origin ' + (meta.origen === 'demo' ? 'origin--demo' : 'origin--real');
    chipOrigen.textContent = meta.origen === 'demo' ? 'DATOS SIMULADOS' : (meta.archivo || 'Datos cargados');
    chipOrigen.title = meta.origen === 'demo' ? 'Datos de demostración inventados.' : 'Origen de los datos';
  }

  /* Indicador de conexión con la base: en línea (hoja de Google) o modo demostración (solo este dispositivo). */
  const TEXTOS_CONEXION = {
    demo: ['Modo demostración · solo este dispositivo', 'Demostración', 'demo'],
    cargando: ['Conectando con la base…', 'Conectando', 'busy'],
    linea: ['En línea con la base', 'En línea', 'ok'],
    'sin-red': ['Sin conexión con la base', 'Sin conexión', 'off']
  };
  function actualizarConexion() {
    const c = G4G.store.state.conexion, t = TEXTOS_CONEXION[c.modo] || TEXTOS_CONEXION.demo;
    chipConn.className = 'conn conn--' + t[2];
    chipConn.replaceChildren(el('span', { class: 'conn__dot', 'aria-hidden': 'true' }), el('span', { class: 'conn__full' }, t[0]), el('span', { class: 'conn__short' }, t[1]));
    const hora = c.ultima ? new Date(c.ultima).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
    chipConn.title = c.modo === 'demo' ? 'No hay base en línea configurada: lo que se registra queda solo en este dispositivo y no aparece en otros.'
      : c.modo === 'linea' ? 'Conectado a la hoja de Google del municipio. Última actualización: ' + hora
      : c.modo === 'sin-red' ? 'No se pudo hablar con la base (' + (c.error || 'sin respuesta') + '). Se muestran los últimos datos guardados.' : 'Conectando con la hoja de Google del municipio…';
    chipConn.setAttribute('role', 'status');
  }

  /* Botón de cuenta (arriba a la derecha) y pie del menú lateral. */
  function actualizarCuenta() {
    const u = G4G.auth.usuario(), ui = G4G.ui;
    clear(cuenta); clear(pie);
    const rolTxt = { funcionario: 'Autoridad', tecnico: 'Técnico de campo', operador: 'Cooperativa o empresa' };
    if (u) {
      cuenta.append(el('a', { class: 'account account--on', href: '#/ingresar', title: 'Mi sesión' }, ui.icon('usuario', 16),
        el('span', { class: 'account__txt' }, el('strong', null, u.nombre), el('span', null, rolTxt[u.rol] || u.municipio || ''))));
      pie.append(el('div', { class: 'readonly readonly--on' }, ui.icon('usuario', 14), 'Sesión: ' + ({ operador: 'cooperativa' }[u.rol] || (rolTxt[u.rol] || 'iniciada').toLowerCase())));
    } else {
      cuenta.append(el('a', { class: 'account', href: '#/ingresar', title: 'Ingresar: cooperativas, empresas y autoridades' }, ui.icon('candado', 16), el('span', { class: 'account__txt' }, 'Ingresar')));
      pie.append(el('div', { class: 'readonly' }, ui.icon('candado', 14), 'Consulta pública'));
    }
    pie.append(el('div', null, `Versión ${G4G.config.version} · Equipo ${G4G.config.equipo}`));
  }

  /* Menú: en pantalla ancha, todas las secciones por grupo. En celular, barra inferior con 4 accesos según el perfil
     (los marcados con "movil" en cada módulo) y un botón "Más" que abre el resto. */
  function itemsNav() {
    /* nav__ind: pastilla dorada que desliza motion.js bajo el acceso activo (solo celular). */
    const items = [el('span', { class: 'nav__ind', 'aria-hidden': 'true' })], p = perfil();
    Object.entries(GRUPOS).forEach(([g, label]) => {
      const mods = modulos.filter((m) => m.grupo === g && !m.oculto && permitido(m));
      if (!mods.length) return;
      items.push(el('div', { class: 'nav__group' + (g === 'app' ? ' nav__app' : '') }, label));
      mods.forEach((m) => items.push(el('a', { href: '#/' + m.id, 'data-id': m.id, 'data-grupo': g, class: (m.movil || []).includes(p) ? null : 'nav__sec' }, G4G.ui.icon(m.icono, 20), el('span', null, m.corto || m.titulo))));
    });
    items.push(el('button', { type: 'button', class: 'nav__mas', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', onclick: abrirMas }, G4G.ui.icon('menu', 22), el('span', null, 'Más')));
    return items;
  }

  /* Hoja inferior con todas las secciones (solo celular). */
  let hojaMas = null;
  function cerrarMas(devolverFoco) {
    if (!hojaMas) return;
    const hoja = hojaMas; hojaMas = null; document.body.classList.remove('sheet-open');
    /* Cierre animado: se marca la hoja y se quita del DOM al terminar (sin movimiento, al instante). */
    if (G4G.motion && !G4G.motion.reducido()) {
      hoja.classList.add('is-closing'); hoja.setAttribute('aria-hidden', 'true');
      setTimeout(() => hoja.remove(), 260);
    } else hoja.remove();
    const b = nav && nav.querySelector('.nav__mas');
    if (b) { b.setAttribute('aria-expanded', 'false'); if (devolverFoco === true) b.focus({ preventScroll: true }); }
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && hojaMas) cerrarMas(true); });
  function abrirMas() {
    if (hojaMas) return cerrarMas(true);
    const secciones = [];
    Object.entries(GRUPOS).forEach(([g, label]) => {
      const mods = modulos.filter((m) => m.grupo === g && !m.oculto && permitido(m));
      if (!mods.length) return;
      secciones.push(el('div', { class: 'sheet__group' }, label),
        el('div', { class: 'sheet__grid' }, mods.map((m) => el('a', { href: '#/' + m.id, class: 'sheet__item' + (activo && activo.id === m.id ? ' is-active' : ''), onclick: () => cerrarMas() }, G4G.ui.icon(m.icono, 24), el('span', null, m.titulo)))));
    });
    secciones.push(el('div', { class: 'sheet__group' }, 'Cuenta'), el('div', { class: 'sheet__grid' },
      el('a', { href: '#/ingresar', class: 'sheet__item', onclick: () => cerrarMas() }, G4G.ui.icon(G4G.auth.usuario() ? 'usuario' : 'candado', 24), el('span', null, G4G.auth.usuario() ? 'Mi sesión' : 'Ingresar')),
      el('a', { href: '#/configuracion', class: 'sheet__item', onclick: () => cerrarMas() }, G4G.ui.icon('ajustes', 24), el('span', null, 'Instalar y ajustes'))));
    hojaMas = el('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Más secciones' },
      el('div', { class: 'sheet__scrim', onclick: () => cerrarMas() }),
      el('div', { class: 'sheet__panel' }, el('div', { class: 'sheet__handle', 'aria-hidden': 'true' }),
        el('div', { class: 'sheet__head' }, el('strong', null, 'Todas las secciones'), el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Cerrar', onclick: () => cerrarMas() }, G4G.ui.icon('cerrar'))),
        ...secciones));
    document.body.append(hojaMas); document.body.classList.add('sheet-open');
    const bm = nav.querySelector('.nav__mas'); if (bm) bm.setAttribute('aria-expanded', 'true');
    hojaMas.querySelector('.icon-btn').focus({ preventScroll: true });
  }

  function boot() {
    G4G.store.init();
    const app = document.getElementById('app');
    nav = el('nav', { class: 'nav', 'aria-label': 'Secciones' }, itemsNav());
    titulo = el('h1', null); subtitulo = el('p', { class: 'topbar__sub' });
    chipOrigen = el('span', { class: 'origin' });
    chipConn = el('span', { class: 'conn' });
    cuenta = el('div', { class: 'account-slot' });
    pie = el('div', { class: 'side__foot' });
    host = el('main', { class: 'main', id: 'contenido' });
    app.append(
      el('aside', { class: 'side' },
        el('a', { class: 'brand', href: '#/' + inicio() }, el('img', { class: 'brand__logo', src: 'icons/logo-aurum80.svg', alt: '', width: 40, height: 40 }), el('div', null, el('div', { class: 'brand__name' }, G4G.config.nombre), el('div', { class: 'brand__tag' }, 'Minería responsable'))),
        nav, pie),
      el('div', { class: 'stage' },
        el('header', { class: 'topbar' }, el('div', { class: 'topbar__title' }, titulo, subtitulo),
          el('div', { class: 'topbar__right' }, chipConn, chipOrigen, cuenta,
            el('a', { class: 'icon-btn', href: '#/configuracion', title: 'Configuración', 'aria-label': 'Configuración' }, G4G.ui.icon('ajustes', 20)))),
        host));
    G4G.ui.drawer.init(document.body);

    G4G.bus.on('data:changed', () => {
      actualizarOrigen();
      modulos.forEach((m) => { if (!m.construido) return; if (m === activo) refrescar(m); else m.sucio = true; });
    });
    G4G.bus.on('conexion:changed', actualizarConexion);
    /* Una denuncia nueva o con otro estado: el mapa se redibuja solo; aquí solo las pantallas que lo piden (p. ej. Resumen). */
    G4G.bus.on('denuncias:changed', () => modulos.forEach((m) => { if (m.reaccionaDenuncias && m.construido) { if (m === activo) refrescar(m); else m.sucio = true; } }));
    G4G.bus.on('auth:changed', () => {
      nav.replaceChildren(...itemsNav());
      if (G4G.motion) G4G.motion.indicador(nav);
      actualizarCuenta();
      /* Las vistas ya construidas se rehacen con lo que el nuevo perfil puede ver. */
      modulos.forEach((m) => { if (m.construido && m !== activo) m.sucio = true; });
      const entro = !!G4G.auth.usuario() && activo && activo.id === 'ingresar';
      if (entro && (retorno || destinoTrasIngresar() !== 'ingresar')) {
        /* Recién ingresó: vuelve a donde iba, o va a su panel. Si lo que pedía no es de su perfil, va a su panel. */
        const r = retorno && permitido(modulos.find((m) => m.id === retorno) || {}) ? retorno : destinoTrasIngresar();
        retorno = null; go(r);
      }
      else if (activo && !permitido(activo)) go(inicio());
      else if (activo) refrescar(activo);
    });
    window.addEventListener('hashchange', () => { const p = pendiente; pendiente = null; G4G.ui.drawer.close(); mostrar(rutaActual(), p); });
    actualizarOrigen(); actualizarCuenta(); actualizarConexion();
    mostrar(rutaActual());
    /* Base en línea: se muestra lo último guardado y se actualiza en segundo plano. */
    G4G.store.sincronizar().then((r) => {
      if (r.estado === 'error') G4G.ui.toast('No se pudo actualizar desde la base en línea; se muestran los últimos datos guardados.', 'warn');
    });
    /* Con base en línea: denuncias de todos los dispositivos, y se actualizan solas. */
    G4G.store.cargarDenunciasRed().catch(() => {});
    G4G.store.iniciarAuto();
    if (G4G.pwa) G4G.pwa.iniciar();
  }

  window.addEventListener('error', (e) => {
    const b = document.getElementById('app') || document.body;
    b.prepend(el('div', { class: 'fatal' }, `Error: ${e.message} (${(e.filename || '').split('/').pop()}:${e.lineno})`));
  });
  document.addEventListener('DOMContentLoaded', boot);

  G4G.app = { register, go, modulos, retorno: () => retorno, perfil };
})();
