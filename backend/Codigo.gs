/* ==========================================================================
   Backend de "Aurum80" en Google Apps Script (gratis).
   Vive DENTRO de la hoja de Google: Extensiones > Apps Script > pegar este archivo.
   Guía paso a paso: backend/INSTRUCCIONES.md

   Acciones (todas por POST, cuerpo JSON; doGet solo responde estado, publico y denunciasMapa):
   - publico        (sin clave)  Operadores SIN los "No legal". NUNCA envía pasivos (colas/relaves).
   - denunciasMapa  (sin clave)  Denuncias para el mapa público: SOLO id corto, lat, lng, tipo, fecha y estado resumido.
   - denuncia       (sin clave)  Crea una denuncia en la hoja Denuncias (+ foto opcional en una carpeta privada de Drive).
   - login          usuario y clave -> token de sesión (6 h) + rol (funcionario, tecnico u operador).
   - completo       (token; funcionario, tecnico) Toda la base: operadores (incluidos "No legal") y pasivos.
   - guardar        (token; funcionario, tecnico) Crea o actualiza un operador o pasivo (por id).
                    El rol tecnico NO puede cambiar la situación legal ni los requisitos (eso lo verifica la autoridad).
   - denuncias      (token; funcionario) Lista COMPLETA de denuncias (descripción, nota, si tiene foto...).
   - estadoDenuncia (token; funcionario) Cambia el estado de una denuncia y anota el seguimiento.
   - aceptarDenuncia(token; funcionario) Convierte una denuncia en un punto por verificar (nueva fila en Operadores, "No legal",
                    origen "denuncia") y deja la denuncia como atendida. Es idempotente: no duplica el punto.
   - foto           (token; funcionario, tecnico) Foto de una denuncia (tabla "denuncias") o de una muestra (tabla "muestras").
   - guardarMuestra (token; funcionario, tecnico) Registra una muestra de campo (tamizaje colorimétrico) y marca el pasivo como muestreado.
   - muestras       (token; funcionario, tecnico) Lista de muestras.
   - miOperador     (token; operador) La ficha de SU cooperativa o empresa, con el estado de cada requisito, y sus inscripciones.
   - inscribir      (token; operador) Solicita inscribirse a un programa (p. ej. biorremediación).
   - inscripciones  (token; funcionario) Lista de solicitudes de inscripción.
   - estadoInscripcion (token; funcionario) Cambia el estado de una solicitud.
   - salir          (token)      Cierra la sesión.

   La hoja NO debe estar "Publicada en la Web": si lo está, cualquiera puede
   leer los datos confidenciales sin pasar por aquí.

   Decisión de privacidad (denunciasMapa): las coordenadas se publican EXACTAS, porque el punto que marca
   quien denuncia es el lugar de la actividad que vio, no su casa; y el mapa público no incluye foto,
   descripción libre, contacto, hora exacta ni ningún dato de la persona. Si el municipio prefiere más
   discreción, basta redondear lat y lng en listarDenunciasMapa_() (por ejemplo a 3 decimales, unos 110 m).
   ========================================================================== */

var HOJAS = { operadores: 'Operadores', pasivos: 'Pasivos', denuncias: 'Denuncias', usuarios: 'Usuarios', muestras: 'Muestras', inscripciones: 'Inscripciones' };
var CAB_DENUNCIAS = ['codigo', 'id', 'recibido', 'creado', 'tipo', 'descripcion', 'lat', 'lng', 'precision_m', 'estado', 'foto_id', 'nota', 'atendido_por', 'atendido_en'];
var CAB_USUARIOS = ['usuario', 'nombre', 'municipio', 'rol', 'activo', 'clave_nueva', 'hash', 'sal', 'ultimo_ingreso', 'operador_id'];
var CAB_MUESTRAS = ['id', 'fecha', 'pasivo_id', 'operador_id', 'lugar', 'lat', 'lng', 'precision_m', 'matriz', 'volumen_m3', 'hg2_ppb', 'hg_total_ppb', 'ch3hg_ppb', 'nivel2', 'semaforo', 'lote_reactivo', 'confirmado_lab', 'foto_id', 'notas', 'tomada_por', 'registrado_en'];
var CAB_INSCRIPCIONES = ['id', 'operador_id', 'operador_nombre', 'programa', 'estado', 'mensaje', 'nota', 'creado', 'atendido_por', 'atendido_en'];
var CAB_OPERADORES_EXTRA = ['origen', 'denuncia_codigo'];       // columnas que se agregan sola a la hoja Operadores
var ESTADOS_DENUNCIA = ['nueva', 'en_revision', 'atendida', 'descartada'];  // = config.estadosDenuncia
var ESTADOS_INSCRIPCION = ['pendiente', 'en_revision', 'aceptada', 'no_aplica'];  // = config.estadosInscripcion
var PROGRAMAS = ['biorremediacion'];                             // = config.programas (ids)
var R_AUTORIDAD = ['funcionario'], R_CAMPO = ['funcionario', 'tecnico'], R_OPERADOR = ['operador'];
var SEMAFOROS = ['verde', 'amarillo', 'rojo'], MATRICES = ['agua', 'lodo'];
var TIPOS_DENUNCIA = ['Posible operación sin registro o licencia', 'Vertido de colas o relaves a un río', 'Uso visible de mercurio', 'Acumulación de colas sin control', 'Otro'];   // = config.tiposDenuncia
var SESION_S = 21600;               // 6 horas (máximo de CacheService)
var MAX_FALLOS = 5, BLOQUEO_S = 900;
var MIN_CLAVE = 6;                  // caracteres mínimos de una clave
/* Freno contra envíos masivos de denuncias (CacheService, por ventana de tiempo). */
var MAX_DENUNCIAS_MIN = 30;         // entre todos, por minuto
var MAX_DENUNCIAS_DISP_HORA = 10;   // por dispositivo, por hora
var MAX_DENUNCIAS_ANON_HORA = 40;   // entre quienes no envían identificador de dispositivo, por hora
var MAX_FOTO_CHARS = 2500000;       // ~1,8 MB en base64
var MAX_PUNTOS_MAPA = 800;          // denuncias más recientes que se publican en el mapa
var CACHE_MAPA_S = 20;              // el mapa público se guarda 20 s para no leer la hoja en cada consulta

/* ---------------- Entrada ---------------- */
function doGet(e) {
  var accion = (e && e.parameter && e.parameter.accion) || 'estado';
  if (accion === 'publico') return responder(publico_());
  if (accion === 'denunciasMapa') return responder(denunciasMapa_());
  return responder({ ok: true, servicio: 'Aurum80', hora: new Date().toISOString() });
}

function doPost(e) {
  var p;
  try { p = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { return responder(fallo_('Pedido mal formado.', 'formato')); }
  if (!p || typeof p !== 'object') return responder(fallo_('Pedido mal formado.', 'formato'));
  try {
    switch (p.accion) {
      case 'publico': return responder(publico_());
      case 'denunciasMapa': return responder(denunciasMapa_());
      case 'denuncia': return responder(recibirDenuncia_(p.denuncia || {}));
      case 'login': return responder(login_(String(p.usuario || ''), String(p.clave || '')));
      case 'salir': if (p.token) CacheService.getScriptCache().remove('ses_' + p.token); return responder({ ok: true });
      case 'completo': return responder(conSesion_(p.token, function () { return completo_(); }, R_CAMPO));
      case 'guardar': return responder(conSesion_(p.token, function (u) { return guardar_(u, p.tabla, p.registro || {}); }, R_CAMPO));
      case 'denuncias': return responder(conSesion_(p.token, function () { return listarDenuncias_(); }, R_AUTORIDAD));
      case 'estadoDenuncia': return responder(conSesion_(p.token, function (u) { return estadoDenuncia_(u, p.id, p.estado, p.nota); }, R_AUTORIDAD));
      case 'aceptarDenuncia': return responder(conSesion_(p.token, function (u) { return aceptarDenuncia_(u, p.id, p.nota); }, R_AUTORIDAD));
      case 'foto': return responder(conSesion_(p.token, function (u) { return foto_(u, p.id, p.tabla); }, R_CAMPO));
      case 'guardarMuestra': return responder(conSesion_(p.token, function (u) { return guardarMuestra_(u, p.muestra || {}); }, R_CAMPO));
      case 'muestras': return responder(conSesion_(p.token, function () { return listarMuestras_(); }, R_CAMPO));
      case 'miOperador': return responder(conSesion_(p.token, function (u) { return miOperador_(u); }, R_OPERADOR));
      case 'inscribir': return responder(conSesion_(p.token, function (u) { return inscribir_(u, p.programa, p.mensaje); }, R_OPERADOR));
      case 'inscripciones': return responder(conSesion_(p.token, function () { return listarInscripciones_(); }, R_AUTORIDAD));
      case 'estadoInscripcion': return responder(conSesion_(p.token, function (u) { return estadoInscripcion_(u, p.id, p.estado, p.nota); }, R_AUTORIDAD));
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
/* El público recibe los operadores que NO son "No legal" y NINGÚN pasivo (colas, relaves, desmontes). */
function publico_() {
  var visibles = filas_(HOJAS.operadores).filter(function (o) {
    return !esNoLegal_(campo_(o, ['estadolegal', 'estado', 'legalidad', 'situacionlegal', 'situacion', 'categoria', 'condicion']));
  }).map(sinAuditoria_);
  return { ok: true, nivel: 'publico', operadores: visibles, pasivos: [], generado: new Date().toISOString() };
}
function sinAuditoria_(f) { var o = {}; for (var k in f) if (k !== 'editado_por' && k !== 'editado_en' && k !== 'denuncia_codigo' && k !== 'origen') o[k] = f[k]; return o; }

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
    var rol = norm_(v[i][c.rol]);
    if (['funcionario', 'tecnico', 'operador'].indexOf(rol) < 0) break;   // sin un rol válido no se ingresa (falla cerrado)
    var opId = c.operador_id !== undefined ? String(v[i][c.operador_id] || '').trim() : '';
    if (rol === 'operador' && !opId) break;   // un usuario "operador" sin cooperativa asignada no puede ingresar
    var u = { usuario: usuario, nombre: String(v[i][c.nombre] || usuario), municipio: String(v[i][c.municipio] || ''), rol: rol, operador_id: opId };
    var token = Utilities.getUuid() + Utilities.getUuid().slice(0, 8);
    cache.put('ses_' + token, JSON.stringify(u), SESION_S);
    h.getRange(i + 1, c.ultimo_ingreso + 1).setValue(new Date());
    return { ok: true, token: token, usuario: u, expiraEnS: SESION_S };
  }
  cache.put(kf, String(fallos + 1), BLOQUEO_S);
  return fallo_('Usuario o clave incorrectos.', 'credenciales');
}

/* Valida la sesión Y el rol en el servidor. "roles" es la lista de roles que pueden usar la acción. */
function conSesion_(token, fn, roles) {
  if (!token) return fallo_('Inicie sesión.', 'sesion');
  var raw = CacheService.getScriptCache().get('ses_' + token);
  if (!raw) return fallo_('La sesión venció. Vuelva a ingresar.', 'sesion');
  var u = JSON.parse(raw);
  if (roles && roles.indexOf(u.rol) < 0) return fallo_('Su cuenta no tiene permiso para esta acción.', 'permiso');
  return fn(u);
}

function indice_(cab) { var o = {}; cab.forEach(function (h, i) { o[String(h).trim()] = i; }); return o; }

/* ---------------- Escritura (funcionarios) ---------------- */
function guardar_(u, tabla, reg) {
  var nombre = tabla === 'operadores' ? HOJAS.operadores : tabla === 'pasivos' ? HOJAS.pasivos : null;
  if (!nombre) return fallo_('Tabla no válida.', 'tabla');
  if (!reg || typeof reg !== 'object') return fallo_('Registro no válido.', 'datos');
  /* El rol "tecnico" registra datos de campo, pero la situación legal y los requisitos los verifica la autoridad. */
  if (u.rol === 'tecnico' && tabla === 'operadores') {
    for (var k in reg) { var nk = norm_(k).replace(/[^a-z0-9]/g, ''); if (/^(estadolegal|estado|legalidad|situacionlegal|situacion|categoria|condicion|origen|denunciacodigo)$/.test(nk) || /^req/.test(nk)) delete reg[k]; }
  }
  if (tabla === 'operadores') { delete reg.origen; delete reg.denuncia_codigo; }   // solo los fija aceptarDenuncia
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try { return guardarFila_(u, tabla, nombre, reg); } finally { lock.releaseLock(); }
}

/* Escribe una fila (por id). Quien la llama debe tener el candado. */
function guardarFila_(u, tabla, nombre, reg) {
  var h = hoja_(nombre);
  if (!h) return fallo_('No existe la hoja ' + nombre + '.', 'config');
  var lastCol = Math.max(h.getLastColumn(), 1);
  var cab = h.getRange(1, 1, 1, lastCol).getValues()[0].map(function (x) { return String(x).trim(); });
  var extra = ['editado_por', 'editado_en'].concat(tabla === 'operadores' ? CAB_OPERADORES_EXTRA : tabla === 'pasivos' ? ['notas'] : []);   // 'notas' de Pasivos la usa la planilla de campo
  extra.forEach(function (k) { if (cab.indexOf(k) < 0) { cab.push(k); h.getRange(1, cab.length).setValue(k); } });
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
  cab.forEach(function (k, j) { if (Object.prototype.hasOwnProperty.call(reg, k)) actual[j] = reg[k] === null || reg[k] === undefined ? '' : (typeof reg[k] === 'string' ? texto_(reg[k]) : reg[k]); });
  if (fila > 0) h.getRange(fila, 1, 1, cab.length).setValues([actual]);
  else h.appendRow(actual);
  return { ok: true, id: id, creado: fila < 0 };
}

function siguienteId_(h, col, pref) {
  var n = h.getLastRow(), max = 0;
  if (n >= 2) h.getRange(2, col + 1, n - 1, 1).getValues().forEach(function (r) { var m = String(r[0]).match(/(\d+)\s*$/); if (m) max = Math.max(max, Number(m[1])); });
  return pref + ('000' + (max + 1)).slice(-3);
}

/* Texto libre -> texto seguro para la hoja: sin caracteres de control y sin que una celda que empiece con
   =, +, - o @ se interprete como fórmula (se le antepone un apóstrofo). */
function texto_(s, max) {
  s = String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
  if (max) s = s.slice(0, max);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

/* ---------------- Denuncias ---------------- */
function asegurarCabecera_(h, cab) {
  var n = Math.max(h.getLastColumn(), 1);
  var actual = h.getRange(1, 1, 1, n).getValues()[0].map(function (x) { return String(x).trim(); });
  cab.forEach(function (k) { if (actual.indexOf(k) < 0) { actual.push(k); h.getRange(1, actual.length).setValue(k); } });
}
function hojaDenuncias_() {
  var h = hoja_(HOJAS.denuncias);
  if (!h) { h = libro_().insertSheet(HOJAS.denuncias); h.appendRow(CAB_DENUNCIAS); h.setFrozenRows(1); }
  else asegurarCabecera_(h, CAB_DENUNCIAS);
  return h;
}

/* Cuenta una denuncia en las ventanas de tiempo. Devuelve el mensaje de error o '' si puede seguir.
   Se llama DENTRO del candado, así dos envíos simultáneos no se saltan el límite. */
function frenarEnvios_(dispositivo) {
  var cache = CacheService.getScriptCache(), ahora = Date.now();
  var kMin = 'den_min_' + Math.floor(ahora / 60000);
  var kHora = 'den_h_' + (dispositivo || 'anon') + '_' + Math.floor(ahora / 3600000);
  var nMin = Number(cache.get(kMin) || 0), nHora = Number(cache.get(kHora) || 0);
  if (nMin >= MAX_DENUNCIAS_MIN) return 'Hay muchas denuncias en este momento. Intente en un minuto.';
  if (nHora >= (dispositivo ? MAX_DENUNCIAS_DISP_HORA : MAX_DENUNCIAS_ANON_HORA)) return 'Ya envió varias denuncias en esta hora. Intente de nuevo más tarde.';
  cache.put(kMin, String(nMin + 1), 120);
  cache.put(kHora, String(nHora + 1), 3700);
  return '';
}

function recibirDenuncia_(d) {
  if (d.web) return { ok: true };   // campo trampa (honeypot): los robots lo llenan, las personas no. Se responde "ok" sin guardar nada.
  var lat = Number(d.lat), lng = Number(d.lng);
  if (d.lat === '' || d.lng === '' || d.lat === null || d.lng === null || !isFinite(lat) || !isFinite(lng) || lat < -23.5 || lat > -9 || lng < -70 || lng > -57) return fallo_('Ubicación fuera de Bolivia.', 'datos');
  var tipo = texto_(d.tipo, 80), desc = texto_(d.descripcion, 2000);
  if (tipo && TIPOS_DENUNCIA.indexOf(tipo) < 0) tipo = 'Otro';   // el tipo se publica en el mapa: solo valores de la lista
  if (!tipo) return fallo_('Falta el tipo de denuncia.', 'datos');
  var dispositivo = /^[A-Za-z0-9_-]{1,60}$/.test(String(d.dispositivo || '')) ? String(d.dispositivo) : '';
  var id = /^[A-Za-z0-9_-]{1,60}$/.test(String(d.id || '')) ? String(d.id) : Utilities.getUuid();
  var codigo = /^[A-Za-z0-9-]{1,20}$/.test(String(d.codigo || '')) ? String(d.codigo).toUpperCase() : 'DEN-' + id.slice(-6).toUpperCase();
  var creado = d.creado ? new Date(d.creado) : null;
  if (!creado || isNaN(creado.getTime()) || creado.getTime() > Date.now() + 86400000) creado = '';

  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var h = hojaDenuncias_(), v = h.getDataRange().getValues(), c = indice_(v[0].map(String));
    for (var i = 1; i < v.length; i++) if (String(v[i][c.id]) === id) return { ok: true, codigo: v[i][c.codigo], repetida: true };   // reintento de una denuncia ya recibida
    var limite = frenarEnvios_(dispositivo);
    if (limite) return fallo_(limite, 'limite');
    var fotoId = '';
    if (d.foto && String(d.foto).length <= MAX_FOTO_CHARS) {
      var m = String(d.foto).match(/^data:(image\/(jpeg|png|webp));base64,([A-Za-z0-9+\/=]+)$/);
      if (m) {
        try { fotoId = carpetaFotos_().createFile(Utilities.newBlob(Utilities.base64Decode(m[3]), m[1], codigo + '.' + (m[2] === 'jpeg' ? 'jpg' : m[2]))).getId(); }
        catch (errFoto) { console.error('Foto no guardada: ' + errFoto.message); }   // la denuncia se guarda igual, sin foto
      }
    }
    var valores = { codigo: codigo, id: id, recibido: new Date(), creado: creado, tipo: tipo, descripcion: desc, lat: lat, lng: lng,
      precision_m: Number(d.precision) || '', estado: 'nueva', foto_id: fotoId, nota: '', atendido_por: '', atendido_en: '' };
    var cab = v[0].map(String);
    h.appendRow(cab.map(function (k) { return Object.prototype.hasOwnProperty.call(valores, k) ? valores[k] : ''; }));
    CacheService.getScriptCache().remove('den_mapa');
    return { ok: true, codigo: codigo };
  } finally { lock.releaseLock(); }
}

function carpetaFotos_() {
  var props = PropertiesService.getScriptProperties(), id = props.getProperty('CARPETA_FOTOS');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* se recrea */ } }
  var f = DriveApp.createFolder('Aurum80 - fotos de denuncias (privado)');
  props.setProperty('CARPETA_FOTOS', f.getId());
  return f;
}

/* Funcionarios: lista completa. */
function listarDenuncias_() {
  var lista = filas_(HOJAS.denuncias, true).map(function (r) {
    return { codigo: r.codigo, id: r.id, recibido: r.recibido, creado: r.creado, tipo: r.tipo, descripcion: r.descripcion, lat: Number(r.lat), lng: Number(r.lng),
      precision: Number(r.precision_m) || null, estado: r.estado || 'nueva', tieneFoto: !!r.foto_id, nota: r.nota, atendido_por: r.atendido_por, atendido_en: r.atendido_en };
  });
  lista.reverse();
  return { ok: true, denuncias: lista };
}

/* Público: SOLO campos no sensibles. Sin foto, sin descripción, sin nota, sin quién la atendió, sin hora.
   El estado se resume en "abierta" (nueva o en revisión) o "atendida"; las descartadas no se publican. */
function denunciasMapa_() {
  var cache = CacheService.getScriptCache(), guardado = cache.get('den_mapa');
  if (guardado) { try { return JSON.parse(guardado); } catch (e) { /* se recalcula */ } }
  var lista = listarDenunciasMapa_();
  var res = { ok: true, denuncias: lista, generado: new Date().toISOString() };
  var s = JSON.stringify(res);
  if (s.length < 95000) cache.put('den_mapa', s, CACHE_MAPA_S);   // CacheService admite hasta 100 KB por valor
  return res;
}
function listarDenunciasMapa_() {
  var out = [];
  filas_(HOJAS.denuncias).forEach(function (r) {
    var est = String(r.estado || 'nueva');
    var lat = Number(r.lat), lng = Number(r.lng);
    if (est === 'descartada' || r.lat === '' || r.lng === '' || !isFinite(lat) || !isFinite(lng)) return;
    out.push({ id: String(r.codigo || ''), lat: Math.round(lat * 1000) / 1000, lng: Math.round(lng * 1000) / 1000, tipo: String(r.tipo || ''), fecha: String(r.creado || r.recibido || '').slice(0, 10), estado: est === 'atendida' ? 'atendida' : 'abierta' });
  });
  out.reverse();   // las más recientes primero
  return out.slice(0, MAX_PUNTOS_MAPA);
}

function estadoDenuncia_(u, id, estado, nota) {
  if (ESTADOS_DENUNCIA.indexOf(estado) < 0) return fallo_('Estado no válido.', 'datos');
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try { return estadoDenunciaFila_(u, id, estado, nota) ? { ok: true } : fallo_('No se encontró la denuncia.', 'datos'); }
  finally { lock.releaseLock(); }
}

/* Cambia el estado de una denuncia. Quien la llama debe tener el candado. Devuelve false si no existe. */
function estadoDenunciaFila_(u, id, estado, nota) {
  var h = hojaDenuncias_(), v = h.getDataRange().getValues(), c = indice_(v[0].map(String));
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][c.id]) !== String(id)) continue;
    h.getRange(i + 1, c.estado + 1).setValue(estado);
    if (nota !== undefined && nota !== null) h.getRange(i + 1, c.nota + 1).setValue(texto_(nota, 1000));
    h.getRange(i + 1, c.atendido_por + 1).setValue(u.usuario);
    h.getRange(i + 1, c.atendido_en + 1).setValue(new Date());
    CacheService.getScriptCache().remove('den_mapa');
    return true;
  }
  return false;
}

/* Denuncia aceptada -> punto por verificar. Crea una fila en Operadores (situación "No legal", origen "denuncia",
   sin nombre de persona alguna) y marca la denuncia como atendida. Si ya se aceptó antes, devuelve el mismo punto. */
function aceptarDenuncia_(u, id, nota) {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var hd = hojaDenuncias_(), v = hd.getDataRange().getValues(), c = indice_(v[0].map(String)), fila = null;
    for (var i = 1; i < v.length; i++) if (String(v[i][c.id]) === String(id)) { fila = v[i]; break; }
    if (!fila) return fallo_('No se encontró la denuncia.', 'datos');
    var codigo = String(fila[c.codigo] || ''), lat = Number(fila[c.lat]), lng = Number(fila[c.lng]);
    if (!isFinite(lat) || !isFinite(lng) || lat < -23.5 || lat > -9 || lng < -70 || lng > -57) return fallo_('La denuncia no tiene una ubicación válida.', 'datos');
    var ho = hoja_(HOJAS.operadores);
    if (!ho) return fallo_('No existe la hoja Operadores.', 'config');
    asegurarCabecera_(ho, CAB_OPERADORES_EXTRA);
    var previos = filas_(HOJAS.operadores).filter(function (o) { return codigo && String(o.denuncia_codigo || '') === codigo; });
    if (previos.length) { estadoDenunciaFila_(u, id, 'atendida', nota); return { ok: true, id: previos[0].id, repetida: true }; }
    var hoy = Utilities.formatDate(new Date(), libro_().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
    var r = guardarFila_(u, 'operadores', HOJAS.operadores, {
      nombre: 'Punto por verificar (' + codigo + ')', tipo: '', estado_legal: 'No legal', lat: lat, lng: lng,
      actualizado: hoy, origen: 'denuncia', denuncia_codigo: codigo
    });
    if (!r.ok) return r;
    estadoDenunciaFila_(u, id, 'atendida', (nota ? texto_(nota, 800) + ' · ' : '') + 'Convertida en punto por verificar ' + r.id + '.');
    return { ok: true, id: r.id, repetida: false };
  } finally { lock.releaseLock(); }
}

/* Foto de una denuncia (solo autoridad) o de una muestra (autoridad y técnico). */
function foto_(u, id, tabla) {
  var esMuestra = tabla === 'muestras';
  if (!esMuestra && u.rol !== 'funcionario') return fallo_('Su cuenta no tiene permiso para esta acción.', 'permiso');
  var r = filas_(esMuestra ? HOJAS.muestras : HOJAS.denuncias).filter(function (x) { return String(x.id) === String(id); })[0];
  if (!r || !r.foto_id) return fallo_('Sin foto.', 'datos');
  var b = DriveApp.getFileById(r.foto_id).getBlob();
  return { ok: true, foto: 'data:' + b.getContentType() + ';base64,' + Utilities.base64Encode(b.getBytes()) };
}

/* ---------------- Muestras de campo (tamizaje) ---------------- */
function hojaPropia_(nombre, cab) {
  var h = hoja_(nombre);
  if (!h) { h = libro_().insertSheet(nombre); h.appendRow(cab); h.setFrozenRows(1); }
  else asegurarCabecera_(h, cab);
  return h;
}
function num_(x, min, max) { if (x === '' || x === null || x === undefined) return ''; var n = Number(x); return isFinite(n) && n >= min && n <= max ? n : null; }
/* true / "si" / "true" / 1 -> 'si'; cualquier otra cosa ("no", "false", vacío) -> 'no'. */
function siNo_(x) { return x === true || /^(si|true|1)$/.test(norm_(x)) ? 'si' : 'no'; }
function idSeguro_(x, max) { return /^[A-Za-z0-9_-]+$/.test(String(x || '')) && String(x).length <= (max || 60) ? String(x) : ''; }

function guardarMuestra_(u, m) {
  var lat = Number(m.lat), lng = Number(m.lng);
  if (m.lat === '' || m.lng === '' || m.lat == null || m.lng == null || !isFinite(lat) || !isFinite(lng) || lat < -23.5 || lat > -9 || lng < -70 || lng > -57) return fallo_('Ubicación fuera de Bolivia.', 'datos');
  var matriz = norm_(m.matriz), semaforo = norm_(m.semaforo);
  if (MATRICES.indexOf(matriz) < 0) return fallo_('Tipo de muestra no válido.', 'datos');
  if (SEMAFOROS.indexOf(semaforo) < 0) return fallo_('Resultado no válido.', 'datos');
  var hg2 = num_(m.hg2_ppb, 0, 1e6), hgt = num_(m.hg_total_ppb, 0, 1e6), ch3 = num_(m.ch3hg_ppb, 0, 1e6), vol = num_(m.volumen_m3, 0, 1e9), prec = num_(m.precision_m, 0, 1e5);
  if (hg2 === null || hgt === null || ch3 === null || vol === null || prec === null || hg2 === '') return fallo_('Hay un valor numérico no válido.', 'datos');
  var id = idSeguro_(m.id) || ('MU-' + Utilities.getUuid().slice(0, 8).toUpperCase());
  var fecha = m.fecha ? new Date(m.fecha) : new Date();
  if (isNaN(fecha.getTime()) || fecha.getTime() > Date.now() + 86400000) fecha = new Date();
  var pasivoId = idSeguro_(m.pasivo_id, 40), opId = idSeguro_(m.operador_id, 40);

  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var h = hojaPropia_(HOJAS.muestras, CAB_MUESTRAS), v = h.getDataRange().getValues(), cab = v[0].map(String), c = indice_(cab);
    for (var i = 1; i < v.length; i++) if (String(v[i][c.id]) === id) return { ok: true, id: id, repetida: true };   // reintento de una muestra ya recibida
    var fotoId = '';
    if (m.foto && String(m.foto).length <= MAX_FOTO_CHARS) {
      var mm = String(m.foto).match(/^data:(image\/(jpeg|png|webp));base64,([A-Za-z0-9+\/=]+)$/);
      if (mm) { try { fotoId = carpetaFotos_().createFile(Utilities.newBlob(Utilities.base64Decode(mm[3]), mm[1], id + '.' + (mm[2] === 'jpeg' ? 'jpg' : mm[2]))).getId(); } catch (e) { console.error('Foto de muestra no guardada: ' + e.message); } }
    }
    var valores = { id: id, fecha: fecha, pasivo_id: pasivoId, operador_id: opId, lugar: texto_(m.lugar, 120), lat: lat, lng: lng, precision_m: prec,
      matriz: matriz, volumen_m3: vol, hg2_ppb: hg2, hg_total_ppb: hgt, ch3hg_ppb: ch3, nivel2: siNo_(m.nivel2), semaforo: semaforo,
      lote_reactivo: texto_(m.lote_reactivo, 40), confirmado_lab: siNo_(m.confirmado_lab), foto_id: fotoId, notas: texto_(m.notas, 600),
      tomada_por: u.usuario, registrado_en: new Date() };
    h.appendRow(cab.map(function (k) { return Object.prototype.hasOwnProperty.call(valores, k) ? valores[k] : ''; }));
    if (pasivoId) marcarMuestraPasivo_(pasivoId);
    return { ok: true, id: id };
  } finally { lock.releaseLock(); }
}

/* Si la muestra es de un pasivo conocido, deja constancia en su columna "muestra" (la usa el puntaje). */
function marcarMuestraPasivo_(pasivoId) {
  var h = hoja_(HOJAS.pasivos); if (!h || h.getLastRow() < 2) return;
  var v = h.getDataRange().getValues(), c = indice_(v[0].map(String));
  if (c.id === undefined || c.muestra === undefined) return;
  for (var i = 1; i < v.length; i++) if (String(v[i][c.id]).trim() === pasivoId) { h.getRange(i + 1, c.muestra + 1).setValue('si'); return; }
}

function listarMuestras_() {
  var lista = filas_(HOJAS.muestras, true).map(function (r) {
    var o = {}; for (var k in r) if (k !== 'foto_id') o[k] = r[k];
    o.tieneFoto = !!r.foto_id; return o;
  });
  lista.reverse();
  return { ok: true, muestras: lista };
}

/* ---------------- Cooperativas / empresas (rol operador) ---------------- */
function miOperador_(u) {
  var op = filas_(HOJAS.operadores).filter(function (o) { return String(o.id).trim() === u.operador_id; })[0];
  if (!op) return fallo_('Su cuenta no está vinculada a una cooperativa o empresa registrada. Avise a la autoridad.', 'datos');
  delete op.denuncia_codigo; delete op.origen;
  var ins = filas_(HOJAS.inscripciones).filter(function (r) { return String(r.operador_id).trim() === u.operador_id; }).map(function (r) {
    return { id: r.id, programa: r.programa, estado: r.estado, creado: r.creado, nota: r.nota };
  });
  return { ok: true, operador: op, inscripciones: ins };
}

function inscribir_(u, programa, mensaje) {
  programa = norm_(programa);
  if (PROGRAMAS.indexOf(programa) < 0) return fallo_('Programa no válido.', 'datos');
  var op = filas_(HOJAS.operadores).filter(function (o) { return String(o.id).trim() === u.operador_id; })[0];
  if (!op) return fallo_('Su cuenta no está vinculada a una cooperativa o empresa registrada.', 'datos');
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var h = hojaPropia_(HOJAS.inscripciones, CAB_INSCRIPCIONES), v = h.getDataRange().getValues(), cab = v[0].map(String), c = indice_(cab);
    for (var i = 1; i < v.length; i++) {
      if (String(v[i][c.operador_id]).trim() === u.operador_id && norm_(v[i][c.programa]) === programa && ['pendiente', 'en_revision', 'aceptada'].indexOf(norm_(v[i][c.estado])) >= 0)
        return { ok: true, id: v[i][c.id], repetida: true };   // ya tiene una solicitud activa
    }
    var id = siguienteId_(h, c.id, 'IN-');
    var valores = { id: id, operador_id: u.operador_id, operador_nombre: texto_(op.nombre, 120), programa: programa, estado: 'pendiente',
      mensaje: texto_(mensaje, 500), nota: '', creado: new Date(), atendido_por: '', atendido_en: '' };
    h.appendRow(cab.map(function (k) { return Object.prototype.hasOwnProperty.call(valores, k) ? valores[k] : ''; }));
    return { ok: true, id: id };
  } finally { lock.releaseLock(); }
}

function listarInscripciones_() {
  var lista = filas_(HOJAS.inscripciones, true);
  lista.reverse();
  return { ok: true, inscripciones: lista };
}

function estadoInscripcion_(u, id, estado, nota) {
  if (ESTADOS_INSCRIPCION.indexOf(estado) < 0) return fallo_('Estado no válido.', 'datos');
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var h = hojaPropia_(HOJAS.inscripciones, CAB_INSCRIPCIONES), v = h.getDataRange().getValues(), c = indice_(v[0].map(String));
    for (var i = 1; i < v.length; i++) {
      if (String(v[i][c.id]) !== String(id)) continue;
      h.getRange(i + 1, c.estado + 1).setValue(estado);
      if (nota !== undefined && nota !== null) h.getRange(i + 1, c.nota + 1).setValue(texto_(nota, 600));
      h.getRange(i + 1, c.atendido_por + 1).setValue(u.usuario);
      h.getRange(i + 1, c.atendido_en + 1).setValue(new Date());
      return { ok: true };
    }
    return fallo_('No se encontró la solicitud.', 'datos');
  } finally { lock.releaseLock(); }
}

/* ---------------- Administración (se ejecutan desde el editor) ---------------- */

/* 1) Ejecutar UNA vez: crea las hojas Denuncias y Usuarios si faltan, cifra las claves
      escritas en clave_nueva, crea la carpeta privada de fotos y muestra un diagnóstico. */
function configurar() {
  hojaDenuncias_();
  var h = hoja_(HOJAS.usuarios);
  if (!h) {
    h = libro_().insertSheet(HOJAS.usuarios);
    h.appendRow(CAB_USUARIOS); h.setFrozenRows(1);
    /* Cuenta inicial del piloto. Su clave está en el código público de GitHub: cámbiela
       (escriba otra en clave_nueva) cuando se use con datos reales. */
    h.appendRow(['Aurum80', 'Funcionario municipal', '', 'funcionario', 'si', 'Aurum80', '', '', '']);
  } else asegurarCabecera_(h, CAB_USUARIOS);
  hojaPropia_(HOJAS.muestras, CAB_MUESTRAS);
  hojaPropia_(HOJAS.inscripciones, CAB_INSCRIPCIONES);
  var ho = hoja_(HOJAS.operadores); if (ho) asegurarCabecera_(ho, CAB_OPERADORES_EXTRA);
  var hp = hoja_(HOJAS.pasivos); if (hp) asegurarCabecera_(hp, ['notas']);
  crearUsuariosDemo();
  procesarClaves();
  carpetaFotos_();
  var informe = diagnostico();
  console.log(informe);
  return informe;
}

/* Agrega las cuentas de demostración que falten (no toca las existentes):
   - Campo80  (rol tecnico): usa la app "Aurum80 Campo".
   - Coop80   (rol operador): cooperativa de prueba, vinculada a un operador "En proceso" (o al primero de la hoja).
   Sus claves están en este código público: SOLO para la demostración. Cámbielas o desactívelas (activo = no) con datos reales. */
function crearUsuariosDemo() {
  var h = hoja_(HOJAS.usuarios); if (!h) return 0;
  asegurarCabecera_(h, CAB_USUARIOS);
  var existentes = filas_(HOJAS.usuarios).map(function (r) { return norm_(r.usuario); }), n = 0;
  var ops = filas_(HOJAS.operadores), elegido = ops.filter(function (o) { return /proceso|tramite/.test(norm_(campo_(o, ['estadolegal', 'estado', 'situacion']))); })[0] || ops[0];
  var nuevos = [['Campo80', 'Técnico de campo (demo)', '', 'tecnico', 'si', 'Campo80', '', '', '', '']];
  if (elegido && elegido.id) nuevos.push(['Coop80', 'Cooperativa de prueba (demo)', '', 'operador', 'si', 'Coop80', '', '', '', String(elegido.id)]);
  var cab = h.getRange(1, 1, 1, Math.max(h.getLastColumn(), 1)).getValues()[0].map(function (x) { return String(x).trim(); }), c = indice_(cab);
  nuevos.forEach(function (f) {
    if (existentes.indexOf(norm_(f[0])) >= 0) return;
    var fila = cab.map(function () { return ''; });
    CAB_USUARIOS.forEach(function (k, j) { if (c[k] !== undefined) fila[c[k]] = f[j]; });
    h.appendRow(fila); n++;
  });
  return n;
}

/* Revisa que las pestañas y columnas existan. Ejecutar desde el editor y mirar el registro de ejecución. */
function diagnostico() {
  var pedidas = {
    Operadores: ['id', 'nombre', 'estado_legal', 'lat', 'lng'],
    Pasivos: ['id', 'lat', 'lng'],
    Denuncias: CAB_DENUNCIAS,
    Usuarios: CAB_USUARIOS,
    Muestras: CAB_MUESTRAS,
    Inscripciones: CAB_INSCRIPCIONES
  };
  var lineas = [];
  Object.keys(pedidas).forEach(function (nombre) {
    var h = hoja_(nombre);
    if (!h) { lineas.push('FALTA la pestaña ' + nombre + '.'); return; }
    var cab = h.getRange(1, 1, 1, Math.max(h.getLastColumn(), 1)).getValues()[0].map(function (x) { return String(x).trim(); });
    var faltan = pedidas[nombre].filter(function (k) { return cab.indexOf(k) < 0; });
    lineas.push((faltan.length ? 'REVISAR ' : 'OK ') + nombre + ': ' + Math.max(h.getLastRow() - 1, 0) + ' filas' + (faltan.length ? '; faltan columnas: ' + faltan.join(', ') : '') + '.');
  });
  return lineas.join('\n');
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
    if (clave.length < MIN_CLAVE) { h.getRange(i + 1, c.clave_nueva + 1).setNote('Mínimo ' + MIN_CLAVE + ' caracteres.'); continue; }
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
