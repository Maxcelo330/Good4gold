/* ==========================================================================
   Importador de la "base de datos que se llena" (Excel o CSV).
   - Reconoce encabezados por alias (config.columnas), sin importar tildes,
     mayúsculas ni espacios.
   - Es de SOLO LECTURA: nunca escribe de vuelta en el archivo original.
   ========================================================================== */
(function () {
  const G4G = (window.G4G = window.G4G || {});
  const U = G4G.util;

  const REQUERIDAS = { operadores: ['nombre', 'lat', 'lng', 'estado_legal'], pasivos: ['lat', 'lng'] };

  function aliasesOperadores() {
    const a = JSON.parse(JSON.stringify(G4G.config.columnas.operadores));
    G4G.config.requisitos.forEach((r) => { a['req_' + r.id] = ['req' + U.normKey(r.id), U.normKey(r.label), U.normKey(r.id)]; });
    return a;
  }
  const aliasesFor = (kind) => (kind === 'operadores' ? aliasesOperadores() : G4G.config.columnas.pasivos);

  /* Lee un archivo y devuelve { hojas: { nombre: filas[] } } */
  async function leerArchivo(file) {
    const name = file.name.toLowerCase();
    if (/\.(xlsx|xlsm|xls)$/.test(name)) {
      if (!window.XLSX) throw new Error('El lector de Excel no está disponible. Guarde el archivo como CSV.');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      const hojas = {};
      wb.SheetNames.forEach((n) => { hojas[n] = XLSX.utils.sheet_to_json(wb.Sheets[n], { defval: '', raw: true }); });
      return { hojas };
    }
    const text = await file.text();
    return { hojas: { [file.name.replace(/\.[^.]+$/, '')]: U.parseCSV(text) } };
  }

  /* Decide qué hoja es de operadores y cuál de pasivos (por nombre o por columnas). */
  function clasificar(hojas) {
    const out = {};
    for (const [nombre, filas] of Object.entries(hojas)) {
      if (!filas.length) continue;
      const n = U.normKey(nombre), keys = Object.keys(filas[0]).map(U.normKey);
      let kind = null;
      if (/pasiv|cola|relave|sitio/.test(n)) kind = 'pasivos';
      else if (/operador|cooperativa|apm|minera|actor/.test(n)) kind = 'operadores';
      else if (keys.some((k) => /volumen|ley|distrio|estructura/.test(k))) kind = 'pasivos';
      else if (keys.some((k) => /estadolegal|legalidad|situacion|socios|estado/.test(k))) kind = 'operadores';
      if (kind && !out[kind]) out[kind] = { hoja: nombre, filas };
    }
    return out;
  }

  /* Normaliza filas crudas al modelo interno e informa qué se entendió. */
  function mapear(filas, kind) {
    const aliases = aliasesFor(kind);
    const headers = Object.keys(filas[0] || {});
    const col = {}, reconocidas = [], ignoradas = [];
    headers.forEach((h) => {
      const k = U.normKey(h);
      const campo = Object.keys(aliases).find((f) => aliases[f].includes(k) || U.normKey(f) === k);
      if (campo && !col[campo]) { col[campo] = h; reconocidas.push({ columna: h, campo }); } else ignoradas.push(h);
    });
    const faltantes = REQUERIDAS[kind].filter((f) => !col[f]);
    const get = (r, f) => (col[f] !== undefined ? r[col[f]] : undefined);
    const registros = filas.map((r, i) => (kind === 'operadores' ? opDesde(r, i, get) : pasDesde(r, i, get)));
    return { registros, reconocidas, ignoradas, faltantes };
  }

  function estadoLegal(v) {
    const s = U.norm(v);
    if (!s) return 'sin_dato';
    if (/^(legal|legales|formal|formales|regular|vigente|si)$/.test(s)) return 'legal';
    if (/(proceso|tramite|informal|informales|regulariz|pendiente)/.test(s)) return 'proceso';
    if (/(ilegal|no legal|nolegal|irregular|clandest|sin licencia)/.test(s)) return 'no_legal';
    return 'sin_dato';
  }
  function opDesde(r, i, get) {
    const req = {};
    G4G.config.requisitos.forEach((q) => { req[q.id] = U.parseBool(get(r, 'req_' + q.id)); });
    return {
      id: String(get(r, 'id') || 'OP-' + String(i + 1).padStart(3, '0')).trim(),
      nombre: String(get(r, 'nombre') || '').trim(),
      tipo: String(get(r, 'tipo') || '').trim() || null,
      estado_legal: estadoLegal(get(r, 'estado_legal')),
      departamento: String(get(r, 'departamento') || '').trim() || null,
      municipio: String(get(r, 'municipio') || '').trim() || null,
      lat: U.parseNum(get(r, 'lat')), lng: U.parseNum(get(r, 'lng')),
      socios: U.parseNum(get(r, 'socios')),
      actualizado: U.parseDate(get(r, 'actualizado')),
      requisitos: req
    };
  }
  function enumDe(v, mapa, porDefecto) {
    const s = U.norm(v);
    if (!s) return porDefecto;
    const hit = Object.keys(mapa).find((k) => s.includes(k.replace('_', ' ')) || s.includes(U.norm(mapa[k].label || '')));
    return hit || porDefecto;
  }
  function pasDesde(r, i, get) {
    const hg = U.norm(get(r, 'uso_hg'));
    return {
      id: String(get(r, 'id') || 'PA-' + String(i + 1).padStart(3, '0')).trim(),
      operador_id: String(get(r, 'operador_id') || '').trim() || null,
      nombre: String(get(r, 'nombre') || '').trim() || null,
      tipo: String(get(r, 'tipo') || '').trim() || null,
      lat: U.parseNum(get(r, 'lat')), lng: U.parseNum(get(r, 'lng')),
      volumen_m3: U.parseNum(get(r, 'volumen_m3')),
      dist_rio_m: U.parseNum(get(r, 'dist_rio_m')),
      dist_poblado_m: U.parseNum(get(r, 'dist_poblado_m')),
      estructura: enumDe(get(r, 'estructura'), G4G.config.estructura, 'desconocida'),
      uso_hg: !hg ? 'desconocido' : (U.parseBool(hg) === true ? 'si' : (U.parseBool(hg) === false ? 'no' : 'desconocido')),
      muestra: U.parseBool(get(r, 'muestra')) === true,
      ley_au_gt: U.parseNum(get(r, 'ley_au_gt')),
      actualizado: U.parseDate(get(r, 'actualizado')),
      deteccion: String(get(r, 'deteccion') || '').trim() || null
    };
  }

  /* Importa un archivo completo. Devuelve el dataset y un informe de lectura. */
  async function importar(file) {
    const { hojas } = await leerArchivo(file);
    const tablas = clasificar(hojas);
    if (!tablas.operadores && !tablas.pasivos) {
      throw new Error('No se reconocieron hojas de operadores ni de pasivos. Revise los nombres de las hojas o columnas (descargue la plantilla para ver el formato).');
    }
    const informe = {};
    const dataset = { operadores: [], pasivos: [] };
    for (const kind of ['operadores', 'pasivos']) {
      if (!tablas[kind]) { informe[kind] = null; continue; }
      const m = mapear(tablas[kind].filas, kind);
      informe[kind] = { hoja: tablas[kind].hoja, filas: tablas[kind].filas.length, reconocidas: m.reconocidas, ignoradas: m.ignoradas, faltantes: m.faltantes };
      dataset[kind] = m.registros;
    }
    return { dataset, informe };
  }

  /* Columnas del Excel, en orden. Las usan la plantilla y el registro desde la app. */
  const cabeceras = (kind) => (kind === 'operadores'
    ? ['id', 'nombre', 'tipo', 'estado_legal', 'departamento', 'municipio', 'lat', 'lng', 'socios', 'actualizado', ...G4G.config.requisitos.map((r) => 'req_' + r.id)]
    : ['id', 'operador_id', 'nombre', 'tipo', 'lat', 'lng', 'volumen_m3', 'dist_rio_m', 'dist_poblado_m', 'estructura', 'uso_hg', 'muestra', 'ley_au_gt', 'actualizado', 'deteccion']);

  /* Registro interno -> fila del Excel { encabezado: valor } (inversa de mapear). */
  function aFila(kind, r) {
    const sn = (b) => (b === true ? 'si' : b === false ? 'no' : '');
    const v = (x) => (x === null || x === undefined ? '' : x);
    if (kind === 'operadores') {
      const f = { id: v(r.id), nombre: v(r.nombre), tipo: v(r.tipo), estado_legal: (G4G.config.estados[r.estado_legal] || G4G.config.estados.sin_dato).label,
        departamento: v(r.departamento), municipio: v(r.municipio), lat: v(r.lat), lng: v(r.lng), socios: v(r.socios), actualizado: v(r.actualizado) };
      G4G.config.requisitos.forEach((q) => { f['req_' + q.id] = sn((r.requisitos || {})[q.id]); });
      return f;
    }
    return { id: v(r.id), operador_id: v(r.operador_id), nombre: v(r.nombre), tipo: v(r.tipo), lat: v(r.lat), lng: v(r.lng), volumen_m3: v(r.volumen_m3),
      dist_rio_m: v(r.dist_rio_m), dist_poblado_m: v(r.dist_poblado_m), estructura: (G4G.config.estructura[r.estructura] || {}).label || '',
      uso_hg: v(r.uso_hg), muestra: r.muestra ? 'si' : 'no', ley_au_gt: v(r.ley_au_gt), actualizado: v(r.actualizado), deteccion: v(r.deteccion) };
  }

  /* Libro de Excel con el formato esperado (hojas Operadores y Pasivos). */
  function plantillaXLSX(operadores, pasivos) {
    const hoja = (kind, regs) => { const h = cabeceras(kind); return XLSX.utils.aoa_to_sheet([h, ...regs.map((r) => { const f = aFila(kind, r); return h.map((k) => f[k]); })]); };
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, hoja('operadores', operadores), 'Operadores');
    XLSX.utils.book_append_sheet(wb, hoja('pasivos', pasivos), 'Pasivos');
    return new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/octet-stream' });
  }

  G4G.importer = { importar, leerArchivo, clasificar, mapear, plantillaXLSX, estadoLegal, aFila, cabeceras };
})();
