/* Módulo: Inicio. Portada para el público: buscar un operador, ver el mapa,
   denunciar, conocer los trámites y el programa. Lenguaje simple, sin tecnicismos.
   También expone ayudas para mostrar datos de G4G.normativa (referencial, fuente, fecha). */
(function () {
  const G4G = (window.G4G = window.G4G || {});
  const U = G4G.util, { el } = U;
  const ui = () => G4G.ui;

  /* Buscador con sugerencias (operadores por nombre, municipio o departamento). */
  function buscador(opts = {}) {
    const lista = el('ul', { class: 'suggest', role: 'listbox', hidden: true });
    let res = [], activo = -1;
    const input = el('input', {
      class: 'search-big__input', type: 'search', role: 'combobox', 'aria-expanded': 'false', 'aria-autocomplete': 'list', autocomplete: 'off',
      placeholder: opts.placeholder || 'Nombre o municipio…', 'aria-label': opts.ariaLabel || 'Buscar una cooperativa o empresa por nombre o municipio'
    });
    function elegir(o) { lista.hidden = true; input.setAttribute('aria-expanded', 'false'); (opts.onElegir || ((x) => G4G.detalle.operador(x.id)))(o); }
    function pintar() {
      U.clear(lista);
      const q = U.norm(input.value);
      if (q.length < 2) { lista.hidden = true; input.setAttribute('aria-expanded', 'false'); return; }
      res = G4G.store.state.operadores.filter((o) => U.norm(`${o.nombre} ${o.municipio || ''} ${o.departamento || ''} ${o.id}`).includes(q)).slice(0, 7);
      activo = -1;
      if (!res.length) lista.appendChild(el('li', { class: 'suggest__empty' }, 'No hay operadores con ese nombre en el registro. ¿Viste actividad minera ahí? Puedes reportarla.'));
      res.forEach((o, i) => lista.appendChild(el('li', { role: 'option', id: 'sug-' + i },
        el('button', { type: 'button', class: 'suggest__item', onclick: () => elegir(o) },
          el('span', { class: 'suggest__main' }, el('span', { class: 'suggest__name' }, o.nombre), el('span', { class: 'suggest__sub' }, [o.municipio, o.departamento].filter(Boolean).join(', '))),
          ui().estadoChip(o.estado_legal)))));
      lista.hidden = false; input.setAttribute('aria-expanded', 'true');
    }
    input.addEventListener('input', U.debounce(pintar, 120));
    input.addEventListener('keydown', (e) => {
      const items = lista.querySelectorAll('.suggest__item');
      if (e.key === 'ArrowDown' && items.length) { e.preventDefault(); activo = Math.min(items.length - 1, activo + 1); items[activo].focus(); }
      if (e.key === 'Enter' && res.length) { e.preventDefault(); elegir(res[0]); }
      if (e.key === 'Escape') { lista.hidden = true; }
    });
    lista.addEventListener('keydown', (e) => {
      const items = [...lista.querySelectorAll('.suggest__item')];
      const i = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown' && i < items.length - 1) { e.preventDefault(); items[i + 1].focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); if (i > 0) items[i - 1].focus(); else input.focus(); }
      if (e.key === 'Escape') { lista.hidden = true; input.focus(); }
    });
    document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) lista.hidden = true; });
    const wrap = el('div', { class: 'search-big' + (opts.compacto ? ' search-big--compact' : '') },
      el('span', { class: 'search-big__icon', 'aria-hidden': 'true' }, ui().icon('buscar', 20)), input, lista);
    return wrap;
  }

  /* ---------- Ilustraciones decorativas (img/*.svg): alt vacío, tamaño explícito, sin innerHTML ---------- */
  const ILU = { 'hero-andes-rio': [960, 260], 'vacio-denuncias': [240, 160], 'vacio-datos': [240, 160], exito: [200, 160] };
  function ilustracion(nombre, cls, ancho, urgente) {
    const t = ILU[nombre] || [240, 180], w = ancho || t[0];
    return el('img', { class: 'il ' + (cls || ''), src: 'img/' + nombre + '.svg', alt: '', width: w, height: Math.round(w * t[1] / t[0]), decoding: 'async', loading: urgente ? null : 'lazy' });
  }
  /* Bloque de estado vacío: ilustración suave + mensaje. Se pasa a ui().empty(...) o a la opción empty de una tabla. */
  function vacio(nombre, mensaje) {
    return el('div', { class: 'il-vacio' }, ilustracion(nombre, 'il-vacio__img', 200), el('p', { class: 'il-vacio__txt' }, mensaje));
  }

  /* ---------- Ayudas compartidas con Trámites, Programas, Mi estado e Ingresar ---------- */
  const normativa = () => G4G.normativa || {};
  /* Solo enlaces http(s): nunca javascript: ni otros esquemas. */
  function urlSegura(u) {
    if (!u) return '';
    try { const x = new URL(String(u).trim(), location.href); return /^https?:$/.test(x.protocol) ? x.href : ''; } catch (e) { return ''; }
  }
  /* Un dato es "referencial" si no está marcado como verificado. Si no trae estado propio, vale el estado general. */
  function esReferencial(item) {
    if (item && item.estado) return item.estado !== 'verificado';
    return !normativa().verificado;
  }
  const rotuloReferencial = () => el('span', { class: 'p2-ref', title: 'Dato referencial: aún no verificado con la fuente oficial.' }, ui().icon('info', 13), 'Referencial');
  const fechaVerificada = () => (normativa().verificado ? 'Verificado el ' + U.fmtDate(normativa().verificado) : null);
  /* Fuente con enlace (si lo hay) y fecha de verificación. Devuelve null si no hay nada que mostrar. */
  function lineaFuente(fuente, url) {
    const href = urlSegura(url) || urlSegura(/^https?:\/\//i.test(String(fuente || '')) ? fuente : '');
    const texto = /^https?:\/\//i.test(String(fuente || '')) ? 'Fuente oficial' : (fuente || (href ? 'Fuente oficial' : ''));
    const nodoFuente = href ? el('a', { href, target: '_blank', rel: 'noopener noreferrer' }, texto) : (texto ? el('span', null, texto) : null);
    const f = fechaVerificada();
    if (!nodoFuente && !f) return null;
    return el('p', { class: 'p2-fuente' }, nodoFuente ? ['Fuente: ', nodoFuente] : null, nodoFuente && f ? ' · ' : null, f);
  }

  /* Botón "Instalar en tu celular": se actualiza solo cuando el navegador avisa que ya se puede instalar. */
  let slotInstalar = null;
  function pintarInstalar(slot) {
    U.clear(slot);
    if (!G4G.pwa) return;
    const e = G4G.pwa.estado();
    if (e.modo === 'instalada' || e.modo === 'archivo') return;
    const accion = e.modo === 'disponible'
      ? async () => { const ok = await G4G.pwa.instalar(); if (!ok) ui().toast('Instalación cancelada. Puedes intentarlo cuando quieras.'); }
      : () => G4G.app.go('configuracion');
    slot.append(
      el('button', { type: 'button', class: 'btn', onclick: accion }, ui().icon('celular', 18), 'Instalar en tu celular'),
      el('span', { class: 'p2-instalar__txt' }, e.modo === 'disponible' ? 'Queda en tu pantalla de inicio y abre más rápido.' : 'Te mostramos cómo hacerlo.'));
  }
  G4G.bus.on('pwa:changed', () => { if (slotInstalar && slotInstalar.isConnected) pintarInstalar(slotInstalar); });

  function acceso(href, icono, titulo, desc, extra) {
    return el('li', null, el('a', { class: 'p2-acceso' + (extra ? ' ' + extra : ''), href },
      el('span', { class: 'p2-acceso__icon', 'aria-hidden': 'true' }, ui().icon(icono, 26)),
      el('span', { class: 'p2-acceso__txt' }, el('span', { class: 'p2-acceso__title' }, titulo), el('span', { class: 'p2-acceso__desc' }, desc)),
      el('span', { class: 'p2-acceso__go', 'aria-hidden': 'true' }, chevron())));
  }
  function chevron() {
    return U.svg('svg', { viewBox: '0 0 24 24', width: 22, height: 22, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' }, U.svg('path', { d: 'M9 5l7 7-7 7' }));
  }

  /* Informaciones: acordeón con lo que viene de G4G.normativa.informaciones. */
  function bloqueInformaciones() {
    const lista = normativa().informaciones || [];
    if (!lista.length) return null;
    const f = fechaVerificada();
    return el('section', { class: 'block' },
      el('div', { class: 'block__head' }, el('h3', null, 'Informaciones'), f ? el('span', { class: 'muted small' }, f) : el('span', { class: 'muted small' }, 'Aún sin verificar')),
      el('div', { class: 'p2-info' }, lista.map((it) => {
        const parrafos = String(it.texto || '').split(/\n+/).map((t) => t.trim()).filter(Boolean);
        return el('details', null,
          el('summary', null, el('span', { class: 'p2-info__tit' }, it.titulo), esReferencial(it) ? rotuloReferencial() : null),
          el('div', { class: 'p2-info__body' }, parrafos.map((t) => el('p', null, t)), lineaFuente(it.fuente, it.url)));
      })));
  }

  /* Franja de Novedades: las 3 más recientes (datos en js/data/novedades.js). Carrusel en celular, 3 columnas en escritorio. */
  function franjaNovedades() {
    const N = G4G.novedadesUI;
    const items = N ? N.recientes(3) : [];
    if (!items.length) return null;
    return el('section', { class: 'block', 'aria-label': 'Novedades' },
      el('div', { class: 'block__head' }, el('h3', null, 'Novedades'), el('a', { class: 'nv-todas', href: '#/novedades' }, 'Ver todas')),
      el('ul', { class: 'nv-strip' }, items.map((it) => el('li', null,
        el('a', { class: 'nv-mini', href: '#/novedades', onclick: (e) => { e.preventDefault(); G4G.app.go('novedades', { abrir: it.id }); } },
          N.imagen(it),
          el('span', { class: 'nv-mini__body' }, N.meta(it), el('span', { class: 'nv-mini__title' }, it.titulo)))))));
  }

  function render(root) {
    root.classList.add('p2');
    const S = G4G.store, ops = S.state.operadores, n = ops.length;
    const cs = ops.reduce((a, o) => { a[o.estado_legal] = (a[o.estado_legal] || 0) + 1; return a; }, {});
    const E = G4G.config.estados, A = G4G.auth;
    const fun = A.esFuncionario();
    const nPrio = fun ? S.pasivosEvaluados().filter((p) => p.clase.nivel === 1).length : 0;

    slotInstalar = el('div', { class: 'p2-instalar' });
    pintarInstalar(slotInstalar);

    root.appendChild(el('section', { class: 'hero hero--p2' },
      el('div', { class: 'p2-marca' },
        el('img', { class: 'p2-marca__logo', src: 'icons/logo-aurum80.svg', alt: '', width: 44, height: 44 }),
        el('span', { class: 'p2-marca__txt' }, el('strong', null, G4G.config.nombre), el('span', null, 'Minería responsable'))),
      el('h2', { class: 'hero__title' }, 'Consulta, denuncia y formaliza: minería de oro responsable'),
      el('p', { class: 'hero__lead' }, 'Con Aurum80 consultas qué dice el registro sobre una cooperativa o empresa minera de oro, ves dónde opera, denuncias lo que observas y conoces los pasos para formalizarte.'),
      buscador(),
      slotInstalar,
      el('div', { class: 'il-hero', 'aria-hidden': 'true' }, ilustracion('hero-andes-rio', 'il-hero__img', 960, true))));

    /* Accesos grandes. Primero el de la sesión, si la hay. */
    const accesos = [];
    if (A.esOperador()) accesos.push(acceso('#/miestado', 'miestado', 'Mi estado', 'Mira tu avance y qué sigue para ti.', 'p2-acceso--sesion'));
    else if (fun) accesos.push(acceso('#/resumen', 'resumen', 'Resumen del municipio', 'Panel con el estado de todas las operaciones.', 'p2-acceso--sesion'));
    accesos.push(
      acceso('#/mapa', 'mapa', 'Ver el mapa', 'Mira dónde operan las cooperativas y empresas.'),
      acceso('#/denuncias', 'denuncias', 'Denunciar', 'Envía una foto y la ubicación en tres pasos.', 'p2-acceso--primary'),
      acceso('#/tramites', 'tramites', 'Trámites para ser legal', 'Los pasos para regularizar una operación.'),
      acceso('#/programas', 'programas', 'Programa de biorremediación', 'Conoce el programa piloto y cómo inscribirte.'));
    root.appendChild(el('section', { class: 'block' },
      el('div', { class: 'block__head' }, el('h3', null, '¿Qué quieres hacer?')),
      el('ul', { class: 'p2-accesos' }, accesos)));

    const novedades = franjaNovedades();
    if (novedades) root.appendChild(novedades);

    /* Lo que dice el registro: cada cifra lleva a la lista filtrada. */
    const tile = (k, texto) => el('button', { type: 'button', class: 'stat-link', onclick: () => G4G.app.go('operadores', { estado: k }) },
      el('span', { class: 'stat-link__top' }, ui().shapeSvg(E[k].forma, E[k].color, 14), el('span', { class: 'stat-link__n' }, U.fmt(cs[k] || 0))),
      el('span', { class: 'stat-link__txt' }, texto),
      el('span', { class: 'stat-link__go' }, 'Ver lista →'));
    root.appendChild(el('section', { class: 'block' },
      el('div', { class: 'block__head' }, el('h3', null, 'Lo que dice el registro'), el('span', { class: 'muted small' }, `${U.fmt(n)} operadores registrados`)),
      el('div', { class: 'stat-links' },
        tile('legal', 'figuran como legales en el registro'),
        tile('proceso', 'están regularizándose: les faltan requisitos'),
        fun ? tile('no_legal', 'operan sin los permisos necesarios') : null,
        tile('sin_dato', 'sin verificar: falta el dato oficial')),
      /* Los pasivos (colas y relaves) son solo para funcionarios. */
      fun ? el('button', { type: 'button', class: 'banner-link', onclick: () => G4G.app.go('pasivos') },
        el('span', { class: 'banner-link__n' }, U.fmt(nPrio)),
        el('span', null, el('strong', null, 'pasivos mineros con prioridad alta. '), 'Colas y relaves cerca de ríos o poblaciones que conviene revisar primero.'),
        el('span', { class: 'stat-link__go' }, 'Ver →')) : null));

    const info = bloqueInformaciones();
    if (info) root.appendChild(info);

    root.appendChild(el('section', { class: 'block' },
      el('div', { class: 'block__head' }, el('h3', null, 'Cómo funciona')),
      el('ol', { class: 'how' },
        el('li', null, el('span', { class: 'how__n' }, '1'), el('strong', null, 'Consulta'), el('span', null, 'Busca una operación y mira si tiene sus permisos y qué le falta.')),
        el('li', null, el('span', { class: 'how__n' }, '2'), el('strong', null, 'Reporta'), el('span', null, 'Si ves vertidos al río, uso de mercurio o una operación que no aparece, envía foto y ubicación.')),
        el('li', null, el('span', { class: 'how__n' }, '3'), el('strong', null, 'La autoridad verifica'), el('span', null, 'Los técnicos revisan los reportes y priorizan inspecciones. El registro sirve para regularizar, no para castigar.')))));

    if (S.state.meta.origen === 'demo') {
      root.appendChild(el('p', { class: 'muted small center' }, 'Prototipo con datos simulados: los nombres y estados son inventados y no corresponden a operaciones reales.'));
    }

    root.appendChild(el('footer', { class: 'p2-pie' },
      el('img', { src: 'icons/logo-aurum80.svg', alt: '', width: 36, height: 36 }),
      el('span', null, el('strong', null, 'Equipo ' + G4G.config.equipo), ' · ' + G4G.config.evento)));
  }

  G4G.ilu = { img: ilustracion, vacio };
  G4G.inicio = { buscador, urlSegura, esReferencial, rotuloReferencial, fechaVerificada, lineaFuente };
  G4G.app.register({ id: 'inicio', titulo: 'Inicio', icono: 'inicio', orden: 0, grupo: 'ciudadania', movil: ['publico', 'operador', 'funcionario'], subtitulo: 'Información, trámites y denuncias para una minería responsable', render });
})();
