/* ==========================================================================
   Modelo de puntaje de pasivos mineros (colas, relaves, desmontes).
   Riesgo (0-100) y valor recuperable (índice 0-100) son DOS ejes separados.
   Con ellos se decide qué atender primero; nunca se recomienda reprocesar
   sin licencia: solo "evaluar".
   El satélite ubica pero no mide mercurio: aquí se usan indicadores
   indirectos (proxies) y el modelo dice cuándo falta muestreo.
   ========================================================================== */
(function () {
  const G4G = (window.G4G = window.G4G || {});
  const { clamp } = G4G.util;
  const cfg = () => G4G.config.puntaje;

  const COMPONENTES = {
    volumen:         'Volumen estimado',
    rio:             'Cercanía a un río',
    poblado:         'Cercanía a población',
    estructura:      'Estado de la estructura',
    mercurio:        'Uso de mercurio',
    responsabilidad: 'Responsable legal'
  };

  function factores(p, op) {
    const c = cfg();
    const f = {};
    f.volumen = p.volumen_m3 == null ? 0.5 : clamp(Math.log10(Math.max(p.volumen_m3, 1)) / Math.log10(c.volumenRefM3), 0, 1);
    f.rio = p.dist_rio_m == null ? 0.5 : 1 - clamp(p.dist_rio_m / c.distanciaRioMaxM, 0, 1);
    f.poblado = p.dist_poblado_m == null ? 0.5 : 1 - clamp(p.dist_poblado_m / c.distanciaPobladoMaxM, 0, 1);
    f.estructura = (G4G.config.estructura[p.estructura] || G4G.config.estructura.desconocida).riesgo;
    f.mercurio = c.mercurio[p.uso_hg] != null ? c.mercurio[p.uso_hg] : c.mercurio.desconocido;
    f.responsabilidad = op ? (c.responsabilidad[op.estado_legal] ?? 0.8) : c.responsabilidad.sin_operador;
    return f;
  }

  function riesgo(p, op) {
    const w = cfg().pesosRiesgo, f = factores(p, op);
    return Math.round(100 * Object.keys(w).reduce((s, k) => s + w[k] * f[k], 0));
  }

  /* Oro recuperable estimado (g) = volumen x densidad x ley x recuperación.
     Sin ley medida no se inventa un valor: queda "sin dato" y pide muestreo. */
  function oroRecuperableG(p) {
    const c = cfg();
    if (p.ley_au_gt == null || p.volumen_m3 == null) return null;
    return p.volumen_m3 * c.densidadTM3 * p.ley_au_gt * c.recuperacion;
  }
  function valorIndice(p) {
    const g = oroRecuperableG(p);
    if (g === null) return null;
    return Math.round(100 * clamp(Math.log10(Math.max(g, 1)) / Math.log10(cfg().oroRefG), 0, 1));
  }

  function clasificar(r, v) {
    const c = cfg(), altoR = r >= c.umbralRiesgoAlto;
    if (v === null) {
      return altoR
        ? { id: 'muestreo_urgente', nivel: 1, corto: 'Muestreo urgente', label: 'Muestreo dirigido urgente', detalle: 'Riesgo alto y sin dato de ley: tomar muestra con protocolo de seguridad.' }
        : { id: 'sin_dato', nivel: 4, corto: 'Sin dato de ley', label: 'Sin dato de ley', detalle: 'Muestrear cuando sea posible para estimar valor y contenido.' };
    }
    const altoV = v >= c.umbralValorAlto;
    if (altoR && altoV) return { id: 'prioridad1', nivel: 1, corto: 'Prioridad 1', label: 'Prioridad 1: evaluar reprocesamiento controlado', detalle: 'Riesgo y valor altos. Requiere licencia ambiental y control del mercurio antes de cualquier reproceso.' };
    if (altoR) return { id: 'remediar', nivel: 2, corto: 'Remediar', label: 'Remediar o contener', detalle: 'Riesgo alto y poco oro recuperable: requiere financiamiento de remediación.' };
    if (altoV) return { id: 'oportunidad', nivel: 3, corto: 'Oportunidad', label: 'Oportunidad con monitoreo', detalle: 'Valor alto y riesgo moderado: vigilar y evaluar con el responsable.' };
    return { id: 'monitoreo', nivel: 4, corto: 'Monitoreo', label: 'Monitoreo', detalle: 'Riesgo y valor bajos por ahora.' };
  }

  function explicar(p, op) {
    const w = cfg().pesosRiesgo, f = factores(p, op);
    return Object.keys(w).map((k) => ({ id: k, label: COMPONENTES[k], factor: f[k], peso: w[k], puntos: Math.round(100 * w[k] * f[k]), maximo: Math.round(100 * w[k]) }));
  }

  /* Devuelve los pasivos con su puntaje, ordenados por prioridad. */
  function evaluar(pasivos, getOperador) {
    return pasivos.map((p) => {
      const op = p.operador_id ? getOperador(p.operador_id) : null;
      const r = riesgo(p, op), v = valorIndice(p);
      return Object.assign({}, p, { _op: op, riesgo: r, valor: v, oroG: oroRecuperableG(p), clase: clasificar(r, v) });
    }).sort((a, b) => a.clase.nivel - b.clase.nivel || b.riesgo - a.riesgo);
  }

  G4G.scoring = { COMPONENTES, riesgo, valorIndice, oroRecuperableG, clasificar, explicar, evaluar };
})();
