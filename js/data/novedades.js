/* ==========================================================================
   Datos de Novedades. Para publicar una novedad, agregar un objeto a "items".
   Reglas:
   - Solo hechos que se hayan podido comprobar abriendo la fuente. El resumen es PROPIO
     (1 o 2 frases), nunca un párrafo copiado. Cada afirmación se atribuye a su fuente.
   - Sin fotos de medios (derechos y uso sin conexión): cada item usa una ilustración propia de img/.
   - Lenguaje neutral y no punitivo: no se señala a personas ni a cooperativas.
   - 'verificado' es la fecha en que se abrió la fuente y se confirmó la fecha y las cifras.
   Forma de cada item (no cambiar los nombres de campo):
     { id, tipo: 'noticia' | 'aurum80' | 'guia', fecha: 'AAAA-MM-DD', titulo, resumen, etiquetas: [],
       fuente, url, imagen, destacada, verificado, ruta?, rutaTexto?, nota? }
   'ruta' (opcional) lleva a una sección de la app; 'nota' es un aviso corto que se muestra en el detalle.
   Verificación hecha el 2026-11-26 (ver el informe de la tarea). No se publicó ninguna noticia cuya
   página no abriera: El Diario (bloquea el acceso automático) y CEPAL (error 403) quedaron fuera.
   ========================================================================== */
(function () {
  const G4G = (window.G4G = window.G4G || {});

  G4G.novedades = {
    actualizado: '2026-11-26',
    items: [
      /* ---------- Lo nuevo de Aurum80 y guías prácticas ---------- */
      { id: 'a80-v06-campo', tipo: 'aurum80', fecha: '2026-11-26',
        titulo: 'Llega la versión 0.7 con la app Aurum80 Campo',
        resumen: 'La versión 0.7 suma tres perfiles con ingreso (autoridad, cooperativa o empresa y técnico de campo) y una app aparte, Aurum80 Campo, para tomar muestras de mercurio con foto y ubicación, también sin señal.',
        etiquetas: ['Aurum80', 'Campo', 'Versión 0.7'], fuente: 'Aurum80', url: '', ruta: 'configuracion', rutaTexto: 'Cómo instalar la app',
        imagen: 'img/novedades-aurum80.svg', destacada: true, verificado: '2026-11-26' },
      { id: 'a80-planilla', tipo: 'aurum80', fecha: '2026-11-26',
        titulo: 'Planilla tipo Excel en Aurum80 Campo',
        resumen: 'Aurum80 Campo suma una planilla para cargar muchas muestras o pasivos de una vez, como en una hoja de cálculo. Puedes pegar filas copiadas desde Excel, y lo cargado se guarda en el teléfono y se envía solo cuando vuelve la señal.',
        etiquetas: ['Aurum80', 'Campo', 'Planilla'], fuente: 'Aurum80', url: '', ruta: 'ingresar', rutaTexto: 'Ver cómo ingresar',
        imagen: 'img/novedades-guia.svg', destacada: false, verificado: '2026-11-26' },
      { id: 'a80-animacion', tipo: 'aurum80', fecha: '2026-11-26',
        titulo: 'Programa de biorremediación: ahora con animación',
        resumen: 'En Programas puedes ver, etapa por etapa, cómo sería un proceso de biorremediación: desde tomar muestras hasta el seguimiento. Es un esquema ilustrativo del concepto, no un diseño de planta ni una promesa de resultados.',
        etiquetas: ['Aurum80', 'Programas', 'Biorremediación'], fuente: 'Aurum80', url: '', ruta: 'programas', rutaTexto: 'Ver la animación',
        imagen: 'img/novedades-aurum80.svg', destacada: false, verificado: '2026-11-26' },
      { id: 'a80-tramites', tipo: 'aurum80', fecha: '2026-11-26',
        titulo: 'Trámites para ser legal, ahora con fuente',
        resumen: 'La sección de Trámites muestra los pasos para una cooperativa, con la institución, el documento y la norma de cada uno. Los datos que no se pudieron comprobar llevan la marca Referencial.',
        etiquetas: ['Aurum80', 'Trámites'], fuente: 'Aurum80', url: '', ruta: 'tramites', rutaTexto: 'Ver los trámites',
        imagen: 'img/novedades-formalizacion.svg', destacada: false, verificado: '2026-11-26' },
      { id: 'guia-denunciar', tipo: 'guia', fecha: '2026-11-26',
        titulo: 'Cómo denunciar: tu denuncia llega a la plataforma sin datos personales',
        resumen: 'Aquí no se piden tus datos. Las autoridades revisan la denuncia y verifican la ubicación; si la aceptan, el lugar queda como punto por verificar.',
        etiquetas: ['Guía', 'Denuncias'], fuente: 'Aurum80', url: '', ruta: 'denuncias', rutaTexto: 'Ir a Denunciar',
        nota: 'Para una denuncia formal por minería sin autorización, la AJAM tiene su propio formulario en línea, que sí pide datos de quien denuncia.',
        imagen: 'img/novedades-guia.svg', destacada: false, verificado: '2026-11-26' },
      { id: 'guia-muestra', tipo: 'guia', fecha: '2026-11-26',
        titulo: 'Cómo leer el resultado de una muestra: el verde no significa que cumple la norma',
        resumen: 'La prueba de campo orienta, pero no reemplaza al laboratorio acreditado. Los límites bolivianos son de 1 ppb, por debajo de lo que la prueba distingue con seguridad.',
        etiquetas: ['Guía', 'Muestras', 'Mercurio'], fuente: 'Aurum80', url: '',
        imagen: 'img/novedades-guia.svg', destacada: false, verificado: '2026-11-26' },
      { id: 'guia-limites', tipo: 'guia', fecha: '2026-11-26',
        titulo: 'Límites de mercurio en el agua: 1 ppb (NB 512)',
        resumen: 'La norma boliviana de agua potable, NB 512:2016, fija 0,001 mg/L de mercurio, que equivale a 1 microgramo por litro (1 ppb). La OMS recomienda 0,006 mg/L para el mercurio inorgánico.',
        etiquetas: ['Guía', 'Normas', 'Mercurio'], fuente: 'Compendio normativo del Ministerio de Medio Ambiente y Agua', url: 'https://sihita.org/wp-content/uploads/2022/04/Compendio-Normativo-sobre-Calidad-de-Agua-para-Consumo-Humano.pdf',
        imagen: 'img/novedades-mercurio-rio.svg', destacada: false, verificado: '2026-11-26' },

      /* ---------- Noticias del sector (resumen propio; abrir la fuente para el texto completo) ---------- */
      { id: 'n-servindi-codigo-minero', tipo: 'noticia', fecha: '2026-11-25',
        titulo: 'Organizaciones de territorios afectados rechazan el proyecto de Código Minero',
        resumen: 'Según Servindi, la coordinadora CONTACOM expuso en la Asamblea Legislativa su rechazo al proyecto, que considera hecho sin participación de los pueblos y poblaciones afectadas. Entre sus pedidos figuran la consulta previa y evitar permisos cerca de fuentes de agua.',
        etiquetas: ['Código Minero', 'Comunidades'], fuente: 'Servindi', url: 'https://www.servindi.org/25/11/2026/bolivia-rechazan-codigo-minero-de-muerte',
        imagen: 'img/novedades-ley.svg', destacada: false, verificado: '2026-11-26' },
      { id: 'n-vision360-precio-oro', tipo: 'noticia', fecha: '2026-11-25',
        titulo: 'Opinión: el oro, el mercurio y la salud en la cuenca del río Beni',
        resumen: 'En su columna, Sebastián Crespo Postigo cita un estudio de 2023 en la cuenca del río Beni: el 74,5 % de 302 personas de 36 comunidades indígenas superaba los niveles de referencia de mercurio. Pide controles a toda la cadena del oro.',
        etiquetas: ['Opinión', 'Salud', 'Mercurio'], fuente: 'Visión 360', url: 'https://www.vision360.bo/noticias/2026/11/25/78822-el-verdadero-precio-del-oro',
        nota: 'Es una columna de opinión y no representa una posición oficial del medio.',
        imagen: 'img/novedades-oro.svg', destacada: false, verificado: '2026-11-26' },
      { id: 'n-eju-japon', tipo: 'noticia', fecha: '2026-11-11',
        titulo: 'Bolivia y Japón realizan un taller técnico sobre mercurio',
        resumen: 'Según eju.tv, ambos países reunieron un taller para fortalecer el cumplimiento del Convenio de Minamata, con foco en la minería de oro de pequeña escala y en el monitoreo y análisis del mercurio. El viceministro de Medio Ambiente, Jorge Ávila, destacó la cooperación con Japón.',
        etiquetas: ['Cooperación', 'Convenio de Minamata'], fuente: 'eju.tv', url: 'https://eju.tv/2026/11/bolivia-y-japon-impulsan-la-cooperacion-tecnica-contra-el-uso-de-mercurio/',
        nota: 'La fecha es la de publicación de la nota; la fuente no indica el día del taller.',
        imagen: 'img/novedades-cooperacion.svg', destacada: false, verificado: '2026-11-26' },
      { id: 'n-lostiempos-mercurio', tipo: 'noticia', fecha: '2026-11-03',
        titulo: 'La extracción de oro concentra la mayor parte del mercurio liberado, según un inventario de 2017',
        resumen: 'Los Tiempos cita el inventario nacional de fuentes de mercurio, mencionado por la Defensoría del Pueblo: la minería de oro generaba el 82,3 % de las liberaciones. La nota aclara que es una cifra solo de mercurio y que no permite atribuir ese porcentaje a las cooperativas.',
        etiquetas: ['Mercurio', 'Datos'], fuente: 'Los Tiempos', url: 'https://www.lostiempos.com/actualidad/pais/20261103/bolivia-extraccion-oro-concentra-823-del-mercurio-liberado',
        nota: 'El inventario citado es de 2017: la cifra no describe la situación de hoy.',
        imagen: 'img/novedades-mercurio-rio.svg', destacada: false, verificado: '2026-11-26' },
      { id: 'n-mongabay-beni', tipo: 'noticia', fecha: '2026-08-25',
        titulo: 'Un análisis de estudios reúne datos de mercurio en comunidades de la cuenca del Beni',
        resumen: 'Mongabay Latam revisó 39 estudios científicos. Para Bolivia informa que las 533 muestras de personas de 39 comunidades superaron el límite de la OMS y que se encontró mercurio en 15 especies de peces de alto consumo.',
        etiquetas: ['Salud', 'Mercurio', 'Río Beni'], fuente: 'Mongabay Latam', url: 'https://es.mongabay.com/2026/08/oro-toxico-mercurio-mineria-amenaza-comunidades-cuenca-rio-beni-bolivia/',
        imagen: 'img/novedades-salud.svg', destacada: false, verificado: '2026-11-26' },
      { id: 'n-mongabay-ate', tipo: 'noticia', fecha: '2026-03-19',
        titulo: 'El Gobierno prepara un decreto para adecuar 3982 autorizaciones mineras transitorias',
        resumen: 'Según Mongabay, el borrador convertiría esas autorizaciones en contratos administrativos mineros con pocos requisitos y, para cooperativas, sin exigir licencia ambiental. La Fundación Solón critica la propuesta; el medio también cita datos oficiales sobre el avance de las adecuaciones.',
        etiquetas: ['Formalización', 'Licencia ambiental'], fuente: 'Mongabay Latam', url: 'https://es.mongabay.com/2026/03/bolivia-gobierno-paz-busca-formalizar-permisos-mineros-sin-licencia-ambiental/',
        nota: 'Se trataba de un borrador de decreto en preparación; revisa si fue aprobado y con qué texto.',
        imagen: 'img/novedades-formalizacion.svg', destacada: false, verificado: '2026-11-26' },
      { id: 'n-eju-minamata', tipo: 'noticia', fecha: '2026-02-12',
        titulo: 'El Gobierno prevé ajustar el Plan de Minamata hasta mayo',
        resumen: 'Según eju.tv, el viceministro de Medio Ambiente, Jorge Ávila, fijó mayo como plazo para reforzar el plan ligado al Convenio de Minamata y propuso empezar por un enfoque de persuasión para que los actores se formalicen. La nota recuerda una advertencia del Cedib sobre el plazo hasta 2031.',
        etiquetas: ['Mercurio', 'Plan de acción'], fuente: 'eju.tv', url: 'https://eju.tv/?p=4892581',
        imagen: 'img/novedades-mercurio-rio.svg', destacada: false, verificado: '2026-11-26' }
    ]
  };
})();
