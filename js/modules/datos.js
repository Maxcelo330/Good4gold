/* Módulo: Datos. Conexión con la base (Excel/CSV/URL) y calidad de la información. */
(function () {
  const G4G = (window.G4G = window.G4G || {});
  const U = G4G.util, { el } = U;
  const ui = () => G4G.ui;

  async function cargarArchivo(file) {
    try {
      const { dataset, informe } = await G4G.importer.importar(file);
      const persistido = G4G.store.setDataset(dataset, { origen: 'archivo', archivo: file.name, informe });
      ui().toast(`Se cargó "${file.name}": ${dataset.operadores.length} operadores y ${dataset.pasivos.length} pasivos.` + (persistido ? '' : ' (No se pudo recordar para la próxima vez: archivo grande.)'));
    } catch (e) { ui().toast(e.message, 'warn'); }
  }

  function informeLectura(meta) {
    if (!meta.informe) return el('p', { class: 'muted' }, 'Se mostrará aquí qué columnas se reconocieron al cargar un archivo.');
    return el('div', { class: 'readreport' }, ['operadores', 'pasivos'].map((k) => {
      const i = meta.informe[k];
      if (!i) return el('div', { class: 'readreport__block' }, el('h4', null, k === 'operadores' ? 'Operadores' : 'Pasivos'), el('p', { class: 'muted' }, 'No se encontró esta tabla en el archivo.'));
      return el('div', { class: 'readreport__block' },
        el('h4', null, `${k === 'operadores' ? 'Operadores' : 'Pasivos'} · ${U.fmt(i.filas)} filas`), el('div', { class: 'cell-sub' }, `Hoja: ${i.hoja}`),
        i.faltantes.length ? el('div', { class: 'callout callout--warn' }, 'Faltan columnas obligatorias: ', el('strong', null, i.faltantes.join(', '))) : el('div', { class: 'callout' }, 'Columnas obligatorias completas.'),
        el('div', { class: 'tags' }, i.reconocidas.map((r) => el('span', { class: 'tag' }, `${r.columna} → ${r.campo}`))),
        i.ignoradas.length ? el('details', null, el('summary', null, `${i.ignoradas.length} columnas ignoradas`), el('div', { class: 'tags' }, i.ignoradas.map((c) => el('span', { class: 'tag tag--muted' }, c)))) : null);
    }));
  }

  function abrirRegistro(id) {
    if (G4G.store.getOperador(id)) G4G.detalle.operador(id); else if (G4G.store.getPasivo(id)) G4G.detalle.pasivo(id);
  }

  function render(root) {
    const S = G4G.store, meta = S.state.meta;
    const fileInput = el('input', { type: 'file', accept: '.xlsx,.xls,.csv', class: 'visually-hidden', id: 'archivo-datos', onchange: (e) => { if (e.target.files[0]) cargarArchivo(e.target.files[0]); e.target.value = ''; } });

    const origen = el('div', null,
      meta.origen === 'demo'
        ? el('div', { class: 'callout callout--warn' }, el('strong', null, 'Datos simulados. '), 'Los nombres y estados legales son inventados y no representan a ninguna cooperativa real. Cargue su Excel para trabajar con datos reales.')
        : el('div', { class: 'callout' }, el('strong', null, meta.archivo || meta.url || 'Archivo'), ` · cargado el ${U.fmtDateTime(meta.cargado)}`),
      ui().dl([['Operadores', U.fmt(S.state.operadores.length)], ['Pasivos', U.fmt(S.state.pasivos.length)]]),
      el('div', { class: 'row-gap' },
        G4G.api.activo() ? null : [el('label', { class: 'btn btn--primary', for: 'archivo-datos' }, ui().icon('subir', 16), 'Cargar Excel o CSV'), fileInput],
        ui().button('Plantilla Excel', { icon: 'descargar', title: 'Descarga un libro con las hojas Operadores y Pasivos', onclick: () => U.download('plantilla-registro-minero.xlsx', 'application/octet-stream', G4G.importer.plantillaXLSX(S.state.operadores, S.state.pasivos)) }),
        meta.origen !== 'demo' && !G4G.api.activo() ? ui().button('Volver a la demostración', { onclick: () => { S.cargarDemo(); ui().toast('Se restauraron los datos de demostración.'); } }) : null),
      el('p', { class: 'muted small' }, G4G.api.activo() ? 'La base vive en la hoja de Google del municipio. Se actualiza desde Registrar datos o editando la hoja; la app la vuelve a leer al abrirse.' : 'La app solo lee el archivo: nunca lo modifica. Para actualizar datos, edite su Excel y vuelva a cargarlo.'));

    const guardada = S.fuenteGuardada() || { operadores: '', pasivos: '' };
    const urlOp = el('input', { class: 'input mono', type: 'url', placeholder: 'https://…/operadores.csv', value: guardada.operadores || G4G.config.fuenteRemota.operadoresUrl });
    const urlPa = el('input', { class: 'input mono', type: 'url', placeholder: 'https://…/pasivos.csv', value: guardada.pasivos || G4G.config.fuenteRemota.pasivosUrl });
    const remota = el('div', { class: 'form' },
      el('p', { class: 'muted' }, 'Opcional. Conecte la base publicada en línea (solo lectura): Google Sheets con "Publicar en la Web → CSV", o un CSV del repositorio de GitHub.'),
      ui().field('Hoja de operadores (CSV)', urlOp), ui().field('Hoja de pasivos (CSV)', urlPa),
      el('div', { class: 'row-gap' }, ui().button('Conectar y cargar', { kind: 'primary', onclick: async () => {
        try {
          const { dataset, informe } = await S.cargarDesdeUrl(urlOp.value.trim(), urlPa.value.trim());
          S.guardarFuente({ operadores: urlOp.value.trim(), pasivos: urlPa.value.trim() });
          S.setDataset(dataset, { origen: 'url', archivo: 'Fuente en línea', url: urlOp.value.trim() || urlPa.value.trim(), informe });
          ui().toast('Datos cargados desde la fuente en línea.');
        } catch (e) { ui().toast(e.message + ' Verifique que la URL sea pública.', 'warn'); }
      } })));

    /* Validación */
    const issues = S.validar();
    const orden = { error: 0, warn: 1, info: 2 }, rotulo = { error: 'Error', warn: 'Advertencia', info: 'Nota' };
    const validacion = issues.length ? el('ul', { class: 'issues' }, issues.sort((a, b) => orden[a.sev] - orden[b.sev]).map((i) => el('li', { class: 'issue issue--' + i.sev },
      el('details', null,
        el('summary', null, el('span', { class: 'issue__sev' }, rotulo[i.sev]), el('span', { class: 'issue__title' }, i.titulo), el('span', { class: 'issue__n' }, U.fmt(i.ids.length))),
        el('p', { class: 'muted' }, i.nota),
        el('div', { class: 'tags' }, i.ids.slice(0, 30).map((id) => el('button', { type: 'button', class: 'tag tag--btn', onclick: () => abrirRegistro(id) }, id)), i.ids.length > 30 ? el('span', { class: 'muted' }, `… y ${i.ids.length - 30} más`) : null))))) : ui().empty('Sin observaciones: la base pasa todas las validaciones.');
    const comp = S.completitud();

    root.appendChild(el('div', { class: 'grid grid--2' }, ui().card('Origen de los datos', origen), G4G.api.activo() ? ui().card('Servidor del municipio', el('div', null, el('p', null, 'Conectado a la base del municipio (Google Apps Script).'), el('p', { class: 'muted small mono' }, G4G.config.backend.url))) : ui().card('Conexión en línea (solo lectura)', remota)));
    root.appendChild(ui().card('Informe de lectura', informeLectura(meta)));
    root.appendChild(ui().card('Calidad y validación de la base', [
      el('div', { class: 'quality quality--row' },
        el('div', null, el('div', { class: 'quality__label' }, 'Operadores completos'), el('div', { class: 'progress' }, ui().meter(comp.operadores), el('span', null, comp.operadores + '%'))),
        el('div', null, el('div', { class: 'quality__label' }, 'Pasivos completos'), el('div', { class: 'progress' }, ui().meter(comp.pasivos), el('span', null, comp.pasivos + '%')))),
      validacion]));
    root.appendChild(ui().card('Formato esperado', el('div', null,
      el('p', null, 'Un libro de Excel con dos hojas, ', el('strong', null, 'Operadores'), ' y ', el('strong', null, 'Pasivos'), ', o un CSV por tabla. Los nombres de columna se reconocen aunque cambien tildes, mayúsculas o espacios; los alias aceptados están en ', el('span', { class: 'mono' }, 'js/config/config.js'), '.'),
      el('p', { class: 'muted' }, 'Situación legal: Legal / Formal, En proceso / Informal, No legal / Ilegal. Cualquier otro valor se marca como "Sin verificar". Los requisitos van en columnas req_… con valores sí/no.'))));
  }

  G4G.app.register({ id: 'datos', titulo: 'Datos', icono: 'datos', orden: 12, grupo: 'tecnico', subtitulo: 'Conexión con la base y calidad de la información', render });
})();
