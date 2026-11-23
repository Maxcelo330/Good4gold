/* ==========================================================================
   Almacén de datos.
   - operadores y pasivos: vienen del Excel/CSV, del backend o de la demostración.
     "completo" guarda todo lo que hay en memoria; "state" expone solo lo que la
     persona puede ver: el público NO ve los operadores "No legal" ni sus pasivos
     (config.acceso.ocultarAlPublico). Con backend, el servidor ya los filtra y los
     datos confidenciales nunca se guardan en el dispositivo.
   - denuncias: se guardan en este dispositivo y, si hay backend, se envían
     a la hoja "Denuncias" (con reintento si no hay señal).
   ========================================================================== */
(function () {
  const G4G = (window.G4G = window.G4G || {});
  const U = G4G.util;
  const K_DATASET = 'g4g.dataset.v1', K_DENUNCIAS = 'g4g.denuncias.v1', K_FUENTE = 'g4g.fuente.v1';

  const state = {
    operadores: [], pasivos: [], denuncias: [],
    meta: { origen: 'demo', archivo: null, cargado: Date.now(), informe: null }
  };
  let completo = { operadores: [], pasivos: [] };
  let cachePasivos = null;

  function emit() { cachePasivos = null; G4G.bus.emit('data:changed'); }

  /* ---- Visibilidad por perfil ---- */
  const esFuncionario = () => !!(G4G.auth && G4G.auth.esFuncionario());
  const ocultos = () => G4G.config.acceso.ocultarAlPublico || [];
  function filtrarPublico(d) {
    const fuera = new Set(d.operadores.filter((o) => ocultos().includes(o.estado_legal)).map((o) => o.id));
    return { operadores: d.operadores.filter((o) => !fuera.has(o.id)), pasivos: d.pasivos.filter((p) => !p.operador_id || !fuera.has(p.operador_id)) };
  }
  function aplicarVista() {
    const v = esFuncionario() ? completo : filtrarPublico(completo);
    state.operadores = v.operadores; state.pasivos = v.pasivos;
  }
  /* Situaciones legales que la persona puede ver (para leyendas y filtros). */
  const estadosVisibles = () => Object.entries(G4G.config.estados)
    .filter(([k]) => esFuncionario() || !ocultos().includes(k)).sort((a, b) => a[1].orden - b[1].orden);

  /* Con backend solo se guarda en el dispositivo la parte pública. */
  function persistir() {
    const d = G4G.api.activo() ? filtrarPublico(completo) : completo;
    try { localStorage.setItem(K_DATASET, JSON.stringify({ operadores: d.operadores, pasivos: d.pasivos, meta: state.meta })); return true; } catch (e) { return false; }
  }

  function init() {
    let cargado = false;
    try {
      const raw = localStorage.getItem(K_DATASET);
      const d = raw ? JSON.parse(raw) : null;
      /* Una copia del servidor no vale si ya no hay servidor configurado. */
      if (d && !(d.meta && d.meta.origen === 'servidor' && !G4G.api.activo())) { completo = { operadores: d.operadores, pasivos: d.pasivos }; state.meta = d.meta; cargado = true; }
    } catch (e) { /* si falla se usa la demostración */ }
    if (!cargado && G4G.api.activo()) {
      completo = { operadores: [], pasivos: [] };
      state.meta = { origen: 'cargando', archivo: 'Cargando la base…', cargado: Date.now(), informe: null };
    } else if (!cargado) cargarDemo(false);
    aplicarVista();
    try { state.denuncias = JSON.parse(localStorage.getItem(K_DENUNCIAS) || '[]'); } catch (e) { state.denuncias = []; }
  }

  function cargarDemo(notificar = true) {
    const d = G4G.seed.generar();
    completo = { operadores: d.operadores, pasivos: d.pasivos };
    state.meta = { origen: 'demo', archivo: null, cargado: Date.now(), informe: null };
    try { localStorage.removeItem(K_DATASET); } catch (e) { /* sin persistencia */ }
    aplicarVista();
    if (notificar) emit();
  }

  /* Reemplaza los datos por los de un archivo o URL.
     Si se parte de la demostración, los datos simulados se descartan por completo
     (nunca se mezclan con datos reales). Si ya había datos reales, una tabla que
     no venga en el archivo se conserva (p. ej. un CSV por tabla). */
  function setDataset(dataset, meta) {
    if (state.meta.origen === 'demo') completo = { operadores: [], pasivos: [] };
    if (dataset.operadores.length) completo.operadores = dataset.operadores;
    if (dataset.pasivos.length) completo.pasivos = dataset.pasivos;
    state.meta = Object.assign({ origen: 'archivo', cargado: Date.now() }, meta);
    aplicarVista();
    const guardado = persistir();
    emit();
    return guardado;
  }

  /* Datos que llegan del backend (filas con los encabezados del Excel). */
  function cargarDelServidor(r) {
    const ops = G4G.importer.mapear(r.operadores || [], 'operadores'), pas = G4G.importer.mapear(r.pasivos || [], 'pasivos');
    completo = { operadores: ops.registros, pasivos: pas.registros };
    state.meta = { origen: 'servidor', archivo: r.nivel === 'completo' ? 'Base del municipio (completa)' : 'Base del municipio', cargado: Date.now(),
      informe: { operadores: { hoja: 'Operadores', filas: (r.operadores || []).length, reconocidas: ops.reconocidas, ignoradas: ops.ignoradas, faltantes: ops.faltantes },
        pasivos: { hoja: 'Pasivos', filas: (r.pasivos || []).length, reconocidas: pas.reconocidas, ignoradas: pas.ignoradas, faltantes: pas.faltantes } } };
    aplicarVista(); persistir(); emit();
  }

  /* Al ingresar o salir: con backend se piden los datos que corresponden al perfil. */
  async function alCambiarSesion() {
    if (G4G.api.activo()) {
      if (esFuncionario()) cargarDelServidor(await G4G.api.completo(G4G.auth.token()));
      else {
        completo = filtrarPublico(completo);   // lo confidencial sale de la memoria
        aplicarVista(); emit();
        G4G.api.publico().then(cargarDelServidor).catch(() => {});
      }
    } else { aplicarVista(); emit(); }
  }

  /* Alta o edición de un registro por un funcionario. */
  async function guardarRegistro(kind, reg) {
    if (!esFuncionario()) throw new Error('Debe ingresar como funcionario.');
    if (G4G.api.activo()) {
      let r;
      try { r = await G4G.api.guardar(G4G.auth.token(), kind, G4G.importer.aFila(kind, reg)); }
      catch (e) { if (e.codigo === 'sesion') G4G.auth.vencida(); throw e; }
      cargarDelServidor(await G4G.api.completo(G4G.auth.token()));
      return Object.assign({}, reg, { id: r.id });
    }
    const lista = completo[kind];
    if (!reg.id) {
      const pref = kind === 'operadores' ? 'OP-' : 'PA-';
      const max = lista.reduce((m, x) => { const n = Number((String(x.id).match(/(\d+)\s*$/) || [])[1] || 0); return Math.max(m, n); }, 0);
      reg = Object.assign({}, reg, { id: pref + String(max + 1).padStart(3, '0') });
    }
    const i = lista.findIndex((x) => x.id === reg.id);
    if (i >= 0) lista[i] = reg; else lista.push(reg);
    aplicarVista(); persistir(); emit();
    return reg;
  }

  const getOperador = (id) => state.operadores.find((o) => o.id === id) || null;
  const getPasivo = (id) => state.pasivos.find((p) => p.id === id) || null;
  function pasivosEvaluados() {
    if (!cachePasivos) cachePasivos = G4G.scoring.evaluar(state.pasivos, getOperador);
    return cachePasivos;
  }
  const pasivosDe = (opId) => state.pasivos.filter((p) => p.operador_id === opId);

  /* Requisitos que faltan a un operador: false = falta; null = sin dato. */
  function requisitosDe(op) {
    return G4G.config.requisitos.map((r) => ({ id: r.id, label: r.label, estado: op.requisitos ? op.requisitos[r.id] : null }));
  }
  function avance(op) {
    const rq = requisitosDe(op);
    return { cumplidos: rq.filter((r) => r.estado === true).length, total: rq.length, faltan: rq.filter((r) => r.estado === false), sinDato: rq.filter((r) => r.estado === null) };
  }
  const estaDesactualizado = (r) => { const d = U.daysSince(r.actualizado); return d === null || d > G4G.config.diasDesactualizado; };

  /* ---- Denuncias (locales) ---- */
  function persistDenuncias() {
    try { localStorage.setItem(K_DENUNCIAS, JSON.stringify(state.denuncias)); return true; } catch (e) { return false; }
  }
  function addDenuncia(d) {
    state.denuncias.unshift(d);
    const ok = persistDenuncias();
    emit();
    return ok;
  }
  function updateDenuncia(id, patch) {
    const d = state.denuncias.find((x) => x.id === id);
    if (d) { Object.assign(d, patch); persistDenuncias(); emit(); }
  }
  function removeDenuncia(id) {
    state.denuncias = state.denuncias.filter((x) => x.id !== id);
    persistDenuncias(); emit();
  }

  /* ---- Calidad de datos ---- */
  function validar() {
    const L = G4G.config.limites, issues = [];
    const add = (sev, codigo, titulo, ids, nota) => { if (ids.length) issues.push({ sev, codigo, titulo, ids, nota }); };
    const fueraDeBolivia = (r) => r.lat === null || r.lng === null || r.lat < L.latMin || r.lat > L.latMax || r.lng < L.lngMin || r.lng > L.lngMax;

    const ops = state.operadores, pas = state.pasivos;
    add('error', 'coords-op', 'Operadores sin coordenadas válidas en Bolivia', ops.filter(fueraDeBolivia).map((o) => o.id), 'No pueden dibujarse en el mapa. Revise latitud/longitud (negativas en Bolivia).');
    add('error', 'coords-pa', 'Pasivos sin coordenadas válidas en Bolivia', pas.filter(fueraDeBolivia).map((p) => p.id), 'No pueden dibujarse en el mapa.');
    const dup = (arr) => { const seen = {}, d = []; arr.forEach((r) => { if (seen[r.id]) d.push(r.id); seen[r.id] = 1; }); return d; };
    add('error', 'dup-op', 'Identificadores de operador repetidos', dup(ops), 'Cada operador debe tener un id único.');
    add('error', 'dup-pa', 'Identificadores de pasivo repetidos', dup(pas), 'Cada pasivo debe tener un id único.');
    add('warn', 'pa-sin-op', 'Pasivos sin operador registrado', pas.filter((p) => !p.operador_id || !getOperador(p.operador_id)).map((p) => p.id), 'Sin responsable identificado: el puntaje de responsabilidad sube al máximo.');
    add('warn', 'sin-verificar', 'Operadores con situación legal sin verificar', ops.filter((o) => o.estado_legal === 'sin_dato').map((o) => o.id), 'Falta confirmar con el organismo que controla la legalidad.');
    add('warn', 'viejo-op', `Operadores sin actualizar hace más de ${G4G.config.diasDesactualizado} días`, ops.filter(estaDesactualizado).map((o) => o.id), 'Dato posiblemente desactualizado.');
    add('warn', 'viejo-pa', `Pasivos sin actualizar hace más de ${G4G.config.diasDesactualizado} días`, pas.filter(estaDesactualizado).map((p) => p.id), 'Dato posiblemente desactualizado.');
    add('info', 'sin-ley', 'Pasivos sin ley de oro medida', pas.filter((p) => p.ley_au_gt === null).map((p) => p.id), 'Sin muestreo no se puede estimar valor ni contenido: candidatos a muestreo dirigido.');
    add('info', 'sin-volumen', 'Pasivos sin volumen estimado', pas.filter((p) => p.volumen_m3 === null).map((p) => p.id), 'El puntaje usa un valor medio por defecto.');
    add('info', 'hg-desc', 'Pasivos con uso de mercurio desconocido', pas.filter((p) => p.uso_hg === 'desconocido').map((p) => p.id), 'Preguntar al responsable o registrar en la ficha de campo.');
    return issues;
  }
  function completitud() {
    const campos = (r, lista) => lista.filter((f) => r[f] !== null && r[f] !== undefined && r[f] !== '').length / lista.length;
    const op = state.operadores.map((o) => campos(o, ['nombre', 'tipo', 'departamento', 'municipio', 'lat', 'lng', 'socios', 'actualizado']) * 0.5 + (o.estado_legal !== 'sin_dato' ? 0.5 : 0));
    const pa = state.pasivos.map((p) => campos(p, ['operador_id', 'tipo', 'lat', 'lng', 'volumen_m3', 'dist_rio_m', 'dist_poblado_m', 'ley_au_gt', 'actualizado']));
    const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
    return { operadores: Math.round(avg(op) * 100), pasivos: Math.round(avg(pa) * 100) };
  }

  /* ---- Fuente remota opcional ---- */
  const fuenteGuardada = () => { try { return JSON.parse(localStorage.getItem(K_FUENTE) || 'null'); } catch (e) { return null; } };
  const guardarFuente = (f) => { try { localStorage.setItem(K_FUENTE, JSON.stringify(f)); } catch (e) { /* sin persistencia */ } };
  async function cargarDesdeUrl(urlOp, urlPa) {
    const dataset = { operadores: [], pasivos: [] }, informe = {};
    for (const [kind, url] of [['operadores', urlOp], ['pasivos', urlPa]]) {
      if (!url) { informe[kind] = null; continue; }
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`No se pudo leer ${kind} (HTTP ${res.status}).`);
      const filas = U.parseCSV(await res.text());
      if (!filas.length) throw new Error(`La URL de ${kind} no devolvió filas.`);
      const m = G4G.importer.mapear(filas, kind);
      dataset[kind] = m.registros;
      informe[kind] = { hoja: url, filas: filas.length, reconocidas: m.reconocidas, ignoradas: m.ignoradas, faltantes: m.faltantes };
    }
    return { dataset, informe };
  }

  /* Sincronización automática con la base publicada (Google Sheets / CSV).
     Se ejecuta al abrir la página si hay URLs en config.fuenteRemota (o guardadas
     por el usuario). Si no hay red o falla, se siguen usando los últimos datos
     guardados en este dispositivo. No pisa un archivo cargado a mano. */
  async function sincronizar() {
    if (G4G.api.activo()) {
      try {
        if (esFuncionario()) {
          try { cargarDelServidor(await G4G.api.completo(G4G.auth.token())); }
          catch (e) { if (e.codigo === 'sesion') { G4G.auth.vencida(); return { estado: 'sesion' }; } throw e; }
        } else cargarDelServidor(await G4G.api.publico());
        enviarPendientes();
        return { estado: 'ok' };
      } catch (e) { return { estado: 'error', mensaje: e.message }; }
    }
    const cfg = G4G.config.fuenteRemota, guardada = fuenteGuardada() || {};
    const urlOp = cfg.operadoresUrl || guardada.operadores || '', urlPa = cfg.pasivosUrl || guardada.pasivos || '';
    if (!urlOp && !urlPa) return { estado: 'sin-fuente' };
    if (state.meta.origen === 'archivo') return { estado: 'archivo-manual' };
    try {
      const { dataset, informe } = await cargarDesdeUrl(urlOp, urlPa);
      if (!dataset.operadores.length && !dataset.pasivos.length) return { estado: 'vacia' };
      setDataset(dataset, { origen: 'url', archivo: 'Base en línea (Google Sheets)', url: urlOp || urlPa, informe });
      return { estado: 'ok' };
    } catch (e) { return { estado: 'error', mensaje: e.message }; }
  }

  /* Denuncias guardadas sin señal: se envían cuando vuelve la conexión. */
  let enviando = false;
  async function enviarDenuncia(d) {
    const r = await G4G.api.denuncia({ id: d.id, codigo: d.codigo, creado: new Date(d.creado).toISOString(), tipo: d.tipo, descripcion: d.descripcion, lat: d.lat, lng: d.lng, precision: d.precision, foto: d.foto || '' });
    updateDenuncia(d.id, { envio: 'enviada', enviada: Date.now(), codigo: r.codigo || d.codigo });
    return r;
  }
  async function enviarPendientes() {
    if (!G4G.api.activo() || enviando) return 0;
    enviando = true; let n = 0;
    try {
      for (const d of state.denuncias.filter((x) => x.envio === 'pendiente')) {
        try { await enviarDenuncia(d); n++; } catch (e) { break; }
      }
    } finally { enviando = false; }
    if (n && G4G.ui) G4G.ui.toast(n === 1 ? 'Se envió 1 denuncia pendiente.' : `Se enviaron ${n} denuncias pendientes.`);
    return n;
  }
  window.addEventListener('online', () => enviarPendientes());

  G4G.store = {
    state, init, sincronizar, alCambiarSesion, guardarRegistro, estadosVisibles, enviarDenuncia, enviarPendientes, cargarDemo, setDataset, getOperador, getPasivo, pasivosEvaluados, pasivosDe,
    requisitosDe, avance, estaDesactualizado, addDenuncia, updateDenuncia, removeDenuncia,
    validar, completitud, fuenteGuardada, guardarFuente, cargarDesdeUrl
  };
})();
