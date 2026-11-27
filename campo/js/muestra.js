/* ==========================================================================
   Pestaña "Muestra": toma de muestra de campo (tamizaje colorimétrico HgSense) en pasos.
   Lugar -> Tipo de muestra -> Nivel 1 (tubo A) -> [Nivel 2 (tubo C)] -> Resultado -> Guardar.
   El cálculo vive en js/core/hgsense.js (módulo puro). El resultado es un TAMIZAJE: no reemplaza
   al laboratorio acreditado y un "verde" no significa que se cumpla la norma.
   El guardado pasa por la cola de campo.js (idempotente: el id lo crea el teléfono).
   ========================================================================== */
(function () {
  const G4G = (window.G4G = window.G4G || {});
  const C = G4G.campo, U = C.U, el = C.el, ui = C.ui, H = G4G.hgsense;
  const W = H.LIENZO.ancho, HT = H.LIENZO.alto, ROI = H.ROI_TAM;

  const TXT = { demo: 'Escenario', lugar: 'Lugar', matriz: 'Tipo de muestra', nivel1: 'Nivel 1: tubo A', nivel2: 'Nivel 2: tubo C', resultado: 'Resultado', guardar: 'Guardar' };
  const MATRIZ_TXT = { agua: 'Agua', lodo: 'Lodo o sedimento' };
  const UNIDAD = { agua: 'ppb (µg/L)', lodo: 'ppb (µg/kg, base seca)' };

  /* Escenarios sintéticos del modo demostración (los mismos de la app HgSense de origen). */
  const ESCENARIOS = [
    { id: 'agua_limpia', nombre: 'Agua limpia de río', desc: 'Termina en el Nivel 1.', matriz: 'agua', A: [234, 194, 32], C: null },
    { id: 'efluente', nombre: 'Efluente de una operación', desc: 'Pide confirmar (Nivel 1 en rojo).', matriz: 'agua', A: [235, 212, 102], C: null },
    { id: 'lodo', nombre: 'Lodo de una poza, con Nivel 2', desc: 'Incluye el tubo C y el metilmercurio indicativo.', matriz: 'lodo', A: [235, 204, 64], C: [235, 216, 120] }
  ];

  const nuevo = () => ({
    paso: 'lugar', demo: false, escenario: null,
    destino: null, lugarLibre: '', matriz: null, volumen: '',
    tubos: { A: null, C: null }, nivel2: false,
    gps: null, gpsEstado: '', gpsMsg: '',
    lote: C.leerLote(), notas: '', id: null, qid: null,
    filtro: '', tipoLista: 'todos', pos: null, posIntentada: false, error: ''
  });
  let m = nuevo();
  let nodoLista = null;

  const lHg2 = () => el('span', null, 'Hg', el('sup', null, '2+'));
  const lCh3 = () => el('span', null, 'CH', el('sub', null, '3'), 'Hg', el('sup', null, '+'));
  const f1 = (n) => U.fmt(n, 1);
  const r2 = (n) => (n === null || n === undefined ? null : Math.round(n * 100) / 100);

  function pasosActivos() {
    const p = m.demo ? ['demo', 'nivel1'] : ['lugar', 'matriz', 'nivel1'];
    if (m.nivel2) p.push('nivel2');
    p.push('resultado');
    if (!m.demo) p.push('guardar');
    return p;
  }
  function ir(paso) { m.paso = paso; m.error = ''; C.repintar(true); }
  function reiniciar() { m = nuevo(); C.repintar(true); }
  function aviso(txt) { C.ui.toast(txt, 'warn'); }

  /* ---- Cálculo con lo medido ---- */
  function lectura(t) {
    if (!t || !t.rgb || !m.matriz) return null;
    const a = H.analizarRgb(t.rgb.r, t.rgb.g, t.rgb.b, m.matriz);
    return Object.assign(a, { calidad: H.calidadRoi(t.rgb.r, t.rgb.g, t.rgb.b) });
  }
  function calculo() {
    const a = lectura(m.tubos.A);
    if (!a) return null;
    const c = m.nivel2 ? lectura(m.tubos.C) : null;
    const hg2 = a.ppb, total = c ? c.ppb : null, ch3 = c ? H.metilmercurio(total, hg2) : null;
    const nivel = H.peorNivel(a.semaforo, c ? c.semaforo : null);
    return { a, c, hg2, total, ch3, nivel };
  }

  /* ---- Imagen sintética de un tubo (modo demostración) ---- */
  function rect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function vialSintetico(rgb, rotulo, tapa) {
    const cv = document.createElement('canvas'); cv.width = W; cv.height = HT;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#2B2824'; ctx.fillRect(0, 0, W, HT);
    ctx.fillStyle = '#F3EFE7'; rect(ctx, 72, 16, 176, 188, 6); ctx.fill();
    const vw = 104, vx = (W - vw) / 2, vt = 34, vh = 164;
    ctx.fillStyle = tapa; rect(ctx, vx + 4, 18, vw - 8, 24, 4); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.72)'; rect(ctx, vx, vt, vw, vh, 14); ctx.fill();
    ctx.fillStyle = 'rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ')'; rect(ctx, vx + 5, 58, vw - 10, 134, 10); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.32)'; rect(ctx, vx + 6, vt + 10, 8, vh - 22, 4); ctx.fill();
    ctx.strokeStyle = 'rgba(79,75,67,0.55)'; ctx.lineWidth = 1.5; rect(ctx, vx, vt, vw, vh, 14); ctx.stroke();
    ctx.fillStyle = '#FFFFFF'; ctx.font = '700 12px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('DEMOSTRACIÓN · ' + rotulo, 8, 14);
    return cv;
  }

  /* ---- Tubos: foto -> lienzo -> color promedio del recuadro ---- */
  function tuboDe(canvas, file) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const t = { canvas, file: file || null, datos: ctx.getImageData(0, 0, W, HT), x: Math.floor((W - ROI) / 2), y: Math.floor((HT - ROI) / 2), rgb: null };
    t.rgb = H.promedioRoi(t.datos, t.x, t.y, ROI);
    return t;
  }
  function dibujar(t, cv) {
    const ctx = cv.getContext('2d');
    ctx.drawImage(t.canvas, 0, 0);
    ctx.lineWidth = 5; ctx.strokeStyle = '#1D1B18'; ctx.strokeRect(t.x, t.y, ROI, ROI);
    ctx.lineWidth = 2; ctx.strokeStyle = '#FFFFFF'; ctx.setLineDash([6, 4]); ctx.strokeRect(t.x, t.y, ROI, ROI); ctx.setLineDash([]);
  }

  async function cargarFoto(key, file) {
    try {
      const img = await C.decodificar(file);
      m.tubos[key] = tuboDe(C.aLienzo(img, W, HT), file);
      C.repintar(false);
    } catch (e) { aviso(e.message || 'No se pudo leer la foto.'); }
  }

  /* Bloque de un tubo: botones de foto, lienzo con recuadro movible y lectura en vivo. */
  function bloqueTubo(key, o) {
    const t = m.tubos[key];
    const lect = el('div', { class: 'c-lectura', 'aria-live': 'polite' });
    const raiz = el('div', { class: 'c-tubo' });
    const fuente = (captura) => el('input', { type: 'file', accept: 'image/*', capture: captura ? 'environment' : null, class: 'visually-hidden', tabindex: '-1', 'aria-hidden': 'true',
      onchange: (ev) => { const f = ev.target.files && ev.target.files[0]; ev.target.value = ''; if (f) cargarFoto(key, f); } });
    const camara = fuente(true), galeria = fuente(false);
    if (!m.demo) {
      raiz.appendChild(el('div', { class: 'c-btnrow' },
        el('button', { type: 'button', class: 'btn btn--primary c-btn c-btn--block', onclick: () => camara.click() }, ui.icon('camara', 22), t ? 'Tomar otra foto' : 'Tomar foto del ' + o.nombre),
        el('button', { type: 'button', class: 'btn c-btn c-btn--block', onclick: () => galeria.click() }, 'Usar foto de la galería'),
        camara, galeria));
    }
    if (!t) {
      raiz.appendChild(el('div', { class: 'c-vacio' }, 'Aún no hay foto del ' + o.nombre + '.'));
      return raiz;
    }
    const cv = el('canvas', { class: 'c-lienzo', width: W, height: HT, tabindex: '0', role: 'img', 'aria-label': 'Foto del ' + o.nombre + '. Toque el líquido para mover el recuadro de medida; con teclado, use las flechas.' });
    function pintarLectura() {
      U.clear(lect);
      const a = lectura(t); if (!a) return;
      const cal = a.calidad;
      lect.appendChild(el('div', { class: 'c-lectura__fila' },
        el('span', { class: 'c-muestra', style: { background: 'rgb(' + a.r + ',' + a.g + ',' + a.b + ')' }, 'aria-hidden': 'true' }),
        el('div', null,
          el('div', { class: 'c-lectura__rot' }, o.rotulo()),
          el('div', { class: 'c-lectura__val' }, cal.ok ? f1(a.ppb) + ' ' + UNIDAD[m.matriz] : 'Sin lectura'))));
      if (cal.ok) lect.appendChild(el('div', null, C.chipSemaforo(a.semaforo)));
      else lect.appendChild(el('div', { class: 'callout callout--warn', role: 'alert' }, cal.avisos[0]));
    }
    function mover(x, y) {
      t.x = U.clamp(Math.round(x - ROI / 2), 0, W - ROI); t.y = U.clamp(Math.round(y - ROI / 2), 0, HT - ROI);
      t.rgb = H.promedioRoi(t.datos, t.x, t.y, ROI);
      dibujar(t, cv); pintarLectura();
    }
    const aCanvas = (ev) => { const r = cv.getBoundingClientRect(); return [(ev.clientX - r.left) * W / r.width, (ev.clientY - r.top) * HT / r.height]; };
    let arrastra = false;
    cv.addEventListener('pointerdown', (ev) => { arrastra = true; try { cv.setPointerCapture(ev.pointerId); } catch (e) { /* nada */ } const p = aCanvas(ev); mover(p[0], p[1]); });
    cv.addEventListener('pointermove', (ev) => { if (!arrastra) return; const p = aCanvas(ev); mover(p[0], p[1]); });
    const fin = () => { arrastra = false; };
    cv.addEventListener('pointerup', fin); cv.addEventListener('pointercancel', fin);
    cv.addEventListener('keydown', (ev) => {
      const d = { ArrowLeft: [-4, 0], ArrowRight: [4, 0], ArrowUp: [0, -4], ArrowDown: [0, 4] }[ev.key];
      if (d) { ev.preventDefault(); mover(t.x + ROI / 2 + d[0], t.y + ROI / 2 + d[1]); }
    });
    dibujar(t, cv); pintarLectura();
    raiz.appendChild(cv);
    raiz.appendChild(lect);
    raiz.appendChild(el('p', { class: 'muted c-ayuda' }, 'Toque el líquido del tubo para mover el recuadro de medida.'));
    raiz.appendChild(el('button', { type: 'button', class: 'btn c-btn', onclick: () => mover(W / 2, HT / 2) }, 'Centrar el recuadro'));
    return raiz;
  }

  /* ---- Piezas comunes ---- */
  function progreso() {
    const p = pasosActivos(), i = Math.max(0, p.indexOf(m.paso));
    return el('div', { class: 'c-prog', role: 'group', 'aria-label': 'Progreso' },
      el('div', { class: 'c-prog__txt' }, 'Paso ' + (i + 1) + ' de ' + p.length + ': ' + TXT[m.paso]),
      el('div', { class: 'c-prog__bar', 'aria-hidden': 'true' }, p.map((x, j) => el('span', { class: 'c-prog__seg' + (j <= i ? ' is-on' : '') }))));
  }
  function bannerDemo() {
    return m.demo ? el('div', { class: 'c-demo', role: 'status' }, ui.shapeSvg('triangulo', '#1D1B18', 18), 'DEMOSTRACIÓN: no se guarda') : null;
  }
  function nav(o) {
    return el('div', { class: 'c-nav' },
      o.atras ? el('button', { type: 'button', class: 'btn c-btn', onclick: o.atras }, 'Atrás') : el('span'),
      o.sig ? el('button', { type: 'button', class: 'btn btn--primary c-btn c-btn--grow', onclick: o.sig }, o.sigTxt || 'Siguiente') : null);
  }
  const pagina = (...hijos) => el('div', { class: 'c-paso' }, bannerDemo(), progreso(), ...hijos);

  /* ======================= Paso: demostración ======================= */
  function pasoDemo() {
    return pagina(
      el('h2', { class: 'c-h' }, 'Elija un escenario de demostración'),
      el('p', { class: 'lead' }, 'Son tubos dibujados por la aplicación, no muestras reales. Nada de esto se guarda.'),
      el('ul', { class: 'c-list' }, ESCENARIOS.map((s) => el('li', null, el('button', { type: 'button', class: 'c-row', onclick: () => {
        m.escenario = s; m.matriz = s.matriz;
        m.tubos.A = tuboDe(vialSintetico(s.A, 'Tubo A', '#D49300'), null);
        m.tubos.C = s.C ? tuboDe(vialSintetico(s.C, 'Tubo C', '#D95D1E'), null) : null;
        m.nivel2 = false; ir('nivel1');
      } }, el('span', { class: 'c-row__main' }, el('strong', null, s.nombre), el('span', { class: 'cell-sub' }, MATRIZ_TXT[s.matriz] + '. ' + s.desc)))))),
      nav({ atras: reiniciar, sigTxt: 'Salir' }));
  }

  /* ======================= Paso: lugar ======================= */
  function opcionesLugar() {
    const b = C.getBase(), ops = new Map(b.operadores.map((o) => [o.id, o]));
    const todos = [];
    b.pasivos.forEach((p) => todos.push({ tipo: 'pasivo', id: p.id, nombre: p.nombre || 'Pasivo sin nombre', operador_id: p.operador_id || '', lat: p.lat, lng: p.lng,
      sub: [p.tipo || 'Pasivo', p.operador_id && ops.get(p.operador_id) ? ops.get(p.operador_id).nombre : ''].filter(Boolean).join(' · ') }));
    b.operadores.forEach((o) => todos.push({ tipo: 'operador', id: o.id, nombre: o.nombre || o.id, operador_id: o.id, lat: o.lat, lng: o.lng,
      sub: [o.tipo, o.municipio].filter(Boolean).join(' · ') }));
    const q = U.norm(m.filtro);
    const lista = todos.filter((x) => (m.tipoLista === 'todos' || x.tipo === m.tipoLista) && (!q || U.norm(x.nombre + ' ' + x.id + ' ' + x.sub).includes(q)));
    lista.forEach((x) => { x.km = m.pos && x.lat !== null && x.lng !== null && x.lat !== undefined ? U.haversineKm(m.pos, x) : null; });
    lista.sort((a, b) => (a.km === null ? 1 : 0) - (b.km === null ? 1 : 0) || (a.km || 0) - (b.km || 0) || a.nombre.localeCompare(b.nombre, 'es'));
    return { total: lista.length, filas: lista.slice(0, 40) };
  }
  const distTxt = (km) => (km === null ? '' : km < 1 ? Math.round(km * 1000) + ' m' : f1(km) + ' km');

  function listaLugares() {
    const { total, filas } = opcionesLugar();
    const ul = el('ul', { class: 'c-list', 'aria-live': 'polite' }, filas.length ? filas.map((x) => el('li', null, el('button', { type: 'button', class: 'c-row', onclick: () => {
      m.destino = { tipo: x.tipo, id: x.id, nombre: x.nombre, operador_id: x.operador_id, lat: x.lat, lng: x.lng };
      ir('matriz');
    } },
      el('span', { class: 'c-row__ico' }, ui.shapeSvg(x.tipo === 'pasivo' ? 'hexagono' : 'anillo', x.tipo === 'pasivo' ? '#6B3FA0' : '#1D1B18', 20)),
      el('span', { class: 'c-row__main' }, el('strong', null, x.nombre), el('span', { class: 'cell-sub' }, (x.tipo === 'pasivo' ? 'Pasivo' : 'Operador') + ' · ' + x.id + (x.sub ? ' · ' + x.sub : ''))),
      el('span', { class: 'c-row__dist' }, distTxt(x.km))))) : el('li', { class: 'muted c-vacio' }, 'No hay resultados. Pruebe con otro nombre o use "Punto nuevo".'));
    if (total > filas.length) ul.appendChild(el('li', { class: 'muted c-vacio' }, 'Se muestran ' + filas.length + ' de ' + total + '. Escriba para buscar.'));
    return ul;
  }
  function refrescarLista() {
    if (!nodoLista || !nodoLista.isConnected) return;
    const n = listaLugares(); nodoLista.replaceWith(n); nodoLista = n;
  }

  function pasoLugar() {
    const b = C.getBase();
    if (!m.posIntentada) {
      m.posIntentada = true;
      C.posicionRapida().then((p) => { m.pos = p; if (m.paso === 'lugar' && C.vistaActual() === 'muestra') refrescarLista(); });
    }
    const raiz = pagina(el('h2', { class: 'c-h' }, '¿Dónde toma la muestra?'));

    if (m.destino && m.destino.tipo === 'nuevo') {
      const d = el('input', { class: 'input', type: 'text', maxlength: '120', value: m.lugarLibre, placeholder: 'Ej.: quebrada junto al puente', oninput: (ev) => { m.lugarLibre = ev.target.value; } });
      raiz.append(el('p', { class: 'lead' }, 'Punto nuevo: describa el lugar para reconocerlo después.'),
        el('label', { class: 'field' }, el('span', { class: 'field__label' }, 'Descripción del lugar'), d),
        el('p', { class: 'muted' }, 'Si es un pasivo o una operación que falta en la lista, puede crear su ficha en la pestaña Fichas.'),
        nav({ atras: () => { m.destino = null; C.repintar(false); }, sig: () => { if (!m.lugarLibre.trim()) { aviso('Escriba una descripción del lugar.'); return; } ir('matriz'); } }));
      return raiz;
    }

    const bus = el('input', { class: 'input', type: 'search', placeholder: 'Buscar por nombre o código', value: m.filtro, 'aria-label': 'Buscar lugar',
      oninput: U.debounce((ev) => { m.filtro = ev.target.value; refrescarLista(); }, 150) });
    const seg = el('div', { class: 'c-seg', role: 'group', 'aria-label': 'Mostrar' }, [['todos', 'Todos'], ['pasivo', 'Pasivos'], ['operador', 'Operadores']].map(([k, l]) => el('button', {
      type: 'button', class: 'c-seg__btn' + (m.tipoLista === k ? ' is-on' : ''), 'aria-pressed': String(m.tipoLista === k), onclick: () => { m.tipoLista = k; C.repintar(false); } }, l)));
    nodoLista = listaLugares();
    U.append(raiz, [
      el('p', { class: 'lead' }, m.pos ? 'Ordenado del más cercano al más lejano.' : 'Elija el pasivo o la operación donde toma la muestra.'),
      C.avisoBase() ? el('div', { class: 'callout callout--warn' }, C.avisoBase()) : null,
      !b.pasivos.length && !b.operadores.length ? el('div', { class: 'callout' }, 'No hay lista descargada. Puede registrar un punto nuevo, o actualizar la base en la pestaña Cuenta cuando tenga señal.') : null,
      el('button', { type: 'button', class: 'btn btn--primary c-btn c-btn--block', onclick: () => { m.destino = { tipo: 'nuevo' }; C.repintar(false); } }, ui.icon('mas', 22), 'Punto nuevo'),
      bus, seg, nodoLista,
      el('div', { class: 'c-demo-link' }, el('button', { type: 'button', class: 'link', onclick: () => { m = nuevo(); m.demo = true; m.paso = 'demo'; C.repintar(true); } }, 'Modo demostración'))]);
    return raiz;
  }

  /* ======================= Paso: tipo de muestra ======================= */
  function pasoMatriz() {
    const opciones = [['agua', 'Agua', 'Río, quebrada, efluente o pozo.'], ['lodo', 'Lodo o sedimento', 'Colas, relave, poza o fondo de río.']];
    const vol = el('input', { class: 'input', type: 'text', inputmode: 'decimal', value: m.volumen, placeholder: 'Ej.: 35', oninput: (ev) => { m.volumen = ev.target.value; } });
    return pagina(
      el('h2', { class: 'c-h' }, '¿Qué tipo de muestra es?'),
      el('div', { class: 'c-choice', role: 'radiogroup', 'aria-label': 'Tipo de muestra' }, opciones.map(([k, t, d]) => el('button', {
        type: 'button', role: 'radio', 'aria-checked': String(m.matriz === k), class: 'c-choice__btn' + (m.matriz === k ? ' is-on' : ''), onclick: () => { m.matriz = k; C.repintar(false); } },
        el('span', { class: 'c-choice__mark', 'aria-hidden': 'true' }, m.matriz === k ? ui.icon('miestado', 24) : null),
        el('span', { class: 'c-row__main' }, el('strong', null, t), el('span', { class: 'cell-sub' }, d))))),
      m.matriz === 'lodo' ? el('div', { class: 'callout' }, 'Lodo: prepare el extracto antes del tubo A (protocolo HgSense: 1 g de lodo con 10 mL del Frasco 0, tapa roja; agite 2 minutos, deje decantar 2 minutos y filtre). El resultado incluye el factor 10 de esa dilución.') : null,
      el('label', { class: 'field' }, el('span', { class: 'field__label' }, 'Volumen estimado (m³), opcional'), vol,
        el('span', { class: 'field__hint' }, 'Del agua o del lodo que representa la muestra. Puede dejarlo vacío.')),
      nav({ atras: () => ir('lugar'), sig: () => {
        if (!m.matriz) { aviso('Elija si es agua o lodo.'); return; }
        if (m.volumen.trim() && (U.parseNum(m.volumen) === null || U.parseNum(m.volumen) < 0)) { aviso('El volumen debe ser un número, por ejemplo 35.'); return; }
        ir('nivel1');
      } }));
  }

  /* ======================= Paso: Nivel 1 (tubo A) ======================= */
  function pasoNivel1() {
    const t = m.tubos.A, a = lectura(t);
    const listo = a && a.calidad.ok;
    const raiz = pagina(
      el('h2', { class: 'c-h' }, 'Nivel 1: tubo A'),
      el('p', { class: 'lead' }, m.demo ? 'Este es un tubo dibujado. Puede mover el recuadro de medida.' : 'Tubo A, tapa amarilla. Tome la foto con luz pareja, sin flash y con el tubo frente a un fondo claro.'),
      bloqueTubo('A', { nombre: 'tubo A', rotulo: lHg2 }));
    if (listo && a.semaforo !== 'verde') {
      raiz.appendChild(el('div', { class: 'callout callout--warn c-oferta' },
        el('p', null, el('strong', null, 'El resultado pide confirmar. '), m.demo && !m.tubos.C ? 'Este escenario termina en el Nivel 1.' : 'Puede hacer el Nivel 2 (tubos B y C) para estimar el mercurio total y el metilmercurio, que es solo indicativo.'),
        el('div', { class: 'c-btnrow' },
          !m.demo || m.tubos.C ? el('button', { type: 'button', class: 'btn btn--primary c-btn c-btn--block', onclick: () => { m.nivel2 = true; ir('nivel2'); } }, 'Hacer el Nivel 2') : null,
          el('button', { type: 'button', class: 'btn c-btn c-btn--block', onclick: () => { m.nivel2 = false; ir('resultado'); } }, 'Ir al resultado'))));
      raiz.appendChild(nav({ atras: () => ir(m.demo ? 'demo' : 'matriz') }));
    } else {
      raiz.appendChild(nav({ atras: () => ir(m.demo ? 'demo' : 'matriz'), sig: () => {
        if (!t) { aviso('Primero tome la foto del tubo A.'); return; }
        if (!listo) { aviso(a ? a.calidad.avisos[0] : 'No hay lectura.'); return; }
        m.nivel2 = false; ir('resultado');
      } }));
    }
    return raiz;
  }

  /* ======================= Paso: Nivel 2 (tubo C) ======================= */
  function pasoNivel2() {
    const t = m.tubos.C, c = lectura(t), a = lectura(m.tubos.A);
    const raiz = pagina(
      el('h2', { class: 'c-h' }, 'Nivel 2: tubo C'),
      el('p', { class: 'lead' }, m.demo ? 'Tubo C dibujado, después de la luz UV-C.' : 'Tubo B (tapa morada): irradie con luz UV-C de 254 nm según su protocolo. Después mida el tubo C (tapa naranja).'),
      bloqueTubo('C', { nombre: 'tubo C', rotulo: () => el('span', null, 'Mercurio total') }));
    if (c && c.calidad.ok && a) {
      raiz.appendChild(el('p', { class: 'muted' }, 'Metilmercurio indicativo (total menos Hg2+): ' + f1(H.metilmercurio(c.ppb, a.ppb)) + ' ' + UNIDAD[m.matriz] + '. Requiere confirmar en laboratorio.'));
    }
    raiz.appendChild(nav({ atras: () => ir('nivel1'), sig: () => {
      if (!t) { aviso('Primero tome la foto del tubo C.'); return; }
      if (!c.calidad.ok) { aviso(c.calidad.avisos[0]); return; }
      ir('resultado');
    } }));
    return raiz;
  }

  /* ======================= Paso: resultado ======================= */
  function recomendaciones(nivel, matriz, hizoN2) {
    if (nivel === 'verde') return ['Anote el resultado y repita el control según su programa de monitoreo.', 'Si necesita certificar el cumplimiento de una norma, tome una muestra para un laboratorio acreditado.'];
    const r = nivel === 'amarillo'
      ? ['Repita la prueba con una muestra nueva del mismo lugar para confirmar.', 'Envíe una muestra a un laboratorio acreditado.', 'Informe el resultado a la autoridad ambiental del municipio.']
      : ['Envíe una muestra a un laboratorio acreditado cuanto antes.', 'Informe el resultado a la autoridad ambiental del municipio para su seguimiento.', 'Use guantes al manipular la muestra y evite el contacto directo con el agua o el lodo del lugar.'];
    if (nivel === 'rojo' && matriz === 'agua') r.push('Como precaución mientras se confirma, evite que esta agua se use para beber o cocinar.');
    if (!hizoN2) r.push('El Nivel 2 permite estimar el mercurio total; el metilmercurio es solo indicativo.');
    return r;
  }

  function pasoResultado() {
    const k = calculo();
    if (!k) { m.paso = m.demo ? 'demo' : 'lugar'; return pasoLugar(); }
    const s = G4G.config.semaforoMuestra[k.nivel], u = H.UMBRALES[m.matriz];
    const filas = [
      ['Lugar', m.demo ? m.escenario.nombre : (m.destino.tipo === 'nuevo' ? m.lugarLibre : m.destino.nombre)],
      ['Tipo de muestra', MATRIZ_TXT[m.matriz]],
      [lHg2(), f1(k.hg2) + ' ' + UNIDAD[m.matriz]]
    ];
    if (m.nivel2 && k.total !== null) { filas.push(['Mercurio total', f1(k.total) + ' ' + UNIDAD[m.matriz]]); filas.push([lCh3(), f1(k.ch3) + ' ' + UNIDAD[m.matriz] + ' (solo indicativo)']); }
    const raiz = pagina(
      el('h2', { class: 'c-h' }, 'Resultado de campo'),
      el('div', { class: 'c-semaforo c-semaforo--' + k.nivel, role: 'status' }, ui.shapeSvg(s.forma, s.color, 34), el('div', null, el('div', { class: 'c-semaforo__t' }, s.label), el('div', { class: 'c-semaforo__s' }, 'Tamizaje de campo'))),
      el('section', { class: 'card' }, el('div', { class: 'card__body' }, ui.dl(filas))),
      el('h3', { class: 'c-sec' }, 'Qué hacer'),
      el('ul', { class: 'c-recom' }, recomendaciones(k.nivel, m.matriz, m.nivel2).map((x) => el('li', null, x))),
      el('div', { class: 'callout c-norma' }, el('strong', null, 'Importante. '), G4G.hgsense.NOTA_NORMA[m.matriz]),
      el('div', { class: 'c-nota-calib' },
        el('p', { class: 'muted small' }, H.CALIBRACION.texto + '.'),
        el('p', { class: 'muted small' }, el('strong', null, 'Umbrales de campo: '), 'verde, menos de ' + u.amarillo + ' ppb; amarillo, hasta ' + u.rojo + ' ppb; rojo, más de ' + u.rojo + ' ppb.'),
        el('p', { class: 'muted small' }, u.fuente)));
    if (m.demo) {
      raiz.appendChild(el('div', { class: 'c-btnrow' }, el('button', { type: 'button', class: 'btn btn--primary c-btn c-btn--block', onclick: reiniciar }, 'Terminar la demostración')));
      raiz.appendChild(nav({ atras: () => ir(m.nivel2 ? 'nivel2' : 'nivel1') }));
    } else {
      raiz.appendChild(nav({ atras: () => ir(m.nivel2 ? 'nivel2' : 'nivel1'), sig: () => ir('guardar'), sigTxt: 'Continuar para guardar' }));
    }
    return raiz;
  }

  /* ======================= Paso: guardar ======================= */
  async function tomarGps() {
    m.gpsEstado = 'buscando'; m.gpsMsg = ''; pintarGps();
    try {
      const p = await C.ubicacion({ alta: true, timeout: 25000 });
      m.gps = { lat: p.lat, lng: p.lng, precision: p.precision, origen: 'gps' }; m.gpsEstado = 'ok';
    } catch (e) { m.gpsEstado = 'error'; m.gpsMsg = e.message; }
    pintarGps();
  }
  function pintarGps() {
    const nodo = document.getElementById('c-gps'); if (!nodo) return;
    U.clear(nodo);
    if (m.gpsEstado === 'buscando') nodo.appendChild(el('p', { role: 'status' }, 'Buscando la señal GPS…'));
    else if (m.gps) {
      nodo.appendChild(el('p', { class: 'c-gps__val', role: 'status' }, ui.shapeSvg('circulo', '#2E7D4F', 14), ' ' + U.fmtCoord(m.gps.lat, m.gps.lng) + (m.gps.precision ? ' (± ' + U.fmt(m.gps.precision) + ' m)' : ' (escrita a mano)')));
      if (m.gps.precision && m.gps.precision > 50) nodo.appendChild(el('div', { class: 'callout callout--warn' }, 'La precisión es baja. Si puede, salga a cielo abierto y vuelva a tomar la ubicación.'));
      const err = C.validarCoord(m.gps.lat, m.gps.lng);
      if (err) nodo.appendChild(el('div', { class: 'callout callout--warn', role: 'alert' }, err));
    } else nodo.appendChild(el('p', null, m.gpsMsg || 'Aún no hay ubicación.'));
  }

  function pasoGuardar() {
    if (!m.id) m.id = C.idMuestra();
    if (!m.gps && m.gpsEstado !== 'buscando' && m.gpsEstado !== 'error') setTimeout(tomarGps, 0);
    const lat = el('input', { class: 'input', type: 'text', inputmode: 'text', placeholder: '-15.43274', 'aria-label': 'Latitud' });
    const lng = el('input', { class: 'input', type: 'text', inputmode: 'text', placeholder: '-67.50264', 'aria-label': 'Longitud' });
    const manual = () => {
      const la = U.parseNum(lat.value), lo = U.parseNum(lng.value);
      if (la === null || lo === null) return;
      m.gps = { lat: la, lng: lo, precision: null, origen: 'manual' }; m.gpsEstado = 'ok'; pintarGps();
    };
    lat.addEventListener('change', manual); lng.addEventListener('change', manual);
    const lote = el('input', { class: 'input', type: 'text', maxlength: '40', value: m.lote, placeholder: 'Ej.: AG-2026-014', oninput: (ev) => { m.lote = ev.target.value; } });
    const notas = el('textarea', { class: 'input', rows: '3', maxlength: '600', placeholder: 'Observaciones del lugar o de la toma', oninput: (ev) => { m.notas = ev.target.value; } }, m.notas);
    const nombre = m.destino.tipo === 'nuevo' ? m.lugarLibre : m.destino.nombre;
    const k = calculo();
    const guardar = el('button', { type: 'button', class: 'btn btn--primary c-btn c-btn--block c-btn--xl', onclick: (ev) => confirmarGuardado(ev.currentTarget) }, ui.icon('subir', 22), 'Guardar muestra');
    return pagina(
      el('h2', { class: 'c-h' }, 'Ubicación y guardado'),
      el('div', { class: 'callout' }, el('strong', null, nombre), ' · ' + MATRIZ_TXT[m.matriz] + ' · ' + (k ? G4G.config.semaforoMuestra[k.nivel].label : '')),
      el('h3', { class: 'c-sec' }, 'Ubicación de la muestra'),
      el('div', { id: 'c-gps', class: 'c-gps' }),
      el('div', { class: 'c-btnrow' },
        el('button', { type: 'button', class: 'btn c-btn c-btn--block', onclick: tomarGps }, ui.icon('gps', 22), 'Volver a tomar la ubicación'),
        m.destino.tipo !== 'nuevo' && m.destino.lat !== null && m.destino.lat !== undefined && m.destino.lng !== null && m.destino.lng !== undefined
          ? el('button', { type: 'button', class: 'btn c-btn c-btn--block', onclick: () => { m.gps = { lat: m.destino.lat, lng: m.destino.lng, precision: null, origen: 'ficha' }; m.gpsEstado = 'ok'; pintarGps(); } }, 'Usar la ubicación de la ficha') : null),
      el('details', { class: 'c-det' }, el('summary', null, 'Escribir las coordenadas a mano'), el('div', { class: 'c-coords' }, lat, lng)),
      el('label', { class: 'field' }, el('span', { class: 'field__label' }, 'Lote del reactivo'), lote, el('span', { class: 'field__hint' }, 'Opcional. Se recuerda para la próxima muestra.')),
      el('label', { class: 'field' }, el('span', { class: 'field__label' }, 'Nota'), notas),
      guardar,
      nav({ atras: () => ir('resultado') }));
  }

  function confirmarGuardado(btn) {
    const k = calculo();
    if (!k || !m.destino) { aviso('Faltan datos de la muestra.'); return; }
    if (!m.gps) { aviso('Falta la ubicación de la muestra.'); return; }
    const err = C.validarCoord(m.gps.lat, m.gps.lng);
    if (err) { aviso(err); return; }
    btn.disabled = true;
    (async () => {
      let foto = null;
      try { const t = m.tubos.A; if (t && t.file) foto = C.aJpeg(await C.decodificar(t.file), 1280, 0.8); } catch (e) { foto = null; }
      const d = m.destino, nombre = d.tipo === 'nuevo' ? m.lugarLibre.trim() : d.nombre;
      const vol = m.volumen.trim() ? U.parseNum(m.volumen) : null;
      const payload = {
        id: m.id, fecha: new Date().toISOString(),
        pasivo_id: d.tipo === 'pasivo' ? d.id : '', operador_id: d.tipo === 'operador' ? d.id : (d.operador_id || ''),
        lugar: nombre, lat: m.gps.lat, lng: m.gps.lng, precision_m: m.gps.precision ? Math.round(m.gps.precision) : null,
        matriz: m.matriz, volumen_m3: vol,
        hg2_ppb: r2(k.hg2), hg_total_ppb: r2(k.total), ch3hg_ppb: r2(k.ch3), nivel2: !!m.nivel2, semaforo: k.nivel,
        lote_reactivo: m.lote.trim(), confirmado_lab: false, foto, notas: m.notas.trim()
      };
      try {
        const it = C.registrar({ tipo: 'muestra', etiqueta: nombre, detalle: MATRIZ_TXT[m.matriz] + ' · Hg2+ ' + f1(k.hg2) + ' ppb', semaforo: k.nivel, payload });
        C.guardarLote(m.lote.trim());
        m.qid = it.qid; m.paso = 'listo'; C.repintar(true);
      } catch (e) { aviso(e.message); btn.disabled = false; }
    })();
  }

  /* ======================= Paso: listo ======================= */
  function pasoListo() {
    const it = C.itemDeCola(m.qid);
    const est = it ? it.estado : 'enviado';
    const msg = est === 'enviado' ? 'La muestra llegó al servidor.'
      : est === 'error' ? 'El servidor no aceptó la muestra. Revise el motivo en Pendientes.'
      : est === 'enviando' ? 'Enviando…'
      : 'La muestra quedó guardada en este teléfono y se enviará sola cuando haya señal.';
    return el('div', { class: 'c-paso c-listo' },
      el('img', { src: '../img/muestra.svg', alt: '', width: 190, height: 143, decoding: 'async', style: { display: 'block', width: 'min(190px, 56%)', maxHeight: '22vh', objectFit: 'contain', margin: '0 auto' } }),
      el('h2', { class: 'c-h c-listo__t' }, el('span', { class: 'c-listo__ok' }, ui.icon('miestado', 30)), 'Muestra registrada'),
      el('div', { class: 'c-listo__chip' }, C.chipEstado(est)),
      el('p', { class: 'lead', role: 'status' }, msg),
      it && it.error && est !== 'enviado' ? el('p', { class: 'muted' }, it.error) : null,
      el('div', { class: 'c-btnrow' },
        el('button', { type: 'button', class: 'btn btn--primary c-btn c-btn--block c-btn--xl', onclick: reiniciar }, ui.icon('mas', 22), 'Nueva muestra'),
        el('button', { type: 'button', class: 'btn c-btn c-btn--block', onclick: () => C.navegar('pendientes') }, 'Ver pendientes')));
  }

  const PASOS = { demo: pasoDemo, lugar: pasoLugar, matriz: pasoMatriz, nivel1: pasoNivel1, nivel2: pasoNivel2, resultado: pasoResultado, guardar: pasoGuardar, listo: pasoListo };

  function render(host) {
    if (!m.demo && !m.destino && m.paso !== 'lugar' && m.paso !== 'listo') m.paso = 'lugar';
    const f = PASOS[m.paso] || pasoLugar;
    host.appendChild(f());
    if (m.paso === 'guardar') pintarGps();
  }

  G4G.bus.on('cola:changed', () => { if (m.paso === 'listo' && C.vistaActual() === 'muestra') C.repintar(false); });
  C.registrarVista('muestra', { subtitulo: 'Muestra de campo', render });
})();
