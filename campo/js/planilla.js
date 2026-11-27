/* ==========================================================================
   Pestaña "Planilla": hoja de cálculo editable para ingresar muchas filas rápido, también sin señal.
   Dos hojas: Muestras (tamizaje de campo) y Pasivos (fichas nuevas).
   - Las celdas se editan directo (input real dentro de la celda). Tab, Enter y flechas mueven el foco como en Excel.
   - Se puede pegar desde Excel o Google Sheets (texto tabulado): rellena hacia abajo y a la derecha.
   - Borrador en el teléfono al instante (localStorage 'g4g.campo.planilla.v1').
   - Las filas listas se envían por la MISMA cola de campo.js (reintento automático sin señal), con las mismas
     reglas que muestra.js (guardarMuestra) y fichas.js (guardar 'pasivos'). Los datos de la planilla llevan
     el prefijo '[Planilla] ' en las notas para distinguirlos de una lectura colorimétrica del tubo.
   Seguridad: ningún dato entra al DOM como HTML (G4G.util.el); nombre de lugar de 120 caracteres y notas de 600.
   Rendimiento: la tabla se construye una vez; cada tecla solo actualiza su fila (delegación de eventos).
   ========================================================================== */
(function () {
  const G4G = (window.G4G = window.G4G || {});
  const C = G4G.campo, U = C.U, el = C.el, ui = C.ui, H = G4G.hgsense;

  const K_BORRADOR = 'g4g.campo.planilla.v1';
  const PREF = '[Planilla] ';
  const MAX_FILAS = 300, MAX_LUGAR = 120, MAX_NOTAS = 600, MAX_NOTA_ENTRADA = MAX_NOTAS - PREF.length;
  const LIM = { latMin: -23.5, latMax: -9, lngMin: -70, lngMax: -57 };   // las mismas del servidor (Codigo.gs)
  const BLOQUEADOS = ['enviada', 'cola', 'enviando'];
  const REDUCIDO = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ---------------- Iconos propios (se registran en campo.js) ---------------- */
  C.registrarIcono('tabla', 'M4 5h16v14H4zM4 10h16M4 15h16M10 5v14');
  C.registrarIcono('calendario', 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4');
  C.registrarIcono('gota', 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z');
  C.registrarIcono('etiqueta', 'M3 12V4h8l10 10-8 8zM7.5 8h.01');
  C.registrarIcono('copiar', 'M9 9h11v11H9zM5 15V4h11');
  C.registrarIcono('papelera', 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6');
  C.registrarIcono('cubo', 'M12 3 4 7v10l8 4 8-4V7zM4 7l8 4 8-4M12 11v10');
  C.registrarIcono('termometro', 'M10 4a2 2 0 0 1 4 0v9a4 4 0 1 1-4 0z');
  C.registrarIcono('visto', 'M5 12.5l4.5 4.5L19 7.5');
  C.registrarIcono('filas', 'M4 6h16M4 12h16M4 18h16');
  const ico = C.icono;

  /* ---------------- Definición de las hojas ---------------- */
  const cfg = () => G4G.config;
  const MATRICES = [['agua', 'Agua'], ['lodo', 'Lodo']];
  const MATRIZ_TXT = { agua: 'Agua', lodo: 'Lodo o sedimento' };
  const SINONIMOS = { lodo: ['sedimento', 'lodo o sedimento'] };
  const USO = [['si', 'Sí'], ['no', 'No'], ['desconocido', 'Desconocido']];
  const estructuraOpc = () => Object.entries(cfg().estructura).map(([k, e]) => [k, e.label]);
  const tiposPasivoOpc = () => cfg().tiposPasivo.map((t) => [t, t]);

  /* tipo: fecha | combo | select | num | coord | text | calc | gps | estado | acc. Las de edición llevan 'k' en row.v. */
  const HOJAS = {
    muestras: {
      id: 'muestras', titulo: 'Muestras', plural: 'muestras', icono: 'muestras',
      defecto: () => ({ fecha: fechaTxt(C.hoy()), lugar: '', matriz: '', hg2: '', hgt: '', lat: '', lng: '', lote: C.leerLote() || '', notas: '' }),
      ignoraVacia: ['fecha', 'lote'],
      cols: [
        { k: 'fecha', rot: 'Fecha', ico: 'calendario', tipo: 'fecha', w: 152, clase: 't-fecha', ph: 'dd/mm/aaaa' },
        { k: 'lugar', rot: 'Lugar o pasivo', corto: 'Lugar', ico: 'ubicacion', tipo: 'combo', lista: 'lugares', w: 250, clase: 't-lugar', max: MAX_LUGAR, ph: 'Elija o escriba' },
        { k: 'matriz', rot: 'Tipo', ico: 'muestras', tipo: 'select', opc: () => MATRICES, w: 124, clase: 't-tipo' },
        { k: 'hg2', rot: 'Hg2+', sub: 'ppb', ico: 'gota', tipo: 'num', modo: 'decimal', w: 112, clase: 't-ppb' },
        { k: 'hgt', rot: 'Hg total', sub: 'ppb, opcional', corto: 'Hg total', ico: 'gota', tipo: 'num', modo: 'decimal', w: 124, clase: 't-ppb' },
        { k: 'res', rot: 'Resultado', ico: 'visto', tipo: 'calc', w: 198, clase: 't-res' },
        { k: 'lat', rot: 'Latitud', ico: 'ubicacion', tipo: 'coord', w: 132, clase: 't-geo' },
        { k: 'lng', rot: 'Longitud', ico: 'ubicacion', tipo: 'coord', w: 132, clase: 't-geo' },
        { k: 'gps', rot: 'GPS', ico: 'gps', tipo: 'gps', w: 96, clase: 't-geo' },
        { k: 'lote', rot: 'Lote de reactivo', corto: 'Lote', ico: 'etiqueta', tipo: 'text', w: 140, clase: 't-txt', max: 40 },
        { k: 'notas', rot: 'Notas', ico: 'tramites', tipo: 'text', w: 260, clase: 't-txt', max: MAX_NOTA_ENTRADA },
        { k: 'estado', rot: 'Estado', ico: 'miestado', tipo: 'estado', w: 232, clase: 't-sys' },
        { k: 'acc', rot: 'Fila', ico: 'filas', tipo: 'acc', w: 108, clase: 't-sys' }
      ]
    },
    pasivos: {
      id: 'pasivos', titulo: 'Pasivos', plural: 'pasivos', icono: 'pasivos',
      defecto: () => ({ nombre: '', tipo: '', operador: '', lat: '', lng: '', volumen: '', estructura: 'desconocida', uso: 'desconocido', notas: '' }),
      ignoraVacia: ['estructura', 'uso'],
      cols: [
        { k: 'nombre', rot: 'Nombre', ico: 'pasivos', tipo: 'text', w: 250, clase: 't-lugar', max: MAX_LUGAR, ph: 'Ej.: Dique de colas Norte' },
        { k: 'tipo', rot: 'Tipo', ico: 'pasivos', tipo: 'select', opc: tiposPasivoOpc, w: 160, clase: 't-tipo' },
        { k: 'operador', rot: 'Operador', ico: 'operadores', tipo: 'combo', lista: 'operadores', w: 232, clase: 't-lugar', max: MAX_LUGAR, ph: 'Elija de la lista' },
        { k: 'lat', rot: 'Latitud', ico: 'ubicacion', tipo: 'coord', w: 132, clase: 't-geo' },
        { k: 'lng', rot: 'Longitud', ico: 'ubicacion', tipo: 'coord', w: 132, clase: 't-geo' },
        { k: 'gps', rot: 'GPS', ico: 'gps', tipo: 'gps', w: 96, clase: 't-geo' },
        { k: 'volumen', rot: 'Volumen', sub: 'm³', corto: 'Volumen', ico: 'cubo', tipo: 'num', modo: 'decimal', w: 124, clase: 't-ppb' },
        { k: 'estructura', rot: 'Estructura', ico: 'riesgos', tipo: 'select', opc: estructuraOpc, w: 142, clase: 't-estr' },
        { k: 'uso', rot: 'Uso de mercurio', corto: 'Uso de mercurio', ico: 'termometro', tipo: 'select', opc: () => USO, w: 150, clase: 't-estr' },
        { k: 'notas', rot: 'Notas', sub: 'solo en su teléfono', corto: 'Notas', ico: 'tramites', tipo: 'text', w: 250, clase: 't-txt', max: MAX_NOTA_ENTRADA },
        { k: 'estado', rot: 'Estado', ico: 'miestado', tipo: 'estado', w: 232, clase: 't-sys' },
        { k: 'acc', rot: 'Fila', ico: 'filas', tipo: 'acc', w: 108, clase: 't-sys' }
      ]
    }
  };
  const EDITABLES = {};
  Object.keys(HOJAS).forEach((h) => { EDITABLES[h] = HOJAS[h].cols.filter((c) => ['fecha', 'combo', 'select', 'num', 'coord', 'text'].includes(c.tipo)); });
  const colDe = (h, k) => HOJAS[h].cols.find((c) => c.k === k);

  /* ---------------- Utilidades de texto ---------------- */
  const pad2 = (n) => String(n).padStart(2, '0');
  function fechaTxt(iso) { const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; }
  function parseFecha(s) {
    s = String(s == null ? '' : s).trim();
    let m, y, mo, d;
    if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/))) { y = +m[1]; mo = +m[2]; d = +m[3]; }
    else if ((m = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2}|\d{4})$/))) { d = +m[1]; mo = +m[2]; y = +m[3]; if (m[3].length === 2) y += 2000; }
    else if ((m = s.match(/^(\d{2})(\d{2})(\d{4})$/))) { d = +m[1]; mo = +m[2]; y = +m[3]; }
    else return null;
    const t = new Date(y, mo - 1, d);
    if (t.getFullYear() !== y || t.getMonth() !== mo - 1 || t.getDate() !== d || y < 2000) return null;
    return { y, m: mo, d, iso: y + '-' + pad2(mo) + '-' + pad2(d), txt: pad2(d) + '/' + pad2(mo) + '/' + y };
  }
  /* Número con coma o punto decimal. Devuelve un número, o null si el texto no es un número. */
  function num(s) {
    s = String(s == null ? '' : s).replace(/−/g, '-').replace(/\s/g, '');
    if (!s) return null;
    const co = (s.match(/,/g) || []).length, pu = (s.match(/\./g) || []).length;
    if (co && pu) { const dec = s.lastIndexOf(',') > s.lastIndexOf('.') ? ',' : '.'; s = dec === ',' ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, ''); }
    else if (co > 1 || pu > 1) s = s.replace(/[.,]/g, '');
    else if (co) s = s.replace(',', '.');
    if (!/^[-+]?(\d+(\.\d*)?|\.\d+)$/.test(s)) return null;
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : null;
  }
  const vacioTxt = (s) => String(s == null ? '' : s).trim() === '';
  const r2 = (x) => Math.round(x * 100) / 100;
  const coma = (n) => String(n).replace('.', ',');
  const soloTxt = (s, max) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ').replace(/[\r\n\t]+/g, ' ').slice(0, max || 1000);

  /* Opciones de una lista desplegable: acepta el valor, la etiqueta o el inicio de la etiqueta, sin tildes. */
  function mapSelect(col, texto) {
    const t = U.norm(texto); if (!t) return '';
    const opc = col.opc();
    for (const [v, l] of opc) if (U.norm(v) === t || U.norm(l) === t) return v;
    for (const [v, l] of opc) if ((SINONIMOS[v] || []).some((s) => U.norm(s) === t)) return v;
    if (t.length >= 3) for (const [v, l] of opc) if (U.norm(l).startsWith(t)) return v;
    return null;
  }

  /* ---------------- Base descargada: lugares y operadores ---------------- */
  let LUG = { etiquetas: [], porEtiqueta: new Map(), porNombre: new Map(), porId: new Map() };
  let OPS = { etiquetas: [], porEtiqueta: new Map(), porNombre: new Map(), porId: new Map() };
  function indexar(lista) {
    const ix = { etiquetas: [], porEtiqueta: new Map(), porNombre: new Map(), porId: new Map() }, dup = new Set();
    lista.forEach((x) => {
      ix.etiquetas.push(x.etiqueta);
      ix.porEtiqueta.set(U.norm(x.etiqueta), x);
      ix.porId.set(U.norm(x.id), x);
      const n = U.norm(x.nombre);
      if (ix.porNombre.has(n)) dup.add(n); else ix.porNombre.set(n, x);
    });
    dup.forEach((n) => ix.porNombre.delete(n));
    return ix;
  }
  function reindexarBase() {
    const b = C.getBase();
    const lug = [];
    b.pasivos.forEach((p) => lug.push({ tipo: 'pasivo', id: p.id, nombre: p.nombre || 'Pasivo sin nombre', operador_id: p.operador_id || '', etiqueta: (p.nombre || 'Pasivo sin nombre') + ' · ' + p.id }));
    b.operadores.forEach((o) => lug.push({ tipo: 'operador', id: o.id, nombre: o.nombre || o.id, operador_id: o.id, etiqueta: (o.nombre || o.id) + ' · ' + o.id }));
    LUG = indexar(lug);
    OPS = indexar(b.operadores.map((o) => ({ tipo: 'operador', id: o.id, nombre: o.nombre || o.id, etiqueta: (o.nombre || o.id) + ' · ' + o.id })));
    if (V) { llenarLista(V.dlLugares, LUG.etiquetas); llenarLista(V.dlOps, OPS.etiquetas); }
  }
  function resolver(ix, texto) {
    const t = U.norm(texto); if (!t) return null;
    return ix.porEtiqueta.get(t) || ix.porNombre.get(t) || ix.porId.get(t) || null;
  }
  function llenarLista(dl, etiquetas) {
    if (!dl) return;
    U.clear(dl);
    const fr = document.createDocumentFragment();
    etiquetas.slice().sort((a, b) => a.localeCompare(b, 'es')).forEach((e) => fr.appendChild(el('option', { value: e })));
    dl.appendChild(fr);
  }

  /* ---------------- Estado y borrador ---------------- */
  let S = { hoja: 'muestras', muestras: [], pasivos: [] };
  let V = null;   // vista actual (nodos); null si la pestaña no está abierta
  let ridN = 0;
  const nuevoRid = () => 'r' + Date.now().toString(36) + (++ridN).toString(36);

  function nuevaFila(hoja, v) {
    return { rid: nuevoRid(), v: Object.assign(HOJAS[hoja].defecto(), v || {}), estado: '', qid: null, sid: null, err: '', env: 0, prec: null, t: new Set(), rev: false, st: null };
  }
  const bloqueada = (row) => BLOQUEADOS.includes(row.estado);

  function cargarBorrador() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(K_BORRADOR)); } catch (e) { d = null; }
    if (d && d.v === 1) {
      if (d.hoja === 'pasivos' || d.hoja === 'muestras') S.hoja = d.hoja;
      ['muestras', 'pasivos'].forEach((h) => {
        const base = HOJAS[h].defecto();
        (Array.isArray(d[h]) ? d[h] : []).slice(0, MAX_FILAS).forEach((f) => {
          if (!f || typeof f.v !== 'object' || !f.v) return;
          const v = {};
          Object.keys(base).forEach((k) => { v[k] = soloTxt(f.v[k] === undefined || f.v[k] === null ? base[k] : f.v[k], k === 'notas' ? MAX_NOTAS : 200); });
          const row = nuevaFila(h, v);
          row.estado = ['enviada', 'cola', 'enviando', 'error'].includes(f.estado) ? (f.estado === 'enviando' ? 'cola' : f.estado) : '';
          row.qid = typeof f.qid === 'string' ? f.qid : null; row.sid = typeof f.sid === 'string' ? f.sid : null;
          row.err = typeof f.err === 'string' ? f.err.slice(0, 300) : ''; row.env = Number(f.env) || 0;
          row.prec = typeof f.prec === 'number' ? f.prec : null;
          row.rev = true;   // un borrador recuperado muestra de una vez lo que falta
          S[h].push(row);
        });
      });
    }
    ['muestras', 'pasivos'].forEach((h) => { while (S[h].length < 5) S[h].push(nuevaFila(h)); asegurarFinal(h, true); });
  }

  let avisoGuardado = false;
  function guardarYa() {
    clearTimeout(guardarYa.t);
    const salida = { v: 1, hoja: S.hoja };
    ['muestras', 'pasivos'].forEach((h) => {
      salida[h] = S[h].filter((r) => !validar(h, r).vacia || r.estado).map((r) => ({ v: r.v, estado: r.estado, qid: r.qid, sid: r.sid, err: r.err, env: r.env, prec: r.prec }));
    });
    try { localStorage.setItem(K_BORRADOR, JSON.stringify(salida)); avisoGuardado = false; }
    catch (e) { if (!avisoGuardado) { avisoGuardado = true; ui.toast('No se pudo guardar el borrador: poco espacio en el teléfono. Envíe las filas listas o libere espacio.', 'warn'); } }
  }
  const guardarPronto = () => { clearTimeout(guardarYa.t); guardarYa.t = setTimeout(guardarYa, 160); };
  window.addEventListener('pagehide', () => { if (C.vistaActual() === 'planilla') guardarYa(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && C.vistaActual() === 'planilla') guardarYa(); });

  /* ---------------- Validación ---------------- */
  const MSG = {
    fecha: 'Escriba la fecha como día/mes/año, por ejemplo 26/11/2026.',
    futura: 'La fecha no puede ser futura.',
    lugar: 'Elija un lugar de la lista o escriba uno.',
    matriz: 'Elija agua o lodo.',
    ppb: 'Escriba un número mayor o igual a 0, por ejemplo 12,5.',
    lat: 'La latitud de Bolivia va de -23,5 a -9 (¿falta el signo menos?).',
    lng: 'La longitud de Bolivia va de -70 a -57 (¿falta el signo menos?).',
    coordFalta: 'Escriba la coordenada o use el botón GPS.',
    nombre: 'Escriba el nombre del sitio.',
    tipo: 'Elija el tipo de pasivo.',
    operador: 'Ese operador no está en la lista: elíjalo de la lista o deje la celda vacía.',
    volumen: 'Escriba un número mayor o igual a 0, por ejemplo 1500.',
    lista: 'Elija una opción de la lista.'
  };

  function validar(hoja, row) {
    const v = row.v, P = [];
    const falta = (k, msg) => P.push({ k, msg, falta: true });
    const malo = (k, msg) => P.push({ k, msg, falta: false });
    const out = { problemas: P, vacia: false, nivel: null, lugar: null, op: null, alerta: false, listo: false };
    const H_ = HOJAS[hoja];
    const hayDatos = Object.keys(v).some((k) => !H_.ignoraVacia.includes(k) && !vacioTxt(v[k]));
    if (!hayDatos) { out.vacia = true; return out; }

    const coords = () => {
      if (vacioTxt(v.lat)) falta('lat', MSG.coordFalta); else { const n = num(v.lat); if (n === null || n < LIM.latMin || n > LIM.latMax) malo('lat', MSG.lat); }
      if (vacioTxt(v.lng)) falta('lng', MSG.coordFalta); else { const n = num(v.lng); if (n === null || n < LIM.lngMin || n > LIM.lngMax) malo('lng', MSG.lng); }
    };
    const opcional = (k, max, msg) => { if (!vacioTxt(v[k])) { const n = num(v[k]); if (n === null || n < 0 || n > max) malo(k, msg); } };

    if (hoja === 'muestras') {
      if (vacioTxt(v.fecha)) falta('fecha', MSG.fecha);
      else { const f = parseFecha(v.fecha); if (!f) malo('fecha', MSG.fecha); else if (f.iso > C.hoy()) malo('fecha', MSG.futura); }
      if (vacioTxt(v.lugar)) falta('lugar', MSG.lugar); else out.lugar = resolver(LUG, v.lugar);
      if (!v.matriz) falta('matriz', MSG.matriz); else if (v.matriz !== 'agua' && v.matriz !== 'lodo') malo('matriz', MSG.matriz);
      let h2 = null, ht = null;
      if (vacioTxt(v.hg2)) falta('hg2', 'Escriba el Hg2+ en ppb, por ejemplo 12,5.');
      else { h2 = num(v.hg2); if (h2 === null || h2 < 0 || h2 > 1e6) { malo('hg2', MSG.ppb); h2 = null; } }
      if (!vacioTxt(v.hgt)) { ht = num(v.hgt); if (ht === null || ht < 0 || ht > 1e6) { malo('hgt', MSG.ppb); ht = null; } }
      coords();
      if ((v.matriz === 'agua' || v.matriz === 'lodo') && h2 !== null) {
        out.nivel = H.peorNivel(H.semaforo(v.matriz, h2), ht !== null ? H.semaforo(v.matriz, ht) : null);
        out.alerta = out.nivel === 'amarillo' || out.nivel === 'rojo';
      }
    } else {
      if (vacioTxt(v.nombre)) falta('nombre', MSG.nombre);
      if (!v.tipo) falta('tipo', MSG.tipo); else if (!cfg().tiposPasivo.includes(v.tipo)) malo('tipo', MSG.tipo);
      if (!vacioTxt(v.operador)) { out.op = resolver(OPS, v.operador); if (!out.op) malo('operador', MSG.operador); }
      coords();
      opcional('volumen', 1e9, MSG.volumen);
      if (v.estructura && !cfg().estructura[v.estructura]) malo('estructura', MSG.lista);
      if (v.uso && !USO.some((u) => u[0] === v.uso)) malo('uso', MSG.lista);
      out.alerta = v.estructura === 'critica' || v.uso === 'si';
    }
    out.listo = P.length === 0;
    return out;
  }

  /* Estado que se muestra: vacia | lista | falta | enviada | cola | enviando | error */
  function estadoUI(row, st) {
    if (row.estado === 'enviada' || row.estado === 'enviando' || row.estado === 'cola') return row.estado;
    if (st.vacia) return 'vacia';
    if (row.estado === 'error' && st.listo) return 'error';
    return st.listo ? 'lista' : 'falta';
  }
  const enviable = (row, st) => !bloqueada(row) && !st.vacia && st.listo;
  const mostrarProblema = (row, k) => row.rev || row.t.has(k);

  function textoEstado(hoja, row, st, e) {
    if (e === 'lista') return 'Lista';
    if (e === 'enviada') return 'Enviada';
    if (e === 'cola') return 'En cola';
    if (e === 'enviando') return 'Enviando…';
    if (e === 'error') return 'Error: ' + (row.err || 'no se pudo enviar');
    if (e === 'falta') {
      const nom = (p) => { const c = colDe(hoja, p.k); return c.corto || c.rot; };
      const f = st.problemas.filter((p) => p.falta).map(nom), m = st.problemas.filter((p) => !p.falta).map(nom);
      return [f.length ? 'Falta: ' + f.join(', ') : '', m.length ? 'Revisar: ' + m.join(', ') : ''].filter(Boolean).join(' · ');
    }
    return '';
  }
  const FORMA_ESTADO = {
    lista: ['circulo', '#2E7D4F'], falta: ['triangulo', '#B97A00'], error: ['cuadrado', '#B3261E'],
    enviada: ['circulo', '#2E7D4F'], cola: ['anillo', '#1F4E9C'], enviando: ['anillo', '#1F4E9C'], vacia: null
  };

  /* ---------------- Construcción de la tabla ---------------- */
  const vistaH = (h) => V && V.hojas[h];

  function crearControl(hoja, col, row) {
    const v = row.v[col.k] === undefined ? '' : row.v[col.k];
    if (col.tipo === 'select') {
      const s = el('select', { class: 'pl-in pl-in--sel', 'data-k': col.k, 'data-t': col.tipo },
        el('option', { value: '' }, ''), col.opc().map(([val, lab]) => el('option', { value: val }, lab)));
      fijarSelect(s, col, v);
      return s;
    }
    const attrs = { class: 'pl-in' + (col.tipo === 'num' || col.tipo === 'coord' ? ' pl-in--num' : ''), type: 'text', 'data-k': col.k, 'data-t': col.tipo, value: v,
      autocomplete: 'off', autocorrect: 'off', spellcheck: 'false', enterkeyhint: 'next', maxlength: col.max || (col.tipo === 'fecha' ? 10 : 24) };
    if (col.ph) attrs.placeholder = col.ph;
    if (col.tipo === 'num') attrs.inputmode = 'decimal';
    else if (col.tipo === 'coord') attrs.inputmode = 'text';    // el teclado decimal de iOS no tiene el signo menos
    else if (col.tipo === 'fecha') attrs.inputmode = 'numeric';
    else if (col.tipo === 'combo') { attrs.list = col.lista === 'lugares' ? 'pl-dl-lugares' : 'pl-dl-operadores'; attrs.autocapitalize = 'sentences'; }
    else attrs.autocapitalize = 'sentences';
    return el('input', attrs);
  }
  function fijarSelect(s, col, valor) {
    const extra = s.querySelector('option[data-extra]'); if (extra) extra.remove();
    if (valor && !col.opc().some((o) => o[0] === valor)) s.appendChild(el('option', { value: valor, 'data-extra': '1' }, valor));
    s.value = valor || '';
  }

  function construirFila(hoja, row) {
    const H_ = HOJAS[hoja];
    const tr = el('tr', { class: 'pl-r' });
    tr.__row = row;
    const ref = { tr, ctl: {}, td: {}, nIco: el('span', { class: 'pl-n__ico' }), nNum: el('span', { class: 'pl-n__num' }), est: null, res: null, estKey: '', nivel: undefined, lugarTipo: '' };
    tr.appendChild(el('th', { class: 'pl-n', scope: 'row' }, ref.nIco, ref.nNum));
    H_.cols.forEach((col) => {
      const td = el('td', { class: 'pl-td ' + col.clase + ' pl-td--' + col.tipo, 'data-k': col.k });
      ref.td[col.k] = td;
      switch (col.tipo) {
        case 'fecha': {
          const c = crearControl(hoja, col, row); ref.ctl[col.k] = c;
          td.append(c, el('button', { type: 'button', class: 'pl-cal', tabindex: '-1', 'data-act': 'cal', 'aria-label': 'Elegir la fecha en el calendario' }, ico('calendario', 20)));
          break;
        }
        case 'calc': ref.res = el('span', { class: 'pl-res' }); td.appendChild(ref.res); break;
        case 'gps': td.appendChild(el('button', { type: 'button', class: 'pl-gps', tabindex: '-1', 'data-act': 'gps', title: 'Poner la ubicación de GPS en esta fila (Alt+G)' }, ico('gps', 18), el('span', null, 'GPS'))); break;
        case 'estado': ref.est = el('span', { class: 'pl-st-wrap' }); td.appendChild(ref.est); break;
        case 'acc':
          td.append(
            el('button', { type: 'button', class: 'pl-ib', tabindex: '-1', 'data-act': 'dup', title: 'Duplicar la fila (Ctrl+D)', 'aria-label': 'Duplicar la fila' }, ico('copiar', 20)),
            el('button', { type: 'button', class: 'pl-ib pl-ib--del', tabindex: '-1', 'data-act': 'del', title: 'Borrar la fila', 'aria-label': 'Borrar la fila' }, ico('papelera', 20)));
          break;
        default: { const c = crearControl(hoja, col, row); ref.ctl[col.k] = c; td.appendChild(c); }
      }
      tr.appendChild(td);
    });
    return ref;
  }

  function construirTabla(hoja) {
    const H_ = HOJAS[hoja], hv = V.hojas[hoja];
    const total = H_.cols.reduce((s, c) => s + c.w, 0) + 60;
    const thead = el('thead', null, el('tr', null,
      el('th', { class: 'pl-n pl-h pl-corner', scope: 'col', 'aria-label': 'Número de fila' }, el('span', { class: 'pl-h__t' }, el('b', null, '#'))),
      H_.cols.map((c) => el('th', { class: 'pl-h ' + c.clase, scope: 'col' },
        el('span', { class: 'pl-h__ico' }, ico(c.ico, 18)),
        el('span', { class: 'pl-h__t' }, el('b', null, c.rot), c.sub ? el('i', null, c.sub) : null)))));
    hv.tbody = el('tbody');
    hv.tabla = el('table', { class: 'pl-tabla', role: 'grid', 'aria-label': 'Planilla de ' + H_.plural, style: { width: 'max(100%, ' + total + 'px)' } },
      el('colgroup', null, el('col', { style: { width: '60px' } }), H_.cols.map((c) => el('col', { style: { width: c.w + 'px' } }))), thead, hv.tbody);
    const fr = document.createDocumentFragment();
    S[hoja].forEach((row) => { const ref = construirFila(hoja, row); hv.refs.set(row.rid, ref); fr.appendChild(ref.tr); });
    hv.tbody.appendChild(fr);
    hv.wrap.appendChild(hv.tabla);
    S[hoja].forEach((row) => pintarFila(hoja, row));
    renumerar(hoja);
  }

  function renumerar(hoja) {
    const hv = vistaH(hoja); if (!hv || !hv.tbody) return;
    S[hoja].forEach((row, i) => {
      const ref = hv.refs.get(row.rid); if (!ref) return;
      ref.nNum.textContent = String(i + 1);
      EDITABLES[hoja].forEach((c) => ref.ctl[c.k].setAttribute('aria-label', c.rot + ', fila ' + (i + 1)));
    });
  }

  /* Pinta el estado de UNA fila (solo toca lo que cambió). */
  function pintarFila(hoja, row) {
    const hv = vistaH(hoja); if (!hv || !hv.tbody) return;
    const ref = hv.refs.get(row.rid); if (!ref) return;
    const st = validar(hoja, row); row.st = st;
    const e = estadoUI(row, st), bloq = bloqueada(row);
    const clase = 'pl-r is-' + e + (bloq ? ' is-bloq' : '') + (st.alerta ? ' is-alerta' : '') + (ref.tr.classList.contains('is-nueva') ? ' is-nueva' : '');
    if (ref.tr.className !== clase) ref.tr.className = clase;

    /* Celdas con problema (se muestran al salir de la celda, al pegar o al intentar enviar). */
    HOJAS[hoja].cols.forEach((c) => {
      if (!ref.ctl[c.k]) return;
      const p = st.problemas.find((x) => x.k === c.k), malo = !!p && mostrarProblema(row, c.k);
      const td = ref.td[c.k];
      if (td.classList.contains('is-bad') !== malo) { td.classList.toggle('is-bad', malo); ref.ctl[c.k].setAttribute('aria-invalid', malo ? 'true' : 'false'); }
      if (malo) td.title = p.msg; else if (td.title) td.removeAttribute('title');
      const c0 = ref.ctl[c.k];
      if (c.tipo === 'select') { if (c0.disabled !== bloq) c0.disabled = bloq; } else if (c0.readOnly !== bloq) c0.readOnly = bloq;
    });

    /* Indicador de lugar conocido (pasivo u operador de la base). */
    if (hoja === 'muestras') {
      const lt = st.lugar ? st.lugar.tipo : '';
      if (ref.lugarTipo !== lt) { ref.lugarTipo = lt; ref.td.lugar.dataset.ref = lt; ref.td.lugar.setAttribute('data-ref', lt); }
      if (ref.nivel !== st.nivel) {
        ref.nivel = st.nivel; U.clear(ref.res);
        if (st.nivel) { const chip = C.chipSemaforo(st.nivel); chip.classList.add('pl-pill'); ref.res.appendChild(chip); if (!REDUCIDO()) { chip.classList.add('is-pop'); } }
      }
    }

    /* Número de fila con la forma del estado. */
    const clave = e + '|' + textoEstado(hoja, row, st, e);
    if (ref.estKey !== clave) {
      ref.estKey = clave;
      const f = FORMA_ESTADO[e];
      U.clear(ref.nIco); if (f) ref.nIco.appendChild(ui.shapeSvg(f[0], f[1], 12));
      U.clear(ref.est);
      if (f) {
        const t = textoEstado(hoja, row, st, e);
        ref.est.appendChild(el('span', { class: 'pl-st pl-st--' + e, title: t },
          e === 'enviando' ? el('span', { class: 'pl-spin', 'aria-hidden': 'true' }) : (e === 'enviada' ? ico('visto', 14) : ui.shapeSvg(f[0], f[1], 12)),
          el('span', { class: 'pl-st__t' }, t)));
      }
      ref.nIco.parentNode.title = e === 'vacia' ? '' : textoEstado(hoja, row, st, e);
    }
  }

  /* ---------------- Contadores, tarjetas y barra de envío ---------------- */
  let contarPend = false;
  function programarConteo() { if (contarPend) return; contarPend = true; requestAnimationFrame(() => { contarPend = false; contar(); }); }

  function resumen(hoja) {
    let filas = 0, listas = 0, alerta = 0, enviadas = 0, cola = 0;
    S[hoja].forEach((row) => {
      const st = row.st || validar(hoja, row);
      if (st.vacia && !row.estado) return;
      filas++;
      if (row.estado === 'enviada') enviadas++;
      else if (row.estado === 'cola' || row.estado === 'enviando') cola++;
      else if (enviable(row, st)) listas++;
      if (st.alerta) alerta++;
    });
    return { filas, listas, alerta, enviadas, cola };
  }
  function pop(nodo, txt) {
    if (nodo.textContent === txt) return;
    nodo.textContent = txt;
    if (!REDUCIDO()) { nodo.classList.remove('is-pop'); void nodo.offsetWidth; nodo.classList.add('is-pop'); }
  }
  function contar() {
    if (!V) return;
    const r = resumen(S.hoja), otra = S.hoja === 'muestras' ? 'pasivos' : 'muestras', ro = resumen(otra);
    pop(V.n.filas, String(r.filas)); pop(V.n.listas, String(r.listas)); pop(V.n.alerta, String(r.alerta)); pop(V.n.enviadas, String(r.enviadas));
    V.cont.textContent = r.filas + (r.filas === 1 ? ' fila' : ' filas') + ', ' + r.listas + (r.listas === 1 ? ' lista' : ' listas');
    ['muestras', 'pasivos'].forEach((h) => { const c = resumen(h); V.segN[h].textContent = String(c.filas); V.segN[h].hidden = c.filas === 0; });
    V.btnQuitar.disabled = r.enviadas === 0;
    actualizarEnvio(r, ro);
  }

  function progresoLote() {
    if (!V.lote) return null;
    let hechas = 0, err = 0;
    V.lote.qids.forEach((q) => { const it = C.itemDeCola(q); if (it && it.estado === 'enviado') hechas++; else if (it && it.estado === 'error') { hechas++; err++; } else if (!it) hechas++; });
    return { hechas, total: V.lote.qids.length, err };
  }
  function actualizarEnvio(r, ro) {
    if (!V) return;
    const enCurso = V.enviando;
    const pr = enCurso ? progresoLote() : null;
    const M = r.listas;
    U.clear(V.btnEnviar);
    if (enCurso) {
      V.btnEnviar.append(el('span', { class: 'pl-spin pl-spin--claro', 'aria-hidden': 'true' }), 'Enviando ' + Math.min(pr.hechas + 1, pr.total) + ' de ' + pr.total + '…');
      V.prog.style.width = (pr.total ? Math.round(pr.hechas / pr.total * 100) : 0) + '%';
      V.prog.parentNode.hidden = false;
    } else {
      V.prog.parentNode.hidden = true;
      V.btnEnviar.append(ico('subir', 22), M === 0 ? 'Sin filas listas para enviar' : 'Enviar ' + M + (M === 1 ? ' fila lista' : ' filas listas'));
    }
    V.btnEnviar.disabled = enCurso || M === 0;
    V.btnEnviar.classList.toggle('is-enviando', enCurso);
    let msg = V.mensaje;
    if (!msg) {
      if (enCurso) msg = 'No cierre la aplicación hasta que termine.';
      else if (M > 0 && !C.enLinea()) msg = 'Sin señal: las filas listas se guardan en la cola y se envían solas cuando vuelva la conexión.';
      else if (r.filas > 0 && M === 0 && r.cola === 0 && r.enviadas < r.filas) msg = 'Complete lo que dice la columna Estado para poder enviar.';
      else if (ro.listas > 0) msg = 'También hay ' + ro.listas + (ro.listas === 1 ? ' fila lista' : ' filas listas') + ' en la hoja ' + (S.hoja === 'muestras' ? 'Pasivos' : 'Muestras') + '.';
      else if (r.cola > 0) msg = r.cola + (r.cola === 1 ? ' fila está' : ' filas están') + ' en la cola: se envían solas cuando hay señal.';
      else msg = 'Las filas listas se envían con un toque.';
    }
    if (V.msg.textContent !== msg) V.msg.textContent = msg;
  }
  function fijarMensaje(txt, ms) {
    if (!V) return;
    V.mensaje = txt; clearTimeout(fijarMensaje.t);
    if (ms) fijarMensaje.t = setTimeout(() => { if (V) { V.mensaje = ''; programarConteo(); } }, ms);
    programarConteo();
  }

  /* ---------------- Edición de datos ---------------- */
  function liberar(row) {
    if (row.estado === 'error') { if (row.qid) C.quitarDeCola(row.qid); row.qid = null; row.estado = ''; row.err = ''; }
  }

  /* Cambia un valor de la fila. 'dom' = también reflejarlo en la celda (pegar, GPS, calendario). */
  function escribir(hoja, row, k, texto, dom) {
    const col = colDe(hoja, k); if (!col) return;
    let v = String(texto == null ? '' : texto);
    if (col.tipo === 'select') { const m = mapSelect(col, v); v = m === null ? soloTxt(v.trim(), 40) : m; }
    else { v = soloTxt(v, col.max || 24); if (col.tipo === 'fecha' && dom) { const f = parseFecha(v); if (f) v = f.txt; } if (col.tipo !== 'text' && col.tipo !== 'combo') v = v.trim(); }
    row.v[k] = v;
    if ((k === 'lat' || k === 'lng') && !(dom && dom.gps)) row.prec = null;
    if (dom) {
      const hv = vistaH(hoja), ref = hv && hv.refs.get(row.rid);
      if (ref && ref.ctl[k]) { if (col.tipo === 'select') fijarSelect(ref.ctl[k], col, v); else if (ref.ctl[k].value !== v) ref.ctl[k].value = v; }
    }
  }

  function despuesDeEditar(hoja, row) {
    pintarFila(hoja, row);
    asegurarFinal(hoja);
    programarConteo(); guardarPronto();
  }

  /* Siempre queda una fila en blanco al final: al llenar la última se crea otra. */
  function asegurarFinal(hoja, sinDom) {
    const filas = S[hoja], ultima = filas[filas.length - 1];
    if (filas.length >= MAX_FILAS) return;
    if (!ultima || !validar(hoja, ultima).vacia || ultima.estado) agregarFila(hoja, sinDom);
  }
  function agregarFila(hoja, sinDom, v, indice) {
    if (S[hoja].length >= MAX_FILAS) { ui.toast('La planilla admite hasta ' + MAX_FILAS + ' filas. Envíe las listas y quite las enviadas.', 'warn'); return null; }
    const row = nuevaFila(hoja, v);
    const i = indice === undefined ? S[hoja].length : indice;
    S[hoja].splice(i, 0, row);
    const hv = vistaH(hoja);
    if (!sinDom && hv && hv.tbody) {
      const ref = construirFila(hoja, row); hv.refs.set(row.rid, ref);
      if (!REDUCIDO()) { ref.tr.classList.add('is-nueva'); setTimeout(() => ref.tr.classList.remove('is-nueva'), 600); }
      const sig = S[hoja][i + 1], sigRef = sig && hv.refs.get(sig.rid);
      hv.tbody.insertBefore(ref.tr, sigRef ? sigRef.tr : null);
      pintarFila(hoja, row); renumerar(hoja);
    }
    return row;
  }

  function duplicarFila(hoja, row) {
    const i = S[hoja].indexOf(row); if (i < 0) return;
    const copia = agregarFila(hoja, false, Object.assign({}, row.v), i + 1); if (!copia) return;
    copia.rev = row.rev; copia.prec = row.prec;
    pintarFila(hoja, copia); asegurarFinal(hoja); programarConteo(); guardarPronto();
    ui.toast('Fila ' + (i + 1) + ' duplicada.');
    const ref = vistaH(hoja).refs.get(copia.rid), c = EDITABLES[hoja][0];
    if (ref) { ref.ctl[c.k].focus(); }
  }

  function borrarFila(hoja, row) {
    if (row.estado === 'cola' || row.estado === 'enviando') { ui.toast('Esa fila ya está en la cola de envío. Para anularla, descártela en Pendientes.', 'warn'); return; }
    const filas = S[hoja], i = filas.indexOf(row); if (i < 0) return;
    const hv = vistaH(hoja), ref = hv.refs.get(row.rid);
    filas.splice(i, 1); hv.refs.delete(row.rid);
    if (ref) ref.tr.remove();
    if (!filas.length || !validar(hoja, filas[filas.length - 1]).vacia) agregarFila(hoja);
    renumerar(hoja); programarConteo(); guardarPronto();
    mostrarDeshacer(hoja, row, i);
  }
  function mostrarDeshacer(hoja, row, indice) {
    clearTimeout(mostrarDeshacer.t);
    U.clear(V.undo);
    V.undo.append(el('span', null, 'Fila ' + (indice + 1) + ' borrada.'),
      el('button', { type: 'button', class: 'pl-undo__btn', onclick: () => {
        clearTimeout(mostrarDeshacer.t); V.undo.hidden = true;
        const nueva = agregarFila(hoja, false, null, Math.min(indice, S[hoja].length));
        if (!nueva) return;
        // la fila vuelve con sus datos: se reemplaza la fila en blanco recién creada
        Object.assign(nueva, { v: row.v, estado: row.estado, qid: row.qid, sid: row.sid, err: row.err, env: row.env, prec: row.prec, rev: row.rev });
        const hv = vistaH(hoja), ref = hv.refs.get(nueva.rid);
        EDITABLES[hoja].forEach((c) => { if (c.tipo === 'select') fijarSelect(ref.ctl[c.k], c, nueva.v[c.k]); else ref.ctl[c.k].value = nueva.v[c.k]; });
        pintarFila(hoja, nueva); asegurarFinal(hoja); programarConteo(); guardarPronto();
      } }, 'Deshacer'));
    V.undo.hidden = false;
    mostrarDeshacer.t = setTimeout(() => { if (V) V.undo.hidden = true; }, 5000);
  }

  function quitarEnviadas() {
    const hoja = S.hoja, hv = vistaH(hoja);
    const fuera = S[hoja].filter((r) => r.estado === 'enviada');
    if (!fuera.length) return;
    fuera.forEach((r) => { const ref = hv.refs.get(r.rid); if (ref) ref.tr.remove(); hv.refs.delete(r.rid); });
    S[hoja] = S[hoja].filter((r) => r.estado !== 'enviada');
    while (S[hoja].length < 3) agregarFila(hoja);
    asegurarFinal(hoja); renumerar(hoja); programarConteo(); guardarPronto();
    ui.toast('Se quitaron ' + fuera.length + (fuera.length === 1 ? ' fila enviada.' : ' filas enviadas.'));
  }

  /* ---------------- Teclado y foco ---------------- */
  function posicion(ctl) {
    const tr = ctl.closest('tr'), hoja = S.hoja, ri = S[hoja].indexOf(tr.__row), cols = EDITABLES[hoja];
    return { tr, row: tr.__row, hoja, ri, ci: cols.findIndex((c) => c.k === ctl.dataset.k), cols };
  }
  function controlDe(hoja, ri, ci) {
    const row = S[hoja][ri], hv = vistaH(hoja), ref = row && hv.refs.get(row.rid);
    return ref ? ref.ctl[EDITABLES[hoja][ci].k] : null;
  }
  function enfocar(ctl, seleccionar) {
    if (!ctl || ctl.disabled) return false;
    ctl.focus();
    if (seleccionar && ctl.tagName === 'INPUT') { try { ctl.select(); } catch (e) { /* nada */ } }
    return document.activeElement === ctl;
  }
  /* Mueve el foco; salta las celdas bloqueadas (filas ya enviadas) en la dirección indicada. */
  function mover(hoja, ri, ci, dr, dc) {
    const cols = EDITABLES[hoja];
    for (let guarda = 0; guarda < MAX_FILAS * cols.length; guarda++) {
      if (ri < 0 || ci < 0 || ci >= cols.length) return false;
      if (ri >= S[hoja].length) {
        const n = agregarFila(hoja); if (!n) return false;
      }
      if (enfocar(controlDe(hoja, ri, ci), true)) return true;
      ri += dr; ci += dc;
    }
    return false;
  }

  function alBorde(ctl, dir) {
    if (ctl.tagName !== 'INPUT') return true;
    const a = ctl.selectionStart, b = ctl.selectionEnd, n = ctl.value.length; if (a === null) return true;
    if (a === 0 && b === n) return true;      // celda "seleccionada" (como al llegar con Tab o Enter): las flechas la cambian
    return dir < 0 ? a === 0 && b === 0 : a === n && b === n;
  }

  function alTeclear(ev) {
    const ctl = ev.target; if (!ctl.dataset || !ctl.dataset.k || ev.isComposing) return;
    const p = posicion(ctl); if (p.ci < 0) return;
    const { hoja, ri, ci, cols, row } = p, k = ev.key;
    if (ev.altKey && (k === 'g' || k === 'G')) { ev.preventDefault(); gpsFila(hoja, row); return; }
    if ((ev.ctrlKey || ev.metaKey) && (k === 'd' || k === 'D')) { ev.preventDefault(); duplicarFila(hoja, row); return; }
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (k === 'Enter') { ev.preventDefault(); mover(hoja, ri + (ev.shiftKey ? -1 : 1), ci, ev.shiftKey ? -1 : 1, 0); return; }
    if (k === 'Tab') {
      if (ev.shiftKey) {
        if (ri === 0 && ci === 0) return;                       // sale de la planilla
        ev.preventDefault();
        if (ci > 0) mover(hoja, ri, ci - 1, 0, -1); else mover(hoja, ri - 1, cols.length - 1, -1, -1);
      } else {
        ev.preventDefault();
        if (ci < cols.length - 1) mover(hoja, ri, ci + 1, 0, 1); else mover(hoja, ri + 1, 0, 1, 1);
      }
      return;
    }
    if (k === 'ArrowDown' || k === 'ArrowUp') { ev.preventDefault(); mover(hoja, ri + (k === 'ArrowDown' ? 1 : -1), ci, k === 'ArrowDown' ? 1 : -1, 0); return; }
    if (k === 'ArrowLeft' && alBorde(ctl, -1) && ci > 0) { ev.preventDefault(); mover(hoja, ri, ci - 1, 0, -1); return; }
    if (k === 'ArrowRight' && alBorde(ctl, 1) && ci < cols.length - 1) { ev.preventDefault(); mover(hoja, ri, ci + 1, 0, 1); return; }
    if ((k === 'Delete' || k === 'Backspace') && ctl.tagName === 'SELECT' && !ctl.disabled) { ev.preventDefault(); liberar(row); escribir(hoja, row, ctl.dataset.k, '', true); row.t.add(ctl.dataset.k); despuesDeEditar(hoja, row); }
  }

  /* ---------------- Eventos de las celdas (delegados en el tbody) ---------------- */
  function alEscribir(ev) {
    const ctl = ev.target; if (!ctl.dataset || !ctl.dataset.k) return;
    const tr = ctl.closest('tr'); if (!tr || !tr.__row) return;
    const row = tr.__row, hoja = S.hoja, col = colDe(hoja, ctl.dataset.k);
    if (bloqueada(row)) return;
    liberar(row);
    if (col.tipo === 'fecha' && ev.inputType && ev.inputType.startsWith('insert') && /^[\d/]+$/.test(ctl.value)) {
      const d = ctl.value.replace(/\D/g, '').slice(0, 8);
      const f = d.slice(0, 2) + (d.length > 2 ? '/' : '') + d.slice(2, 4) + (d.length > 4 ? '/' : '') + d.slice(4, 8);
      if (f !== ctl.value) ctl.value = f;
    }
    escribir(hoja, row, col.k, ctl.value, false);
    if (col.tipo === 'select') row.t.add(col.k);
    despuesDeEditar(hoja, row);
    actualizarTip(ctl);
  }
  function alConfirmar(ev) {
    const ctl = ev.target; if (!ctl.dataset || !ctl.dataset.k) return;
    const tr = ctl.closest('tr'); if (!tr || !tr.__row) return;
    const row = tr.__row, hoja = S.hoja, col = colDe(hoja, ctl.dataset.k);
    if (bloqueada(row)) return;
    if (col.tipo === 'fecha') { const f = parseFecha(ctl.value); if (f && f.txt !== ctl.value) { ctl.value = f.txt; row.v.fecha = f.txt; } }
    row.t.add(col.k); pintarFila(hoja, row); programarConteo(); guardarPronto();
  }
  function alSalir(ev) {
    const ctl = ev.target; if (!ctl.dataset || !ctl.dataset.k) return;
    const tr = ctl.closest('tr'); if (!tr || !tr.__row) return;
    const row = tr.__row;
    if (!bloqueada(row)) { row.t.add(ctl.dataset.k); pintarFila(S.hoja, row); }
    ocultarTip();
  }
  function alEntrar(ev) {
    const ctl = ev.target; if (!ctl.dataset || !ctl.dataset.k) return;
    actualizarTip(ctl);
  }

  /* ---------------- Aviso de ayuda en la celda ---------------- */
  let tipEl = null;
  function ocultarTip() { if (tipEl) tipEl.hidden = true; }
  function actualizarTip(ctl) {
    const tr = ctl.closest('tr'); if (!tr || !tr.__row) return;
    const row = tr.__row, st = row.st, k = ctl.dataset.k;
    const p = st && st.problemas.find((x) => x.k === k);
    if (!p || !mostrarProblema(row, k) || bloqueada(row)) { ocultarTip(); return; }
    if (!tipEl) { tipEl = el('div', { class: 'pl-tip', role: 'status', hidden: true }); document.body.appendChild(tipEl); }
    tipEl.textContent = '';
    tipEl.append(ui.shapeSvg('cuadrado', '#fff', 11), el('span', null, p.msg));
    tipEl.hidden = false;
    const td = ctl.closest('td'), r = td.getBoundingClientRect(), vv = window.visualViewport, vh = vv ? vv.height : window.innerHeight;
    const w = tipEl.offsetWidth, h = tipEl.offsetHeight;
    let top = r.bottom + 6; if (top + h > vh - 8) top = Math.max(8, r.top - h - 6);
    tipEl.style.top = top + 'px'; tipEl.style.left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8)) + 'px';
  }

  /* ---------------- Pegar desde Excel / Google Sheets ---------------- */
  function parseTSV(texto) {
    const filas = []; let fila = [], cel = '', q = false, i = 0;
    texto = texto.replace(/\r\n?/g, '\n');
    while (i < texto.length) {
      const c = texto[i];
      if (q) { if (c === '"' && texto[i + 1] === '"') { cel += '"'; i += 2; continue; } if (c === '"') { q = false; i++; continue; } cel += c; i++; continue; }
      if (c === '"' && cel === '') { q = true; i++; continue; }
      if (c === '\t') { fila.push(cel); cel = ''; } else if (c === '\n') { fila.push(cel); filas.push(fila); fila = []; cel = ''; } else cel += c;
      i++;
    }
    if (cel !== '' || fila.length) { fila.push(cel); filas.push(fila); }
    while (filas.length && filas[filas.length - 1].every((x) => x === '')) filas.pop();   // Excel agrega un salto final
    return filas;
  }
  function pareceEncabezado(fila, cols) {
    const rot = new Set(cols.map((c) => U.norm(c.rot)).concat(cols.map((c) => U.norm(c.corto || ''))));
    return fila.filter((x) => rot.has(U.norm(String(x).replace(/\(.*\)/, '')))).length >= 2;
  }
  function alPegar(ev) {
    const ctl = ev.target; if (!ctl.dataset || !ctl.dataset.k) return;
    const texto = (ev.clipboardData || window.clipboardData) ? (ev.clipboardData || window.clipboardData).getData('text') : '';
    if (!texto) return;
    const multi = /[\t\n]/.test(texto.replace(/\r?\n$/, ''));
    const p = posicion(ctl); if (p.ci < 0) return;
    if (!multi) {
      /* Un solo valor: en las listas se convierte aquí; en los demás campos pega el navegador. */
      if (ctl.tagName === 'SELECT' && !p.row.estado) { ev.preventDefault(); liberar(p.row); escribir(p.hoja, p.row, ctl.dataset.k, texto.trim(), true); p.row.t.add(ctl.dataset.k); despuesDeEditar(p.hoja, p.row); }
      return;
    }
    ev.preventDefault();
    pegarBloque(p.hoja, p.ri, p.ci, parseTSV(texto));
  }
  function pegarBloque(hoja, ri, ci, matriz) {
    const cols = EDITABLES[hoja];
    if (matriz.length > 1 && pareceEncabezado(matriz[0], cols)) matriz = matriz.slice(1);
    if (!matriz.length) return;
    const filas = S[hoja]; let omitidas = 0, cortadas = 0, hechas = 0;
    while (filas.length < ri + matriz.length && filas.length < MAX_FILAS) agregarFila(hoja, false);
    matriz.forEach((celdas, i) => {
      const row = filas[ri + i];
      if (!row) { cortadas++; return; }
      if (bloqueada(row)) { omitidas++; return; }
      liberar(row);
      celdas.forEach((txt, j) => { const c = cols[ci + j]; if (c) { escribir(hoja, row, c.k, txt, true); row.t.add(c.k); } });
      row.rev = true; hechas++;
      pintarFila(hoja, row);
    });
    asegurarFinal(hoja); programarConteo(); guardarPronto();
    const extra = (omitidas ? ' Se omitieron ' + omitidas + ' ya enviadas.' : '') + (cortadas ? ' Se ignoraron ' + cortadas + ' por el límite de ' + MAX_FILAS + ' filas.' : '');
    ui.toast('Pegadas ' + hechas + (hechas === 1 ? ' fila.' : ' filas.') + extra, extra ? 'warn' : '');
    fijarMensaje('Pegadas ' + hechas + (hechas === 1 ? ' fila' : ' filas') + '. Revise la columna Estado.', 6000);
  }

  /* ---------------- GPS ---------------- */
  function aplicarGps(hoja, row, p) {
    liberar(row);
    escribir(hoja, row, 'lat', p.lat.toFixed(5), { gps: true }); escribir(hoja, row, 'lng', p.lng.toFixed(5), { gps: true });
    row.v.lat = p.lat.toFixed(5); row.v.lng = p.lng.toFixed(5); row.prec = p.precision || null;
    const ref = vistaH(hoja).refs.get(row.rid); ref.ctl.lat.value = row.v.lat; ref.ctl.lng.value = row.v.lng;
    row.t.add('lat'); row.t.add('lng');
    pintarFila(hoja, row);
  }
  function gpsFila(hoja, row) {
    if (bloqueada(row)) { ui.toast('Esa fila ya fue enviada.', 'warn'); return; }
    const ref = vistaH(hoja).refs.get(row.rid), b = ref.td.gps.querySelector('button');
    b.classList.add('is-busy'); b.disabled = true;
    C.ubicacion({ alta: true, timeout: 25000 }).then((p) => {
      aplicarGps(hoja, row, p); asegurarFinal(hoja); programarConteo(); guardarPronto();
      ui.toast('Ubicación puesta en la fila ' + (S[hoja].indexOf(row) + 1) + ' (± ' + U.fmt(p.precision) + ' m).' + (p.precision > 50 ? ' La precisión es baja: salga a cielo abierto y repita.' : ''), p.precision > 50 ? 'warn' : '');
    }).catch((e) => ui.toast(e.message, 'warn')).finally(() => { b.classList.remove('is-busy'); b.disabled = false; });
  }
  function gpsTodas(btn) {
    const hoja = S.hoja;
    const destino = S[hoja].filter((r) => !bloqueada(r) && !(r.st || validar(hoja, r)).vacia && (vacioTxt(r.v.lat) || vacioTxt(r.v.lng)));
    if (!destino.length) { ui.toast('No hay filas con datos que les falte la ubicación.', 'warn'); return; }
    btn.disabled = true; btn.classList.add('is-busy');
    C.ubicacion({ alta: true, timeout: 25000 }).then((p) => {
      destino.forEach((r) => aplicarGps(hoja, r, p));
      programarConteo(); guardarPronto();
      ui.toast('Ubicación puesta en ' + destino.length + (destino.length === 1 ? ' fila' : ' filas') + ' (± ' + U.fmt(p.precision) + ' m).' + (p.precision > 50 ? ' La precisión es baja: salga a cielo abierto y repita.' : ''), p.precision > 50 ? 'warn' : '');
    }).catch((e) => ui.toast(e.message, 'warn')).finally(() => { btn.disabled = false; btn.classList.remove('is-busy'); });
  }

  /* ---------------- Envío por la cola de campo ---------------- */
  function construirRegistro(hoja, row, st) {
    const v = row.v;
    if (hoja === 'muestras') {
      row.sid = row.sid || C.idMuestra();
      const f = parseFecha(v.fecha), hoy = C.hoy();
      const fecha = f.iso === hoy ? new Date().toISOString() : new Date(f.y, f.m - 1, f.d, 12).toISOString();
      const h2 = num(v.hg2), ht = vacioTxt(v.hgt) ? null : num(v.hgt), lr = st.lugar, txt = v.lugar.trim();
      const notas = (PREF + v.notas.trim()).trim().slice(0, MAX_NOTAS);
      const payload = {
        id: row.sid, fecha,
        pasivo_id: lr && lr.tipo === 'pasivo' ? lr.id : '', operador_id: lr ? (lr.tipo === 'operador' ? lr.id : (lr.operador_id || '')) : '',
        lugar: (lr ? lr.nombre : txt).slice(0, MAX_LUGAR), lat: num(v.lat), lng: num(v.lng), precision_m: row.prec ? Math.round(row.prec) : null,
        matriz: v.matriz, volumen_m3: null, hg2_ppb: r2(h2), hg_total_ppb: ht === null ? null : r2(ht), ch3hg_ppb: null, nivel2: false, semaforo: st.nivel,
        lote_reactivo: v.lote.trim().slice(0, 40), confirmado_lab: false, foto: null, notas
      };
      return { cola: { tipo: 'muestra', etiqueta: payload.lugar, detalle: 'Planilla · ' + MATRIZ_TXT[v.matriz] + ' · Hg2+ ' + coma(r2(h2)) + ' ppb', semaforo: st.nivel, payload } };
    }
    row.sid = row.sid || C.idFicha('PA');
    const hoy = C.hoy(), vol = vacioTxt(v.volumen) ? null : num(v.volumen), estr = v.estructura || 'desconocida', uso = v.uso || 'desconocido';
    const nombre = v.nombre.trim().slice(0, MAX_LUGAR), opId = st.op ? st.op.id : '';
    const notas = vacioTxt(v.notas) ? '' : (PREF + v.notas.trim()).slice(0, MAX_NOTAS);
    const local = { id: row.sid, operador_id: opId || null, nombre, tipo: v.tipo, lat: num(v.lat), lng: num(v.lng), volumen_m3: vol, estructura: estr, uso_hg: uso, actualizado: hoy, deteccion: 'visita de campo' };
    const fila = { id: row.sid, operador_id: opId, nombre, tipo: v.tipo, lat: local.lat, lng: local.lng, volumen_m3: vol, estructura: (cfg().estructura[estr] || {}).label || '', uso_hg: uso, actualizado: hoy, deteccion: 'visita de campo' };
    if (notas) fila.notas = notas;   // el servidor aún no tiene columna de notas en Pasivos: se ignora allá y queda en la planilla
    return { cola: { tipo: 'ficha', tabla: 'pasivos', etiqueta: nombre, detalle: 'Alta · ' + row.sid + ' · Planilla', payload: fila, local }, local };
  }

  async function enviar() {
    if (!V || V.enviando) return;
    const hoja = S.hoja;
    const todas = S[hoja].filter((r) => !(r.st || validar(hoja, r)).vacia && !bloqueada(r));
    const listas = todas.filter((r) => validar(hoja, r).listo);
    if (todas.length > listas.length) {
      /* Se muestran en rojo todos los problemas para que se corrijan. */
      todas.forEach((r) => { r.rev = true; pintarFila(hoja, r); });
    }
    if (!listas.length) { fijarMensaje('Ninguna fila está lista: complete lo marcado en rojo.', 6000); irAlPrimerProblema(hoja); return; }

    const qids = []; let fallo = '';
    for (const row of listas) {
      const st = validar(hoja, row);
      try {
        const r = construirRegistro(hoja, row, st);
        if (row.qid) C.quitarDeCola(row.qid);
        const it = C.encolar(r.cola);
        row.qid = it.qid; row.estado = 'cola'; row.err = ''; qids.push(it.qid);
        if (r.local) C.upsertLocal('pasivos', r.local);
        if (hoja === 'muestras' && row.v.lote.trim()) C.guardarLote(row.v.lote.trim());
        pintarFila(hoja, row);
      } catch (e) { row.estado = 'error'; row.err = e.message; fallo = e.message; pintarFila(hoja, row); break; }
    }
    if (hoja === 'pasivos' && qids.length) C.guardarBase();
    guardarYa(); programarConteo();
    if (!qids.length) { ui.toast(fallo || 'No se pudo guardar en la cola.', 'warn'); return; }
    if (fallo) ui.toast(fallo, 'warn');

    V.lote = { qids, hoja }; V.enviando = true; V.mensaje = ''; programarConteo();
    try { await C.enviarCola(); } catch (e) { /* el estado de cada fila queda en la cola */ }
    sincronizarCola();
    if (V) { V.enviando = false; finalizarLote(); }
  }
  function finalizarLote() {
    const lote = V.lote; V.lote = null; if (!lote) return;
    let ok = 0, err = 0, cola = 0;
    S[lote.hoja].forEach((r) => { if (r.qid && lote.qids.includes(r.qid)) { if (r.estado === 'enviada') ok++; else if (r.estado === 'error') err++; else cola++; } });
    let msg;
    if (cola) msg = (ok ? ok + ' enviadas. ' : '') + cola + (cola === 1 ? ' fila quedó' : ' filas quedaron') + ' guardadas en la cola: se envían solas cuando haya señal.' + (err ? ' ' + err + ' con error.' : '');
    else if (err) msg = ok + ' enviadas y ' + err + (err === 1 ? ' con error' : ' con error') + ': revise la columna Estado, corrija y vuelva a enviar.';
    else msg = 'Listo: ' + ok + (ok === 1 ? ' fila enviada.' : ' filas enviadas.');
    ui.toast(msg, err ? 'warn' : '');
    fijarMensaje(msg, 9000);
    guardarYa(); programarConteo();
    if (err) irAlPrimerProblema(lote.hoja, 'error');
  }
  function irAlPrimerProblema(hoja, modo) {
    const row = S[hoja].find((r) => { const st = r.st || validar(hoja, r); return modo === 'error' ? r.estado === 'error' : (!st.vacia && !st.listo && !bloqueada(r)); });
    const ref = row && vistaH(hoja).refs.get(row.rid); if (!ref) return;
    ref.tr.scrollIntoView({ block: 'center', behavior: REDUCIDO() ? 'auto' : 'smooth' });
  }

  /* Refleja en las filas lo que pasa en la cola (envío, reintento, errores). */
  let sincPend = false;
  function sincronizarCola() {
    ['muestras', 'pasivos'].forEach((h) => {
      let cambio = false;
      S[h].forEach((row) => {
        if (!row.qid || row.estado === 'enviada') return;
        const it = C.itemDeCola(row.qid);
        let nuevo = row.estado, err = row.err;
        if (!it) { nuevo = ''; row.qid = null; err = ''; }
        else if (it.estado === 'enviado') { nuevo = 'enviada'; err = ''; }
        else if (it.estado === 'error') { nuevo = 'error'; err = it.error || 'El servidor no aceptó la fila.'; }
        else if (it.estado === 'enviando') { nuevo = 'enviando'; err = ''; }
        else { nuevo = 'cola'; err = it.error || ''; }
        if (nuevo !== row.estado || err !== row.err) {
          row.estado = nuevo; row.err = err; if (nuevo === 'enviada') row.env = Date.now();
          cambio = true; pintarFila(h, row);
        }
      });
      if (cambio) guardarPronto();
    });
    programarConteo();
  }
  G4G.bus.on('cola:changed', () => {
    if (sincPend) return; sincPend = true;
    requestAnimationFrame(() => { sincPend = false; sincronizarCola(); });
  });
  G4G.bus.on('base:changed', reindexarBase);

  /* ---------------- CSV (plantilla y exportación) ---------------- */
  function csvCelda(v) {
    let s = String(v == null ? '' : v);
    /* Una celda que empieza con = + - @ podría ejecutarse como fórmula en Excel: se neutraliza (salvo los números). */
    if (/^[=+\-@\t\r]/.test(s) && !/^[-+]?\d+([.,]\d+)?$/.test(s)) s = "'" + s;
    return /[";\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function cabeceraCsv(hoja) { return EDITABLES[hoja].map((c) => c.rot + (c.sub && c.k !== 'notas' ? ' (' + c.sub.replace(', opcional', '') + ')' : '')); }
  function descargarCsv(nombre, lineas) {
    U.download(nombre, 'text/csv;charset=utf-8', '﻿' + lineas.map((l) => l.map(csvCelda).join(';')).join('\r\n') + '\r\n');
  }
  function plantillaCsv() { descargarCsv('aurum80-planilla-' + S.hoja + '-plantilla.csv', [cabeceraCsv(S.hoja)]); ui.toast('Plantilla descargada. Llénela en Excel y péguela aquí.'); }
  function exportarCsv() {
    const hoja = S.hoja, cols = EDITABLES[hoja];
    const filas = S[hoja].filter((r) => !(r.st || validar(hoja, r)).vacia);
    if (!filas.length) { ui.toast('La hoja está vacía: no hay nada que exportar.', 'warn'); return; }
    const head = cabeceraCsv(hoja).concat(hoja === 'muestras' ? ['Resultado'] : [], ['Estado']);
    const lineas = [head].concat(filas.map((r) => {
      const st = r.st || validar(hoja, r), e = estadoUI(r, st);
      const datos = cols.map((c) => {
        let t = r.v[c.k] || '';
        if (c.tipo === 'select') { const o = c.opc().find((x) => x[0] === t); t = o ? o[1] : t; }
        else if (c.tipo === 'num' || c.tipo === 'coord') { const n = num(t); if (n !== null) t = coma(n); }
        return t;
      });
      return datos.concat(hoja === 'muestras' ? [st.nivel ? cfg().semaforoMuestra[st.nivel].label : ''] : [], [textoEstado(hoja, r, st, e)]);
    }));
    descargarCsv('aurum80-planilla-' + hoja + '-' + C.hoy() + '.csv', lineas);
    ui.toast('Se exportaron ' + filas.length + (filas.length === 1 ? ' fila.' : ' filas.'));
  }

  /* ---------------- Vista ---------------- */
  function tarjeta(clase, icono, rot) {
    const n = el('strong', { class: 'pl-card__n' }, '0');
    return { n, nodo: el('div', { class: 'pl-card ' + clase }, el('span', { class: 'pl-card__ico' }, icono), el('span', { class: 'pl-card__tx' }, n, el('span', { class: 'pl-card__l' }, rot))) };
  }
  /* 'corto' es el rótulo para pantallas angostas (el completo va en aria-label). */
  function boton(clase, icono, txt, onclick, extra, corto) {
    return el('button', Object.assign({ type: 'button', class: 'pl-btn ' + clase, onclick }, corto ? { 'aria-label': txt } : {}, extra || {}), icono ? ico(icono, 20) : null,
      corto ? [el('span', { class: 'pl-t-l' }, txt), el('span', { class: 'pl-t-c' }, corto)] : el('span', null, txt));
  }

  function ayuda() {
    return el('div', { class: 'pl-ayuda', id: 'pl-ayuda', hidden: true },
      el('h3', null, '¿Cómo se usa?'),
      el('ol', { class: 'pl-pasos' },
        [['Toque una celda y escriba.', 'Tab pasa a la derecha, Enter baja una fila y las flechas se mueven como en Excel. Se acepta coma o punto decimal.'],
         ['Pegue desde Excel.', 'Copie varias celdas en Excel o Google Sheets y pegue en una celda de aquí: se rellenan filas y columnas hacia abajo y a la derecha, en el orden de las columnas.'],
         ['Revise el Estado.', 'Cada fila dice si está Lista, qué le falta o si hubo un error. Las celdas en rojo explican qué corregir.'],
         ['Toque Enviar.', 'Se envían las filas listas. Sin señal quedan guardadas en el teléfono y se mandan solas cuando vuelva la conexión.']]
          .map(([t, d]) => el('li', null, el('strong', null, t), ' ', d))),
      el('p', { class: 'muted small' }, 'Atajos: Alt+G pone el GPS en la fila, Ctrl+D la duplica. Todo lo que escribe queda guardado en el teléfono aunque cierre la aplicación. En esta hoja los valores se marcan como [Planilla] en las notas para distinguirlos de una lectura con tubo.'));
  }

  function render(host) {
    if (!S.muestras.length && !S.pasivos.length) cargarBorrador();
    reindexarBase();
    const hojaVista = (h) => ({ wrap: el('div', { class: 'pl-wrap', id: 'pl-wrap-' + h, tabindex: '-1', hidden: S.hoja !== h }), tbody: null, tabla: null, refs: new Map() });
    V = { hojas: { muestras: hojaVista('muestras'), pasivos: hojaVista('pasivos') }, lote: null, enviando: false, mensaje: '', n: {}, segN: {}, segBtn: {} };

    const tFilas = tarjeta('pl-card--filas', ico('tabla', 22), 'Filas'), tListas = tarjeta('pl-card--listas', ico('miestado', 22), 'Listas'),
      tAlerta = tarjeta('pl-card--alerta', ui.shapeSvg('triangulo', '#B97A00', 20), 'Con alerta'), tEnv = tarjeta('pl-card--env', ico('enviar', 22), 'Enviadas');
    V.n = { filas: tFilas.n, listas: tListas.n, alerta: tAlerta.n, enviadas: tEnv.n };

    const seg = el('div', { class: 'pl-seg', role: 'tablist', 'aria-label': 'Hoja de la planilla' }, ['muestras', 'pasivos'].map((h) => {
      V.segN[h] = el('span', { class: 'pl-seg__n', hidden: true }, '0');
      return (V.segBtn[h] = el('button', { type: 'button', role: 'tab', class: 'pl-seg__btn' + (S.hoja === h ? ' is-on' : ''), 'aria-selected': String(S.hoja === h), onclick: () => cambiarHoja(h) },
        ico(HOJAS[h].icono, 20), el('span', null, HOJAS[h].titulo), V.segN[h]));
    }));

    V.cont = el('span', { class: 'pl-cont', role: 'status', 'aria-live': 'polite' }, '');
    V.btnQuitar = boton('', 'miestado', 'Quitar enviadas', quitarEnviadas);
    V.dlLugares = el('datalist', { id: 'pl-dl-lugares' }); V.dlOps = el('datalist', { id: 'pl-dl-operadores' });
    llenarLista(V.dlLugares, LUG.etiquetas); llenarLista(V.dlOps, OPS.etiquetas);
    V.fechaNativa = el('input', { type: 'date', class: 'pl-fecha-nativa', tabindex: '-1', 'aria-hidden': 'true', max: C.hoy() });
    V.undo = el('div', { class: 'pl-undo', role: 'status', hidden: true });
    V.msg = el('p', { class: 'pl-send__msg', role: 'status', 'aria-live': 'polite' });
    V.prog = el('span', { class: 'pl-prog__bar' });
    V.btnEnviar = el('button', { type: 'button', class: 'btn btn--primary pl-send__btn', onclick: enviar });
    const btnGps = boton('', 'gps', 'Poner GPS a todas', (ev) => gpsTodas(ev.currentTarget), { title: 'Pone su ubicación actual en las filas con datos que no tienen coordenadas' }, 'GPS a todas');
    const btnAyuda = boton('pl-btn--ghost', 'info', '¿Cómo se usa?', () => { const a = $id('pl-ayuda'); a.hidden = !a.hidden; btnAyuda.setAttribute('aria-expanded', String(!a.hidden)); }, { 'aria-expanded': 'false', 'aria-controls': 'pl-ayuda' });
    const $id = (i) => document.getElementById(i);

    const wrapper = el('div', { class: 'pl' },
      el('div', { class: 'pl-top' },
        el('div', { class: 'pl-top__t' }, el('h2', { class: 'c-h' }, 'Planilla'), btnAyuda, el('p', { class: 'muted pl-top__s' }, 'Llene varias filas como en Excel. Funciona también sin señal.')),
        el('div', { class: 'pl-cards' }, tFilas.nodo, tListas.nodo, tAlerta.nodo, tEnv.nodo)),
      ayuda(),
      seg,
      el('div', { class: 'pl-bar' },
        el('div', { class: 'pl-bar__main' },
          boton('pl-btn--acento', 'mas', 'Agregar fila', () => { const row = agregarFila(S.hoja); if (row) { programarConteo(); guardarPronto(); const ref = vistaH(S.hoja).refs.get(row.rid); ref.tr.scrollIntoView({ block: 'nearest' }); enfocar(ref.ctl[EDITABLES[S.hoja][0].k], false); } }),
          boton('', 'mas', 'Agregar 5 filas', () => { let n = 0; for (let i = 0; i < 5; i++) if (agregarFila(S.hoja)) n++; if (n) { programarConteo(); guardarPronto(); } }, null, '5 filas'),
          btnGps),
        el('div', { class: 'pl-bar__sub' },
          el('details', { class: 'pl-mas' }, el('summary', null, ico('menu', 20), el('span', null, 'Más opciones')),
            el('div', { class: 'pl-mas__in' }, V.btnQuitar, boton('', 'tramites', 'Plantilla CSV', plantillaCsv), boton('', 'descargar', 'Exportar a CSV', exportarCsv))),
          V.cont)),
      V.hojas.muestras.wrap, V.hojas.pasivos.wrap,
      el('p', { class: 'muted small pl-pie' }, 'Cada fila de Muestras es un tamizaje de campo: no reemplaza al laboratorio acreditado.'),
      V.dlLugares, V.dlOps, V.fechaNativa,
      V.undo,
      el('div', { class: 'pl-send' }, el('div', { class: 'pl-prog', hidden: true }, V.prog), V.msg, V.btnEnviar));
    host.appendChild(wrapper);

    /* Eventos delegados: una sola vez por tabla. */
    ['muestras', 'pasivos'].forEach((h) => {
      const w = V.hojas[h].wrap;
      w.addEventListener('input', alEscribir); w.addEventListener('change', alConfirmar);
      w.addEventListener('focusin', alEntrar); w.addEventListener('focusout', alSalir);
      w.addEventListener('keydown', alTeclear); w.addEventListener('paste', alPegar);
      w.addEventListener('scroll', () => { if (document.activeElement && w.contains(document.activeElement) && document.activeElement.dataset && document.activeElement.dataset.k) actualizarTip(document.activeElement); else ocultarTip(); }, { passive: true });
      w.addEventListener('click', (ev) => {
        const b = ev.target.closest('button[data-act]'); if (!b) return;
        const tr = b.closest('tr'), row = tr.__row, act = b.dataset.act;
        if (act === 'gps') gpsFila(h, row);
        else if (act === 'dup') duplicarFila(h, row);
        else if (act === 'del') borrarFila(h, row);
        else if (act === 'cal') abrirCalendario(h, row);
      });
    });
    V.fechaNativa.addEventListener('change', () => {
      const t = V.fechaTarget; if (!t || !V.fechaNativa.value) return;
      const f = parseFecha(V.fechaNativa.value); if (!f) return;
      if (bloqueada(t.row)) return;
      liberar(t.row); escribir(t.hoja, t.row, 'fecha', f.txt, true); t.row.t.add('fecha'); despuesDeEditar(t.hoja, t.row);
    });

    construirTabla(S.hoja);
    sincronizarCola();
    contar();
  }

  function abrirCalendario(hoja, row) {
    if (bloqueada(row)) { ui.toast('Esa fila ya fue enviada.', 'warn'); return; }
    V.fechaTarget = { hoja, row };
    const f = parseFecha(row.v.fecha);
    V.fechaNativa.value = f ? f.iso : C.hoy();
    try { if (V.fechaNativa.showPicker) V.fechaNativa.showPicker(); else V.fechaNativa.click(); } catch (e) { try { V.fechaNativa.click(); } catch (e2) { /* nada */ } }
  }

  function cambiarHoja(h) {
    if (!V || S.hoja === h) return;
    S.hoja = h; ocultarTip();
    ['muestras', 'pasivos'].forEach((x) => {
      V.hojas[x].wrap.hidden = x !== h;
      V.segBtn[x].classList.toggle('is-on', x === h); V.segBtn[x].setAttribute('aria-selected', String(x === h));
    });
    if (!V.hojas[h].tbody) construirTabla(h);
    V.mensaje = ''; contar(); guardarPronto();
  }

  C.registrarVista('planilla', { subtitulo: 'Varias filas a la vez', render });
  /* Para pruebas y para otras pestañas. */
  C.planilla = { estado: () => S, validar, parseTSV, num, parseFecha };
})();
