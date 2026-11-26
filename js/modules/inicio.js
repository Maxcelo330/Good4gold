/* Módulo: Inicio. Portada para el público: buscar un operador, ver el mapa
   o hacer una denuncia. Lenguaje simple, sin tecnicismos. */
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
      placeholder: opts.placeholder || 'Escribe el nombre de una cooperativa, empresa o municipio…'
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

  function render(root) {
    const S = G4G.store, ops = S.state.operadores, n = ops.length;
    const cs = ops.reduce((a, o) => { a[o.estado_legal] = (a[o.estado_legal] || 0) + 1; return a; }, {});
    const E = G4G.config.estados;
    const fun = G4G.auth.esFuncionario();
    const nPrio = fun ? S.pasivosEvaluados().filter((p) => p.clase.nivel === 1).length : 0;

    root.appendChild(el('section', { class: 'hero' },
      el('div', { class: 'hero__text' },
        el('div', { class: 'hero__kicker' }, 'Registro público de la minería aurífera'),
        el('h2', { class: 'hero__title' }, '¿Esta operación minera está en regla?'),
        el('p', { class: 'hero__lead' }, 'Consulta la situación legal de cooperativas y empresas mineras, mira dónde operan en el mapa y reporta lo que ves en tu comunidad.'),
        buscador()),
      el('div', { class: 'hero__actions' },
        el('button', { type: 'button', class: 'action-card', onclick: () => G4G.app.go('mapa') },
          el('span', { class: 'action-card__icon' }, ui().icon('mapa', 26)),
          el('span', { class: 'action-card__title' }, 'Explorar el mapa'),
          el('span', { class: 'action-card__desc' }, 'Toca cualquier punto para saber qué operaciones hay cerca.')),
        el('button', { type: 'button', class: 'action-card action-card--primary', onclick: () => G4G.app.go('denuncias') },
          el('span', { class: 'action-card__icon' }, ui().icon('denuncias', 26)),
          el('span', { class: 'action-card__title' }, 'Hacer una denuncia'),
          el('span', { class: 'action-card__desc' }, 'Foto y ubicación en tres pasos. La autoridad la verifica.')))));

    /* Lo que dice el registro: cada cifra lleva a la lista filtrada. */
    const tile = (k, texto) => el('button', { type: 'button', class: 'stat-link', onclick: () => G4G.app.go('operadores', { estado: k }) },
      el('span', { class: 'stat-link__top' }, ui().shapeSvg(E[k].forma, E[k].color, 14), el('span', { class: 'stat-link__n' }, U.fmt(cs[k] || 0))),
      el('span', { class: 'stat-link__txt' }, texto),
      el('span', { class: 'stat-link__go' }, 'Ver lista →'));
    root.appendChild(el('section', { class: 'block' },
      el('div', { class: 'block__head' }, el('h3', null, 'Lo que dice el registro'), el('span', { class: 'muted small' }, `${U.fmt(n)} operadores registrados`)),
      el('div', { class: 'stat-links' },
        tile('legal', 'operan con todos sus permisos'),
        tile('proceso', 'están regularizándose: les faltan requisitos'),
        fun ? tile('no_legal', 'operan sin los permisos necesarios') : null,
        tile('sin_dato', 'sin verificar: falta el dato oficial')),
      /* Los pasivos (colas y relaves) son solo para funcionarios. */
      fun ? el('button', { type: 'button', class: 'banner-link', onclick: () => G4G.app.go('pasivos') },
        el('span', { class: 'banner-link__n' }, U.fmt(nPrio)),
        el('span', null, el('strong', null, 'pasivos mineros con prioridad alta. '), 'Colas y relaves cerca de ríos o poblaciones que conviene revisar primero.'),
        el('span', { class: 'stat-link__go' }, 'Ver →')) : null));

    root.appendChild(el('section', { class: 'block' },
      el('div', { class: 'block__head' }, el('h3', null, 'Cómo funciona')),
      el('ol', { class: 'how' },
        el('li', null, el('span', { class: 'how__n' }, '1'), el('strong', null, 'Consulta'), el('span', null, 'Busca una operación y mira si tiene sus permisos y qué le falta.')),
        el('li', null, el('span', { class: 'how__n' }, '2'), el('strong', null, 'Reporta'), el('span', null, 'Si ves vertidos al río, uso de mercurio o una operación que no aparece, envía foto y ubicación.')),
        el('li', null, el('span', { class: 'how__n' }, '3'), el('strong', null, 'La autoridad verifica'), el('span', null, 'Los técnicos revisan los reportes y priorizan inspecciones. El registro sirve para regularizar, no para castigar.')))));

    if (S.state.meta.origen === 'demo') {
      root.appendChild(el('p', { class: 'muted small center' }, 'Prototipo con datos simulados: los nombres y estados son inventados y no corresponden a operaciones reales.'));
    }
  }

  G4G.inicio = { buscador };
  G4G.app.register({ id: 'inicio', titulo: 'Inicio', icono: 'inicio', orden: 0, grupo: 'ciudadania', subtitulo: 'Consulta, mapa y denuncias de la minería aurífera', render });
})();
