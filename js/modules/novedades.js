/* Módulo: Novedades. Noticias del sector (resumen propio, con su fuente) y lo nuevo de Aurum80.
   Los datos viven en js/data/novedades.js; aquí no se escribe ninguna noticia.
   Todo texto entra al DOM con G4G.util.el (sin innerHTML). Los enlaces externos solo http(s).
   También expone G4G.novedadesUI para la franja de Inicio. */
(function () {
  const G4G = (window.G4G = window.G4G || {});
  const U = G4G.util, { el } = U;
  const ui = () => G4G.ui;

  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  /* forma y color acompañan al texto: el tipo nunca depende solo del color. */
  const TIPOS = {
    noticia: { label: 'Noticia', forma: 'circulo', color: '#1F4E9C' },
    aurum80: { label: 'Aurum80', forma: 'cuadrado', color: '#B07D14' },
    guia: { label: 'Guía', forma: 'triangulo', color: '#2E7D4F' }
  };
  const FILTROS = [['todo', 'Todo'], ['noticia', 'Noticias'], ['aurum80', 'Aurum80'], ['guia', 'Guías']];

  const datos = () => (G4G.novedades && Array.isArray(G4G.novedades.items) ? G4G.novedades.items : []);
  /* Más reciente primero; a igual fecha se respeta el orden del archivo de datos. */
  const ordenadas = () => datos().map((it, i) => [it, i]).sort((a, b) => (a[0].fecha < b[0].fecha ? 1 : a[0].fecha > b[0].fecha ? -1 : a[1] - b[1])).map((x) => x[0]);

  /* '2026-10-31' -> '31 oct 2026' */
  function fechaLegible(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m && MESES[+m[2] - 1] ? `${+m[3]} ${MESES[+m[2] - 1]} ${m[1]}` : '';
  }
  const urlSegura = (u) => (G4G.inicio && G4G.inicio.urlSegura ? G4G.inicio.urlSegura(u) : (/^https?:\/\//i.test(String(u || '')) ? String(u) : ''));
  /* Solo ilustraciones propias de img/. */
  const rutaImagen = (it) => (/^img\/novedades-[a-z0-9-]+\.svg$/.test(it.imagen || '') ? it.imagen : 'img/novedades-aurum80.svg');

  function imagen(it, cls, urgente) {
    return el('img', { class: 'nv-img ' + (cls || ''), src: rutaImagen(it), alt: '', width: 320, height: 200, decoding: 'async', loading: urgente ? null : 'lazy' });
  }
  function tipoChip(it) {
    const t = TIPOS[it.tipo] || TIPOS.noticia;
    return el('span', { class: 'nv-tipo nv-tipo--' + (TIPOS[it.tipo] ? it.tipo : 'noticia') }, ui().shapeSvg(t.forma, t.color, 10), t.label);
  }
  function meta(it) {
    const f = fechaLegible(it.fecha);
    return el('div', { class: 'nv-meta' }, tipoChip(it), f ? el('time', { class: 'nv-fecha', datetime: it.fecha }, f) : null);
  }
  /* Enlace de la tarjeta: a la fuente externa si hay url; si no, a una sección de la app; si no, nada. */
  function enlace(it, cls) {
    const href = urlSegura(it.url);
    if (href) return el('a', { class: cls || 'nv-link', href, target: '_blank', rel: 'noopener noreferrer' }, 'Leer en ' + it.fuente + ' ↗');
    if (it.ruta) return el('a', { class: cls || 'nv-link', href: '#/' + it.ruta }, (it.rutaTexto || 'Abrir') + ' →');
    return null;
  }

  /* Detalle: panel lateral con el resumen, la nota, las etiquetas y el enlace. */
  function abrirDetalle(it) {
    const href = urlSegura(it.url);
    const acciones = [];
    if (href) acciones.push(el('a', { class: 'btn btn--primary', href, target: '_blank', rel: 'noopener noreferrer' }, 'Leer en ' + it.fuente + ' ↗'));
    if (it.ruta) acciones.push(el('a', { class: 'btn' + (href ? '' : ' btn--primary'), href: '#/' + it.ruta }, (it.rutaTexto || 'Abrir') + ' →'));
    const f = fechaLegible(it.fecha), v = fechaLegible(it.verificado);
    ui().drawer.open({
      kicker: (TIPOS[it.tipo] || TIPOS.noticia).label + (f ? ' · ' + f : ''),
      title: it.titulo,
      subtitle: it.tipo === 'noticia' ? 'Resumen de Aurum80 · fuente: ' + it.fuente : it.fuente,
      body: el('div', { class: 'nv-det' },
        imagen(it, '', true),
        el('p', { class: 'nv-det__txt' }, it.resumen),
        it.nota ? el('p', { class: 'nv-det__nota' }, it.nota) : null,
        (it.etiquetas || []).length ? el('ul', { class: 'nv-det__tags', 'aria-label': 'Etiquetas' }, it.etiquetas.map((t) => el('li', null, t))) : null,
        el('p', { class: 'nv-det__fuente' }, 'Fuente: ' + it.fuente + (v ? ' · Verificado el ' + v : '') + (it.tipo === 'noticia' ? '. Este es un resumen propio; el texto completo está en la fuente.' : '.'))),
      footer: acciones.length ? el('div', { class: 'nv-det__acc' }, acciones) : null
    });
  }

  function destacada(it) {
    const abrir = () => abrirDetalle(it);
    return el('article', { class: 'nv-destacada', 'aria-label': 'Novedad destacada' },
      imagen(it, '', true),
      el('div', { class: 'nv-destacada__body' },
        meta(it),
        el('h2', { class: 'nv-destacada__title' }, el('button', { type: 'button', class: 'nv-destacada__open', onclick: abrir }, it.titulo)),
        el('p', { class: 'nv-destacada__txt' }, it.resumen),
        el('div', { class: 'nv-destacada__acc' }, enlace(it))));
  }

  function tarjeta(it) {
    const abrir = () => abrirDetalle(it);
    return el('li', null, el('article', { class: 'nv-card' },
      imagen(it),
      el('div', { class: 'nv-card__body' },
        meta(it),
        el('h3', { class: 'nv-card__title' }, el('button', { type: 'button', class: 'nv-card__open', onclick: abrir }, it.titulo)),
        el('p', { class: 'nv-card__txt' }, it.resumen),
        el('div', { class: 'nv-card__foot' }, enlace(it)))));
  }

  /* ---- Pantalla ---- */
  let filtro = 'todo';

  function pintar(cont, chips) {
    const todas = ordenadas();
    const visibles = filtro === 'todo' ? todas : todas.filter((x) => x.tipo === filtro);
    chips.querySelectorAll('.nv-chip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filtro === filtro)));
    U.clear(cont);
    if (!visibles.length) {
      cont.append(el('div', { class: 'nv-vacio', role: 'status' }, filtro === 'todo' ? 'Todavía no hay novedades publicadas.' : 'No hay novedades de este tipo por ahora.'));
      return;
    }
    const dest = visibles.find((x) => x.destacada) || null;
    if (dest) cont.append(destacada(dest));
    const resto = visibles.filter((x) => x !== dest);
    if (resto.length) cont.append(el('ul', { class: 'nv-lista' }, resto.map(tarjeta)));
  }

  function render(root) {
    root.classList.add('p2');
    const todas = datos();
    const cuenta = (k) => (k === 'todo' ? todas.length : todas.filter((x) => x.tipo === k).length);
    const cont = el('div', { style: { display: 'grid', gap: '16px' } });
    const chips = el('ul', { class: 'nv-filtros', 'aria-label': 'Filtrar por tipo' }, FILTROS.map(([k, label]) =>
      el('li', null, el('button', { type: 'button', class: 'nv-chip', 'data-filtro': k, 'aria-pressed': String(k === filtro), onclick: () => { filtro = k; pintar(cont, chips); } },
        label, el('span', { class: 'nv-chip__n' }, String(cuenta(k)))))));
    root.append(
      el('p', { class: 'p2-lead', style: { marginBottom: 0 } }, 'Lo que se publica sobre la minería de oro y el mercurio en Bolivia, y lo nuevo de Aurum80.'),
      chips, cont,
      el('p', { class: 'nv-aviso' }, 'Las noticias son de medios externos y se resumen aquí; cada una lleva su fuente. Aurum80 no es responsable de su contenido. Actualizado el '
        + (fechaLegible((G4G.novedades || {}).actualizado) || '—') + '.'));
    pintar(cont, chips);
  }

  /* Desde Inicio se puede llegar con { abrir: id } para ver el detalle de una novedad. */
  function onShow(root, params) {
    const id = params && params.abrir;
    if (!id) return;
    const it = datos().find((x) => x.id === id);
    if (it) abrirDetalle(it);
  }

  /* Para la franja de Inicio: las 3 más recientes (sin las guías, que no son noticias nuevas). */
  G4G.novedadesUI = { ordenadas, fechaLegible, imagen, meta, abrirDetalle, recientes: (n) => ordenadas().filter((x) => x.tipo !== 'guia').slice(0, n || 3) };

  G4G.app.register({ id: 'novedades', titulo: 'Novedades', icono: 'novedades', orden: 6, grupo: 'ciudadania', subtitulo: 'Noticias del sector y lo nuevo de Aurum80', render, onShow });
})();
