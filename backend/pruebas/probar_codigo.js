/* Arnes de pruebas para backend/Codigo.gs (Google Apps Script), sin dependencias.
   Carga Codigo.gs en un contexto "vm" con mocks minimos de SpreadsheetApp, CacheService, LockService,
   Utilities, ContentService, DriveApp y PropertiesService (hojas en memoria) y prueba el API por doPost.

   Uso (desde la raiz del repositorio):   node backend/pruebas/probar_codigo.js
   Sale con codigo 0 si todo pasa y 1 si algo falla. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const CODIGO = fs.readFileSync(process.env.CODIGO_GS || path.join(__dirname, '..', 'Codigo.gs'), 'utf8');   // CODIGO_GS: otra copia (p. ej. para pruebas de mutacion)

/* ---------------------------------------------------------------- mocks */
class Rango {
  constructor(hoja, r, c, nr, nc) { this.h = hoja; this.r = r; this.c = c; this.nr = nr; this.nc = nc; }
  getValues() {
    const out = [];
    for (let i = 0; i < this.nr; i++) {
      const fila = [];
      for (let j = 0; j < this.nc; j++) {
        const v = (this.h.filas[this.r - 1 + i] || [])[this.c - 1 + j];
        fila.push(v === undefined ? '' : v);
      }
      out.push(fila);
    }
    return out;
  }
  setValues(m) { for (let i = 0; i < m.length; i++) for (let j = 0; j < m[i].length; j++) this.h._set(this.r + i, this.c + j, m[i][j]); return this; }
  setValue(v) { for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) this.h._set(this.r + i, this.c + j, v); return this; }
  setNote() { return this; }
}
class Hoja {
  constructor(nombre) { this.nombre = nombre; this.filas = []; }
  getName() { return this.nombre; }
  _set(r, c, v) {
    while (this.filas.length < r) this.filas.push([]);
    const f = this.filas[r - 1];
    while (f.length < c) f.push('');
    f[c - 1] = v;
  }
  getLastRow() { return this.filas.length; }
  getLastColumn() { return this.filas.reduce((m, f) => Math.max(m, f.length), 0); }
  getDataRange() { return new Rango(this, 1, 1, Math.max(this.getLastRow(), 1), Math.max(this.getLastColumn(), 1)); }
  getRange(r, c, nr, nc) { return new Rango(this, r, c, nr || 1, nc || 1); }
  appendRow(a) { this.filas.push(a.slice()); }
  setFrozenRows() {}
  /* ayudas de prueba */
  objetos() {
    if (this.filas.length < 2) return [];
    const cab = this.filas[0].map(String);
    return this.filas.slice(1).map(f => { const o = {}; cab.forEach((k, j) => { o[k] = f[j] === undefined ? '' : f[j]; }); return o; });
  }
}
class Libro {
  constructor() { this.hojas = {}; }
  getSheetByName(n) { return this.hojas[n] || null; }
  insertSheet(n) { this.hojas[n] = new Hoja(n); return this.hojas[n]; }
  getSpreadsheetTimeZone() { return 'America/La_Paz'; }
  hojaCon(n, cab, filas) { const h = this.insertSheet(n); h.appendRow(cab); (filas || []).forEach(f => h.appendRow(f)); return h; }
}

function bytesDe(x) {
  if (typeof x === 'string') return Buffer.from(x, 'utf8');
  return Buffer.from(Array.from(x).map(b => (b + 256) % 256));
}
const aFirmados = buf => Array.from(buf).map(b => (b > 127 ? b - 256 : b));

function crearEntorno(libro) {
  const cache = new Map();
  const props = new Map();
  const archivos = new Map();
  let nArchivo = 0;
  const logs = [];
  const entorno = {
    SpreadsheetApp: { getActiveSpreadsheet: () => libro },
    CacheService: { getScriptCache: () => ({
      get: k => (cache.has(k) ? cache.get(k) : null),
      put: (k, v) => { cache.set(k, String(v)); },
      remove: k => { cache.delete(k); }
    }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: {
      computeHmacSha256Signature: (valor, clave) => aFirmados(crypto.createHmac('sha256', bytesDe(clave)).update(bytesDe(valor)).digest()),
      base64Encode: b => bytesDe(b).toString('base64'),
      base64Decode: s => aFirmados(Buffer.from(s, 'base64')),
      getUuid: () => crypto.randomUUID(),
      newBlob: (datos, tipo, nombre) => ({ getBytes: () => aFirmados(bytesDe(datos)), getContentType: () => tipo || 'text/plain', getName: () => nombre }),
      formatDate: (d, tz, fmt) => {
        const l = new Date(d.getTime() - 4 * 3600 * 1000).toISOString();   // La Paz = UTC-4
        return fmt.indexOf('HH') >= 0 ? l.slice(0, 19) : l.slice(0, 10);
      }
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: s => ({ _s: s, setMimeType() { return this; }, getContent() { return this._s; } })
    },
    DriveApp: {
      createFolder: nombre => ({ getId: () => 'CARPETA-1', createFile: blob => { const id = 'ARCH-' + (++nArchivo); archivos.set(id, blob); return { getId: () => id }; } }),
      getFolderById: id => { if (id !== 'CARPETA-1') throw new Error('no existe'); return { getId: () => id, createFile: blob => { const id2 = 'ARCH-' + (++nArchivo); archivos.set(id2, blob); return { getId: () => id2 }; } }; },
      getFileById: id => { if (!archivos.has(id)) throw new Error('archivo no existe'); return { getBlob: () => archivos.get(id) }; }
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (props.has(k) ? props.get(k) : null), setProperty: (k, v) => { props.set(k, String(v)); } }) },
    console: { log: m => logs.push(String(m)), error: m => logs.push('ERROR ' + (m && m.message || m)), warn() {} }
  };
  return { entorno, cache, props, archivos, logs };
}

/* Un "mundo" completo: libro con datos semilla + Codigo.gs cargado + configurar() ejecutado. */
function nuevoMundo() {
  const libro = new Libro();
  libro.hojaCon('Operadores',
    ['id', 'nombre', 'tipo', 'estado_legal', 'departamento', 'municipio', 'lat', 'lng', 'socios', 'actualizado', 'req_derecho_minero', 'req_nit', 'editado_por', 'editado_en'],
    [
      ['OP-001', 'Cooperativa Demo 001 (simulado)', 'Cooperativa', 'Legal', 'La Paz', 'Guanay', -15.43, -67.5, 120, '2026-01-10', 'si', 'si', '', ''],
      ['OP-002', 'Empresa Demo 002 (simulado)', 'Empresa', 'Legal', 'La Paz', 'Tipuani', -15.58, -67.71, 48, '2026-01-10', 'si', 'no', '', ''],
      ['OP-003', 'Asociacion Demo 003 (simulado)', 'Asociación', 'En proceso', 'La Paz', 'Mapiri', -15.33, -68.14, 74, '2026-01-10', 'si', 'no', '', ''],
      ['OP-005', 'Cooperativa Demo 005 (simulado)', 'Cooperativa', 'No legal', 'La Paz', 'Teoponte', -15.5, -67.83, 22, '2026-01-10', 'no', 'no', '', ''],
      ['OP-006', 'Planta Demo 006 (simulado)', 'Planta de beneficio', 'Irregular', 'Oruro', 'Poopo', -18.36, -66.96, 15, '2026-01-10', 'no', 'no', '', '']
    ]);
  libro.hojaCon('Pasivos',
    ['id', 'operador_id', 'nombre', 'tipo', 'lat', 'lng', 'volumen_m3', 'muestra', 'editado_por', 'editado_en'],
    [['PA-001', 'OP-005', 'Dique Demo (simulado)', 'Dique de colas', -15.51, -67.82, 85000, 'no', '', '']]);
  const amb = crearEntorno(libro);
  const ctx = vm.createContext(amb.entorno);
  vm.runInContext(CODIGO, ctx, { filename: 'Codigo.gs' });
  const m = { libro, ctx, amb };
  m.post = (cuerpo) => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(cuerpo) } }).getContent());
  m.get = (accion) => JSON.parse(ctx.doGet({ parameter: { accion } }).getContent());
  m.hoja = n => libro.getSheetByName(n);
  m.filas = n => (libro.getSheetByName(n) ? libro.getSheetByName(n).objetos() : []);
  m.informe = ctx.configurar();   // crea hojas, usuarios demo, cifra claves
  m.login = (u, c) => m.post({ accion: 'login', usuario: u, clave: c });
  m.token = (u, c) => { const r = m.login(u, c || u); if (!r.ok) throw new Error('login fallo para ' + u + ': ' + JSON.stringify(r)); return r.token; };
  return m;
}

/* ---------------------------------------------------------------- mini corredor de pruebas */
let total = 0, fallos = 0;
const detalleFallos = [];
let grupoActual = '';
function grupo(nombre) { grupoActual = nombre; console.log('\n== ' + nombre); }
function ok(cond, nombre, extra) {
  total++;
  if (cond) console.log('  PASA   ' + nombre);
  else { fallos++; const t = '  FALLA  ' + nombre + (extra !== undefined ? '  -> ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)) : ''); console.log(t); detalleFallos.push(grupoActual + ': ' + nombre); }
}
function igual(real, esperado, nombre) { ok(JSON.stringify(real) === JSON.stringify(esperado), nombre, 'esperado ' + JSON.stringify(esperado) + ' y se obtuvo ' + JSON.stringify(real)); }
function codigo(r) { return r && r.ok === false ? r.codigo : (r && r.ok ? 'ok' : '??'); }

const FOTO = 'data:image/jpeg;base64,' + Buffer.from('foto-de-prueba').toString('base64');
const denunciaBase = (id) => ({ accion: 'denuncia', denuncia: { id, tipo: 'Posible operación sin registro o licencia', descripcion: 'Maquinaria cerca del río', lat: -15.5052, lng: -67.8253, precision: 12, dispositivo: 'disp-1' } });

/* ================================================================ PRUEBAS */
(function main() {
  /* ---------- (0) configurar() y esquema ---------- */
  grupo('0) configurar(): hojas, usuarios demo y claves cifradas');
  {
    const m = nuevoMundo();
    console.log('  informe de diagnostico:\n    ' + m.informe.split('\n').join('\n    '));
    ok(/^OK Operadores/m.test(m.informe) && /^OK Muestras/m.test(m.informe) && /^OK Inscripciones/m.test(m.informe) && /^OK Usuarios/m.test(m.informe), 'diagnostico() dice OK en las hojas');
    const us = m.filas('Usuarios');
    igual(us.map(u => u.usuario + ':' + u.rol), ['Aurum80:funcionario', 'Campo80:tecnico', 'Coop80:operador'], 'se crean Aurum80, Campo80 y Coop80 con su rol');
    igual(us.find(u => u.usuario === 'Coop80').operador_id, 'OP-003', 'Coop80 queda vinculada al operador "En proceso" (OP-003)');
    ok(us.every(u => u.clave_nueva === '' && u.hash && u.sal), 'todas las claves quedaron cifradas (clave_nueva vacia, hash y sal con valor)');
    const cabOp = m.hoja('Operadores').filas[0];
    ok(cabOp.indexOf('origen') >= 0 && cabOp.indexOf('denuncia_codigo') >= 0, 'Operadores recibe las columnas origen y denuncia_codigo');
    const antes = JSON.stringify(m.filas('Usuarios').map(u => u.usuario));
    m.ctx.configurar();
    igual(JSON.stringify(m.filas('Usuarios').map(u => u.usuario)), antes, 'configurar() es repetible: no duplica usuarios');
  }

  /* ---------- (a) login de los 3 roles ---------- */
  grupo('a) login de los 3 roles');
  {
    const m = nuevoMundo();
    const f = m.login('Aurum80', 'Aurum80'), t = m.login('campo80', 'Campo80'), o = m.login('Coop80', 'Coop80');
    ok(f.ok && f.usuario.rol === 'funcionario' && f.token, 'Aurum80 entra como funcionario', f);
    ok(t.ok && t.usuario.rol === 'tecnico' && t.token, 'Campo80 (en minusculas) entra como tecnico', t);
    ok(o.ok && o.usuario.rol === 'operador' && o.usuario.operador_id === 'OP-003', 'Coop80 entra como operador con operador_id OP-003', o);
    ok(!('hash' in f.usuario) && !('sal' in f.usuario), 'la respuesta de login no incluye hash ni sal');
    igual(codigo(m.login('Aurum80', 'mala')), 'credenciales', 'clave incorrecta -> credenciales');
    igual(codigo(m.login('noexiste', 'xxxxxx')), 'credenciales', 'usuario inexistente -> credenciales');
    igual(codigo(m.login('', '')), 'credenciales', 'usuario vacio -> credenciales');
    // operador sin operador_id no puede entrar
    const h = m.hoja('Usuarios'), cab = h.filas[0], fila = cab.map(() => '');
    fila[cab.indexOf('usuario')] = 'SinCoop'; fila[cab.indexOf('rol')] = 'operador'; fila[cab.indexOf('activo')] = 'si'; fila[cab.indexOf('clave_nueva')] = 'SinCoop1';
    h.appendRow(fila);
    m.ctx.procesarClaves();
    igual(codigo(m.login('SinCoop', 'SinCoop1')), 'credenciales', 'un usuario operador SIN operador_id no puede ingresar');
    // usuario inactivo
    const fila2 = cab.map(() => ''); fila2[cab.indexOf('usuario')] = 'Baja'; fila2[cab.indexOf('rol')] = 'funcionario'; fila2[cab.indexOf('activo')] = 'no'; fila2[cab.indexOf('clave_nueva')] = 'Baja123';
    h.appendRow(fila2); m.ctx.procesarClaves();
    igual(codigo(m.login('Baja', 'Baja123')), 'credenciales', 'usuario con activo = no no puede ingresar');
    // bloqueo tras 5 fallos
    for (let i = 0; i < 5; i++) m.login('Campo80', 'mala');
    igual(codigo(m.login('Campo80', 'Campo80')), 'bloqueado', 'tras 5 fallos el usuario queda bloqueado (aun con la clave correcta)');
    // salir
    const tk = m.token('Aurum80');
    ok(m.post({ accion: 'salir', token: tk }).ok, 'salir responde ok');
    igual(codigo(m.post({ accion: 'completo', token: tk })), 'sesion', 'tras salir el token ya no sirve');
    igual(codigo(m.post({ accion: 'inventada' })), 'accion', 'accion desconocida -> accion');
    igual(codigo(JSON.parse(m.ctx.doPost({ postData: { contents: '{no es json' } }).getContent())), 'formato', 'JSON mal formado -> formato');
  }

  /* ---------- (b) permisos por rol en cada accion ---------- */
  grupo('b) cada accion con el rol equivocado -> "permiso"; sin sesion -> "sesion"');
  {
    const m = nuevoMundo();
    const tk = { funcionario: m.token('Aurum80'), tecnico: m.token('Campo80'), operador: m.token('Coop80') };
    const F = ['funcionario'], FT = ['funcionario', 'tecnico'], O = ['operador'];
    const acciones = [
      ['completo', FT, {}], ['guardar', FT, { tabla: 'pasivos', registro: { id: 'PA-001', nombre: 'x' } }],
      ['denuncias', F, {}], ['estadoDenuncia', F, { id: 'X', estado: 'nueva' }], ['aceptarDenuncia', F, { id: 'X' }],
      ['guardarMuestra', FT, { muestra: {} }], ['muestras', FT, {}],
      ['miOperador', O, {}], ['inscribir', O, { programa: 'biorremediacion' }],
      ['inscripciones', F, {}], ['estadoInscripcion', F, { id: 'X', estado: 'pendiente' }],
      ['foto', FT, { id: 'X', tabla: 'muestras' }]
    ];
    for (const [nombre, permitidos, extra] of acciones) {
      const malos = ['funcionario', 'tecnico', 'operador'].filter(r => permitidos.indexOf(r) < 0);
      malos.forEach(rol => igual(codigo(m.post(Object.assign({ accion: nombre, token: tk[rol] }, extra))), 'permiso', nombre + ' con rol ' + rol + ' -> permiso'));
      permitidos.forEach(rol => { const c = codigo(m.post(Object.assign({ accion: nombre, token: tk[rol] }, extra))); ok(c !== 'permiso' && c !== 'sesion', nombre + ' con rol ' + rol + ' pasa el control de permisos (responde ' + c + ')', c); });
      igual(codigo(m.post(Object.assign({ accion: nombre }, extra))), 'sesion', nombre + ' sin token -> sesion');
      igual(codigo(m.post(Object.assign({ accion: nombre, token: 'token-falso' }, extra))), 'sesion', nombre + ' con token falso -> sesion');
    }
    // foto de denuncia: solo funcionario
    igual(codigo(m.post({ accion: 'foto', token: tk.tecnico, id: 'X', tabla: 'denuncias' })), 'permiso', 'foto (tabla denuncias) con rol tecnico -> permiso');
    igual(codigo(m.post({ accion: 'foto', token: tk.tecnico, id: 'X' })), 'permiso', 'foto sin tabla (= denuncias) con rol tecnico -> permiso');
    igual(codigo(m.post({ accion: 'foto', token: tk.operador, id: 'X', tabla: 'muestras' })), 'permiso', 'foto (muestras) con rol operador -> permiso');
    // acciones publicas funcionan sin sesion
    ok(m.post({ accion: 'publico' }).ok && m.post({ accion: 'denunciasMapa' }).ok, 'publico y denunciasMapa responden sin sesion');
    ok(m.post(denunciaBase('PUB-1')).ok, 'denuncia (publica) se recibe sin sesion');
  }

  /* ---------- (c) aislamiento del operador ---------- */
  grupo('c) un operador no ve ni toca a otro operador');
  {
    const m = nuevoMundo();
    // segunda cuenta operador vinculada a OP-001
    const h = m.hoja('Usuarios'), cab = h.filas[0], fila = cab.map(() => '');
    fila[cab.indexOf('usuario')] = 'Coop1'; fila[cab.indexOf('rol')] = 'operador'; fila[cab.indexOf('activo')] = 'si'; fila[cab.indexOf('clave_nueva')] = 'Coop1234'; fila[cab.indexOf('operador_id')] = 'OP-001';
    h.appendRow(fila); m.ctx.procesarClaves();
    const t80 = m.token('Coop80'), t1 = m.token('Coop1', 'Coop1234');
    const a = m.post({ accion: 'miOperador', token: t80 }), b = m.post({ accion: 'miOperador', token: t1 });
    igual(a.operador && a.operador.id, 'OP-003', 'Coop80 recibe solo OP-003');
    igual(b.operador && b.operador.id, 'OP-001', 'Coop1 recibe solo OP-001');
    ok(JSON.stringify(a).indexOf('OP-001') < 0 && JSON.stringify(a).indexOf('OP-005') < 0 && JSON.stringify(a).indexOf('Demo 001') < 0, 'la respuesta de Coop80 no contiene datos de otros operadores');
    ok(!('denuncia_codigo' in a.operador) && !('origen' in a.operador), 'el operador no recibe origen ni denuncia_codigo');
    // intentar suplantar enviando otro operador_id en el cuerpo
    const c = m.post({ accion: 'miOperador', token: t80, operador_id: 'OP-001', id: 'OP-001' });
    igual(c.operador && c.operador.id, 'OP-003', 'enviar operador_id=OP-001 en el cuerpo no cambia la ficha (sigue OP-003)');
    const i = m.post({ accion: 'inscribir', token: t80, programa: 'biorremediacion', operador_id: 'OP-001', operador_nombre: 'Falso' });
    ok(i.ok, 'Coop80 se inscribe', i);
    const ins = m.filas('Inscripciones');
    igual(ins.map(x => x.operador_id), ['OP-003'], 'la inscripcion se guarda con el operador de la CUENTA, no el del cuerpo');
    ok(ins[0].operador_nombre.indexOf('Demo 003') >= 0, 'operador_nombre sale de la hoja Operadores');
    const b2 = m.post({ accion: 'miOperador', token: t1 });
    igual(b2.inscripciones.length, 0, 'Coop1 no ve la inscripcion de Coop80');
    // el operador no puede usar acciones de otros roles
    ['completo', 'guardar', 'muestras', 'denuncias', 'inscripciones', 'aceptarDenuncia', 'estadoDenuncia', 'estadoInscripcion', 'guardarMuestra'].forEach(ac =>
      igual(codigo(m.post({ accion: ac, token: t80, tabla: 'operadores', registro: { id: 'OP-001', nombre: 'Hackeado' }, id: 'IN-001', estado: 'aceptada' })), 'permiso', 'operador no puede ' + ac));
    igual(m.filas('Operadores').find(o => o.id === 'OP-001').nombre, 'Cooperativa Demo 001 (simulado)', 'OP-001 no fue modificado por el operador');
    // un usuario operador cuyo operador_id ya no existe
    const h2 = m.hoja('Operadores'); h2.filas = h2.filas.filter(f => f[0] !== 'OP-003');
    igual(codigo(m.post({ accion: 'miOperador', token: t80 })), 'datos', 'si el operador vinculado no existe, miOperador -> datos');
    igual(codigo(m.post({ accion: 'inscribir', token: t80, programa: 'biorremediacion' })), 'datos', 'si el operador vinculado no existe, inscribir -> datos');
  }

  /* ---------- (d) limites del tecnico ---------- */
  grupo('d) tecnico: no cambia estado_legal ni req_*, no pide foto de denuncia');
  {
    const m = nuevoMundo();
    const tt = m.token('Campo80'), tf = m.token('Aurum80');
    const r = m.post({ accion: 'guardar', token: tt, tabla: 'operadores', registro: { id: 'OP-003', nombre: 'Nombre editado por tecnico', socios: 99, estado_legal: 'Legal', req_nit: 'si', req_derecho_minero: 'no', origen: 'denuncia', denuncia_codigo: 'DEN-X', req_nuevo: 'si' } });
    ok(r.ok && r.id === 'OP-003' && r.creado === false, 'el tecnico guarda cambios de campo en OP-003', r);
    const op = m.filas('Operadores').find(o => o.id === 'OP-003');
    igual(op.nombre, 'Nombre editado por tecnico', 'el tecnico SI puede cambiar nombre');
    igual(op.socios, 99, 'el tecnico SI puede cambiar socios');
    igual(op.estado_legal, 'En proceso', 'el tecnico NO cambia estado_legal');
    igual(op.req_nit, 'no', 'el tecnico NO cambia req_nit');
    igual(op.req_derecho_minero, 'si', 'el tecnico NO cambia req_derecho_minero');
    igual(op.origen, '', 'el tecnico NO fija origen');
    igual(op.denuncia_codigo, '', 'el tecnico NO fija denuncia_codigo');
    igual(op.editado_por, 'campo80', 'editado_por queda con el usuario del token');
    // un tecnico crea un operador nuevo: sin estado_legal
    const n = m.post({ accion: 'guardar', token: tt, tabla: 'operadores', registro: { nombre: 'Nuevo de campo', estado_legal: 'Legal', req_nit: 'si', lat: -15, lng: -67 } });
    ok(n.ok && n.creado && /^OP-\d+$/.test(n.id), 'el tecnico crea un operador nuevo con id automatico', n);
    const nuevo = m.filas('Operadores').find(o => o.id === n.id);
    ok(nuevo.estado_legal === '' && nuevo.req_nit === '', 'el operador creado por el tecnico no trae estado_legal ni requisitos', nuevo);
    // el funcionario si puede, pero origen/denuncia_codigo nunca
    const f = m.post({ accion: 'guardar', token: tf, tabla: 'operadores', registro: { id: 'OP-003', estado_legal: 'Legal', req_nit: 'si', origen: 'denuncia', denuncia_codigo: 'DEN-X' } });
    ok(f.ok, 'el funcionario guarda', f);
    const op2 = m.filas('Operadores').find(o => o.id === 'OP-003');
    ok(op2.estado_legal === 'Legal' && op2.req_nit === 'si', 'el funcionario SI cambia estado_legal y req_*');
    ok(op2.origen === '' && op2.denuncia_codigo === '', 'ni el funcionario puede fijar origen/denuncia_codigo con "guardar"');
    // pasivos: el tecnico puede editar (incluye muestra)
    ok(m.post({ accion: 'guardar', token: tt, tabla: 'pasivos', registro: { id: 'PA-001', volumen_m3: 1234 } }).ok, 'el tecnico puede editar un pasivo');
    igual(codigo(m.post({ accion: 'guardar', token: tt, tabla: 'usuarios', registro: { usuario: 'x' } })), 'tabla', 'guardar en una tabla no permitida (usuarios) -> tabla');
    // foto de denuncia
    const d = denunciaBase('FOTO-2'); d.denuncia.foto = FOTO;
    ok(m.post(d).ok, 'se recibe una denuncia con foto');
    const fotoF = m.post({ accion: 'foto', token: tf, id: 'FOTO-2', tabla: 'denuncias' });
    ok(fotoF.ok && fotoF.foto.indexOf('data:image/jpeg;base64,') === 0, 'el funcionario SI obtiene la foto de la denuncia', fotoF.ok ? 'ok' : fotoF);
    igual(codigo(m.post({ accion: 'foto', token: tt, id: 'FOTO-2', tabla: 'denuncias' })), 'permiso', 'el tecnico NO obtiene la foto de la denuncia');
    igual(codigo(m.post({ accion: 'foto', token: tt, id: 'FOTO-2' })), 'permiso', 'el tecnico NO obtiene la foto sin indicar tabla');
    igual(codigo(m.post({ accion: 'denuncias', token: tt })), 'permiso', 'el tecnico NO lista las denuncias');
    // 'completo' del tecnico incluye todo (necesita ver No legal y pasivos para trabajar en campo)
    const c = m.post({ accion: 'completo', token: tt });
    ok(c.ok && c.pasivos.length === 1 && c.operadores.some(o => o.id === 'OP-005'), 'el tecnico ve la base completa (No legal y pasivos)');
  }

  /* ---------- (e) aceptarDenuncia ---------- */
  grupo('e) aceptarDenuncia: un solo punto "No legal" de origen "denuncia", idempotente');
  {
    const m = nuevoMundo();
    const tf = m.token('Aurum80');
    const rec = m.post(denunciaBase('DEN-ID-1'));
    ok(rec.ok && rec.codigo, 'se crea la denuncia (codigo ' + rec.codigo + ')', rec);
    const nOpAntes = m.filas('Operadores').length;
    const r1 = m.post({ accion: 'aceptarDenuncia', token: tf, id: 'DEN-ID-1', nota: 'Revisada por el municipio' });
    ok(r1.ok && /^OP-\d+$/.test(r1.id) && r1.repetida === false, 'primera aceptacion crea el punto ' + r1.id, r1);
    const ops = m.filas('Operadores');
    igual(ops.length, nOpAntes + 1, 'se agrega exactamente UNA fila a Operadores');
    const punto = ops.find(o => o.id === r1.id);
    igual(punto.estado_legal, 'No legal', 'el punto es "No legal"');
    igual(punto.origen, 'denuncia', 'origen = denuncia');
    igual(punto.denuncia_codigo, rec.codigo, 'denuncia_codigo = codigo de la denuncia');
    ok(punto.nombre.indexOf(rec.codigo) >= 0 && !/Maquinaria/.test(JSON.stringify(punto)), 'el nombre es "Punto por verificar (codigo)" y no copia la descripcion de la denuncia', punto.nombre);
    ok(punto.lat === -15.5052 && punto.lng === -67.8253, 'copia lat y lng de la denuncia');
    const den = m.filas('Denuncias').find(d => d.id === 'DEN-ID-1');
    igual(den.estado, 'atendida', 'la denuncia queda "atendida"');
    ok(den.nota.indexOf(r1.id) >= 0 && den.nota.indexOf('Revisada') >= 0, 'la nota de la denuncia menciona el punto y la nota del funcionario', den.nota);
    igual(den.atendido_por, 'aurum80', 'atendido_por = usuario del token');
    const r2 = m.post({ accion: 'aceptarDenuncia', token: tf, id: 'DEN-ID-1' });
    ok(r2.ok && r2.repetida === true && r2.id === r1.id, 'segunda llamada devuelve el MISMO punto con repetida=true', r2);
    const r3 = m.post({ accion: 'aceptarDenuncia', token: tf, id: 'DEN-ID-1' });
    igual(m.filas('Operadores').filter(o => o.denuncia_codigo === rec.codigo).length, 1, 'tras 3 llamadas sigue habiendo UN solo punto de esa denuncia');
    igual(m.filas('Operadores').length, nOpAntes + 1, 'el total de operadores no crece con las repeticiones');
    // otra denuncia crea otro punto distinto
    m.post(denunciaBase('DEN-ID-2'));
    const r4 = m.post({ accion: 'aceptarDenuncia', token: tf, id: 'DEN-ID-2' });
    ok(r4.ok && r4.id !== r1.id, 'otra denuncia crea otro punto distinto (' + r4.id + ')', r4);
    igual(codigo(m.post({ accion: 'aceptarDenuncia', token: tf, id: 'NO-EXISTE' })), 'datos', 'denuncia inexistente -> datos');
    // el punto aceptado NO aparece en publico
    const pub = m.post({ accion: 'publico' });
    ok(!pub.operadores.some(o => o.id === r1.id), 'el punto "No legal" aceptado no sale en el listado publico');
    // el mapa publico de denuncias muestra la denuncia como atendida, sin datos sensibles
    const mapa = m.post({ accion: 'denunciasMapa' });
    const pm = mapa.denuncias.find(x => x.id === rec.codigo);
    ok(pm && pm.estado === 'atendida' && Object.keys(pm).sort().join() === 'estado,fecha,id,lat,lng,tipo', 'denunciasMapa expone solo id, lat, lng, tipo, fecha y estado', pm);
    ok(JSON.stringify(mapa).indexOf('Maquinaria') < 0, 'denunciasMapa no incluye la descripcion');
  }

  /* ---------- (f) privacidad del publico ---------- */
  grupo('f) publico_ nunca devuelve No legal, pasivos ni denuncia_codigo');
  {
    const m = nuevoMundo();
    const tf = m.token('Aurum80');
    m.post(denunciaBase('P-1'));
    const acept = m.post({ accion: 'aceptarDenuncia', token: tf, id: 'P-1' });
    // el punto sigue No legal: no sale. Ahora lo pasamos a Legal: sale, pero sin denuncia_codigo ni origen
    const antes = m.post({ accion: 'publico' });
    ok(!antes.operadores.some(o => o.id === acept.id), 'No legal aceptado desde denuncia: oculto');
    ok(!antes.operadores.some(o => o.id === 'OP-005'), 'OP-005 (No legal) oculto');
    ok(!antes.operadores.some(o => o.id === 'OP-006'), 'OP-006 (estado "Irregular") oculto');
    ok(antes.operadores.some(o => o.id === 'OP-001') && antes.operadores.some(o => o.id === 'OP-003'), 'los Legal y En proceso si se ven');
    igual(antes.pasivos, [], 'pasivos = [] siempre');
    igual(antes.nivel, 'publico', 'nivel = publico');
    // (el funcionario verifica el punto: le pone nombre real y lo pasa a Legal; el nombre provisional "Punto por verificar (DEN-...)" desaparece)
    m.post({ accion: 'guardar', token: tf, tabla: 'operadores', registro: { id: acept.id, nombre: 'Cooperativa verificada (simulado)', estado_legal: 'Legal' } });
    // muestras y pasivo con datos
    m.post({ accion: 'guardarMuestra', token: tf, muestra: { id: 'MU-PRIV', lat: -15.51, lng: -67.82, matriz: 'agua', semaforo: 'rojo', hg2_ppb: 40, pasivo_id: 'PA-001', lugar: 'Lugar privado', notas: 'Nota privada' } });
    const post = m.post({ accion: 'publico' });
    const get = m.get('publico');
    [['doPost', post], ['doGet', get]].forEach(([via, resp]) => {
      const s = JSON.stringify(resp);
      ok(resp.operadores.some(o => o.id === acept.id), via + ': el punto ya pasado a Legal aparece');
      ok(s.indexOf('denuncia_codigo') < 0 && s.indexOf('DEN-') < 0, via + ': no hay denuncia_codigo ni codigos DEN- en la respuesta');
      ok(s.indexOf('"origen"') < 0, via + ': no hay "origen" en la respuesta');
      ok(s.indexOf('editado_por') < 0 && s.indexOf('editado_en') < 0, via + ': no hay datos de auditoria');
      ok(s.indexOf('PA-001') < 0 && s.indexOf('Dique Demo') < 0 && s.indexOf('MU-PRIV') < 0 && s.indexOf('Lugar privado') < 0 && s.indexOf('Nota privada') < 0, via + ': no hay pasivos ni muestras');
      ok(!resp.operadores.some(o => /no legal|irregular/i.test(String(o.estado_legal))), via + ': ningun operador No legal / irregular');
    });
    ok(m.post({ accion: 'denunciasMapa' }).denuncias.every(d => !('descripcion' in d) && !('nota' in d) && !('foto_id' in d)), 'denunciasMapa sin descripcion, nota ni foto');
    // variantes de "no legal"
    const ho = m.hoja('Operadores'), cab = ho.filas[0];
    ['ilegal', 'NO LEGAL', 'clandestino', 'Sin licencia'].forEach((v, i) => { const f = cab.map(() => ''); f[cab.indexOf('id')] = 'OP-9' + i; f[cab.indexOf('nombre')] = 'Var ' + v; f[cab.indexOf('estado_legal')] = v; ho.appendRow(f); });
    const pub2 = m.post({ accion: 'publico' });
    ok(![0, 1, 2, 3].some(i => pub2.operadores.some(o => o.id === 'OP-9' + i)), 'variantes "ilegal", "NO LEGAL", "clandestino" y "Sin licencia" tambien se ocultan');
  }

  /* ---------- (g) muestras ---------- */
  grupo('g) guardarMuestra: validacion, idempotencia y marca en el pasivo');
  {
    const m = nuevoMundo();
    const tt = m.token('Campo80'), tf = m.token('Aurum80');
    const base = (o) => ({ accion: 'guardarMuestra', token: tt, muestra: Object.assign({ lat: -15.51, lng: -67.82, matriz: 'agua', semaforo: 'amarillo', hg2_ppb: 4.5 }, o) });
    ok(m.filas('Pasivos')[0].muestra === 'no', 'precondicion: PA-001 tiene muestra = no');
    const r = m.post(base({ id: 'MU-T1', pasivo_id: 'PA-001', operador_id: 'OP-005', lugar: 'Borde del dique', volumen_m3: 2, hg_total_ppb: 6, ch3hg_ppb: 0.4, nivel2: true, lote_reactivo: 'L-1', confirmado_lab: false, notas: 'ok', precision_m: 9, fecha: '2026-11-20T10:00:00Z', foto: FOTO }));
    ok(r.ok && r.id === 'MU-T1' && !r.repetida, 'muestra valida se guarda', r);
    let ms = m.filas('Muestras');
    igual(ms.length, 1, 'hay 1 fila en Muestras');
    const f = ms[0];
    ok(f.matriz === 'agua' && f.semaforo === 'amarillo' && f.nivel2 === 'si' && f.confirmado_lab === 'no' && f.tomada_por === 'campo80' && f.pasivo_id === 'PA-001' && f.operador_id === 'OP-005' && f.hg2_ppb === 4.5, 'campos guardados correctamente', f);
    ok(f.foto_id && m.amb.archivos.has(f.foto_id), 'la foto se guardo en la carpeta privada (foto_id ' + f.foto_id + ')');
    igual(m.filas('Pasivos')[0].muestra, 'si', 'el pasivo PA-001 queda con muestra = si');
    const r2 = m.post(base({ id: 'MU-T1', semaforo: 'rojo', hg2_ppb: 99 }));
    ok(r2.ok && r2.repetida === true && r2.id === 'MU-T1', 'reintento con el mismo id -> repetida=true', r2);
    ms = m.filas('Muestras');
    ok(ms.length === 1 && ms[0].semaforo === 'amarillo', 'el reintento no duplica ni sobrescribe', ms.length);
    // sin id: se genera
    const r3 = m.post(base({}));
    ok(r3.ok && /^MU-[0-9A-F]{8}$/.test(r3.id), 'sin id se genera MU-XXXXXXXX', r3);
    // invalidas
    const casos = [
      ['lat fuera de Bolivia (norte)', { lat: -5 }], ['lat fuera de Bolivia (sur)', { lat: -30 }], ['lng fuera de Bolivia', { lng: -80 }],
      ['lat vacia', { lat: '' }], ['lat null', { lat: null }], ['lat texto', { lat: 'abc' }], ['lng 0', { lng: 0 }],
      ['semaforo invalido', { semaforo: 'azul' }], ['semaforo vacio', { semaforo: '' }], ['matriz invalida', { matriz: 'aire' }],
      ['hg2_ppb negativo', { hg2_ppb: -1 }], ['hg2_ppb faltante', { hg2_ppb: '' }], ['hg2_ppb texto', { hg2_ppb: 'mucho' }],
      ['hg_total_ppb negativo', { hg_total_ppb: -0.1 }], ['ch3hg_ppb negativo', { ch3hg_ppb: -5 }], ['volumen negativo', { volumen_m3: -2 }], ['precision negativa', { precision_m: -3 }]
    ];
    const antesN = m.filas('Muestras').length;
    casos.forEach(([nombre, cambio]) => {
      const r = m.post(base(Object.assign({ id: 'MU-X-' + nombre.replace(/\W/g, '') }, cambio)));
      ok(r.ok === false && r.codigo === 'datos', 'rechaza ' + nombre + ' (codigo datos)', r);
    });
    igual(m.filas('Muestras').length, antesN, 'ninguna muestra invalida se guardo');
    // semaforo y matriz se normalizan (mayusculas/acentos)
    ok(m.post(base({ id: 'MU-N1', semaforo: 'ROJO', matriz: 'Lodo' })).ok, 'semaforo "ROJO" y matriz "Lodo" se aceptan normalizados');
    igual(m.filas('Muestras').find(x => x.id === 'MU-N1').semaforo, 'rojo', 'se guarda en minusculas');
    // pasivo inexistente o con caracteres raros no rompe
    ok(m.post(base({ id: 'MU-N2', pasivo_id: 'PA-999' })).ok, 'pasivo_id inexistente no rompe');
    ok(m.post(base({ id: 'MU-N3', pasivo_id: 'PA-001"; DROP' })).ok && m.filas('Muestras').find(x => x.id === 'MU-N3').pasivo_id === '', 'pasivo_id con caracteres raros se descarta (queda vacio)');
    ok(m.post(base({ id: 'bad id!' })).ok && !m.filas('Muestras').some(x => x.id === 'bad id!'), 'un id con caracteres no permitidos se reemplaza por uno generado');
    // foto invalida no bloquea
    const rf = m.post(base({ id: 'MU-F1', foto: 'data:text/html;base64,AAAA' }));
    ok(rf.ok && m.filas('Muestras').find(x => x.id === 'MU-F1').foto_id === '', 'una foto que no es imagen se ignora y la muestra se guarda igual');
    // listado
    const l = m.post({ accion: 'muestras', token: tf });
    ok(l.ok && l.muestras.length === m.filas('Muestras').length, 'funcionario lista las muestras');
    ok(l.muestras.every(x => !('foto_id' in x)) && l.muestras.find(x => x.id === 'MU-T1').tieneFoto === true, 'el listado no expone foto_id, solo tieneFoto');
    // foto de muestra: tecnico y funcionario
    const ft = m.post({ accion: 'foto', token: tt, id: 'MU-T1', tabla: 'muestras' });
    ok(ft.ok && ft.foto.indexOf('data:image/jpeg;base64,') === 0, 'el tecnico obtiene la foto de una muestra');
    igual(codigo(m.post({ accion: 'foto', token: tf, id: 'MU-N1', tabla: 'muestras' })), 'datos', 'muestra sin foto -> datos');
    // el operador no ve muestras
    igual(codigo(m.post({ accion: 'muestras', token: m.token('Coop80') })), 'permiso', 'el operador no puede listar muestras');
  }

  /* ---------- (h) inscripciones ---------- */
  grupo('h) inscribir: no duplica una solicitud activa');
  {
    const m = nuevoMundo();
    const to = m.token('Coop80'), tf = m.token('Aurum80');
    const r1 = m.post({ accion: 'inscribir', token: to, programa: 'biorremediacion', mensaje: 'Queremos participar' });
    ok(r1.ok && r1.id === 'IN-001' && !r1.repetida, 'primera solicitud crea IN-001', r1);
    const r2 = m.post({ accion: 'inscribir', token: to, programa: 'biorremediacion', mensaje: 'otra vez' });
    ok(r2.ok && r2.repetida === true && r2.id === 'IN-001', 'segunda solicitud pendiente -> repetida, mismo id', r2);
    igual(m.filas('Inscripciones').length, 1, 'sigue habiendo 1 fila');
    ok(m.post({ accion: 'inscribir', token: to, programa: 'Biorremediacion' }).repetida === true, 'el programa se normaliza ("Biorremediacion")');
    igual(codigo(m.post({ accion: 'inscribir', token: to, programa: 'otro' })), 'datos', 'programa no valido -> datos');
    igual(codigo(m.post({ accion: 'inscribir', token: to })), 'datos', 'sin programa -> datos');
    // en revision y aceptada siguen siendo activas
    ok(m.post({ accion: 'estadoInscripcion', token: tf, id: 'IN-001', estado: 'en_revision', nota: 'Se pidio documentacion' }).ok, 'el funcionario pasa la solicitud a en_revision');
    igual(m.post({ accion: 'inscribir', token: to, programa: 'biorremediacion' }).repetida, true, 'en_revision sigue siendo activa: no duplica');
    m.post({ accion: 'estadoInscripcion', token: tf, id: 'IN-001', estado: 'aceptada' });
    igual(m.post({ accion: 'inscribir', token: to, programa: 'biorremediacion' }).repetida, true, 'aceptada sigue siendo activa: no duplica');
    igual(m.filas('Inscripciones').length, 1, 'tras 5 intentos sigue habiendo 1 fila');
    const mi = m.post({ accion: 'miOperador', token: to });
    ok(mi.inscripciones.length === 1 && mi.inscripciones[0].estado === 'aceptada' && mi.inscripciones[0].nota.indexOf('documentacion') >= 0, 'el operador ve el estado y la nota de su solicitud', mi.inscripciones);
    ok(!('operador_id' in mi.inscripciones[0]) && !('atendido_por' in mi.inscripciones[0]), 'el operador no ve quien la atendio');
    // no_aplica libera: se puede volver a solicitar
    m.post({ accion: 'estadoInscripcion', token: tf, id: 'IN-001', estado: 'no_aplica' });
    const r3 = m.post({ accion: 'inscribir', token: to, programa: 'biorremediacion' });
    ok(r3.ok && r3.id === 'IN-002' && !r3.repetida, 'tras no_aplica se puede crear una solicitud nueva (IN-002)', r3);
    igual(codigo(m.post({ accion: 'estadoInscripcion', token: tf, id: 'IN-001', estado: 'inventado' })), 'datos', 'estado de inscripcion invalido -> datos');
    igual(codigo(m.post({ accion: 'estadoInscripcion', token: tf, id: 'IN-999', estado: 'aceptada' })), 'datos', 'solicitud inexistente -> datos');
    const li = m.post({ accion: 'inscripciones', token: tf });
    ok(li.ok && li.inscripciones.length === 2 && li.inscripciones[0].id === 'IN-002', 'el funcionario lista las solicitudes (mas recientes primero)', li.inscripciones && li.inscripciones.map(x => x.id));
    igual(m.filas('Inscripciones').find(x => x.id === 'IN-001').atendido_por, 'aurum80', 'atendido_por queda registrado');
  }

  /* ---------- (i) inyeccion de formulas ---------- */
  grupo('i) texto que empieza con = + - @ se guarda con apostrofo');
  {
    const m = nuevoMundo();
    const tf = m.token('Aurum80'), tt = m.token('Campo80'), to = m.token('Coop80');
    const MAL = ['=1+1', '+54 2222', '-cmd|calc', '@SUM(A1)', '  =HYPERLINK("http://x")', '=\u0001cmd'];
    // texto_() directo
    igual(m.ctx.texto_('=1+1'), "'=1+1", 'texto_("=1+1") -> apostrofo');
    igual(m.ctx.texto_('+1'), "'+1", 'texto_("+1") -> apostrofo');
    igual(m.ctx.texto_('-1'), "'-1", 'texto_("-1") -> apostrofo');
    igual(m.ctx.texto_('@a'), "'@a", 'texto_("@a") -> apostrofo');
    igual(m.ctx.texto_('  =x  '), "'=x", 'texto_ recorta espacios y luego protege');
    igual(m.ctx.texto_('a=b'), 'a=b', 'texto_("a=b") no se toca');
    igual(m.ctx.texto_('Hola\u0000 mundo\u0007'), 'Hola mundo', 'texto_ quita caracteres de control');
    igual(m.ctx.texto_('x'.repeat(50), 10).length, 10, 'texto_ respeta la longitud maxima');
    // guardar (operadores)
    const r = m.post({ accion: 'guardar', token: tf, tabla: 'operadores', registro: { id: 'OP-002', nombre: MAL[0], departamento: MAL[1], municipio: MAL[2] } });
    ok(r.ok, 'guardar con textos peligrosos', r);
    const op = m.filas('Operadores').find(o => o.id === 'OP-002');
    igual([op.nombre, op.departamento, op.municipio], ["'=1+1", "'+54 2222", "'-cmd|calc"], 'guardar (funcionario): nombre, departamento y municipio protegidos');
    m.post({ accion: 'guardar', token: tt, tabla: 'pasivos', registro: { id: 'PA-001', nombre: MAL[3] } });
    igual(m.filas('Pasivos')[0].nombre, "'@SUM(A1)", 'guardar (tecnico) en pasivos: nombre protegido');
    // denuncia publica
    m.post({ accion: 'denuncia', denuncia: { id: 'INY-1', tipo: '=Tipo', descripcion: MAL[4], lat: -15.5, lng: -67.8 } });
    const dn = m.filas('Denuncias').find(d => d.id === 'INY-1');
    igual([dn.tipo, dn.descripcion], ['Otro', "'=HYPERLINK(\"http://x\")"], 'denuncia: un tipo fuera de la lista pasa a Otro y la descripcion queda protegida');
    // nota de denuncia
    m.post({ accion: 'estadoDenuncia', token: tf, id: 'INY-1', estado: 'en_revision', nota: '@nota' });
    igual(m.filas('Denuncias').find(d => d.id === 'INY-1').nota, "'@nota", 'estadoDenuncia: nota protegida');
    // muestra
    m.post({ accion: 'guardarMuestra', token: tt, muestra: { id: 'MU-INY', lat: -15.5, lng: -67.8, matriz: 'agua', semaforo: 'verde', hg2_ppb: 1, lugar: '=lugar', lote_reactivo: '+lote', notas: '-notas' } });
    const mu = m.filas('Muestras').find(x => x.id === 'MU-INY');
    igual([mu.lugar, mu.lote_reactivo, mu.notas], ["'=lugar", "'+lote", "'-notas"], 'guardarMuestra: lugar, lote_reactivo y notas protegidos');
    // inscripcion
    m.post({ accion: 'inscribir', token: to, programa: 'biorremediacion', mensaje: '=mensaje' });
    igual(m.filas('Inscripciones')[0].mensaje, "'=mensaje", 'inscribir: mensaje protegido');
    m.post({ accion: 'estadoInscripcion', token: tf, id: 'IN-001', estado: 'en_revision', nota: '+nota' });
    igual(m.filas('Inscripciones')[0].nota, "'+nota", 'estadoInscripcion: nota protegida');
    // aceptarDenuncia con nota peligrosa
    m.post(denunciaBase('INY-2'));
    m.post({ accion: 'aceptarDenuncia', token: tf, id: 'INY-2', nota: '=nota' });
    ok(m.filas('Denuncias').find(d => d.id === 'INY-2').nota.indexOf("'=nota") === 0, 'aceptarDenuncia: nota protegida', m.filas('Denuncias').find(d => d.id === 'INY-2').nota);
    // ninguna celda de texto de las hojas empieza con formula
    const peligrosas = [];
    ['Operadores', 'Pasivos', 'Denuncias', 'Muestras', 'Inscripciones'].forEach(h => m.filas(h).forEach(f => Object.keys(f).forEach(k => { if (typeof f[k] === 'string' && /^[=+\-@]/.test(f[k])) peligrosas.push(h + '.' + k + '=' + f[k]); })));
    igual(peligrosas, [], 'ninguna celda de texto de las hojas empieza con = + - @ sin apostrofo');
  }

  /* ---------- (j) denuncias y limites (comprobaciones adicionales) ---------- */
  grupo('j) comprobaciones adicionales: denuncias publicas');
  {
    const m = nuevoMundo();
    igual(codigo(m.post({ accion: 'denuncia', denuncia: { tipo: 'x', lat: -5, lng: -67 } })), 'datos', 'denuncia con lat fuera de Bolivia -> datos');
    igual(codigo(m.post({ accion: 'denuncia', denuncia: { tipo: '', lat: -15, lng: -67 } })), 'datos', 'denuncia sin tipo -> datos');
    const a = m.post(denunciaBase('REP-1')), b = m.post(denunciaBase('REP-1'));
    ok(a.ok && b.ok && b.repetida === true && b.codigo === a.codigo, 'reintento de la misma denuncia no duplica', b);
    igual(m.filas('Denuncias').length, 1, 'una sola fila de Denuncias');
    const h = m.post({ accion: 'denuncia', denuncia: { web: 'robot', tipo: 'x', lat: -15, lng: -67 } });
    ok(h.ok && m.filas('Denuncias').length === 1, 'el campo trampa (web) responde ok sin guardar');
    const ld = m.post({ accion: 'denuncias', token: m.token('Aurum80') });
    ok(ld.ok && ld.denuncias[0].descripcion && ld.denuncias[0].tieneFoto === false, 'el funcionario ve la descripcion completa');
  }

  /* ---------- resumen ---------- */
  console.log('\n==============================================');
  console.log('Pruebas: ' + total + '   Pasan: ' + (total - fallos) + '   Fallan: ' + fallos);
  if (fallos) { console.log('Fallos:'); detalleFallos.forEach(f => console.log('  - ' + f)); }
  process.exit(fallos ? 1 : 0);
})();
