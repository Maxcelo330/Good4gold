/* Módulo: Registrar datos (solo funcionarios). Alta y edición de operadores y
   pasivos. Con backend se guarda en la hoja de Google (columnas del Excel) y
   queda registrado quién lo editó; sin backend, solo en este dispositivo. */
(function () {
  const G4G = (window.G4G = window.G4G || {});
  const U = G4G.util, { el } = U;
  const ui = () => G4G.ui, S = () => G4G.store;
  const sel = { tabla: 'operadores', id: null, q: '' };
  let raiz = null;

  const hoy = () => new Date().toISOString().slice(0, 10);
  const opciones = (pares, actual, vacio) => [vacio ? el('option', { value: '' }, vacio) : null, ...pares.map(([v, l]) => el('option', { value: v, selected: String(actual ?? '') === String(v) }, l))];
  const tri = (v) => (v === true ? 'si' : v === false ? 'no' : '');
  const triDe = (s) => (s === 'si' ? true : s === 'no' ? false : null);
  const num = (s) => U.parseNum(s);

  function campos(kind, r) {
    const C = G4G.config, f = {};
    const input = (k, attrs = {}) => (f[k] = el('input', Object.assign({ class: 'input', value: r[k] ?? '' }, attrs)));
    const select = (k, pares, vacio) => (f[k] = el('select', { class: 'input' }, opciones(pares, r[k], vacio)));
    const grupo = (titulo, ...hijos) => el('fieldset', { class: 'reg__set' }, el('legend', null, titulo), el('div', { class: 'reg__grid' }, hijos));
    const ubic = grupo('Ubicación',
      ui().field('Latitud *', input('lat', { inputmode: 'decimal', placeholder: '-15.43274' })),
      ui().field('Longitud *', input('lng', { inputmode: 'decimal', placeholder: '-67.50264' })),
      el('div', { class: 'field' }, el('span', { class: 'field__label' }, ' '), ui().button('Usar mi ubicación', { icon: 'gps', onclick: (e) => miUbicacion(e.currentTarget, f) })));
    if (kind === 'operadores') {
      const req = G4G.config.requisitos.map((q) => { f['req_' + q.id] = el('select', { class: 'input' }, opciones([['si', 'Sí cumple'], ['no', 'No cumple']], tri((r.requisitos || {})[q.id]), 'Sin verificar')); return ui().field(q.label, f['req_' + q.id]); });
      return { f, nodos: [
        grupo('Identificación',
          ui().field('Nombre *', input('nombre', { placeholder: 'Cooperativa Minera …' })),
          ui().field('Tipo', select('tipo', C.tiposOperador.map((t) => [t, t]), 'Elegir…')),
          ui().field('Situación legal *', select('estado_legal', Object.entries(C.estados).sort((a, b) => a[1].orden - b[1].orden).map(([k, e]) => [k, e.label]))),
          ui().field('Socios', input('socios', { inputmode: 'numeric' }))),
        grupo('Lugar', ui().field('Departamento', input('departamento')), ui().field('Municipio', input('municipio'))),
        ubic,
        grupo('Requisitos', ...req)] };
    }
    const ops = S().state.operadores.slice().sort((a, b) => a.nombre.localeCompare(b.nombre)).map((o) => [o.id, `${o.nombre} (${o.id})`]);
    return { f, nodos: [
      grupo('Identificación',
        ui().field('Nombre del sitio', input('nombre')),
        ui().field('Tipo', select('tipo', C.tiposPasivo.map((t) => [t, t]), 'Elegir…')),
        ui().field('Responsable', select('operador_id', ops, 'Sin responsable identificado')),
        ui().field('Detectado por', select('deteccion', ['imagen satelital', 'visita de campo', 'denuncia'].map((t) => [t, t]), 'Elegir…'))),
      ubic,
      grupo('Riesgo',
        ui().field('Volumen (m³)', input('volumen_m3', { inputmode: 'decimal' })),
        ui().field('Distancia al río (m)', input('dist_rio_m', { inputmode: 'decimal' })),
        ui().field('Distancia a población (m)', input('dist_poblado_m', { inputmode: 'decimal' })),
        ui().field('Estructura', select('estructura', Object.entries(C.estructura).map(([k, e]) => [k, e.label]))),
        ui().field('Uso de mercurio', select('uso_hg', [['si', 'Sí'], ['no', 'No'], ['desconocido', 'Desconocido']]))),
      grupo('Muestreo',
        ui().field('Muestra tomada', (f.muestra = el('select', { class: 'input' }, opciones([['no', 'No'], ['si', 'Sí']], r.muestra ? 'si' : 'no')))),
        ui().field('Ley de oro (g/t)', input('ley_au_gt', { inputmode: 'decimal' })))] };
  }

  function leer(kind, f, base) {
    const v = (k) => (f[k].value || '').trim();
    if (kind === 'operadores') {
      const requisitos = {};
      G4G.config.requisitos.forEach((q) => { requisitos[q.id] = triDe(f['req_' + q.id].value); });
      return Object.assign({}, base, { nombre: v('nombre'), tipo: v('tipo') || null, estado_legal: v('estado_legal') || 'sin_dato', departamento: v('departamento') || null,
        municipio: v('municipio') || null, lat: num(v('lat')), lng: num(v('lng')), socios: num(v('socios')), actualizado: hoy(), requisitos });
    }
    return Object.assign({}, base, { nombre: v('nombre') || null, tipo: v('tipo') || null, operador_id: v('operador_id') || null, deteccion: v('deteccion') || null,
      lat: num(v('lat')), lng: num(v('lng')), volumen_m3: num(v('volumen_m3')), dist_rio_m: num(v('dist_rio_m')), dist_poblado_m: num(v('dist_poblado_m')),
      estructura: v('estructura') || 'desconocida', uso_hg: v('uso_hg') || 'desconocido', muestra: f.muestra.value === 'si', ley_au_gt: num(v('ley_au_gt')), actualizado: hoy() });
  }

  function validarReg(kind, r) {
    const L = G4G.config.limites, e = [];
    if (kind === 'operadores' && !r.nombre) e.push('Falta el nombre.');
    if (r.lat === null || r.lng === null) e.push('Faltan las coordenadas.');
    else if (r.lat < L.latMin || r.lat > L.latMax || r.lng < L.lngMin || r.lng > L.lngMax) e.push('Las coordenadas están fuera de Bolivia (¿latitud y longitud invertidas o sin el signo menos?).');
    return e;
  }

  function miUbicacion(btn, f) {
    if (!navigator.geolocation) { ui().toast('Este dispositivo no permite obtener la ubicación.', 'warn'); return; }
    btn.disabled = true;
    navigator.geolocation.getCurrentPosition((p) => {
      f.lat.value = p.coords.latitude.toFixed(5); f.lng.value = p.coords.longitude.toFixed(5); btn.disabled = false;
      ui().toast(`Ubicación tomada (± ${U.fmt(p.coords.accuracy)} m).`);
    }, () => { btn.disabled = false; ui().toast('No se pudo obtener la ubicación. Escriba las coordenadas.', 'warn'); }, { enableHighAccuracy: true, timeout: 15000 });
  }

  function editor() {
    const kind = sel.tabla, lista = S().state[kind];
    const actual = sel.id ? lista.find((x) => x.id === sel.id) : null;
    if (sel.id && !actual) sel.id = null;
    const base = actual || (kind === 'operadores' ? { estado_legal: 'sin_dato', requisitos: {} } : { estructura: 'desconocida', uso_hg: 'desconocido', muestra: false });
    const { f, nodos } = campos(kind, base);
    const errores = el('div', { class: 'callout callout--warn', role: 'alert', hidden: true });
    const guardar = el('button', { type: 'submit', class: 'btn btn--primary' }, ui().icon('subir', 16), actual ? 'Guardar cambios' : 'Registrar');
    const destino = G4G.api.activo() ? 'Se guarda en la base del municipio (hoja de Google) con su usuario y la fecha.' : 'Modo demostración: se guarda solo en este dispositivo.';
    return el('form', { class: 'card reg__form', novalidate: true, onsubmit: async (e) => {
      e.preventDefault();
      const r = leer(kind, f, actual || {});
      const err = validarReg(kind, r);
      if (err.length) { errores.textContent = err.join(' '); errores.hidden = false; return; }
      errores.hidden = true; guardar.disabled = true;
      try {
        const g = await S().guardarRegistro(kind, r);
        sel.id = g.id;
        ui().toast(`${actual ? 'Cambios guardados' : 'Registrado'}: ${g.nombre || g.id} (${g.id}).`);
        pintar();
      } catch (ex) { errores.textContent = 'No se pudo guardar: ' + ex.message; errores.hidden = false; guardar.disabled = false; }
    } },
    el('header', { class: 'card__head' }, el('h3', null, actual ? `Editar ${actual.id}` : (kind === 'operadores' ? 'Nuevo operador' : 'Nuevo pasivo')),
      actual ? el('div', { class: 'card__actions' }, ui().button('Ver ficha', { onclick: () => (kind === 'operadores' ? G4G.detalle.operador(actual.id) : G4G.detalle.pasivo(actual.id)) })) : null),
    el('div', { class: 'card__body' }, nodos, errores,
      el('div', { class: 'row-gap' }, guardar, actual ? ui().button('Nuevo registro', { icon: 'mas', onclick: () => { sel.id = null; pintar(); } }) : null),
      el('p', { class: 'muted small' }, '* Obligatorio. ', destino)));
  }

  function listado() {
    const kind = sel.tabla, q = U.norm(sel.q);
    const filas = S().state[kind].filter((r) => !q || U.norm(`${r.id} ${r.nombre || ''} ${r.municipio || ''}`).includes(q)).slice(0, 200);
    const buscar = el('input', { class: 'input', type: 'search', placeholder: 'Buscar por nombre o código…', value: sel.q, oninput: U.debounce((e) => { sel.q = e.target.value; const l = raiz.querySelector('.reg__list'); if (l) l.replaceWith(listado().querySelector('.reg__list')); }, 150) });
    return el('section', { class: 'card reg__side' },
      el('div', { class: 'card__body' },
        buscar,
        el('ul', { class: 'reg__list' }, filas.length ? filas.map((r) => el('li', null, el('button', { type: 'button', class: 'reg__item' + (r.id === sel.id ? ' is-on' : ''), onclick: () => { sel.id = r.id; pintar(); } },
          el('span', { class: 'cell-main' }, r.nombre || r.id), el('span', { class: 'cell-sub' }, r.id),
          kind === 'operadores' ? ui().estadoChip(r.estado_legal) : null))) : el('li', { class: 'muted' }, 'Sin resultados.'))));
  }

  function pintar() {
    if (!raiz) return;
    U.clear(raiz);
    const seg = el('div', { class: 'seg', role: 'group', 'aria-label': 'Tabla' }, [['operadores', 'Operadores'], ['pasivos', 'Pasivos']].map(([k, l]) => el('button', {
      type: 'button', class: 'seg__btn' + (sel.tabla === k ? ' is-on' : ''), 'aria-pressed': String(sel.tabla === k), onclick: () => { sel.tabla = k; sel.id = null; sel.q = ''; pintar(); }
    }, `${l} (${S().state[k].length})`)));
    raiz.appendChild(el('div', { class: 'toolbar' }, seg, el('span', { class: 'spacer' }), ui().button(sel.tabla === 'operadores' ? 'Nuevo operador' : 'Nuevo pasivo', { kind: 'primary', icon: 'mas', onclick: () => { sel.id = null; pintar(); } })));
    raiz.appendChild(el('div', { class: 'reg' }, listado(), editor()));
  }

  function render(root) { raiz = root; pintar(); }
  function onShow(root, params) {
    if (params && params.tabla) { sel.tabla = params.tabla; sel.id = params.id || null; pintar(); }
  }

  G4G.registro = { editar: (tabla, id) => G4G.app.go('registro', { tabla, id }) };
  G4G.app.register({ id: 'registro', titulo: 'Registrar datos', icono: 'editar', orden: 13, grupo: 'tecnico', subtitulo: 'Alta y actualización de operadores y pasivos', render, onShow });
})();
