/* ==========================================================================
   HgSense (tamizaje colorimétrico de mercurio con nanopartículas de plata).
   Módulo PURO: sin DOM, sin red, sin almacenamiento. Lo usa la app de campo
   (campo/) y puede probarse con Node (scripts/probar_hgsense.js).

   Adaptado de la app de origen (nuevos apuntes/Hg-identificator-main/app.js):
   rgbToHsv, computeQuantification y evaluateSemaphore.

   IMPORTANTE (revisión científica):
   - El semáforo es un TAMIZAJE de campo. "Verde" NO significa que se cumpla la
     norma boliviana: los límites de mercurio en agua son mucho más bajos que el
     umbral de campo (p. ej. NB 512, agua potable: 1 ppb). Ver NOTA_NORMA.
   - La calibración es teórica y está pendiente de validar con estándares.
     No se publica ningún R² ni exactitud (ver CALIBRACION).
   - El metilmercurio por diferencia (total - Hg2+) es solo INDICATIVO.
   - Los umbrales viven en UMBRALES (con su 'fuente'): cámbielos ahí cuando el
     agente normativo termine la verificación.
   ========================================================================== */
(function () {
  const G4G = (window.G4G = window.G4G || {});

  /* ---- Parámetros (referenciales) ---- */
  const BLANK_REF = { r: 235, g: 195, b: 30, s: 87.2 };   // blanco de referencia de AgNPs (S en %)
  const PENDIENTE = 1.45;                                 // ppb por punto de delta S (teórica)
  const FACTOR_MATRIZ = { agua: 1, lodo: 10 };            // lodo: 1 g en 10 mL (extracción 1:10)
  const ROI_TAM = 50;                                     // recuadro de medida, en píxeles
  const LIENZO = { ancho: 320, alto: 220 };               // tamaño de trabajo de la imagen

  /* Umbrales por matriz, en ppb. verde: ppb < amarillo; amarillo: amarillo <= ppb <= rojo; rojo: ppb > rojo.
     Estos valores y su base normativa están PENDIENTES DE VERIFICAR. */
  const UMBRALES = {
    fuente: 'Cortes de la prueba de campo (no son límites legales); ver js/data/normativa.js > mercurio.tamizaje',
    agua: { amarillo: 5, rojo: 20, unidad: 'ppb (µg/L)', fuente: 'Corte práctico de campo, pendiente de validar con estándares. Los límites legales (NB 512 y RMCH: 1 ppb) son más bajos que lo que la prueba distingue con seguridad.' },
    lodo: { amarillo: 50, rojo: 170, unidad: 'ppb (µg/kg, base seca)', fuente: 'El corte rojo coincide con el ISQG de CCME (170 µg/kg, verificado); el amarillo es un corte práctico pendiente de validar.' }
  };

  const CALIBRACION = {
    estado: 'referencial',
    texto: 'Calibración teórica pendiente de validar con estándares; es un tamizaje de campo y no reemplaza al laboratorio acreditado'
  };

  /* Nota fija que acompaña a todo resultado. */
  const NOTA_NORMA = {
    agua: 'Un resultado verde no significa que el agua cumpla la norma boliviana: los límites de mercurio son mucho más bajos que el umbral de campo (por ejemplo, 1 ppb para agua potable en la NB 512). Para certificar se necesita un laboratorio acreditado.',
    lodo: 'Un resultado verde no significa que el lodo cumpla una norma ni que no haya riesgo. Es solo un tamizaje de campo; para certificar se necesita un laboratorio acreditado.'
  };

  const MATRICES = Object.keys(FACTOR_MATRIZ);
  const ORDEN = { verde: 0, amarillo: 1, rojo: 2 };

  function validarMatriz(m) {
    if (!Object.prototype.hasOwnProperty.call(FACTOR_MATRIZ, m)) throw new Error('Matriz no válida: ' + m);
    return m;
  }

  /* RGB (0-255) -> HSV (h en grados, s y v en %). */
  function rgbToHsv(r, g, b) {
    const rn = r / 255, gn = g / 255, bn = b / 255;
    const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
    const d = max - min;
    let h = 0;
    if (d !== 0) {
      if (max === rn) h = 60 * (((gn - bn) / d) % 6);
      else if (max === gn) h = 60 * ((bn - rn) / d + 2);
      else h = 60 * ((rn - gn) / d + 4);
    }
    if (h < 0) h += 360;
    return { h, s: max === 0 ? 0 : (d / max) * 100, v: max * 100 };
  }

  /* Promedio de color de un recuadro tam x tam con esquina (x, y) dentro de un ImageData
     ({ data, width, height }). El recuadro se recorta a los bordes de la imagen. */
  function promedioRoi(imageData, x, y, tam) {
    const w = imageData.width, h = imageData.height, d = imageData.data;
    const x0 = Math.max(0, Math.floor(x)), y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(w, Math.floor(x) + tam), y1 = Math.min(h, Math.floor(y) + tam);
    let sr = 0, sg = 0, sb = 0, n = 0;
    for (let j = y0; j < y1; j++) {
      for (let i = x0; i < x1; i++) {
        const k = (j * w + i) * 4;
        sr += d[k]; sg += d[k + 1]; sb += d[k + 2]; n++;
      }
    }
    if (!n) return { r: 0, g: 0, b: 0, n: 0 };
    return { r: sr / n, g: sg / n, b: sb / n, n };
  }

  /* Concentración estimada a partir de la saturación S (en %) del color medido. */
  function estimarPpb(o) {
    const matriz = validarMatriz(o.matriz);
    const s = Number(o.s);
    if (!Number.isFinite(s)) throw new Error('Saturación no válida.');
    const deltaS = Math.max(0, BLANK_REF.s - s);
    const extractoPpb = deltaS * PENDIENTE;
    return { deltaS, extractoPpb, ppb: extractoPpb * FACTOR_MATRIZ[matriz], factor: FACTOR_MATRIZ[matriz] };
  }

  /* 'verde' | 'amarillo' | 'rojo' (o null si ppb no es un número). */
  function semaforo(matriz, ppb) {
    const u = UMBRALES[validarMatriz(matriz)];
    if (typeof ppb !== 'number' || !Number.isFinite(ppb)) return null;
    if (ppb < u.amarillo) return 'verde';
    if (ppb <= u.rojo) return 'amarillo';
    return 'rojo';
  }

  const peorNivel = (...niveles) => niveles.filter(Boolean).reduce((a, n) => (ORDEN[n] > ORDEN[a] ? n : a), 'verde');

  /* Metilmercurio por diferencia: INDICATIVO. */
  const metilmercurio = (total, hg2) => Math.max(0, Number(total) - Number(hg2));

  /* Análisis completo de un color medido. */
  function analizarRgb(r, g, b, matriz) {
    const hsv = rgbToHsv(r, g, b);
    const est = estimarPpb({ s: hsv.s, matriz });
    return { r: Math.round(r), g: Math.round(g), b: Math.round(b), h: hsv.h, s: hsv.s, v: hsv.v, deltaS: est.deltaS, ppb: est.ppb, semaforo: semaforo(matriz, est.ppb) };
  }

  /* ¿La zona medida parece el líquido del tubo? Un recuadro sobre el fondo, una sombra o la
     tapa daría una lectura falsa. Un líquido muy decolorado (casi transparente) SÍ es válido. */
  function calidadRoi(r, g, b) {
    const { h, s, v } = rgbToHsv(r, g, b);
    const avisos = [];
    if (v < 25) avisos.push('La zona medida está demasiado oscura. Toque sobre el líquido o repita la foto con más luz.');
    else if (s >= 20 && (h < 20 || h > 80)) avisos.push('La zona medida no parece el líquido amarillo del tubo. Toque sobre el líquido o repita la foto.');
    return { ok: avisos.length === 0, avisos };
  }

  G4G.hgsense = {
    BLANK_REF, PENDIENTE, FACTOR_MATRIZ, ROI_TAM, LIENZO, UMBRALES, CALIBRACION, NOTA_NORMA, MATRICES,
    rgbToHsv, promedioRoi, estimarPpb, semaforo, peorNivel, metilmercurio, analizarRgb, calidadRoi
  };
})();
