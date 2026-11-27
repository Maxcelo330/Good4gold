/* ==========================================================================
   Pestaña "Fichas": alta y edición de pasivos y operadores desde el campo.
   Campos permitidos al técnico: en operadores, nombre, tipo, departamento, municipio, lat, lng y socios
   (la situación legal y los requisitos los verifica la autoridad: el servidor también lo impone);
   en pasivos, los datos de la ficha de campo. Se envía por la cola de campo.js (con reintento sin señal).
   Reglas de validación: las mismas de js/modules/registro.js (coordenadas dentro de Bolivia).
   ========================================================================== */
(function () {
  const G4G = (window.G4G = window.G4G || {});
  const C = G4G.campo, U = C.U, el = C.el, ui = C.ui;
  const cfg = () => G4G.config;

  const f = { modo: 'lista', tabla: 'pasivos', id: null, q: '', b: {}, gpsEstado: '', gpsMsg: '' };
  let nodoLista = null;

  const str = (v) => (v === null || v === undefined ? '' : String(v));

  /* ---------------- Lista ---------------- */
  function filas() {
    const b = C.getBase(), q = U.norm(f.q), ops = new Map(b.operadores.map((o) => [o.id, o]));
    return b[f.tabla].filter((r) => !q || U.norm(str(r.nombre) + ' ' + r.id + ' ' + str(r.municipio)).includes(q))
      .sort((a, c) => str(a.nombre || a.id).localeCompare(str(c.nombre || c.id), 'es')).slice(0, 60)
      .map((r) => ({ r, sub: f.tabla === 'pasivos' ? [r.tipo, r.operador_id && ops.get(r.operador_id) ? ops.get(r.operador_id).nombre : ''].filter(Boolean).join(' · ') : [r.tipo, r.municipio].filter(Boolean).join(' · ') }));
  }
  function listaNodo() {
    const lista = filas();
    return el('ul', { class: 'c-list', 'aria-live': 'polite' }, lista.length ? lista.map(({ r, sub }) => el('li', null, el('button', { type: 'button', class: 'c-row', onclick: () => abrir(f.tabla, r.id) },
      el('span', { class: 'c-row__ico' }, ui.shapeSvg(f.tabla === 'pasivos' ? 'hexagono' : 'anillo', f.tabla === 'pasivos' ? '#6B3FA0' : '#1D1B18', 20)),
      el('span', { class: 'c-row__main' }, el('strong', null, r.nombre || 'Sin nombre'), el('span', { class: 'cell-sub' }, r.id + (sub ? ' · ' + sub : ''))),
      el('span', { class: 'c-row__dist' }, ui.icon('editar', 20))))) : el('li', { class: 'muted c-vacio' }, 'No hay fichas para mostrar.'));
  }
  function refrescarLista() { if (!nodoLista || !nodoLista.isConnected) return; const n = listaNodo(); nodoLista.replaceWith(n); nodoLista = n; }

  function vistaLista(host) {
    const b = C.getBase(), esP = f.tabla === 'pasivos';
    const seg = el('div', { class: 'c-seg', role: 'group', 'aria-label': 'Tipo de ficha' }, [['pasivos', 'Pasivos (' + b.pasivos.length + ')'], ['operadores', 'Operadores (' + b.operadores.length + ')']].map(([k, l]) => el('button', {
      type: 'button', class: 'c-seg__btn' + (f.tabla === k ? ' is-on' : ''), 'aria-pressed': String(f.tabla === k), onclick: () => { f.tabla = k; f.q = ''; C.repintar(false); } }, l)));
    nodoLista = listaNodo();
    U.append(host, [
      el('h2', { class: 'c-h' }, 'Fichas'),
      seg,
      el('button', { type: 'button', class: 'btn btn--primary c-btn c-btn--block', onclick: () => abrir(f.tabla, null) }, ui.icon('mas', 22), esP ? 'Nuevo pasivo' : 'Nuevo operador'),
      !b.pasivos.length && !b.operadores.length ? el('div', { class: 'callout' }, 'No hay lista descargada. Puede crear fichas nuevas; para ver las existentes, actualice la base en la pestaña Cuenta con señal.') : null,
      el('input', { class: 'input', type: 'search', placeholder: 'Buscar por nombre o código', value: f.q, 'aria-label': 'Buscar ficha', oninput: U.debounce((ev) => { f.q = ev.target.value; refrescarLista(); }, 150) }),
      nodoLista]);
  }

  /* ---------------- Formulario ---------------- */
  function abrir(tabla, id) {
    f.tabla = tabla; f.id = id; f.modo = 'form'; f.gpsEstado = ''; f.gpsMsg = '';
    const r = id ? C.getBase()[tabla].find((x) => x.id === id) || {} : {};
    f.b = tabla === 'pasivos'
      ? { nombre: str(r.nombre), tipo: str(r.tipo), operador_id: str(r.operador_id), lat: str(r.lat), lng: str(r.lng), volumen_m3: str(r.volumen_m3), estructura: r.estructura || 'desconocida', uso_hg: r.uso_hg || 'desconocido' }
      : { nombre: str(r.nombre), tipo: str(r.tipo), departamento: str(r.departamento), municipio: str(r.municipio), socios: str(r.socios), lat: str(r.lat), lng: str(r.lng) };
    C.repintar(true);
  }
  function cerrar() { f.modo = 'lista'; f.id = null; C.repintar(true); }

  const inputs = {};
  function texto(k, attrs) {
    return (inputs[k] = el('input', Object.assign({ class: 'input', type: 'text', value: f.b[k], oninput: (ev) => { f.b[k] = ev.target.value; } }, attrs || {})));
  }
  function lista(k, pares, vacio) {
    return (inputs[k] = el('select', { class: 'input', onchange: (ev) => { f.b[k] = ev.target.value; } },
      vacio ? el('option', { value: '' }, vacio) : null,
      pares.map(([v, l]) => el('option', { value: v, selected: f.b[k] === v }, l))));
  }

  function gps(btn) {
    f.gpsEstado = 'buscando'; pintarGps(); btn.disabled = true;
    C.ubicacion({ alta: true, timeout: 25000 }).then((p) => {
      f.b.lat = p.lat.toFixed(5); f.b.lng = p.lng.toFixed(5);
      if (inputs.lat) inputs.lat.value = f.b.lat; if (inputs.lng) inputs.lng.value = f.b.lng;
      f.gpsEstado = 'ok'; f.gpsMsg = 'Ubicación tomada (± ' + U.fmt(p.precision) + ' m).' + (p.precision > 50 ? ' La precisión es baja: si puede, salga a cielo abierto y repita.' : '');
    }).catch((e) => { f.gpsEstado = 'error'; f.gpsMsg = e.message + ' Escriba las coordenadas.'; }).finally(() => { btn.disabled = false; pintarGps(); });
  }
  function pintarGps() {
    const n = document.getElementById('c-fgps'); if (!n) return;
    n.textContent = f.gpsEstado === 'buscando' ? 'Buscando la señal GPS…' : f.gpsMsg;
  }

  function vistaForm(host) {
    const esP = f.tabla === 'pasivos', C0 = cfg(), existente = !!f.id;
    const ops = C.getBase().operadores.slice().sort((a, c) => str(a.nombre).localeCompare(str(c.nombre), 'es')).map((o) => [o.id, (o.nombre || o.id) + ' (' + o.id + ')']);
    const err = el('div', { class: 'callout callout--warn', role: 'alert', hidden: true });
    const campos = [];
    const fld = (rot, nodo, hint) => campos.push(el('label', { class: 'field' }, el('span', { class: 'field__label' }, rot), nodo, hint ? el('span', { class: 'field__hint' }, hint) : null));

    if (esP) {
      fld('Nombre del sitio', texto('nombre', { placeholder: 'Ej.: Dique de colas del Sector Norte' }));
      fld('Tipo', lista('tipo', C0.tiposPasivo.map((t) => [t, t]), 'Elegir…'));
      fld('Responsable', lista('operador_id', ops, 'Sin responsable identificado'));
    } else {
      fld('Nombre *', texto('nombre', { placeholder: 'Cooperativa Minera …' }));
      fld('Tipo', lista('tipo', C0.tiposOperador.map((t) => [t, t]), 'Elegir…'));
      fld('Departamento', texto('departamento'));
      fld('Municipio', texto('municipio'));
      fld('Socios', texto('socios', { inputmode: 'numeric' }));
    }
    fld('Latitud *', texto('lat', { inputmode: 'text', placeholder: '-15.43274' }));
    fld('Longitud *', texto('lng', { inputmode: 'text', placeholder: '-67.50264' }));
    const btnGps = el('button', { type: 'button', class: 'btn c-btn c-btn--block', onclick: (ev) => gps(ev.currentTarget) }, ui.icon('gps', 22), 'Usar mi ubicación');
    if (esP) {
      fld('Volumen (m³)', texto('volumen_m3', { inputmode: 'decimal' }));
      fld('Estado de la estructura', lista('estructura', Object.entries(C0.estructura).map(([k, e]) => [k, e.label])));
      fld('Uso de mercurio', lista('uso_hg', [['si', 'Sí'], ['no', 'No'], ['desconocido', 'Desconocido']]));
    }

    const guardar = el('button', { type: 'button', class: 'btn btn--primary c-btn c-btn--block c-btn--xl', onclick: (ev) => guardarFicha(ev.currentTarget, err) }, ui.icon('subir', 22), existente ? 'Guardar cambios' : 'Guardar ficha');
    U.append(host, [
      el('h2', { class: 'c-h' }, existente ? 'Editar ' + f.id : (esP ? 'Nuevo pasivo' : 'Nuevo operador')),
      el('p', { class: 'muted' }, '* Obligatorio.' + (esP ? '' : ' La situación legal y los requisitos los verifica la autoridad: esta aplicación no los cambia.')),
      ...campos.slice(0, esP ? 3 : 5),
      el('h3', { class: 'c-sec' }, 'Ubicación'),
      ...campos.slice(esP ? 3 : 5, esP ? 5 : 7),
      btnGps, el('p', { class: 'muted', id: 'c-fgps', role: 'status' }, f.gpsEstado === 'buscando' ? 'Buscando la señal GPS…' : f.gpsMsg),
      ...(esP ? [el('h3', { class: 'c-sec' }, 'Datos del sitio'), ...campos.slice(5)] : []),
      err,
      guardar,
      el('button', { type: 'button', class: 'btn c-btn c-btn--block', onclick: cerrar }, 'Cancelar')]);
  }

  function guardarFicha(btn, err) {
    const esP = f.tabla === 'pasivos', b = f.b, v = (k) => str(b[k]).trim();
    const lat = U.parseNum(v('lat')), lng = U.parseNum(v('lng'));
    const errores = [];
    if (!esP && !v('nombre')) errores.push('Falta el nombre.');
    const ec = C.validarCoord(lat, lng); if (ec) errores.push(ec);
    const vol = U.parseNum(v('volumen_m3')), soc = U.parseNum(v('socios'));
    if (esP && v('volumen_m3') && (vol === null || vol < 0)) errores.push('El volumen debe ser un número, por ejemplo 1500.');
    if (!esP && v('socios') && (soc === null || soc < 0)) errores.push('Los socios deben ser un número entero.');
    if (errores.length) { err.textContent = errores.join(' '); err.hidden = false; err.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
    err.hidden = true; btn.disabled = true;

    const nuevo = !f.id, id = f.id || C.idFicha(esP ? 'PA' : 'OP'), hoy = C.hoy(), nv = (x) => (x === '' ? null : x);
    let local, fila;
    if (esP) {
      local = { id, operador_id: nv(v('operador_id')), nombre: nv(v('nombre')), tipo: nv(v('tipo')), lat, lng, volumen_m3: vol, estructura: v('estructura') || 'desconocida', uso_hg: v('uso_hg') || 'desconocido', actualizado: hoy };
      fila = { id, operador_id: v('operador_id'), nombre: v('nombre'), tipo: v('tipo'), lat, lng, volumen_m3: vol, estructura: (cfg().estructura[local.estructura] || {}).label || '', uso_hg: local.uso_hg, actualizado: hoy };
      if (nuevo) { local.deteccion = 'visita de campo'; fila.deteccion = 'visita de campo'; }
    } else {
      local = { id, nombre: v('nombre'), tipo: nv(v('tipo')), departamento: nv(v('departamento')), municipio: nv(v('municipio')), lat, lng, socios: soc, actualizado: hoy };
      fila = { id, nombre: v('nombre'), tipo: v('tipo'), departamento: v('departamento'), municipio: v('municipio'), lat, lng, socios: soc, actualizado: hoy };
    }
    try {
      C.registrar({ tipo: 'ficha', tabla: f.tabla, etiqueta: v('nombre') || id, detalle: (nuevo ? 'Alta' : 'Edición') + ' · ' + id, payload: fila, local });
      C.upsertLocal(f.tabla, local); C.guardarBase();
      ui.toast('Ficha guardada en el teléfono. Se envía al servidor (vea el estado en Pendientes).');
      f.modo = 'lista'; f.id = null; C.repintar(true);
    } catch (e) { err.textContent = e.message; err.hidden = false; btn.disabled = false; }
  }

  function render(host) { if (f.modo === 'form') vistaForm(host); else vistaLista(host); }
  C.registrarVista('fichas', { subtitulo: 'Pasivos y operadores', render });
})();
