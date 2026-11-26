/* ==========================================================================
   Configuración central. Todo lo que cambia entre versiones o regiones vive
   aquí: estados, requisitos, pesos del puntaje, alias de columnas del Excel.
   Los valores marcados "SUPUESTO" son de demostración y deben ser validados
   (ver vault: 05_VALIDACION-GEMINI) antes de usarse en una presentación.
   ========================================================================== */
(function () {
  const G4G = (window.G4G = window.G4G || {});

  G4G.config = {
    nombre: 'Registro y Control Minero',
    version: '0.5.0',

    /* Caja aproximada de Bolivia: se usa para detectar coordenadas erróneas. */
    limites: { latMin: -23.0, latMax: -9.5, lngMin: -69.8, lngMax: -57.4 },
    mapa: {
      centro: [-16.5, -65.2], zoom: 6,
      /* El primero es el predeterminado; si falla se usa el siguiente.
         Probado 2026-11-22: OpenStreetMap y CARTO NO sirven aquí. No dan error:
         devuelven una imagen de aviso ("Access blocked" / "API KEY REQUIRED")
         cuando la página se abre como archivo o sin clave. Esri sí responde con
         mapas reales (uso con atribución; revisar sus términos si se publica). */
      capasBase: [
        { id: 'mapa', nombre: 'Mapa', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', maxZoom: 18, atribucion: 'Mapa base © Esri, HERE, Garmin, OpenStreetMap y colaboradores' },
        { id: 'satelite', nombre: 'Satélite', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', maxZoom: 18, atribucion: 'Imágenes © Esri, Maxar, Earthstar Geographics',
          etiquetas: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}' },
        { id: 'relieve', nombre: 'Relieve', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', maxZoom: 18, atribucion: 'Mapa base © Esri y colaboradores' }
      ]
    },

    /* Un registro sin actualizar por más de estos días se marca como desactualizado. */
    diasDesactualizado: 365,

    /* Conexión opcional a una base remota (solo lectura). Ejemplos:
       - Google Sheets: Archivo > Compartir > Publicar en la Web > CSV (una URL por hoja)
       - GitHub: URL "raw" de un CSV del repositorio
       Si se deja vacío se usan los datos cargados o los de demostración. */
    fuenteRemota: { operadoresUrl: '', pasivosUrl: '' },

    /* Backend con acceso por usuario (Google Apps Script, ver backend/INSTRUCCIONES.md).
       Pegue aquí la URL que termina en /exec. Con backend:
       - el público recibe la base SIN los operadores "No legal" ni sus pasivos (se filtran en el servidor);
       - los funcionarios ingresan con usuario y clave y ven todo, registran datos y atienden denuncias;
       - las denuncias llegan a la hoja "Denuncias" y se ven en TODOS los dispositivos
         (puntos azules en el mapa público; los funcionarios ven además los rojos);
       - el público NUNCA recibe pasivos (colas/relaves) ni operadores "No legal".
       Si está vacío, la app funciona en MODO DEMOSTRACIÓN (sin confidencialidad real). */
    backend: { url: '' },

    /* Detecciones revisadas (sección del municipio): zonas que una persona marcó como
       "Parece actividad minera" en el visor de imágenes satelitales. Son datos confidenciales:
       NO se incluyen en este repositorio; se cargan desde un archivo GeoJSON en la sección
       (quedan solo en el dispositivo). Opcional: si "url" tiene una dirección pública de un
       GeoJSON, la sección intenta descargarlo ahí (ver README). Por defecto vacía. */
    deteccion: { url: '' },

    /* Acceso de funcionarios. La cuenta de demostración SOLO funciona cuando no hay backend
       (con backend, el usuario y la clave están en la hoja "Usuarios", con la clave cifrada). */
    acceso: {
      ocultarAlPublico: ['no_legal'],
      /* Situaciones legales que el público ve en el mapa (verde y amarillo). "Sin verificar" y
         "No legal" solo los ve un funcionario en el mapa. Consultar y la búsqueda siguen mostrando "Sin verificar". */
      mapaPublico: ['legal', 'proceso'],
      demo: { usuario: 'Aurum80', clave: 'Aurum80' }
    },

    /* Denuncias en el mapa. Azul = denuncia recibida (la ve todo el mundo, sin datos personales).
       Rojo (SOLO funcionarios) = denuncia para verificar: estado "En revisión" o ubicada a menos de
       radioNoLegalKm de una operación "No legal". Se actualizan solas cada refrescoSeg segundos. */
    mapaDenuncias: { refrescoSeg: 60, radioNoLegalKm: 2, estadosRojos: ['en_revision'] },

    /* Situación legal del operador. La forma se usa además del color
       para que el mapa se lea sin depender del color. */
    estados: {
      legal:    { label: 'Legal',          color: '#2E7D4F', forma: 'circulo',   orden: 1 },
      proceso:  { label: 'En proceso',     color: '#B97A00', forma: 'triangulo', orden: 2 },
      no_legal: { label: 'No legal',       color: '#B3261E', forma: 'cuadrado',  orden: 3 },
      sin_dato: { label: 'Sin verificar',  color: '#76726A', forma: 'anillo',    orden: 4 }
    },

    /* Requisitos que se muestran como "lo que le falta" a un operador en proceso.
       EJEMPLO EDITABLE: ajustar a la normativa vigente (pendiente de validación). */
    requisitos: [
      { id: 'derecho_minero',      label: 'Derecho minero vigente' },
      { id: 'licencia_ambiental',  label: 'Licencia ambiental' },
      { id: 'registro_actividad',  label: 'Registro de la actividad minera' },
      { id: 'nit',                 label: 'Registro tributario (NIT)' },
      { id: 'plan_colas',          label: 'Plan de manejo de colas' },
      { id: 'responsable_tecnico', label: 'Responsable técnico designado' }
    ],

    /* Pasivos (colas, relaves, desmontes; SOLO funcionarios): familia VIOLETA y forma de HEXÁGONO, distinta de
       verde (legal), amarillo (en proceso), azul (denuncias) y rojo (no legal / denuncia para verificar).
       Escala por clasificación, de más oscuro (más prioridad) a más claro. Mismos valores en css/base.css (--pasivo-1..4). */
    pasivoColor: { 1: '#3E1670', 2: '#6B3FA0', 3: '#8E6BBF', 4: '#A98FD0' },

    tiposOperador: ['Cooperativa', 'Empresa', 'Asociación', 'Planta de beneficio'],
    tiposPasivo: ['Dique de colas', 'Relave', 'Desmonte', 'Acumulación'],

    estructura: {
      estable:     { label: 'Estable',     riesgo: 0.2 },
      deterioro:   { label: 'Deterioro',   riesgo: 0.6 },
      critica:     { label: 'Crítica',     riesgo: 1.0 },
      desconocida: { label: 'Desconocida', riesgo: 0.5 }
    },

    /* Puntaje de priorización de pasivos: riesgo x valor.
       Todo SUPUESTO de demostración; los pesos suman 1. El satélite ubica pero
       no mide mercurio: estos puntajes usan indicadores indirectos (proxies). */
    puntaje: {
      pesosRiesgo: { volumen: 0.20, rio: 0.25, poblado: 0.15, estructura: 0.15, mercurio: 0.15, responsabilidad: 0.10 },
      volumenRefM3: 200000,       // a este volumen el factor "volumen" llega a 1
      distanciaRioMaxM: 2000,     // más lejos que esto, el factor "río" es 0
      distanciaPobladoMaxM: 5000, // idem para poblados
      mercurio: { si: 1.0, desconocido: 0.6, no: 0.1 },
      responsabilidad: { no_legal: 1.0, sin_dato: 0.8, proceso: 0.5, legal: 0.2, sin_operador: 1.0 },
      /* Valor recuperable (índice relativo, no un precio) */
      densidadTM3: 1.6,           // SUPUESTO t/m3
      recuperacion: 0.6,          // SUPUESTO fracción recuperable con tecnología limpia
      precioUsdG: 100,            // SUPUESTO USD/g: actualizar con el precio vigente
      oroRefG: 200000,            // a estos gramos recuperables el índice de valor llega a 100
      umbralRiesgoAlto: 60,
      umbralValorAlto: 50
    },

    tiposDenuncia: [
      'Posible operación sin registro o licencia',
      'Vertido de colas o relaves a un río',
      'Uso visible de mercurio',
      'Acumulación de colas sin control',
      'Otro'
    ],
    estadosDenuncia: {
      nueva:       { label: 'Nueva' },
      en_revision: { label: 'En revisión' },
      atendida:    { label: 'Atendida' },
      descartada:  { label: 'Descartada' }
    },
    /* Estado de una denuncia tal como lo ve el público (resumido: no revela el trabajo interno). */
    estadosDenunciaPublico: {
      abierta:  { label: 'Recibida' },
      atendida: { label: 'Atendida' }
    },
    radioCercaniaKm: 5,

    /* Alias de encabezados del Excel/CSV real. Se comparan sin tildes, sin
       espacios y en minúsculas. Agrega aquí los nombres de columna de su base. */
    columnas: {
      operadores: {
        id: ['id', 'codigo', 'cod', 'nro', 'numero'],
        nombre: ['nombre', 'operador', 'cooperativa', 'razonsocial', 'apm', 'denominacion'],
        tipo: ['tipo', 'tipooperador', 'clase'],
        estado_legal: ['estadolegal', 'estado', 'legalidad', 'situacionlegal', 'situacion', 'categoria', 'condicion'],
        departamento: ['departamento', 'depto', 'dpto'],
        municipio: ['municipio'],
        lat: ['lat', 'latitud', 'y'],
        lng: ['lng', 'lon', 'long', 'longitud', 'x'],
        socios: ['socios', 'nsocios', 'nrosocios', 'numerosocios'],
        actualizado: ['actualizado', 'fechaactualizacion', 'ultimaactualizacion', 'fecha', 'fechaverificacion']
      },
      pasivos: {
        id: ['id', 'codigo', 'cod', 'nro', 'numero'],
        operador_id: ['operadorid', 'idoperador', 'operador', 'cooperativa', 'responsable'],
        nombre: ['nombre', 'sitio', 'denominacion'],
        tipo: ['tipo', 'tipopasivo', 'clase'],
        lat: ['lat', 'latitud', 'y'],
        lng: ['lng', 'lon', 'long', 'longitud', 'x'],
        volumen_m3: ['volumenm3', 'volumen', 'volumenestimado', 'm3'],
        dist_rio_m: ['distriom', 'distanciariom', 'distanciaalrio', 'distrio'],
        dist_poblado_m: ['distpobladom', 'distanciapobladom', 'distanciaalpoblado', 'distpoblado'],
        estructura: ['estructura', 'estadoestructura', 'estadodique', 'estadofisico'],
        uso_hg: ['usohg', 'usomercurio', 'mercurio', 'hg'],
        muestra: ['muestra', 'muestratomada', 'muestreo'],
        ley_au_gt: ['leyaugt', 'leyau', 'ley', 'leyoro', 'gt'],
        actualizado: ['actualizado', 'fechaactualizacion', 'ultimaactualizacion', 'fecha'],
        deteccion: ['deteccion', 'fuentedeteccion', 'origen']
      }
    }
  };
})();
