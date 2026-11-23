/* Módulo: Denunciar. Asistente en tres pasos (qué viste, dónde, foto y envío).
   Se guarda en el dispositivo (no toca la base) y se exporta para el
   funcionario. Si se llega desde el mapa, la ubicación ya viene marcada. */
(function () {
  const G4G = (window.G4G = window.G4G || {});
  const U = G4G.util, { el } = U;
  const ui = () => G4G.ui;

  const AYUDA = {
    'Posible operación sin registro o licencia': 'Maquinaria, dragas o personas trabajando donde no aparece una operación registrada.',
    'Vertido de colas o relaves a un río': 'Agua turbia, lodo o descargas de residuos que llegan a un río o quebrada.',
    'Uso visible de mercurio': 'Amalgamación, quema de amalgama o envases de mercurio a la vista.',
    'Acumulación de colas sin control': 'Montículos o diques de residuos sin protección que se escurren con la lluvia.',
    'Otro': 'Cualquier otra situación relacionada con la minería que quieras reportar.'
  };
  const PASOS = ['Qué viste', 'Dónde', 'Foto y envío'];

  let raiz = null, mini = null, marcador = null;
  const nuevo = () => ({ paso: 1, tipo: null, descripcion: '', lat: null, lng: null, precision: null, origen: null, foto: null, declaro: false, enviada: null });
  let b = nuevo();

  function reducirFoto(file, maxLado = 1280, calidad = 0.72) {
    return new Promise((resolve, reject) => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        const k = Math.min(1, maxLado / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url); resolve(c.toDataURL('image/jpeg', calidad));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen.')); };
      img.src = url;
    });
  }

  function aguaTexto(lat, lng) {
    const a = G4G.hidro.masCercano(lat, lng);
    if (!a) return null;
    const pref = a.tipo === 'river' && a.nombre && !/^(r[ií]o|arroyo|quebrada)/i.test(a.nombre) ? 'Río ' : '';
    const nombre = a.nombre ? pref + a.nombre : 'curso de agua sin nombre';
    return el('div', { class: 'geo-water' }, el('strong', null, a.fuente === 'detalle' ? 'Curso de agua más cercano: ' : 'Río principal más cercano: '), `${nombre}, a ${a.km < 1 ? U.fmt(a.km * 1000) + ' m' : U.fmt(a.km, 1) + ' km'}.`);
  }
  function cercaniaNodo(lat, lng) {
    const R = G4G.config.radioCercaniaKm;
    const ops = G4G.detalle.cercanos(lat, lng, R).filter((c) => c.tipo === 'operador');
    const agua = aguaTexto(lat, lng);
    if (!ops.length) return el('div', null, el('div', { class: 'geo-near is-alert' }, `No hay operaciones registradas a menos de ${R} km: tu reporte puede ayudar a identificar actividad no registrada.`), agua);
    const o = ops[0];
    return el('div', null, el('div', { class: 'geo-near' }, `${ops.length} operación${ops.length > 1 ? 'es' : ''} registrada${ops.length > 1 ? 's' : ''} a menos de ${R} km. La más cercana: `,
      el('strong', null, o.reg.nombre), ` (${U.fmt(o.d, 1)} km, ${G4G.config.estados[o.reg.estado_legal].label}).`), agua);
  }

  /* ---------- Pasos ---------- */
  function paso1(pie) {
    const siguiente = ui().button('Siguiente', { kind: 'primary', disabled: !b.tipo, onclick: () => { b.paso = 2; pintar(); } });
    pie.append(el('span'), siguiente);
    return el('div', null,
      b.origen === 'mapa' ? el('div', { class: 'note note--lock' }, ui().icon('gps', 15), el('span', null, `Ubicación ya marcada desde el mapa (${U.fmtCoord(b.lat, b.lng)}). Podrás ajustarla en el paso 2.`)) : null,
      el('p', { class: 'step-q' }, '¿Qué observaste?'),
      el('div', { class: 'options', role: 'radiogroup', 'aria-label': 'Tipo de denuncia' }, G4G.config.tiposDenuncia.map((t) => el('button', {
        type: 'button', role: 'radio', 'aria-checked': String(b.tipo === t), class: 'option' + (b.tipo === t ? ' is-on' : ''),
        onclick: () => { b.tipo = t; pintar(); }
      }, el('span', { class: 'option__dot', 'aria-hidden': 'true' }), el('span', { class: 'option__text' }, el('span', { class: 'option__title' }, t), el('span', { class: 'option__help' }, AYUDA[t] || ''))))),
      ui().field('Cuéntanos más (opcional)', el('textarea', { class: 'input', rows: 3, placeholder: 'Desde cuándo ocurre, si hay maquinaria, cómo se ve el agua…', oninput: (e) => { b.descripcion = e.target.value; } }, b.descripcion)));
  }

  function paso2(pie) {
    const siguiente = ui().button('Siguiente', { kind: 'primary', disabled: b.lat === null, onclick: () => { b.paso = 3; pintar(); } });
    pie.append(ui().button('Atrás', { onclick: () => { b.paso = 1; pintar(); } }), siguiente);
    const estado = el('div', { class: 'geo-status' + (b.lat !== null ? ' is-ok' : ''), role: 'status' }, b.lat !== null ? `Ubicación marcada: ${U.fmtCoord(b.lat, b.lng)}` + (b.precision ? ` · precisión ± ${U.fmt(b.precision)} m` : '') : 'Todavía no marcaste la ubicación.');
    const cerca = el('div', null, b.lat !== null ? cercaniaNodo(b.lat, b.lng) : null);
    const latIn = el('input', { class: 'input mono', type: 'text', inputmode: 'decimal', placeholder: 'Latitud  -15.55000', 'aria-label': 'Latitud', value: b.lat !== null ? b.lat.toFixed(5) : '' });
    const lngIn = el('input', { class: 'input mono', type: 'text', inputmode: 'decimal', placeholder: 'Longitud  -67.75000', 'aria-label': 'Longitud', value: b.lng !== null ? b.lng.toFixed(5) : '' });

    function fijar(lat, lng, precision, mover = true) {
      b.lat = lat; b.lng = lng; b.precision = precision || null;
      latIn.value = lat.toFixed(5); lngIn.value = lng.toFixed(5);
      estado.className = 'geo-status is-ok';
      estado.textContent = `Ubicación marcada: ${U.fmtCoord(lat, lng)}` + (precision ? ` · precisión ± ${U.fmt(precision)} m` : '');
      U.clear(cerca); cerca.appendChild(cercaniaNodo(lat, lng));
      siguiente.disabled = false;
      if (mini) {
        if (!marcador) marcador = L.marker([lat, lng], { draggable: true, icon: L.divIcon({ className: 'mk', html: '<svg width="26" height="26" viewBox="0 0 26 26"><circle cx="13" cy="13" r="11" fill="#1F4E9C" stroke="#fff" stroke-width="2.5"/><text x="13" y="18" text-anchor="middle" font-size="14" font-weight="700" fill="#fff" font-family="Roboto,Arial">!</text></svg>', iconSize: [26, 26], iconAnchor: [13, 13] }) })
          .addTo(mini).on('dragend', (e) => { const p = e.target.getLatLng(); fijar(p.lat, p.lng, null, false); });
        else marcador.setLatLng([lat, lng]);
        if (mover) mini.setView([lat, lng], Math.max(mini.getZoom(), 13));
      }
    }
    function gps(btn) {
      if (!navigator.geolocation) { ui().toast('Este dispositivo no permite obtener la ubicación.', 'warn'); return; }
      estado.textContent = 'Buscando señal GPS…'; btn.disabled = true;
      navigator.geolocation.getCurrentPosition(
        (pos) => { btn.disabled = false; fijar(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy); },
        (err) => { btn.disabled = false; estado.textContent = err.code === 1 ? 'Permiso de ubicación denegado. Toca el mapa o escribe las coordenadas.' : 'No se pudo obtener la ubicación. Toca el mapa o escribe las coordenadas.'; },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
    }
    function desdeCampos() {
      const la = U.parseNum(latIn.value), lo = U.parseNum(lngIn.value), Lm = G4G.config.limites;
      if (la === null || lo === null) return;
      if (la < Lm.latMin || la > Lm.latMax || lo < Lm.lngMin || lo > Lm.lngMax) { estado.className = 'geo-status'; estado.textContent = 'Esas coordenadas están fuera de Bolivia. En Bolivia la latitud y la longitud son negativas.'; return; }
      fijar(la, lo, null);
    }
    latIn.addEventListener('change', desdeCampos); lngIn.addEventListener('change', desdeCampos);

    const mapaDiv = el('div', { class: 'minimap', 'aria-label': 'Toca el mapa para marcar el lugar' });
    const nodo = el('div', null,
      el('p', { class: 'step-q' }, '¿Dónde ocurre?'),
      el('div', { class: 'row-gap' }, el('button', { type: 'button', class: 'btn btn--big', onclick: (e) => gps(e.currentTarget) }, ui().icon('gps', 18), 'Usar mi ubicación actual'), el('span', { class: 'muted small' }, 'o toca el mapa / arrastra el marcador')),
      mapaDiv, el('div', { class: 'coords' }, latIn, lngIn), estado, cerca);
    /* El mapa se crea cuando el nodo ya está en la página. */
    setTimeout(() => {
      const c = G4G.config.mapa;
      mini = L.map(mapaDiv, { center: b.lat !== null ? [b.lat, b.lng] : c.centro, zoom: b.lat !== null ? 13 : 5, attributionControl: false });
      G4G.basemap.crear(mini);
      mini.on('click', (e) => fijar(e.latlng.lat, e.latlng.lng, null, false));
      if (b.lat !== null) fijar(b.lat, b.lng, b.precision);
    }, 0);
    return nodo;
  }

  function paso3(pie) {
    const enviar = ui().button('Enviar denuncia', { kind: 'primary', icon: 'subir', disabled: !b.declaro, onclick: guardar });
    pie.append(ui().button('Atrás', { onclick: () => { b.paso = 2; pintar(); } }), enviar);
    const input = el('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'visually-hidden', id: 'foto-input' });
    input.addEventListener('change', async () => {
      const f = input.files[0]; if (!f) return;
      try { b.foto = await reducirFoto(f); pintar(); } catch (e) { ui().toast(e.message, 'warn'); }
    });
    return el('div', null,
      el('p', { class: 'step-q' }, 'Agrega una foto (recomendado)'),
      b.foto
        ? el('div', { class: 'photo-preview' }, el('img', { src: b.foto, alt: 'Foto de la denuncia' }), el('button', { type: 'button', class: 'link', onclick: () => { b.foto = null; pintar(); } }, 'Quitar foto'))
        : el('label', { class: 'dropzone', for: 'foto-input' }, ui().icon('denuncias', 28), el('strong', null, 'Tomar o elegir una foto'), el('span', { class: 'muted small' }, 'Se reduce automáticamente para ahorrar espacio')),
      input,
      el('p', { class: 'step-q' }, 'Revisa tu denuncia'),
      ui().dl([['Qué', b.tipo], ['Detalle', b.descripcion || 'Sin descripción'], ['Dónde', el('span', { class: 'mono' }, U.fmtCoord(b.lat, b.lng))]]),
      el('label', { class: 'check check--block' }, el('input', { type: 'checkbox', checked: b.declaro, onchange: (e) => { b.declaro = e.target.checked; enviar.disabled = !b.declaro; } }),
        'Declaro que lo que reporto es lo que observé directamente.'));
  }

  function guardar() {
    const id = U.uid('DEN');
    const codigo = 'DEN-' + id.slice(-6).toUpperCase();
    b.enviada = { id, codigo };
    const conServidor = G4G.api.activo();
    const reg = { id, codigo, creado: Date.now(), tipo: b.tipo, descripcion: b.descripcion.trim(), foto: b.foto, lat: b.lat, lng: b.lng, precision: b.precision, estado: 'nueva', envio: conServidor ? 'pendiente' : null };
    const ok = G4G.store.addDenuncia(reg);
    if (!ok) { b.enviada = null; ui().toast('No se pudo guardar: el almacenamiento del dispositivo está lleno. Exporta y elimina denuncias antiguas.', 'warn'); pintar(); return; }
    if (conServidor) {
      b.enviada.envio = 'enviando'; pintar();
      G4G.store.enviarDenuncia(reg)
        .then(() => { if (b.enviada && b.enviada.id === id) { b.enviada.envio = 'enviada'; pintar(); } })
        .catch(() => { if (b.enviada && b.enviada.id === id) { b.enviada.envio = 'pendiente'; pintar(); } });
    }
  }

  function exito() {
    const d = b.enviada;
    const reg = G4G.store.state.denuncias.find((x) => x.id === d.id);
    return el('div', { class: 'success' },
      el('div', { class: 'success__mark', 'aria-hidden': 'true' }, '✓'),
      el('h2', null, 'Denuncia registrada'),
      el('div', { class: 'success__code' }, 'Código de seguimiento ', el('strong', { class: 'mono' }, d.codigo)),
      el('p', null, d.envio === 'enviada' ? 'Se envió a la autoridad del municipio para su verificación. Guarda el código para hacer seguimiento.'
        : d.envio === 'enviando' ? 'Enviando a la autoridad del municipio…'
        : d.envio === 'pendiente' ? 'No hay conexión con el servidor ahora. Quedó guardada en este dispositivo y se enviará sola cuando vuelva la señal.'
        : 'Quedó guardada en este dispositivo (modo demostración, sin servidor). Puedes exportarla y entregarla a la autoridad.'),
      el('div', { class: 'row-gap center' },
        reg ? ui().button('Ver en el mapa', { icon: 'mapa', onclick: () => G4G.app.go('mapa', { foco: { lat: reg.lat, lng: reg.lng, id: reg.id } }) }) : null,
        ui().button('Hacer otra denuncia', { kind: 'primary', onclick: () => { b = nuevo(); pintar(); } })));
  }

  /* ---------- Lista de denuncias del dispositivo ---------- */
  function lista() {
    const d = G4G.store.state.denuncias;
    const cuerpo = d.length ? el('ul', { class: 'denlist' }, d.map((x) => el('li', null,
      el('button', { type: 'button', class: 'denlist__row', onclick: () => G4G.detalle.denuncia(x.id) },
        x.foto ? el('img', { src: x.foto, alt: '', class: 'denlist__thumb' }) : el('span', { class: 'denlist__thumb denlist__thumb--empty' }, ui().icon('denuncias', 20)),
        el('span', { class: 'denlist__main' }, el('span', { class: 'cell-main' }, x.tipo), el('span', { class: 'cell-sub' }, `${x.codigo || x.id} · ${U.fmtDateTime(x.creado)}`)),
        x.envio === 'pendiente' ? el('span', { class: 'chip chip--warn', title: 'Se enviará al volver la conexión' }, 'Sin enviar') : x.envio === 'enviada' ? el('span', { class: 'chip chip--ok' }, 'Enviada') : null,
        ui().estadoDenunciaChip(x.estado))))) : ui().empty('Todavía no hay denuncias en este dispositivo.');
    const geo = () => U.download('denuncias.geojson', 'application/geo+json', JSON.stringify({ type: 'FeatureCollection', features: d.map((x) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [x.lng, x.lat] }, properties: { id: x.id, codigo: x.codigo, tipo: x.tipo, descripcion: x.descripcion, creado: new Date(x.creado).toISOString(), precision_m: x.precision, estado: x.estado } })) }, null, 2));
    const csv = () => U.download('denuncias.csv', 'text/csv;charset=utf-8', U.toCSV(d, [{ key: 'codigo', label: 'codigo' }, { key: 'tipo', label: 'tipo' }, { key: 'descripcion', label: 'descripcion' }, { label: 'fecha', get: (x) => new Date(x.creado).toISOString() }, { key: 'lat', label: 'lat' }, { key: 'lng', label: 'lng' }, { key: 'precision', label: 'precision_m' }, { key: 'estado', label: 'estado' }]));
    const json = () => U.download('denuncias-con-fotos.json', 'application/json', JSON.stringify(d));
    const acciones = d.length ? [ui().button('GeoJSON', { icon: 'descargar', onclick: geo }), ui().button('CSV', { icon: 'descargar', onclick: csv }), ui().button('Con fotos', { icon: 'descargar', onclick: json })] : null;
    return ui().card(`Mis denuncias (${d.length})`, [cuerpo, el('p', { class: 'muted small' }, G4G.api.activo() ? 'Copia en este dispositivo. Las que dicen "Sin enviar" se envían solas al volver la señal.' : 'Se guardan solo en este dispositivo, separadas de la base de datos.')], acciones);
  }

  function pintar() {
    if (!raiz) return;
    if (mini) { mini.remove(); mini = null; marcador = null; }
    U.clear(raiz);
    let contenido;
    if (b.enviada) contenido = exito();
    else {
      const pie = el('div', { class: 'wizard__foot' });
      const cuerpo = b.paso === 1 ? paso1(pie) : b.paso === 2 ? paso2(pie) : paso3(pie);
      contenido = el('div', null,
        el('ol', { class: 'steps' }, PASOS.map((p, i) => {
          const n = i + 1, hecho = n < b.paso;
          return el('li', { class: (n === b.paso ? 'is-current' : '') + (hecho ? ' is-done' : '') },
            el('button', { type: 'button', disabled: !hecho, onclick: () => { b.paso = n; pintar(); } }, el('span', { class: 'steps__n' }, hecho ? '✓' : n), el('span', { class: 'steps__label' }, p)));
        })),
        el('div', { class: 'wizard__body' }, cuerpo), pie);
    }
    raiz.appendChild(el('div', { class: 'grid grid--den' }, el('section', { class: 'card wizard' }, el('div', { class: 'card__body' }, contenido)), lista()));
  }

  function render(root) { raiz = root; pintar(); }
  function onShow(root, params) {
    if (params && params.ubicacion) {
      b = nuevo(); b.lat = params.ubicacion.lat; b.lng = params.ubicacion.lng; b.origen = params.ubicacion.origen || 'mapa';
      pintar();
    }
    setTimeout(() => { if (mini) mini.invalidateSize(); }, 80);
  }

  G4G.app.register({ id: 'denuncias', titulo: 'Denunciar', icono: 'denuncias', orden: 3, grupo: 'ciudadania', subtitulo: 'Reporta lo que ves en tres pasos: qué, dónde y una foto', render, onShow });
})();
