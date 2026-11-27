/* ==========================================================================
   Normativa, trámites e informaciones de la plataforma. Fuente única de lo que la app
   afirma sobre leyes bolivianas, límites de mercurio y trámites.

   Todo dato salió de una verificación con fuentes abiertas hecha el 2026-11-26
   (agente normativa-bo). Reglas:
   - Lo que NO pudo comprobarse lleva estado 'referencial' y la app lo rotula así.
   - No agregar leyes, artículos ni cifras en otros archivos: se agregan aquí, con su fuente.
   - Antes de usar la plataforma con una cooperativa real, confirmar los trámites con la AJAM
     y con la gobernación: los requisitos cambian y esto es orientación, no asesoría legal.

   Forma de los datos (no cambiar los nombres de campo):
   G4G.normativa = {
     verificado: 'AAAA-MM-DD',
     normas:        [{ id, titulo, anio, resumen, estado, fuente, url }],
     tramites:      [{ n, id, titulo, institucion, documento, detalle, norma, requisito, url, estado }],
     informaciones: [{ id, titulo, texto, fuente, url }],
     mercurio:      { agua: [...], sedimento: [...], tamizaje: {...}, nota }
   }
   ========================================================================== */
(function () {
  const G4G = (window.G4G = window.G4G || {});

  G4G.normativa = {
    verificado: '2026-11-26',

    normas: [
      { id: 'ley1333', titulo: 'Ley 1333 del Medio Ambiente', anio: 1992, estado: 'verificado',
        resumen: 'Es la ley marco del ambiente en Bolivia. Dice que toda persona tiene el deber de denunciar ante la autoridad competente las infracciones a las normas que protegen el ambiente (art. 100).',
        fuente: 'Lexivox, texto de la ley', url: 'https://www.lexivox.org/norms/BO-L-1333.html' },
      { id: 'rmch', titulo: 'Reglamento en Materia de Contaminación Hídrica (DS 24176)', anio: 1995, estado: 'referencial',
        resumen: 'Fija 0,001 mg/L de mercurio en las cuatro clases de cuerpos de agua (A, B, C y D, Anexo A, cuadro A-1). Para descargas líquidas, 0,002 mg/L por día y 0,001 mg/L por mes (Anexo A-2). La cifra se leyó en un escaneo de la norma: conviene cotejarla con la Gaceta Oficial.',
        fuente: 'Compilación con el escaneo del Anexo A', url: 'https://www.consultores-ambientales.com.bo/wp-content/uploads/2016/04/4.-Reglamento-en-Mareria-de-Contaminacion-Hidrica-RMCH.pdf' },
      { id: 'nb512', titulo: 'Norma Boliviana NB 512:2016, agua potable', anio: 2016, estado: 'verificado',
        resumen: 'El límite de mercurio en agua para consumo humano es 0,001 mg/L (1 microgramo por litro), según la tabla de requisitos químicos. Rige con el reglamento de la RM 126 de 2018.',
        fuente: 'Compendio del Ministerio de Medio Ambiente y Agua con IBNORCA', url: 'https://sihita.org/wp-content/uploads/2022/04/Compendio-Normativo-sobre-Calidad-de-Agua-para-Consumo-Humano.pdf' },
      { id: 'raam', titulo: 'Reglamento Ambiental para Actividades Mineras (DS 24782)', anio: 1997, estado: 'verificado',
        resumen: 'Las actividades mineras necesitan licencia ambiental. Las cooperativas pueden presentar un manifiesto ambiental común (art. 124). Hoy el nivel de categoría se define con el DS 3549 de 2018 (formulario de categorización ambiental).',
        fuente: 'Lexivox', url: 'https://www.lexivox.org/norms/BO-RE-DS24782.html' },
      { id: 'ley535', titulo: 'Ley 535 de Minería y Metalurgia', anio: 2014, estado: 'verificado',
        resumen: 'Regula los derechos mineros, los contratos administrativos mineros con la AJAM y el Registro Minero. Las cooperativas pueden solicitar contrato con un máximo de 250 cuadrículas (arts. 127, 128 y 141). El art. 104 establece la suspensión de actividades sin derecho minero. Fue modificada por las leyes 845 y 1140: revisa siempre la versión vigente.',
        fuente: 'Lexivox', url: 'https://www.lexivox.org/norms/BO-L-N535.html' },
      { id: 'ley1140', titulo: 'Ley 1140', anio: 2018, estado: 'verificado',
        resumen: 'En áreas de COMIBOL, las cooperativas firman un Contrato Cooperativo Minero con COMIBOL, no con la AJAM. Los contratos de arrendamiento antiguos deben adecuarse.',
        fuente: 'Lexivox', url: 'https://www.lexivox.org/norms/BO-L-N1140.html' },
      { id: 'cp232', titulo: 'Código Penal, arts. 232 bis, ter y quater (Ley 367)', anio: 2013, estado: 'verificado',
        resumen: 'Tipifica el avasallamiento de áreas mineras, la explotación sin autorización o derecho minero y la compra o venta de minerales de origen ilegal. Esta plataforma no califica a nadie: solo ordena información para que la autoridad verifique.',
        fuente: 'Texto de la Ley 367 en el sitio de la AJAM', url: 'https://www.autoridadminera.gob.bo/wp-content/uploads/2025/09/LEY-367.pdf' },
      { id: 'ley759', titulo: 'Ley 759, Convenio de Minamata sobre el Mercurio', anio: 2015, estado: 'verificado',
        resumen: 'Bolivia ratificó el convenio internacional para reducir el uso y las emisiones de mercurio.',
        fuente: 'Lexivox', url: 'https://www.lexivox.org/norms/BO-L-N759.html' },
      { id: 'ds4959', titulo: 'Decreto Supremo 4959, Registro Único de Mercurio', anio: 2023, estado: 'verificado',
        resumen: 'Crea el registro (RUME) y la autorización previa para importar o exportar mercurio. No prohíbe su uso en minería.',
        fuente: 'Lexivox', url: 'https://www.lexivox.org/norms/BO-DS-N4959.xhtml' }
    ],

    /* Trámites de una cooperativa minera que busca contrato con la AJAM, en orden orientativo.
       'requisito' enlaza con config.requisitos para mostrar Listo / En proceso / Faltante.
       Los pasos con estado 'referencial' no pudieron comprobarse en fuente abierta. */
    tramites: [
      { n: 1, id: 'personeria', titulo: 'Personalidad jurídica de la cooperativa', institucion: 'AFCOOP', documento: 'Resolución de personalidad jurídica e inscripción en el Registro Estatal de Cooperativas',
        detalle: 'La cooperativa debe estar constituida. La Ley 535 acepta también la constancia de que el trámite está en curso, junto con la nómina de socios.',
        norma: 'Ley General de Cooperativas 356; Ley 535 art. 128', requisito: '', url: '', estado: 'referencial' },
      { n: 2, id: 'nit', titulo: 'Número de Identificación Tributaria (NIT)', institucion: 'Impuestos Nacionales', documento: 'NIT activo',
        detalle: 'Es un requisito de la solicitud de contrato para cooperativas.',
        norma: 'Ley 535 art. 128', requisito: 'nit', url: 'https://www.lexivox.org/norms/BO-L-N535.html', estado: 'verificado' },
      { n: 3, id: 'area_libre', titulo: 'Certificado de área libre', institucion: 'AJAM, Dirección de Catastro y Cuadriculado Minero', documento: 'Certificación de área libre',
        detalle: 'Confirma que las cuadrículas que pides no tienen otro derecho. La norma dice que se expide en el día.',
        norma: 'Ley 535 arts. 140 y 164', requisito: 'derecho_minero', url: 'https://www.lexivox.org/norms/BO-L-N535.html', estado: 'verificado' },
      { n: 4, id: 'solicitud', titulo: 'Solicitud de contrato a la AJAM', institucion: 'AJAM, dirección departamental o regional', documento: 'Solicitud con Plan de Trabajo y Desarrollo, ubicación de cuadrículas y domicilio legal',
        detalle: 'Para cooperativas el máximo es de 250 cuadrículas. Si el área es de COMIBOL, el contrato se firma con COMIBOL (Contrato Cooperativo Minero) y no con la AJAM.',
        norma: 'Ley 535 arts. 127, 128 y 141; Ley 1140', requisito: 'derecho_minero', url: 'https://www.lexivox.org/norms/BO-L-N535.html', estado: 'verificado' },
      { n: 5, id: 'consulta', titulo: 'Consulta previa, si corresponde', institucion: 'AJAM', documento: 'Proceso de consulta previa',
        detalle: 'Solo se exige en contratos nuevos que puedan afectar derechos colectivos de pueblos indígenas. No se exige en prospección y exploración ni en contratos de adecuación.',
        norma: 'Ley 535 arts. 207 y 208', requisito: 'derecho_minero', url: 'https://www.lexivox.org/norms/BO-L-N535.html', estado: 'verificado' },
      { n: 6, id: 'contrato', titulo: 'Firma del contrato y aprobación legislativa', institucion: 'AJAM y Asamblea Legislativa Plurinacional', documento: 'Contrato Administrativo Minero aprobado',
        detalle: 'La Asamblea tiene 90 días para aprobar el contrato. Los contratos por adecuación de autorizaciones transitorias especiales están exentos de esa aprobación.',
        norma: 'Ley 535 arts. 40 y 132', requisito: 'derecho_minero', url: 'https://www.lexivox.org/norms/BO-L-N535.html', estado: 'verificado' },
      { n: 7, id: 'registro', titulo: 'Protocolización e inscripción en el Registro Minero', institucion: 'Notaría y AJAM', documento: 'Contrato protocolizado e inscrito en el Registro Minero',
        detalle: 'La inscripción es obligatoria. La ley llama a este registro Registro Minero.',
        norma: 'Ley 535 arts. 57, 134 y 135', requisito: 'registro_actividad', url: 'https://www.lexivox.org/norms/BO-L-N535.html', estado: 'verificado' },
      { n: 8, id: 'licencia', titulo: 'Licencia ambiental', institucion: 'Autoridad ambiental competente (gobernación para actividades mineras menores)', documento: 'Licencia ambiental con su formulario de categorización',
        detalle: 'Toda actividad minera necesita licencia ambiental. Para actividades menores de impacto conocido no significativo se tramita en la gobernación, y las cooperativas pueden presentar un manifiesto ambiental común. El orden exacto frente al contrato puede variar según tu caso: confirma con la AJAM y la gobernación.',
        norma: 'DS 24782 arts. 4, 5 y 124; DS 3549 de 2018; Ley 535 art. 218', requisito: 'licencia_ambiental', url: 'https://www.lexivox.org/norms/BO-RE-DS24782.html', estado: 'verificado' },
      { n: 9, id: 'colas', titulo: 'Plan de manejo de colas y cierre', institucion: 'Autoridad ambiental competente', documento: 'Plan o compromiso de manejo de colas y de cierre',
        detalle: 'La Ley 535 fija obligaciones de cierre y de manejo de pasivos ambientales. Pedir un plan de manejo de colas es un criterio de esta plataforma, no un trámite separado comprobado en la ley.',
        norma: 'Ley 535 arts. 219 y 221', requisito: 'plan_colas', url: 'https://www.lexivox.org/norms/BO-L-N535.html', estado: 'referencial' },
      { n: 10, id: 'tecnico', titulo: 'Responsable técnico designado', institucion: 'La cooperativa', documento: 'Nombre y datos de la persona responsable',
        detalle: 'No encontramos una norma que lo exija como trámite aparte. La plataforma lo pide como buena práctica para saber con quién hablar sobre el manejo de colas y de mercurio.',
        norma: 'Criterio de la plataforma', requisito: 'responsable_tecnico', url: '', estado: 'referencial' }
    ],

    informaciones: [
      { id: 'por_que_hg', titulo: 'Por qué importa el mercurio',
        texto: 'En la minería de oro a pequeña escala se usa mercurio para juntar el oro. Parte de ese mercurio llega a los ríos y a los sedimentos, y en el agua puede transformarse en metilmercurio, que se acumula en los peces y llega a las personas. Medirlo y reducirlo protege la salud de las comunidades río abajo y también de quienes trabajan en la mina.',
        fuente: 'Convenio de Minamata, ratificado por la Ley 759', url: 'https://www.lexivox.org/norms/BO-L-N759.html' },
      { id: 'limites', titulo: 'Cuánto mercurio permite la norma en el agua',
        texto: 'Para agua potable, Bolivia permite hasta 0,001 mg/L (1 microgramo por litro) según la NB 512. Para ríos y cuerpos receptores, el reglamento de contaminación hídrica fija el mismo valor en todas las clases. La Organización Mundial de la Salud recomienda 0,006 mg/L para mercurio inorgánico: el límite boliviano es seis veces más estricto.',
        fuente: 'NB 512:2016, RMCH y OMS', url: 'https://sihita.org/wp-content/uploads/2022/04/Compendio-Normativo-sobre-Calidad-de-Agua-para-Consumo-Humano.pdf' },
      { id: 'por_que_legal', titulo: 'Por qué conviene tener los papeles al día',
        texto: 'Con contrato minero y licencia ambiental vigentes, una cooperativa puede trabajar con seguridad jurídica y evitar la suspensión de actividades. Esta plataforma está para acompañar ese camino: muestra qué falta y dónde tramitarlo.',
        fuente: 'Ley 535 y DS 24782', url: 'https://www.lexivox.org/norms/BO-L-N535.html' },
      { id: 'denuncia', titulo: 'Qué pasa con una denuncia hecha aquí',
        texto: 'Tu denuncia llega a la plataforma, sin pedir tus datos, y las autoridades la revisan y verifican la ubicación. Si la autoridad la acepta, el lugar queda como punto por verificar. Para una denuncia formal por minería sin autorización, la AJAM tiene un formulario en línea que pide datos de la persona que denuncia, y para denuncias ambientales la Ley 1333 prevé la denuncia ante la autoridad ambiental.',
        fuente: 'Ley 1333 arts. 100 y 101; formulario de la AJAM', url: 'https://seguimiento.autoridadminera.gob.bo/garnet/denuncia_mineria_ilegal' },
      { id: 'estado_hg', titulo: 'Qué dice la ley hoy sobre el mercurio',
        texto: 'Bolivia regula la importación y la comercialización de mercurio con un registro y una autorización previa (DS 4959 de 2023). Hoy no hay una ley promulgada que prohíba su uso en la minería: los proyectos de ley para eliminarlo siguen en discusión.',
        fuente: 'DS 4959 y Senado', url: 'https://www.lexivox.org/norms/BO-DS-N4959.xhtml' },
      { id: 'programas', titulo: 'Sobre el programa de biorremediación',
        texto: 'Hoy no existe un programa del Estado de remediación de pasivos mineros abierto a cooperativas: hay un anteproyecto de ley en discusión. El programa de esta plataforma es un piloto de Aurum80: la inscripción permite que las autoridades vean qué cooperativas están interesadas, sin compromiso.',
        fuente: 'Contraloría General del Estado, informe K2/AP01/F20-E1', url: 'https://www.contraloria.gob.bo/wp-content/uploads/2023/02/Inf-Aud-Amb-K2AP01F20-E1-pasivos-ambientales-mineros.pdf' }
    ],

    /* Límites de referencia para mercurio. Unidades: mg/L en agua, mg/kg en sedimento seco. 1 ppb = 0,001 mg/L en agua. */
    mercurio: {
      agua: [
        { id: 'nb512', label: 'Agua potable (NB 512:2016)', mg_l: 0.001, ppb: 1, estado: 'verificado', fuente: 'NB 512:2016, tabla de requisitos químicos' },
        { id: 'rmch', label: 'Cuerpos de agua, clases A a D (RMCH, cuadro A-1)', mg_l: 0.001, ppb: 1, estado: 'referencial', fuente: 'DS 24176, Anexo A (escaneo)' },
        { id: 'rmch_desc', label: 'Descargas líquidas (RMCH, anexo A-2)', mg_l: 0.002, ppb: 2, estado: 'referencial', fuente: 'DS 24176, Anexo A-2: 0,002 diario y 0,001 mensual' },
        { id: 'oms', label: 'Valor guía de la OMS (mercurio inorgánico)', mg_l: 0.006, ppb: 6, estado: 'verificado', fuente: 'OMS, guías de calidad del agua potable' }
      ],
      sedimento: [
        { id: 'isqg', label: 'CCME agua dulce, nivel ISQG', mg_kg: 0.17, ppb: 170, estado: 'verificado', fuente: 'CCME, 1999, peso seco' },
        { id: 'pel', label: 'CCME agua dulce, nivel de efecto probable (PEL)', mg_kg: 0.486, ppb: 486, estado: 'verificado', fuente: 'CCME, 1999, peso seco' }
      ],
      /* Los cortes de la prueba rápida de campo NO son límites legales: sirven para decidir si se confirma en laboratorio. */
      tamizaje: {
        agua: { verde: 5, rojo: 20, estado: 'referencial', fuente: 'Corte práctico de la prueba de campo, pendiente de validar con estándares' },
        lodo: { verde: 50, rojo: 170, estado: 'referencial', fuente: 'El corte rojo coincide con el ISQG de CCME; el verde es un corte práctico pendiente de validar' }
      },
      nota: 'La prueba de campo orienta; no reemplaza al laboratorio acreditado. Un resultado sin alerta de campo no significa que el agua cumpla la norma: los límites bolivianos son de 1 ppb, por debajo de lo que la prueba puede distinguir con seguridad.'
    }
  };
})();
