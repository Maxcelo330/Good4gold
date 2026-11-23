/* ==========================================================================
   Backend de "Registro y Control Minero" en Google Apps Script (gratis).
   Vive DENTRO de la hoja de Google: Extensiones > Apps Script > pegar este archivo.
   Guía paso a paso: backend/INSTRUCCIONES.md

   Qué hace:
   - publico      (sin clave)  Operadores y Pasivos SIN los "No legal" ni sus pasivos.
   - denuncia     (sin clave)  Agrega una fila en la hoja Denuncias (+ foto en Drive).
   - login        usuario y clave de un funcionario -> token de sesión (6 h).
   - completo     (token)      Toda la base, incluidos los confidenciales.
   - guardar      (token)      Crea o actualiza un operador o pasivo (por id).
   - denuncias    (token)      Lista de denuncias recibidas.
   - estadoDenuncia (token)    Cambia el estado de una denuncia.
   - foto         (token)      Devuelve la foto de una denuncia.
   - salir        (token)      Cierra la sesión.

   La hoja NO debe estar "Publicada en la Web": si lo está, cualquiera puede
   leer los datos confidenciales sin pasar por aquí.
   ========================================================================== */

var HOJAS = { operadores: 'Operadores', pasivos: 'Pasivos', denuncias: 'Denuncias', usuarios: 'Usuarios' };
var CAB_DENUNCIAS = ['codigo', 'id', 'recibido', 'creado', 'tipo', 'descripcion', 'lat', 'lng', 'precision_m', 'estado', 'foto_id', 'nota', 'atendido_por', 'atendido_en'];
var CAB_USUARIOS = ['usuario', 'nombre', 'municipio', 'rol', 'activo', 'clave_nueva', 'hash', 'sal', 'ultimo_ingreso'];
var ESTADOS_DENUNCIA = ['nueva', 'en_revision', 'atendida', 'descartada'];  // = config.estadosDenuncia
var SESION_S = 21600;            // 6 horas (máximo de CacheService)
var MAX_FALLOS = 5, BLOQUEO_S = 900;
var MAX_DENUNCIAS_MIN = 30;      // freno contra envíos masivos
var MAX_FOTO_CHARS = 2500000;    // ~1,8 MB en base64

/* ---------------- Entrada ---------------- */
function doGet(e) {
  var accion = (e && e.parameter && e.parameter.accion) || 'estado';
  if (accion === 'publico') return responder(publico_());
  return responder({ ok: true, servicio: 'Registro y Control Minero', hora: new Date().toISOString() });
}

function doPost(e) {
  var p;
  try { p = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { return responder(fallo_('Pedido mal formado.', 'formato')); }
  try {
    switch (p.accion) {
      case 'publico': return responder(publico_());
      case 'denuncia': return responder(recibirDenuncia_(p.denuncia || {}));
      case 'login': return responder(login_(String(p.usuario || ''), String(p.clave || '')));
      case 'salir': if (p.token) CacheService.getScriptCache().remove('ses_' + p.token); return responder({ ok: true });
      case 'completo': return responder(conSesion_(p.token, function () { return completo_(); }));
      case 'guardar': return responder(conSesion_(p.token, function (u) { return guardar_(u, p.tabla, p.registro || {}); }));
      case 'denuncias': return responder(conSesion_(p.token, function () { return listarDenuncias_(); }));
      case 'estadoDenuncia': return responder(conSesion_(p.token, function (u) { return estadoDenuncia_(u, p.id, p.estado, p.nota); }));
      case 'foto': return responder(conSesion_(p.token, function () { return foto_(p.id); }));
      default: return responder(fallo_('Acción desconocida.', 'accion'));
    }
  } catch (err) {
    console.error(err);
    return responder(fallo_('Error interno: ' + err.message, 'interno'));
  }
}

function responder(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function fallo_(msg, codigo) { return { ok: false, error: msg, codigo: codigo || 'error' }; }

/* ---------------- Lectura de hojas ---------------- */
function libro_() { return SpreadsheetApp.getActiveSpreadsheet(); }
function hoja_(nombre) { return libro_().getSheetByName(nombre); }

/* Filas como objetos { encabezado: valor }. Fechas -> AAAA-MM-DD. */
function filas_(nombre, conHora) {
  var h = hoja_(nombre);
  if (!h || h.getLastRow() < 2) return [];
  var v = h.getDataRange().getValues(), cab = v[0].map(function (x) { return String(x).trim(); }), tz = libro_().getSpreadsheetTimeZone();
  var out = [];
  for (var i = 1; i < v.length; i++) {
    var vacia = true, o = {};
    for (var j = 0; j < cab.length; j++) {
      if (!cab[j]) continue;
      var x = v[i][j];
      if (x instanceof Date) x = Utilities.formatDate(x, tz, conHora ? "yyyy-MM-dd'T'HH:mm:ss" : 'yyyy-MM-dd');
      if (x !== '' && x !== null) vacia = false;
      o[cab[j]] = x;
    }
    if (!vacia) out.push(o);
  }
  return out;
}

/* Misma regla que la app (js/core/importer.js -> estadoLegal). */
function norm_(s) { return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim(); }
function esNoLegal_(v) {
  var s = norm_(v);
  if (/^(legal|legales|formal|formales|regular|vigente|si)$/.test(s)) return false;
  if (/(proceso|tramite|informal|informales|regulariz|pendiente)/.test(s)) return false;
  return /(ilegal|no legal|nolegal|irregular|clandest|sin licencia)/.test(s);
}
function campo_(fila, nombres) {
  for (var k in fila) { var n = norm_(k).replace(/[^a-z0-9]/g, ''); if (nombres.indexOf(n) >= 0) return fila[k]; }
  return '';
}

/* ---------------- Público: sin confidenciales ---------------- */
function publico_() {
  var ops = filas_(HOJAS.operadores), pas = filas_(HOJAS.pasivos), ocultos = {};
  var visibles = ops.filter(function (o) {
    var conf = esNoLegal_(campo_(o, ['estadolegal', 'estado', 'legalidad', 'situacionlegal', 'situacion', 'categoria', 'condicion']));
    if (conf) ocultos[String(campo_(o, ['id', 'codigo', 'cod', 'nro', 'numero'])).trim()] = true;
    return !conf;
  }).map(sinAuditoria_);
  var pasVis = pas.filter(function (p) { return !ocultos[String(campo_(p, ['operadorid', 'idoperador', 'operador', 'cooperativa', 'responsable'])).trim()]; }).map(sinAuditoria_);
  return { ok: true, nivel: 'publico', operadores: visibles, pasivos: pasVis, generado: new Date().toISOString() };
}
function sinAuditoria_(f) { var o = {}; for (var k in f) if (k !== 'editado_por' && k !== 'editado_en') o[k] = f[k]; return o; }

function completo_() {
  return { ok: true, nivel: 'completo', operadores: filas_(HOJAS.operadores), pasivos: filas_(HOJAS.pasivos), generado: new Date().toISOString() };
}

/* ---------------- Sesiones ---------------- */
function hashClave_(clave, sal) {
  var bytes = Utilities.computeHmacSha256Signature(clave, sal);
  for (var i = 0; i < 300; i++) bytes = Utilities.computeHmacSha256Signature(bytes, Utilities.newBlob(sal).getBytes());
  return Utilities.base64Encode(bytes);
}

function login_(usuario, clave) {
  usuario = usuario.trim().toLowerCase();
  if (!usuario || !clave) return fallo_('Escriba usuario y clave.', 'credenciales');
  var cache = CacheService.getScriptCache(), kf = 'fail_' + usuario, fallos = Number(cache.get(kf) || 0);
  if (fallos >= MAX_FALLOS) return fallo_('Demasiados intentos. Espere 15 minutos.', 'bloqueado');
  var h = hoja_(HOJAS.usuarios);
  if (!h) return fallo_('Falta la hoja Usuarios. Ejecute configurar().', 'config');
  var v = h.getDataRange().getValues(), cab = v[0].map(String), c = indice_(cab);
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][c.usuario]).trim().toLowerCase() !== usuario) continue;
    var activo = norm_(v[i][c.activo]);
    if (activo === 'no' || activo === 'false' || activo === '0') break;
    if (!v[i][c.hash] || hashClave_(clave, String(v[i][c.sal])) !== String(v[i][c.hash])) break;
    cache.remove(kf);
    var u = { usuario: usuario, nombre: String(v[i][c.nombre] || usuario), municipio: String(v[i][c.municipio] || ''), rol: String(v[i][c.rol] || 'funcionario') };
    var token = Utilities.getUuid() + Utilities.getUuid().slice(0, 8);
    cache.put('ses_' + token, JSON.stringify(u), SESION_S);
    h.getRange(i + 1, c.ultimo_ingreso + 1).setValue(new Date());
    return { ok: true, token: token, usuario: u, expiraEnS: SESION_S };
  }
  cache.put(kf, String(fallos + 1), BLOQUEO_S);
  return fallo_('Usuario o clave incorrectos.', 'credenciales');
}

function conSesion_(token, fn) {
  if (!token) return fallo_('Inicie sesión.', 'sesion');
  var raw = CacheService.getScriptCache().get('ses_' + token);
  if (!raw) return fallo_('La sesión venció. Vuelva a ingresar.', 'sesion');
  return fn(JSON.parse(raw));
}

function indice_(cab) { var o = {}; cab.forEach(function (h, i) { o[String(h).trim()] = i; }); return o; }

/* ---------------- Escritura (funcionarios) ---------------- */
function guardar_(u, tabla, reg) {
  var nombre = tabla === 'operadores' ? HOJAS.operadores : tabla === 'pasivos' ? HOJAS.pasivos : null;
  if (!nombre) return fallo_('Tabla no válida.', 'tabla');
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var h = hoja_(nombre);
    if (!h) return fallo_('No existe la hoja ' + nombre + '.', 'config');
    var lastCol = Math.max(h.getLastColumn(), 1);
    var cab = h.getRange(1, 1, 1, lastCol).getValues()[0].map(function (x) { return String(x).trim(); });
    ['editado_por', 'editado_en'].forEach(function (k) { if (cab.indexOf(k) < 0) { cab.push(k); h.getRange(1, cab.length).setValue(k); } });
    var c = indice_(cab);
    if (c.id === undefined) return fallo_('La hoja ' + nombre + ' no tiene columna "id".', 'config');
    var id = String(reg.id || '').trim();
    if (!id) id = siguienteId_(h, c.id, tabla === 'operadores' ? 'OP-' : 'PA-');
    reg.id = id; reg.editado_por = u.usuario; reg.editado_en = new Date();
    var fila = -1, n = h.getLastRow();
    if (n >= 2) {
      var ids = h.getRange(2, c.id + 1, n - 1, 1).getValues();
      for (var i = 0; i < ids.length; i++) if (String(ids[i][0]).trim() === id) { fila = i + 2; break; }
    }
    var actual = fila > 0 ? h.getRange(fila, 1, 1, cab.length).getValues()[0] : cab.map(function () { return ''; });
    cab.forEach(function (k, j) { if (Object.prototype.hasOwnProperty.call(reg, k)) actual[j] = reg[k] === null || reg[k] === undefined ? '' : reg[k]; });
    if (fila > 0) h.getRange(fila, 1, 1, cab.length).setValues([actual]);
    else h.appendRow(actual);
    return { ok: true, id: id, creado: fila < 0 };
  } finally { lock.releaseLock(); }
}

function siguienteId_(h, col, pref) {
  var n = h.getLastRow(), max = 0;
  if (n >= 2) h.getRange(2, col + 1, n - 1, 1).getValues().forEach(function (r) { var m = String(r[0]).match(/(\d+)\s*$/); if (m) max = Math.max(max, Number(m[1])); });
  return pref + ('000' + (max + 1)).slice(-3);
}

/* ---------------- Denuncias ---------------- */
function hojaDenuncias_() {
  var h = hoja_(HOJAS.denuncias);
  if (!h) { h = libro_().insertSheet(HOJAS.denuncias); h.appendRow(CAB_DENUNCIAS); h.setFrozenRows(1); }
  return h;
}

function recibirDenuncia_(d) {
  if (d.web) return { ok: true };   // campo trampa: los robots lo llenan, las personas no
  var lat = Number(d.lat), lng = Number(d.lng);
  if (!isFinite(lat) || !isFinite(lng) || lat < -23.5 || lat > -9 || lng < -70 || lng > -57) return fallo_('Ubicación fuera de Bolivia.', 'datos');
  var tipo = String(d.tipo || '').slice(0, 80), desc = String(d.descripcion || '').slice(0, 2000);
  if (!tipo) return fallo_('Falta el tipo de denuncia.', 'datos');
  var cache = CacheService.getScriptCache(), km = 'den_' + Math.floor(Date.now() / 60000), cuenta = Number(cache.get(km) || 0);
  if (cuenta >= MAX_DENUNCIAS_MIN) return fallo_('Hay muchas denuncias en este momento. Intente en un minuto.', 'limite');
  cache.put(km, String(cuenta + 1), 120);

  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var h = hojaDenuncias_(), v = h.getDataRange().getValues(), c = indice_(v[0].map(String));
    var id = String(d.id || Utilities.getUuid()).slice(0, 60);
    for (var i = 1; i < v.length; i++) if (String(v[i][c.id]) === id) return { ok: true, codigo: v[i][c.codigo], repetida: true };
    var codigo = String(d.codigo || ('DEN-' + id.slice(-6).toUpperCase())).slice(0, 20);
    var fotoId = '';
    if (d.foto && String(d.foto).length <= MAX_FOTO_CHARS) {
      var m = String(d.foto).match(/^data:(image\/(jpeg|png|webp));base64,(.+)$/);
      if (m) fotoId = carpetaFotos_().createFile(Utilities.newBlob(Utilities.base64Decode(m[3]), m[1], codigo + '.' + (m[2] === 'jpeg' ? 'jpg' : m[2]))).getId();
    }
    var fila = CAB_DENUNCIAS.map(function (k) {
      return { codigo: codigo, id: id, recibido: new Date(), creado: d.creado ? new Date(d.creado) : '', tipo: tipo, descripcion: desc, lat: lat, lng: lng,
        precision_m: Number(d.precision) || '', estado: 'nueva', foto_id: fotoId, nota: '', atendido_por: '', atendido_en: '' }[k];
    });
    h.appendRow(fila);
    return { ok: true, codigo: codigo };
  } finally { lock.releaseLock(); }
}

function carpetaFotos_() {
  var props = PropertiesService.getScriptProperties(), id = props.getProperty('CARPETA_FOTOS');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* se recrea */ } }
  var f = DriveApp.createFolder('Control Minero - fotos de denuncias (privado)');
  props.setProperty('CARPETA_FOTOS', f.getId());
  return f;
}

function listarDenuncias_() {
  var lista = filas_(HOJAS.denuncias, true).map(function (r) {
    return { codigo: r.codigo, id: r.id, recibido: r.recibido, creado: r.creado, tipo: r.tipo, descripcion: r.descripcion, lat: Number(r.lat), lng: Number(r.lng),
      precision: Number(r.precision_m) || null, estado: r.estado || 'nueva', tieneFoto: !!r.foto_id, nota: r.nota, atendido_por: r.atendido_por, atendido_en: r.atendido_en };
  });
  lista.reverse();
  return { ok: true, denuncias: lista };
}

function estadoDenuncia_(u, id, estado, nota) {
  if (ESTADOS_DENUNCIA.indexOf(estado) < 0) return fallo_('Estado no válido.', 'datos');
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var h = hojaDenuncias_(), v = h.getDataRange().getValues(), c = indice_(v[0].map(String));
    for (var i = 1; i < v.length; i++) {
      if (String(v[i][c.id]) !== String(id)) continue;
      h.getRange(i + 1, c.estado + 1).setValue(estado);
      if (nota !== undefined && nota !== null) h.getRange(i + 1, c.nota + 1).setValue(String(nota).slice(0, 1000));
      h.getRange(i + 1, c.atendido_por + 1).setValue(u.usuario);
      h.getRange(i + 1, c.atendido_en + 1).setValue(new Date());
      return { ok: true };
    }
    return fallo_('No se encontró la denuncia.', 'datos');
  } finally { lock.releaseLock(); }
}

function foto_(id) {
  var r = filas_(HOJAS.denuncias).filter(function (x) { return String(x.id) === String(id); })[0];
  if (!r || !r.foto_id) return fallo_('Sin foto.', 'datos');
  var b = DriveApp.getFileById(r.foto_id).getBlob();
  return { ok: true, foto: 'data:' + b.getContentType() + ';base64,' + Utilities.base64Encode(b.getBytes()) };
}

/* ---------------- Administración (se ejecutan desde el editor) ---------------- */

/* 1) Ejecutar UNA vez: crea las hojas Denuncias y Usuarios si faltan. */
function configurar() {
  hojaDenuncias_();
  var h = hoja_(HOJAS.usuarios);
  if (!h) {
    h = libro_().insertSheet(HOJAS.usuarios);
    h.appendRow(CAB_USUARIOS); h.setFrozenRows(1);
    /* Fila de ejemplo DESACTIVADA y sin clave: este código es público en GitHub,
       así que ninguna clave puede venir escrita aquí. */
    h.appendRow(['municipio', 'Funcionario municipal', 'Mapiri', 'funcionario', 'no', '', '', '', '']);
  }
  procesarClaves();
  carpetaFotos_();
  return 'Listo. Revise la hoja Usuarios.';
}

/* 2) Para dar de alta o cambiar una clave: escríbala en la columna clave_nueva y
      ejecute esta función (o espere: onEdit lo hace solo). La clave se guarda cifrada
      y la celda se vacía. */
function procesarClaves() {
  var h = hoja_(HOJAS.usuarios); if (!h || h.getLastRow() < 2) return 0;
  var v = h.getDataRange().getValues(), c = indice_(v[0].map(String)), n = 0;
  for (var i = 1; i < v.length; i++) {
    var clave = String(v[i][c.clave_nueva] || '');
    if (!clave) continue;
    if (clave.length < 8) { h.getRange(i + 1, c.clave_nueva + 1).setNote('Mínimo 8 caracteres.'); continue; }
    var sal = Utilities.getUuid();
    h.getRange(i + 1, c.hash + 1).setValue(hashClave_(clave, sal));
    h.getRange(i + 1, c.sal + 1).setValue(sal);
    h.getRange(i + 1, c.clave_nueva + 1).setValue('').setNote('');
    n++;
  }
  return n;
}

function onEdit(e) {
  try { if (e && e.range && e.range.getSheet().getName() === HOJAS.usuarios) procesarClaves(); } catch (err) { /* sin permisos en disparador simple */ }
}
