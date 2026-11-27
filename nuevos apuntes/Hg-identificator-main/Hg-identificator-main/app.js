/* ==========================================================================
   HgSense AgNPs + Oportunidad Oro Residual + Biorremediación (Reto 4.2)
   Vanilla JS | 100% Client-Side | Sin Backend | Compatible GitHub Pages
   ========================================================================== */

(() => {
  'use strict';

  // ---------- Constantes Ópticas, Calibración y Modelo Oro Residual ----------
  const BLANK_REF = { r: 235, g: 195, b: 30, s: 87.2 };
  const CALIBRATION_SLOPE = 1.45; // Conc_extracto_ppb = Delta_S * 1.45 (R² = 0.992)
  const ROI_SIZE = 50;
  const CANVAS_W = 320;
  const CANVAS_H = 220;
  const ZONE_W = 360;
  const ZONE_H = 240;

  const STORAGE_KEY = 'hgsense_agnps_history_v2';
  const LEGACY_STORAGE_KEY = 'hgsense_agnps_history_v1';
  const AFFILIATION_KEY = 'hgsense_biorem_affiliations_v1';

  // Parámetros validados de Oro Residual en Colas (Reto 4.2 — Youpoungam et al. + U-101)
  const GOLD_GRADE_GT = 5.5; // 5.50 g Au / tonelada de relave de amalgamación
  const GOLD_RECOVERY_U101 = 0.215; // 21.5% nominal (rango 19.8%–22.7% en < 100 μm) => 1.1825 g Au/t
  const GOLD_PRICE_USD_G = 85; // Referencia conservadora $85 USD / g Au (~$2,645/oz)
  const CLEAN_TECH_NET_MARGIN = 0.65; // 65% margen neto tras operación limpia U-101 + SBR + Azufre

  const MATRICES = {
    water: {
      key: 'water',
      name: 'Agua (Puntos calientes / Efluentes)',
      shortName: 'Agua',
      factor: 1,
      unit: 'ppb (µg/L)',
      unitShort: 'ppb',
      massFactor: 0.001, // Vol (m³) × ppb × 0.001 = gramos Hg
      solidsDensityTM3: 0.15, // Finos en suspensión en efluentes mineros (t/m³)
    },
    sludge: {
      key: 'sludge',
      name: 'Lodo / Colas Auríferas (Frasco 0 - Tapa Roja)',
      shortName: 'Lodo / Colas',
      factor: 10,
      unit: 'ppb (µg/kg base seca)',
      unitShort: 'ppb',
      massFactor: 0.0014, // Vol (m³) × ppb × 0.0014 (ρ ≈ 1.4 t/m³) = gramos Hg
      solidsDensityTM3: 1.4, // Densidad seca aproximada de relaves/lodos (t/m³)
    },
  };

  // Ahorro monitoreo AgNPs vs Laboratorio acreditado (CV-AAS / ICP-MS)
  const LAB_COST_L1_USD = 120;
  const LAB_COST_L2_USD = 240;
  const AGNPS_COST_L1_USD = 6;
  const AGNPS_COST_L2_USD = 12;

  // ---------- Escenarios Demo Realistas ----------
  const DEMO_SCENARIOS = {
    clean_water: {
      matrix: 'water',
      targetStep: 1,
      zone: { length: 8, width: 5, depth: 0.5, refSize: 1.0, refName: 'Vara/Pala 1.0 m' },
      location: 'Río Alto Beni — Zona de Cabecera',
      notes: 'Tamizaje Nivel 1 limpio (< 5 ppb). Prueba finalizada ahorrando reactivos (Demo).',
      tubeA: { r: 234, g: 194, b: 32, label: 'Tubo A • Agua Limpia' },
      tubeC: null,
    },
    mine_effluent: {
      matrix: 'water',
      targetStep: 1,
      zone: { length: 18, width: 10, depth: 0.5, refSize: 1.0, refName: 'Vara/Pala 1.0 m' },
      location: 'Efluente Minero — Quebrada Mapiri',
      notes: 'Descarga minera severa confirmada en Nivel 1 (> 20 ppb). Señal Nivel 2 activada (Demo).',
      tubeA: { r: 235, g: 212, b: 102, label: 'Tubo A • Efluente Minero' },
      tubeC: null,
    },
    anoxic_sludge: {
      matrix: 'sludge',
      targetStep: 3,
      zone: { length: 30, width: 22, depth: 1.0, refSize: 1.0, refName: 'Vara/Pala 1.0 m' },
      location: 'Poza Minera Anóxica — Cuenca Tipuani',
      notes: 'Colas anóxicas con foco activo de metilación (UV-C) y alto potencial de oro residual (Demo).',
      tubeA: { r: 235, g: 204, b: 64, label: 'Tubo A • Lodo 10×' },
      tubeC: { r: 235, g: 216, b: 120, label: 'Tubo C • Post UV-C 254 nm' },
    },
  };

  // ---------- 4 Sitios Precargados de Bolivia ----------
  const DEFAULT_HISTORY = [
    {
      id: 'demo-bo-1',
      dateISO: '2026-11-20T09:15:00',
      location: 'Río Beni — Sector Rurrenabaque (Control)',
      matrix: 'water',
      lengthM: 10,
      widthM: 7,
      depthM: 0.5,
      areaM2: 70,
      volumeM3: 35,
      hg2: 1.4,
      hgTotal: null,
      methylHg: null,
      level2Used: false,
      semaphore: 'green',
      notes: 'Tamizaje Nivel 1 limpio. Incluido en lote 5% auditoría NB 512.',
    },
    {
      id: 'demo-bo-2',
      dateISO: '2026-11-21T14:40:00',
      location: 'Río Tipuani — Descarga Cooperativa Baja',
      matrix: 'water',
      lengthM: 20,
      widthM: 18,
      depthM: 0.5,
      areaM2: 360,
      volumeM3: 180,
      hg2: 14.8,
      hgTotal: null,
      methylHg: null,
      level2Used: false,
      semaphore: 'yellow',
      notes: 'Alerta temprana de descarga Hg²⁺ (supera RMCH 1–2 ppb) con arrastre de finos auríferos.',
    },
    {
      id: 'demo-bo-4',
      dateISO: '2026-11-24T16:05:00',
      location: 'Lago Titicaca — Bahía Cohana (Sedimento)',
      matrix: 'sludge',
      lengthM: 30,
      widthM: 28,
      depthM: 0.5,
      areaM2: 840,
      volumeM3: 420,
      hg2: 86.2,
      hgTotal: 129.4,
      methylHg: 43.2,
      level2Used: true,
      semaphore: 'yellow',
      notes: 'Sedimento con metilación confirmada en Nivel 2 UV-C; candidato a programa limpio.',
    },
    {
      id: 'demo-bo-3',
      dateISO: '2026-11-23T11:20:00',
      location: 'Mapiri — Poza de Relave Anóxica #2',
      matrix: 'sludge',
      lengthM: 46,
      widthM: 25,
      depthM: 1.0,
      areaM2: 1150,
      volumeM3: 1150,
      hg2: 209.3,
      hgTotal: 554.8,
      methylHg: 345.5,
      level2Used: true,
      semaphore: 'red',
      notes: 'Supera CCME (170 ppb) y PEL (486 ppb). Gran oportunidad de autofinanciar biorremediación con oro residual.',
    },
  ];

  // ---------- Definición Matriz 1: Riesgos 3×3 ----------
  const RISK_CELLS_DEF = [
    { sev: 'high', vol: 'small', tier: 'high', tierLabel: 'ALTO', action: 'Contención focalizada del punto caliente, afiliación al Programa de Biorremediación y confirmación en laboratorio (CV-AAS/ICP-MS).' },
    { sev: 'high', vol: 'medium', tier: 'high', tierLabel: 'ALTO', action: 'Restringir uso del agua/pesca, afiliar a tren U-101 + SBR + Azufre para neutralizar metilmercurio y rescatar oro fino.' },
    { sev: 'high', vol: 'large', tier: 'critical', tierLabel: 'CRÍTICO', action: 'Intervención urgente prioritaria: afiliación inmediata al Programa de Biorremediación Autofinanciada con Oro Residual y alerta comunitaria.' },

    { sev: 'medium', vol: 'small', tier: 'moderate', tierLabel: 'MODERADO', action: 'Monitoreo periódico con AgNPs, inspección de fuente aguas arriba y evaluación de pre-afiliación cooperativa.' },
    { sev: 'medium', vol: 'medium', tier: 'moderate', tierLabel: 'MODERADO', action: 'Vigilancia ambiental continua (Ley 1333 RMCH) y evaluación de trampa gravimétrica U-101 + tecnologías limpias.' },
    { sev: 'medium', vol: 'large', tier: 'high', tierLabel: 'ALTO', action: 'Por el alto volumen (> 500 m³), afiliar al Programa de Biorremediación preventiva antes de que escale la metilación.' },

    { sev: 'low', vol: 'small', tier: 'low', tierLabel: 'BAJO', action: 'Sin contaminación aguda detectada. Mantener control rutinario y lote 5% auditoría NB 512.' },
    { sev: 'low', vol: 'medium', tier: 'low', tierLabel: 'BAJO', action: 'Riesgo bajo. Conservar punto como línea base de cuenca y repetir tamizaje estacional.' },
    { sev: 'low', vol: 'large', tier: 'moderate', tierLabel: 'MODERADO', action: 'Concentración baja en gran volumen; vigilancia preventiva en época de lluvias.' },
  ];

  // ---------- Definición Matriz 2: Oportunidad de Inversión y Ganancia Oro Residual 3×3 ----------
  // Eje Y: Ganancia Neta Oro Residual (high > $25k, medium $2k–$25k, low < $2k)
  // Eje X: Urgencia / Riesgo Hg (low, moderate, high)
  const GOLD_CELLS_DEF = [
    { gain: 'high', urg: 'low', tier: 'strong', tierLabel: 'RENTABLE LIMPIO', action: 'Alto potencial de oro fino en colas históricas con bajo riesgo agudo. Ideal para reprocesamiento limpio U-101 libre de mercurio.' },
    { gain: 'high', urg: 'moderate', tier: 'star', tierLabel: 'INVERSIÓN ESTRELLA', action: 'El oro residual autofinancia el 100% del sistema U-101 + SBR + Azufre generando utilidad neta para la cooperativa.' },
    { gain: 'high', urg: 'high', tier: 'star', tierLabel: 'ESTRELLA PRIORITARIA', action: 'Máximo impacto ambiental y económico: el rescate de oro fino (< 100 μm) financia la biorremediación urgente de Hg y CH₃Hg⁺.' },

    { gain: 'medium', urg: 'low', tier: 'cofund', tierLabel: 'OPORTUNIDAD MEDIA', action: 'Recuperación gravimétrica complementaria con bajo riesgo ambiental; evaluar asociación con cooperativas vecinas.' },
    { gain: 'medium', urg: 'moderate', tier: 'strong', tierLabel: 'ALTA OPORTUNIDAD', action: 'Proyecto rentable con tecnologías limpias: afiliar para instalar módulo U-101 + SBR compartido.' },
    { gain: 'medium', urg: 'high', tier: 'strong', tierLabel: 'LIMPIEZA + RETORNO', action: 'Afiliar al Programa de Biorremediación: la ganancia del oro residual cubre una fracción clave de la operación limpia.' },

    { gain: 'low', urg: 'low', tier: 'watch', tierLabel: 'MONITOREO BASE', action: 'No requiere inversión minera ni remediación; mantener como punto de control limpio en la cuenca.' },
    { gain: 'low', urg: 'moderate', tier: 'cofund', tierLabel: 'COFINANCIAR VERDE', action: 'Bajo volumen de sólidos auríferos; gestionar apoyo con fondo ambiental municipal/cooperativo y monitoreo AgNPs.' },
    { gain: 'low', urg: 'high', tier: 'cofund', tierLabel: 'ACCIÓN AMBIENTAL', action: 'Prioridad sanitaria sobre retorno económico: activar fondo ambiental y afiliar a módulo SBR comunitario.' },
  ];

  // ---------- Estado Global ----------
  const state = {
    view: 'measure', // 'measure' | 'risks' | 'priorities' | 'biorem'
    bioSubView: 'sencilla', // 'sencilla' | 'tecnica'
    matrixMode: 'risk', // 'risk' | 'gold'
    step: 0,
    matrix: 'water',
    originMode: 'real',
    level2ManualUnlock: false,
    lastSignaledTubeAId: null,
    priorityFilter: 'all',
    selectedRiskCellKey: 'high-large',
    selectedGoldCellKey: 'high-high',
    selectedRiskSiteId: 'demo-bo-3',
    zone: {
      hasPhoto: false,
      isDemoPhoto: false,
      photoCanvas: null,
      refSize: 1.0,
      refName: 'Vara/Pala 1.0 m',
      lengthM: 8,
      widthM: 5,
      depthM: 0.5,
    },
    tubes: {
      A: createEmptyTubeState(),
      C: createEmptyTubeState(),
    },
    history: [],
    affiliations: [],
  };

  function createEmptyTubeState() {
    return {
      id: 0,
      hasImage: false,
      sourceCanvas: null,
      roiX: Math.floor((CANVAS_W - ROI_SIZE) / 2),
      roiY: Math.floor((CANVAS_H - ROI_SIZE) / 2),
      metrics: null,
    };
  }

  // ---------- Referencias DOM ----------
  const dom = {
    navMeasure: document.getElementById('navMeasure'),
    navRisks: document.getElementById('navRisks'),
    navPriorities: document.getElementById('navPriorities'),
    navBiorem: document.getElementById('navBiorem'),
    topTabMeasure: document.getElementById('topTabMeasure'),
    topTabRisks: document.getElementById('topTabRisks'),
    topTabPriorities: document.getElementById('topTabPriorities'),
    topTabBiorem: document.getElementById('topTabBiorem'),
    sitesCountBadge: document.getElementById('sitesCountBadge'),
    affCountBadge: document.getElementById('affCountBadge'),

    topbarTitle: document.getElementById('topbarTitle'),
    topbarSub: document.getElementById('topbarSub'),
    headerMatrixPill: document.getElementById('headerMatrixPill'),
    originBadge: document.getElementById('originBadge'),

    viewMeasure: document.getElementById('viewMeasure'),
    viewRisks: document.getElementById('viewRisks'),
    viewPriorities: document.getElementById('viewPriorities'),
    viewBiorem: document.getElementById('viewBiorem'),

    btnResetSession: document.getElementById('btnResetSession'),
    demoButtons: document.querySelectorAll('.demo-btn'),

    stepTab0: document.getElementById('stepTab0'),
    stepTab0Sub: document.getElementById('stepTab0Sub'),
    stepTab1: document.getElementById('stepTab1'),
    stepTab2: document.getElementById('stepTab2'),
    stepTab2Sub: document.getElementById('stepTab2Sub'),
    stepTab3: document.getElementById('stepTab3'),

    stepPanel0: document.getElementById('stepPanel0'),
    stepPanel1: document.getElementById('stepPanel1'),
    stepPanel2: document.getElementById('stepPanel2'),
    stepPanel3: document.getElementById('stepPanel3'),

    level2SignalBanner: document.getElementById('level2SignalBanner'),
    signalKicker: document.getElementById('signalKicker'),
    signalText: document.getElementById('signalText'),
    btnSignalGoLevel2: document.getElementById('btnSignalGoLevel2'),

    btnMatrixWater: document.getElementById('btnMatrixWater'),
    btnMatrixSludge: document.getElementById('btnMatrixSludge'),
    sludgeReminder: document.getElementById('sludgeReminder'),

    cameraZoneInput: document.getElementById('cameraZoneInput'),
    uploadZoneInput: document.getElementById('uploadZoneInput'),
    btnLoadDemoZone: document.getElementById('btnLoadDemoZone'),
    canvasZone: document.getElementById('canvasZone'),
    zoneCanvasDimLabel: document.getElementById('zoneCanvasDimLabel'),
    refButtons: document.querySelectorAll('[data-ref]'),
    refEquivalenceHint: document.getElementById('refEquivalenceHint'),
    zoneLengthRange: document.getElementById('zoneLengthRange'),
    zoneLengthNum: document.getElementById('zoneLengthNum'),
    zoneWidthRange: document.getElementById('zoneWidthRange'),
    zoneWidthNum: document.getElementById('zoneWidthNum'),
    depthButtons: document.querySelectorAll('[data-depth]'),
    zoneDepthManual: document.getElementById('zoneDepthManual'),
    zoneAreaOut: document.getElementById('zoneAreaOut'),
    zoneVolumeOut: document.getElementById('zoneVolumeOut'),
    zoneGoldPreviewOut: document.getElementById('zoneGoldPreviewOut'),
    btnGoStep1: document.getElementById('btnGoStep1'),

    cameraInputA: document.getElementById('cameraInputA'),
    uploadInputA: document.getElementById('uploadInputA'),
    canvasA: document.getElementById('canvasA'),
    centerRoiA: document.getElementById('centerRoiA'),
    telemetryEmptyA: document.getElementById('telemetryEmptyA'),
    telemetryA: document.getElementById('telemetryA'),
    swatchA: document.getElementById('swatchA'),
    rgbTextA: document.getElementById('rgbTextA'),
    hsvTextA: document.getElementById('hsvTextA'),
    brTextA: document.getElementById('brTextA'),
    deltaSTextA: document.getElementById('deltaSTextA'),
    concLabelA: document.getElementById('concLabelA'),
    concTextA: document.getElementById('concTextA'),
    level1GateBanner: document.getElementById('level1GateBanner'),
    gateTitle: document.getElementById('gateTitle'),
    gateDesc: document.getElementById('gateDesc'),
    gateActions: document.getElementById('gateActions'),
    btnBackStep0: document.getElementById('btnBackStep0'),
    btnUnlockLevel2: document.getElementById('btnUnlockLevel2'),
    btnNextFromLevel1: document.getElementById('btnNextFromLevel1'),

    cameraInputC: document.getElementById('cameraInputC'),
    uploadInputC: document.getElementById('uploadInputC'),
    canvasC: document.getElementById('canvasC'),
    centerRoiC: document.getElementById('centerRoiC'),
    telemetryEmptyC: document.getElementById('telemetryEmptyC'),
    telemetryC: document.getElementById('telemetryC'),
    swatchC: document.getElementById('swatchC'),
    rgbTextC: document.getElementById('rgbTextC'),
    hsvTextC: document.getElementById('hsvTextC'),
    brTextC: document.getElementById('brTextC'),
    deltaSTextC: document.getElementById('deltaSTextC'),
    concLabelC: document.getElementById('concLabelC'),
    concTextC: document.getElementById('concTextC'),
    btnBackStep1: document.getElementById('btnBackStep1'),
    btnGoStep3: document.getElementById('btnGoStep3'),

    resultLevelBadge: document.getElementById('resultLevelBadge'),
    resultTitle: document.getElementById('resultTitle'),
    semaphoreBanner: document.getElementById('semaphoreBanner'),
    semaphoreBadge: document.getElementById('semaphoreBadge'),
    semaphoreMessage: document.getElementById('semaphoreMessage'),
    semaphoreNormRef: document.getElementById('semaphoreNormRef'),
    bulbRed: document.getElementById('bulbRed'),
    bulbYellow: document.getElementById('bulbYellow'),
    bulbGreen: document.getElementById('bulbGreen'),
    kpiHg2: document.getElementById('kpiHg2'),
    kpiHgTotal: document.getElementById('kpiHgTotal'),
    kpiMethyl: document.getElementById('kpiMethyl'),
    kpiUnit1: document.getElementById('kpiUnit1'),
    kpiUnit2: document.getElementById('kpiUnit2'),
    kpiUnit3: document.getElementById('kpiUnit3'),
    kpiVolume: document.getElementById('kpiVolume'),
    kpiAreaSub: document.getElementById('kpiAreaSub'),
    kpiHgMass: document.getElementById('kpiHgMass'),
    kpiMassFormula: document.getElementById('kpiMassFormula'),
    kpiGoldGain: document.getElementById('kpiGoldGain'),
    kpiGoldGrams: document.getElementById('kpiGoldGrams'),
    speciationBarWrap: document.getElementById('speciationBarWrap'),
    speciationPctLabel: document.getElementById('speciationPctLabel'),
    barInorganic: document.getElementById('barInorganic'),
    barMethyl: document.getElementById('barMethyl'),
    resultAffiliationCard: document.getElementById('resultAffiliationCard'),
    resultAffiliationText: document.getElementById('resultAffiliationText'),
    btnAffiliateFromResult: document.getElementById('btnAffiliateFromResult'),
    saveForm: document.getElementById('saveMeasurementForm'),
    inputLocation: document.getElementById('inputLocation'),
    inputNotes: document.getElementById('inputNotes'),
    btnBackFromResult: document.getElementById('btnBackFromResult'),
    btnJumpToMatrix: document.getElementById('btnJumpToMatrix'),
    btnNewMeasurement: document.getElementById('btnNewMeasurement'),
    calibrationChart: document.getElementById('calibrationChart'),

    // Matrices 3×3
    riskPortfolioKpis: document.getElementById('riskPortfolioKpis'),
    activeMatrixHeading: document.getElementById('activeMatrixHeading'),
    activeMatrixSub: document.getElementById('activeMatrixSub'),
    btnModeRiskMatrix: document.getElementById('btnModeRiskMatrix'),
    btnModeGoldMatrix: document.getElementById('btnModeGoldMatrix'),
    blockRiskMatrix: document.getElementById('blockRiskMatrix'),
    blockGoldMatrix: document.getElementById('blockGoldMatrix'),
    riskMatrixGrid: document.getElementById('riskMatrixGrid'),
    goldMatrixGrid: document.getElementById('goldMatrixGrid'),
    riskDetailPanel: document.getElementById('riskDetailPanel'),

    // Prioritarios
    btnRestoreDemoHistory: document.getElementById('btnRestoreDemoHistory'),
    btnExportPriorityCsv: document.getElementById('btnExportPriorityCsv'),
    prioritySummaryKpis: document.getElementById('prioritySummaryKpis'),
    priorityFilterButtons: document.querySelectorAll('#viewPriorities .filter-btn'),
    priorityList: document.getElementById('priorityList'),

    // Biorremediación & Afiliación
    btnBioSubSencilla: document.getElementById('btnBioSubSencilla'),
    btnBioSubTecnica: document.getElementById('btnBioSubTecnica'),
    btnGoBioTech: document.getElementById('btnGoBioTech'),
    bioSubSencilla: document.getElementById('bioSubSencilla'),
    bioSubTecnica: document.getElementById('bioSubTecnica'),
    affActiveSiteTag: document.getElementById('affActiveSiteTag'),
    affiliationForm: document.getElementById('affiliationForm'),
    affSiteSelect: document.getElementById('affSiteSelect'),
    affCoopName: document.getElementById('affCoopName'),
    affContact: document.getElementById('affContact'),
    affEmail: document.getElementById('affEmail'),
    affiliatedListWrap: document.getElementById('affiliatedListWrap'),
    affiliatedList: document.getElementById('affiliatedList'),

    toast: document.getElementById('toast'),
  };

  // ---------- Cálculos Ópticos, Masa de Hg y Oportunidad de Oro Residual ----------

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

  function computeQuantification(r, g, b, matrixKey) {
    const { h, s, v } = rgbToHsv(r, g, b);
    const br = r > 0 ? b / r : 0;
    const deltaS = Math.max(0, BLANK_REF.s - s);
    const extractPpb = deltaS * CALIBRATION_SLOPE;
    const finalPpb = extractPpb * MATRICES[matrixKey].factor;
    return { r: Math.round(r), g: Math.round(g), b: Math.round(b), h, s, v, br, deltaS, extractPpb, finalPpb };
  }

  function getZoneMetrics() {
    const lengthM = Math.max(0.5, Number(state.zone.lengthM) || 1);
    const widthM = Math.max(0.5, Number(state.zone.widthM) || 1);
    const depthM = Math.max(0.05, Number(state.zone.depthM) || 0.2);
    const areaM2 = lengthM * widthM;
    const volumeM3 = areaM2 * depthM;
    return { lengthM, widthM, depthM, areaM2, volumeM3 };
  }

  /**
   * Calcula Carga Total de Hg (g), Oro Residual Recuperable (g Au), Valor Bruto Oro (USD),
   * Ganancia Neta Estimada con Tecnologías Limpias (USD) y Ahorro de Monitoreo AgNPs vs Lab.
   */
  function computeOpportunityAndLoad(matrixKey, volumeM3, concTotalPpb, level2Used, semaphoreLevel) {
    const mat = MATRICES[matrixKey] || MATRICES.water;
    const vol = Math.max(0, Number(volumeM3) || 0);
    const conc = Math.max(0, Number(concTotalPpb) || 0);

    const hgMassGrams = vol * conc * mat.massFactor;

    // En agua limpia de control (Verde sin descarga), los sólidos de colas son mínimos (0.01 t/m³)
    const effectiveDensity =
      matrixKey === 'water' && semaphoreLevel === 'green' ? 0.01 : mat.solidsDensityTM3;
    const tailingsTons = vol * effectiveDensity;
    const recoverableGoldGrams = tailingsTons * GOLD_GRADE_GT * GOLD_RECOVERY_U101;
    const grossGoldUsd = recoverableGoldGrams * GOLD_PRICE_USD_G;
    const netGoldGainUsd = grossGoldUsd * CLEAN_TECH_NET_MARGIN;

    const monitoringSavingsUsd = level2Used
      ? LAB_COST_L2_USD - AGNPS_COST_L2_USD
      : LAB_COST_L1_USD - AGNPS_COST_L1_USD;

    return {
      hgMassGrams,
      tailingsTons,
      recoverableGoldGrams,
      grossGoldUsd,
      netGoldGainUsd,
      monitoringSavingsUsd,
    };
  }

  function evaluateSemaphore(matrixKey, concPpb) {
    if (matrixKey === 'water') {
      if (concPpb < 5) {
        return {
          level: 'green',
          tone: 'ok',
          label: 'VERDE — SIN CONTAMINACIÓN AGUDA',
          shortLabel: 'Verde',
          message:
            'Sin contaminación aguda detectada (< 5 ppb). La prueba finaliza en Nivel 1 ahorrando tiempo y reactivos. (Para certificación legal NB 512 a 1 ppb, enviar dentro del 5% de auditoría a laboratorio).',
          normRef: 'Normativa: NB 512 (1 ppb potable) • Ley 1333 RMCH (1–2 ppb cuerpos de agua y descargas).',
        };
      }
      if (concPpb <= 20) {
        return {
          level: 'yellow',
          tone: 'mid',
          label: 'AMARILLO — ALERTA AMBIENTAL',
          shortLabel: 'Amarillo',
          message: 'Alerta Ambiental (5–20 ppb) — Supera límite RMCH Bolivia (1–2 ppb). Monitorear fuente y evaluar afiliación a tecnologías limpias.',
          normRef: 'Normativa: Ley 1333 RMCH Bolivia (1–2 ppb). Nivel 2 (UV-C) habilitado.',
        };
      }
      return {
        level: 'red',
        tone: 'bad',
        label: 'ROJO — PELIGRO CRÍTICO',
        shortLabel: 'Rojo',
        message: 'Peligro Crítico (> 20 ppb) — Descarga severa. Envío obligatorio a laboratorio acreditado (CV-AAS/ICP-MS) y afiliación recomendada al Programa de Biorremediación.',
        normRef: 'Normativa: Supera ampliamente Ley 1333 RMCH (1–2 ppb) y NB 512 (1 ppb).',
      };
    }

    if (concPpb < 50) {
      return {
        level: 'green',
        tone: 'ok',
        label: 'VERDE — BAJO RIESGO EN SEDIMENTO',
        shortLabel: 'Verde',
        message: 'Bajo riesgo en sedimento (< 50 ppb). La prueba finaliza en Nivel 1.',
        normRef: 'Referencia: CCME Canadá (ISQG: 170 ppb | PEL: 486 ppb base seca).',
      };
    }
    if (concPpb <= 170) {
      return {
        level: 'yellow',
        tone: 'mid',
        label: 'AMARILLO — ALERTA EN SEDIMENTO',
        shortLabel: 'Amarillo',
        message: 'Alerta en sedimento (50–170 ppb) — Activar Nivel 2 (UV-C) y evaluar afiliación al Programa de Biorremediación.',
        normRef: 'Referencia: CCME Canadá (umbral ISQG: 170 ppb base seca).',
      };
    }
    const pelExtra =
      concPpb > 486
        ? ' Supera además el nivel de efecto probable CCME PEL (486 ppb base seca).'
        : ' Umbral de efecto probable CCME PEL: 486 ppb base seca.';
    return {
      level: 'red',
      tone: 'bad',
      label: 'ROJO — PELIGRO CRÍTICO EN LODO',
      shortLabel: 'Rojo',
      message:
        'Peligro Crítico en lodo (supera umbral CCME 170 ppb) — Activar Nivel 2 (UV-C), enviar a laboratorio y afiliar al Programa de Biorremediación con rescate de oro.',
      normRef: 'Referencia: CCME Canadá (ISQG: 170 ppb).' + pelExtra,
    };
  }

  /**
   * Enriquece cada sitio con:
   * - Matriz 1 (Riesgo 3×3)
   * - Matriz 2 (Oportunidad de Inversión y Ganancia de Oro Residual 3×3)
   * - Índice de Prioridad 0–100 (45% Hg Total, 30% CH₃Hg⁺, 25% Volumen)
   * - Elegibilidad para Afiliación al Programa de Biorremediación
   */
  function enrichSiteRecord(item) {
    const mat = MATRICES[item.matrix] || MATRICES.water;
    const volumeM3 = Math.max(1, Number(item.volumeM3) || (item.matrix === 'sludge' ? 250 : 60));
    const areaM2 = Number(item.areaM2) || volumeM3 * 2;
    const depthM = Number(item.depthM) || (areaM2 > 0 ? volumeM3 / areaM2 : 0.5);
    const concTotal =
      item.hgTotal !== null && item.hgTotal !== undefined
        ? Math.max(Number(item.hgTotal), Number(item.hg2) || 0)
        : Number(item.hg2) || 0;
    const methyl = item.methylHg !== null && item.methylHg !== undefined ? Math.max(0, Number(item.methylHg)) : 0;

    // 1. Matriz de Riesgos 3×3
    const sevAxis = item.semaphore === 'red' || methyl > 0 ? 'high' : item.semaphore === 'yellow' ? 'medium' : 'low';
    const volAxis = volumeM3 < 50 ? 'small' : volumeM3 <= 500 ? 'medium' : 'large';
    const riskCellKey = `${sevAxis}-${volAxis}`;
    const riskCellDef = RISK_CELLS_DEF.find((c) => c.sev === sevAxis && c.vol === volAxis) || RISK_CELLS_DEF[8];

    // 2. Carga Hg y Ganancia en Oro Residual
    const metrics = computeOpportunityAndLoad(item.matrix, volumeM3, concTotal, Boolean(item.level2Used), item.semaphore);

    // 3. Matriz de Oportunidad de Inversión en Oro Residual 3×3
    const gainAxis = metrics.netGoldGainUsd > 25000 ? 'high' : metrics.netGoldGainUsd >= 2000 ? 'medium' : 'low';
    const urgAxis = riskCellDef.tier === 'critical' || riskCellDef.tier === 'high' ? 'high' : riskCellDef.tier === 'moderate' ? 'moderate' : 'low';
    const goldCellKey = `${gainAxis}-${urgAxis}`;
    const goldCellDef = GOLD_CELLS_DEF.find((c) => c.gain === gainAxis && c.urg === urgAxis) || GOLD_CELLS_DEF[8];

    // 4. Índice de Prioridad (0–100)
    let concPts = 0;
    if (item.matrix === 'water') {
      if (concTotal < 5) concPts = (concTotal / 5) * 12;
      else if (concTotal <= 20) concPts = 12 + ((concTotal - 5) / 15) * 18;
      else concPts = 30 + Math.min(1, (concTotal - 20) / 40) * 15;
    } else {
      if (concTotal < 50) concPts = (concTotal / 50) * 12;
      else if (concTotal <= 170) concPts = 12 + ((concTotal - 50) / 120) * 16;
      else concPts = 28 + Math.min(1, (concTotal - 170) / 330) * 17;
    }

    let methylPts = 0;
    if (methyl > 0) {
      const refCap = item.matrix === 'sludge' ? 250 : 20;
      methylPts = 10 + Math.min(1, methyl / refCap) * 20;
    }

    let volPts = 0;
    if (volumeM3 < 50) volPts = (volumeM3 / 50) * 8;
    else if (volumeM3 <= 500) volPts = 8 + ((volumeM3 - 50) / 450) * 10;
    else volPts = 18 + Math.min(1, (volumeM3 - 500) / 700) * 7;

    const priorityScore = Math.min(100, Math.round(concPts + methylPts + volPts));
    let priorityTier = 'low', priorityLabel = 'BAJO';
    if (priorityScore >= 75) { priorityTier = 'critical'; priorityLabel = 'CRÍTICO'; }
    else if (priorityScore >= 50) { priorityTier = 'high'; priorityLabel = 'ALTO'; }
    else if (priorityScore >= 25) { priorityTier = 'moderate'; priorityLabel = 'MODERADO'; }

    // Elegible para Afiliación al Programa de Biorremediación cuando el riesgo es Considerable o Alto
    const eligibleForBiorem =
      item.semaphore === 'red' ||
      item.semaphore === 'yellow' ||
      riskCellDef.tier === 'critical' ||
      riskCellDef.tier === 'high' ||
      riskCellDef.tier === 'moderate';

    const isAffiliated = state.affiliations.some((a) => a.siteId === item.id);

    return {
      ...item,
      mat,
      volumeM3,
      areaM2,
      depthM,
      concTotal,
      methyl,
      sevAxis,
      volAxis,
      riskCellKey,
      riskTier: riskCellDef.tier,
      riskTierLabel: riskCellDef.tierLabel,
      recommendedAction: riskCellDef.action,
      gainAxis,
      urgAxis,
      goldCellKey,
      goldTier: goldCellDef.tier,
      goldTierLabel: goldCellDef.tierLabel,
      goldAction: goldCellDef.action,
      ...metrics,
      scoreBreakdown: {
        concPts: Math.round(concPts),
        methylPts: Math.round(methylPts),
        volPts: Math.round(volPts),
      },
      priorityScore,
      priorityTier,
      priorityLabel,
      eligibleForBiorem,
      isAffiliated,
    };
  }

  // ---------- Formato ----------
  function fmtUsd(amount) {
    return `$${Math.round(amount).toLocaleString('en-US')} USD`;
  }
  function fmtGrams(g) {
    if (g >= 100) return `${g.toFixed(0)} g`;
    if (g >= 10) return `${g.toFixed(1)} g`;
    return `${g.toFixed(2)} g`;
  }
  function formatDateDisplay(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('es-BO', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }
  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  let toastTimer = null;
  function showToast(msg) {
    dom.toast.textContent = msg;
    dom.toast.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => dom.toast.classList.remove('is-show'), 3200);
  }

  // ---------- Canvas Foto de Zona y Volumen ----------

  function buildSyntheticZoneCanvas(matrixKey, refName) {
    const off = document.createElement('canvas');
    off.width = ZONE_W;
    off.height = ZONE_H;
    const ctx = off.getContext('2d');

    const sky = ctx.createLinearGradient(0, 0, 0, 74);
    sky.addColorStop(0, '#B9C7D4');
    sky.addColorStop(1, '#E2DDD1');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, ZONE_W, 74);

    ctx.fillStyle = matrixKey === 'sludge' ? '#7E7262' : '#968B78';
    ctx.fillRect(0, 70, ZONE_W, ZONE_H - 70);

    ctx.fillStyle = matrixKey === 'sludge' ? '#585046' : '#7B7263';
    ctx.beginPath();
    ctx.moveTo(0, 88);
    ctx.quadraticCurveTo(95, 72, 185, 84);
    ctx.quadraticCurveTo(285, 95, ZONE_W, 78);
    ctx.lineTo(ZONE_W, ZONE_H);
    ctx.lineTo(0, ZONE_H);
    ctx.closePath();
    ctx.fill();

    const bodyGrad = ctx.createLinearGradient(0, 95, 0, 220);
    if (matrixKey === 'sludge') {
      bodyGrad.addColorStop(0, '#443E37');
      bodyGrad.addColorStop(0.6, '#302C27');
      bodyGrad.addColorStop(1, '#23201C');
    } else {
      bodyGrad.addColorStop(0, '#6B8899');
      bodyGrad.addColorStop(0.55, '#4A6E82');
      bodyGrad.addColorStop(1, '#365668');
    }
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.moveTo(64, 112);
    ctx.bezierCurveTo(130, 92, 245, 94, 306, 118);
    ctx.bezierCurveTo(334, 152, 316, 206, 250, 214);
    ctx.bezierCurveTo(155, 222, 54, 212, 38, 174);
    ctx.bezierCurveTo(28, 146, 42, 122, 64, 112);
    ctx.closePath();
    ctx.fill();

    ctx.save();
    if (refName.includes('Botella')) {
      ctx.fillStyle = '#F3EFE7';
      ctx.strokeStyle = '#B3261E';
      ctx.lineWidth = 2;
      ctx.fillRect(24, 154, 10, 24);
      ctx.strokeRect(24, 154, 10, 24);
    } else {
      ctx.fillStyle = '#D49300';
      ctx.strokeStyle = '#1F1D1A';
      ctx.lineWidth = 1.5;
      ctx.fillRect(18, 134, 6, 56);
      ctx.strokeRect(18, 134, 6, 56);
    }
    ctx.fillStyle = '#1F1D1A';
    ctx.fillRect(12, 194, 104, 18);
    ctx.fillStyle = '#F3E7C6';
    ctx.font = '700 9.5px Consolas, monospace';
    ctx.fillText(`REF: ${refName}`, 16, 206);
    ctx.restore();

    ctx.fillStyle = 'rgba(31, 29, 26, 0.78)';
    ctx.fillRect(8, 8, 205, 20);
    ctx.fillStyle = '#F6F1E6';
    ctx.font = '600 10px Consolas, monospace';
    ctx.fillText(
      matrixKey === 'sludge' ? 'DEMO ZONA • COLAS AURÍFERAS' : 'DEMO ZONA • CAUCE / EFLUENTE',
      14,
      21
    );
    return off;
  }

  function renderZoneCanvas() {
    const canvas = dom.canvasZone;
    const ctx = canvas.getContext('2d');
    const { lengthM, widthM, depthM } = getZoneMetrics();

    if (state.zone.hasPhoto && state.zone.photoCanvas) {
      ctx.clearRect(0, 0, ZONE_W, ZONE_H);
      ctx.drawImage(state.zone.photoCanvas, 0, 0);
    } else {
      ctx.fillStyle = '#2B2824';
      ctx.fillRect(0, 0, ZONE_W, ZONE_H);
      ctx.strokeStyle = 'rgba(233, 228, 216, 0.08)';
      for (let x = 24; x < ZONE_W; x += 24) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ZONE_H); ctx.stroke(); }
      for (let y = 24; y < ZONE_H; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(ZONE_W, y); ctx.stroke(); }
      ctx.fillStyle = '#CFC9BB';
      ctx.font = '600 12px "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Toma/sube foto de la zona o carga la Imagen Demo', ZONE_W / 2, 34);
      ctx.textAlign = 'left';
    }

    const normL = Math.min(1, Math.max(0.18, lengthM / 55));
    const normW = Math.min(1, Math.max(0.2, widthM / 45));
    const bottomW = 110 + normL * 195;
    const topW = bottomW * 0.72;
    const boxH = 44 + normW * 96;
    const cx = ZONE_W / 2 + 12;
    const bottomY = Math.min(ZONE_H - 18, 128 + boxH / 2);
    const topY = Math.max(54, bottomY - boxH);

    ctx.save();
    ctx.fillStyle = 'rgba(176, 125, 20, 0.22)';
    ctx.strokeStyle = '#F3E7C6';
    ctx.lineWidth = 2.2;
    ctx.setLineDash([7, 4]);
    ctx.beginPath();
    ctx.moveTo(cx - topW / 2, topY);
    ctx.lineTo(cx + topW / 2, topY);
    ctx.lineTo(cx + bottomW / 2, bottomY);
    ctx.lineTo(cx - bottomW / 2, bottomY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(31, 29, 26, 0.86)';
    ctx.fillRect(cx - 74, (topY + bottomY) / 2 - 14, 148, 28);
    ctx.strokeStyle = '#B07D14';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - 74, (topY + bottomY) / 2 - 14, 148, 28);
    ctx.fillStyle = '#F6F1E6';
    ctx.font = '700 11px Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${lengthM.toFixed(1)}m × ${widthM.toFixed(1)}m × ${depthM.toFixed(1)}m`, cx, (topY + bottomY) / 2 + 4);
    ctx.restore();
  }

  function loadZoneImageFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const off = document.createElement('canvas');
        off.width = ZONE_W;
        off.height = ZONE_H;
        const ctx = off.getContext('2d');
        const imgRatio = img.width / img.height, cRatio = ZONE_W / ZONE_H;
        let sx = 0, sy = 0, sw = img.width, sh = img.height;
        if (imgRatio > cRatio) { sw = img.height * cRatio; sx = (img.width - sw) / 2; }
        else { sh = img.width / cRatio; sy = (img.height - sh) / 2; }
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, ZONE_W, ZONE_H);
        state.zone.hasPhoto = true;
        state.zone.isDemoPhoto = false;
        state.zone.photoCanvas = off;
        renderZoneCanvas();
        showToast('Foto de zona cargada. Ajusta largo, ancho y profundidad.');
      };
      img.onerror = () => showToast('No se pudo leer la foto de zona.');
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  function loadDemoZonePhoto() {
    state.zone.hasPhoto = true;
    state.zone.isDemoPhoto = true;
    state.zone.photoCanvas = buildSyntheticZoneCanvas(state.matrix, state.zone.refName);
    renderZoneCanvas();
    showToast('Imagen demo de zona cargada en el lienzo.');
  }

  // ---------- Señal Acústica / Háptica Nivel 2 ----------
  function triggerLevel2AlertSignal(severity) {
    try { if (navigator.vibrate) navigator.vibrate(severity === 'red' ? [140, 80, 180] : [110, 70, 110]); } catch (_) {}
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      const freqs = severity === 'red' ? [660, 880] : [523.25, 659.25];
      freqs.forEach((f, idx) => {
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now + idx * 0.16);
        gain.gain.setValueAtTime(0.001, now + idx * 0.16);
        gain.gain.exponentialRampToValueAtTime(0.08, now + idx * 0.16 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.16 + 0.14);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(now + idx * 0.16); osc.stop(now + idx * 0.16 + 0.15);
      });
    } catch (_) {}
  }

  // ---------- Canvas ROI 50×50 px (Tubo A y Tubo C) ----------

  function drawEmptyCanvas(tubeKey) {
    const canvas = tubeKey === 'A' ? dom.canvasA : dom.canvasC;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1F1D1A';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.strokeStyle = 'rgba(233, 228, 216, 0.08)';
    for (let x = 20; x < CANVAS_W; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_H); ctx.stroke(); }
    for (let y = 20; y < CANVAS_H; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_W, y); ctx.stroke(); }
    drawRoiOverlay(ctx, Math.floor((CANVAS_W - ROI_SIZE) / 2), Math.floor((CANVAS_H - ROI_SIZE) / 2));
    ctx.fillStyle = '#E9E4D8';
    ctx.font = '600 12px "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(tubeKey === 'A' ? 'Tubo A (Tapa Amarilla) — Esperando captura' : 'Tubo C (Tapa Naranja) — Esperando captura', CANVAS_W / 2, 40);
    ctx.fillStyle = '#A8A295';
    ctx.font = '400 11px "Segoe UI", Roboto, sans-serif';
    ctx.fillText('Centra el líquido dentro del recuadro verde 50×50 px', CANVAS_W / 2, CANVAS_H - 32);
  }

  function drawRoiOverlay(ctx, x, y) {
    ctx.save();
    ctx.strokeStyle = 'rgba(29, 27, 24, 0.65)';
    ctx.lineWidth = 3.5;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(x + 0.5, y + 0.5, ROI_SIZE, ROI_SIZE);
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(x + 0.5, y + 0.5, ROI_SIZE, ROI_SIZE);
    const cx = x + ROI_SIZE / 2, cy = y + ROI_SIZE / 2;
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.85)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx - 5, cy); ctx.lineTo(cx + 5, cy);
    ctx.moveTo(cx, cy - 5); ctx.lineTo(cx, cy + 5);
    ctx.stroke();
    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function buildSyntheticVialCanvas(tubeKey, demoTube) {
    const off = document.createElement('canvas');
    off.width = CANVAS_W; off.height = CANVAS_H;
    const ctx = off.getContext('2d');
    ctx.fillStyle = '#2B2824'; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#F3EFE7'; roundRect(ctx, 72, 16, 176, 188, 6); ctx.fill();
    const vialW = 104, vialX = (CANVAS_W - vialW) / 2, vialTop = 34, vialH = 164;
    const capGrad = ctx.createLinearGradient(vialX, 0, vialX + vialW, 0);
    capGrad.addColorStop(0, tubeKey === 'A' ? '#8A6410' : '#963B0A');
    capGrad.addColorStop(0.5, tubeKey === 'A' ? '#D49300' : '#D95D1E');
    capGrad.addColorStop(1, tubeKey === 'A' ? '#8A6410' : '#963B0A');
    ctx.fillStyle = capGrad; roundRect(ctx, vialX + 4, 18, vialW - 8, 24, 4); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.72)'; roundRect(ctx, vialX, vialTop, vialW, vialH, 14); ctx.fill();
    const { r, g, b } = demoTube;
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`; roundRect(ctx, vialX + 5, 58, vialW - 10, 134, 10); ctx.fill();
    ctx.fillStyle = `rgba(${Math.min(255, r + 14)}, ${Math.min(255, g + 14)}, ${Math.min(255, b + 14)}, 0.85)`;
    ctx.beginPath(); ctx.ellipse(CANVAS_W / 2, 60, (vialW - 10) / 2 - 2, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.32)'; roundRect(ctx, vialX + 6, vialTop + 10, 8, vialH - 22, 4); ctx.fill();
    ctx.fillStyle = 'rgba(29,27,24,0.08)'; roundRect(ctx, vialX + vialW - 12, vialTop + 10, 6, vialH - 22, 3); ctx.fill();
    ctx.strokeStyle = 'rgba(79,75,67,0.55)'; ctx.lineWidth = 1.5; roundRect(ctx, vialX, vialTop, vialW, vialH, 14); ctx.stroke();
    ctx.fillStyle = '#4F4B43'; ctx.font = '600 10px Consolas, monospace'; ctx.textAlign = 'left';
    ctx.fillText(demoTube.label || `Tubo ${tubeKey}`, 10, 18);
    return off;
  }

  function loadImageFileToTube(tubeKey, file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const off = document.createElement('canvas');
        off.width = CANVAS_W; off.height = CANVAS_H;
        const ctx = off.getContext('2d');
        const imgRatio = img.width / img.height, cRatio = CANVAS_W / CANVAS_H;
        let sx = 0, sy = 0, sw = img.width, sh = img.height;
        if (imgRatio > cRatio) { sw = img.height * cRatio; sx = (img.width - sw) / 2; }
        else { sh = img.width / cRatio; sy = (img.height - sh) / 2; }
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, CANVAS_W, CANVAS_H);
        state.originMode = 'real';
        const tube = state.tubes[tubeKey];
        tube.id = Date.now();
        tube.sourceCanvas = off;
        tube.hasImage = true;
        tube.roiX = Math.floor((CANVAS_W - ROI_SIZE) / 2);
        tube.roiY = Math.floor((CANVAS_H - ROI_SIZE) / 2);
        analyzeTubeCanvas(tubeKey, true);
        showToast(`Foto real analizada en Tubo ${tubeKey}`);
      };
      img.onerror = () => showToast('No se pudo leer la imagen seleccionada.');
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  function analyzeTubeCanvas(tubeKey, allowSignal = false) {
    const tube = state.tubes[tubeKey];
    const canvas = tubeKey === 'A' ? dom.canvasA : dom.canvasC;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!tube.hasImage || !tube.sourceCanvas) { drawEmptyCanvas(tubeKey); return; }

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.drawImage(tube.sourceCanvas, 0, 0);
    const imgData = ctx.getImageData(tube.roiX, tube.roiY, ROI_SIZE, ROI_SIZE);
    const data = imgData.data;
    const totalPixels = ROI_SIZE * ROI_SIZE;
    let sumR = 0, sumG = 0, sumB = 0;
    for (let i = 0; i < data.length; i += 4) { sumR += data[i]; sumG += data[i + 1]; sumB += data[i + 2]; }

    drawRoiOverlay(ctx, tube.roiX, tube.roiY);
    tube.metrics = computeQuantification(sumR / totalPixels, sumG / totalPixels, sumB / totalPixels, state.matrix);

    const defaultX = Math.floor((CANVAS_W - ROI_SIZE) / 2), defaultY = Math.floor((CANVAS_H - ROI_SIZE) / 2);
    const centerBtn = tubeKey === 'A' ? dom.centerRoiA : dom.centerRoiC;
    centerBtn.classList.toggle('hidden', Math.abs(tube.roiX - defaultX) <= 2 && Math.abs(tube.roiY - defaultY) <= 2);

    if (tubeKey === 'A' && allowSignal) {
      const ev = evaluateSemaphore(state.matrix, tube.metrics.finalPpb);
      if ((ev.level === 'yellow' || ev.level === 'red') && state.lastSignaledTubeAId !== tube.id) {
        state.lastSignaledTubeAId = tube.id;
        triggerLevel2AlertSignal(ev.level);
      }
    }
    updateAllUI();
  }

  // ---------- Navegación entre 4 Pestañas y 4 Pasos ----------

  function switchView(viewName) {
    stopFriendlyTour();
    stopSbrTour();
    state.view = viewName;

    const map = [
      ['measure', dom.navMeasure, dom.topTabMeasure, dom.viewMeasure],
      ['risks', dom.navRisks, dom.topTabRisks, dom.viewRisks],
      ['priorities', dom.navPriorities, dom.topTabPriorities, dom.viewPriorities],
      ['biorem', dom.navBiorem, dom.topTabBiorem, dom.viewBiorem],
    ];
    map.forEach(([key, sideEl, topEl, viewEl]) => {
      const active = key === viewName;
      sideEl.classList.toggle('is-active', active);
      topEl.classList.toggle('is-active', active);
      viewEl.classList.toggle('is-active', active);
    });

    const titles = {
      measure: [
        'Medición Guiada — Zona y AgNPs',
        'Foto de Zona y Volumen → Nivel 1 Hg²⁺ (5 min) → Nivel 2 UV-C CH₃Hg⁺ (+5–8 min) → Valor Oro Residual.',
      ],
      risks: [
        'Matrices 3×3: Riesgo Ambiental y Oportunidad en Oro Residual',
        'Evaluación visual interactiva de severidad Hg/CH₃Hg⁺, volumen afectado y ganancia estimada con tecnologías limpias.',
      ],
      priorities: [
        'Sitios Prioritarios — Ranking y Ganancia en Oro Residual',
        'Índice 0–100, ganancia estimada en colas (U-101), ahorro AgNPs vs Lab, afiliación y exportación CSV.',
      ],
      biorem: [
        'Programa de Biorremediación y Tecnologías Limpias (Reto 4.2)',
        'Afiliación cooperativa, Guía Visual en 4 pasos y Simulador PFD (U-101 → R-101 SBR → Trampa de Azufre T-101).',
      ],
    };
    dom.topbarTitle.textContent = titles[viewName][0];
    dom.topbarSub.textContent = titles[viewName][1];

    if (viewName === 'risks') renderMatricesView();
    if (viewName === 'priorities') renderPrioritiesView();
    if (viewName === 'biorem') renderAffiliationUI();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function switchBioSubView(sub) {
    stopFriendlyTour();
    stopSbrTour();
    state.bioSubView = sub;
    dom.btnBioSubSencilla.classList.toggle('is-active', sub === 'sencilla');
    dom.btnBioSubTecnica.classList.toggle('is-active', sub === 'tecnica');
    dom.bioSubSencilla.classList.toggle('is-active', sub === 'sencilla');
    dom.bioSubTecnica.classList.toggle('is-active', sub === 'tecnica');
  }

  function goToStep(stepIndex) {
    const mA = state.tubes.A.metrics;
    const level1Eval = mA ? evaluateSemaphore(state.matrix, mA.finalPpb) : null;
    const level2Unlocked = Boolean(
      level1Eval && (level1Eval.level === 'yellow' || level1Eval.level === 'red' || state.level2ManualUnlock || state.tubes.C.metrics)
    );
    if (stepIndex === 2 && !level2Unlocked) {
      showToast('Nivel 2 solo se habilita ante un positivo Amarillo/Rojo en Nivel 1.');
      return;
    }
    if (stepIndex === 3 && !mA) {
      showToast('Primero completa el Tamizaje de Nivel 1 (Tubo A).');
      return;
    }
    state.step = stepIndex;
    updateAllUI();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---------- Sincronización General de UI ----------

  function updateAllUI() {
    const mat = MATRICES[state.matrix];
    const z = getZoneMetrics();

    dom.headerMatrixPill.textContent = `${mat.shortName} (${mat.factor}×) • ${z.volumeM3.toFixed(0)} m³`;
    dom.originBadge.className = `origin ${state.originMode === 'demo' ? 'origin--demo' : 'origin--real'}`;
    dom.originBadge.textContent = state.originMode === 'demo' ? 'Escenario Demo' : 'Modo Campo';

    dom.btnMatrixWater.classList.toggle('is-selected', state.matrix === 'water');
    dom.btnMatrixWater.setAttribute('aria-checked', String(state.matrix === 'water'));
    dom.btnMatrixSludge.classList.toggle('is-selected', state.matrix === 'sludge');
    dom.btnMatrixSludge.setAttribute('aria-checked', String(state.matrix === 'sludge'));
    dom.sludgeReminder.classList.toggle('hidden', state.matrix !== 'sludge');

    // Vista previa de Área, Volumen y Ganancia Estimada de Oro Residual (SIN costo de remediación)
    const previewOpp = computeOpportunityAndLoad(state.matrix, z.volumeM3, 0, false, 'yellow');
    dom.zoneAreaOut.textContent = `${z.areaM2.toFixed(1)} m²`;
    dom.zoneVolumeOut.textContent = `${z.volumeM3.toFixed(1)} m³`;
    dom.zoneGoldPreviewOut.textContent = fmtUsd(previewOpp.netGoldGainUsd);
    dom.zoneCanvasDimLabel.textContent = `${z.lengthM.toFixed(1)} m × ${z.widthM.toFixed(1)} m`;
    dom.stepTab0Sub.textContent = `${z.volumeM3.toFixed(0)} m³ • ${mat.shortName}`;

    const refUnitsL = (z.lengthM / state.zone.refSize).toFixed(1);
    const refUnitsW = (z.widthM / state.zone.refSize).toFixed(1);
    dom.refEquivalenceHint.textContent = `Referencia (${state.zone.refName}): ~${refUnitsL}× largo y ~${refUnitsW}× ancho`;

    if (state.zone.isDemoPhoto) {
      state.zone.photoCanvas = buildSyntheticZoneCanvas(state.matrix, state.zone.refName);
    }
    renderZoneCanvas();

    ['A', 'C'].forEach((k) => {
      const tube = state.tubes[k];
      if (tube.metrics) {
        tube.metrics = computeQuantification(tube.metrics.r, tube.metrics.g, tube.metrics.b, state.matrix);
      }
      renderTubeTelemetry(k);
    });

    const mA = state.tubes.A.metrics;
    const mC = state.tubes.C.metrics;
    const level1Eval = mA ? evaluateSemaphore(state.matrix, mA.finalPpb) : null;
    const isPositiveL1 = Boolean(level1Eval && (level1Eval.level === 'yellow' || level1Eval.level === 'red'));
    const level2Unlocked = Boolean(isPositiveL1 || state.level2ManualUnlock || mC);

    dom.stepPanel0.classList.toggle('hidden', state.step !== 0);
    dom.stepPanel1.classList.toggle('hidden', state.step !== 1);
    dom.stepPanel2.classList.toggle('hidden', state.step !== 2);
    dom.stepPanel3.classList.toggle('hidden', state.step !== 3);

    dom.stepTab0.className = `step-tab ${state.step === 0 ? 'is-current' : 'is-done'}`;
    dom.stepTab1.className = `step-tab ${state.step === 1 ? 'is-current' : mA ? 'is-done' : ''}`;
    dom.stepTab2.disabled = !level2Unlocked;
    const shouldPulseTab2 = isPositiveL1 && !mC && state.step !== 2;
    dom.stepTab2.className = `step-tab ${state.step === 2 ? 'is-current' : mC ? 'is-done' : shouldPulseTab2 ? 'is-alert-pulse' : ''}`;
    dom.stepTab2Sub.textContent = mC ? 'Completado (UV-C)' : isPositiveL1 ? '¡SEÑAL ACTIVA!' : level2Unlocked ? 'Manual' : mA ? 'No requerido' : 'Solo positivos';
    dom.stepTab3.disabled = !mA;
    dom.stepTab3.className = `step-tab ${state.step === 3 ? 'is-current' : ''}`;

    if (isPositiveL1 && !mC && state.step !== 2) {
      dom.level2SignalBanner.classList.remove('hidden', 'is-yellow');
      if (level1Eval.level === 'yellow') dom.level2SignalBanner.classList.add('is-yellow');
      const colorWord = level1Eval.level === 'red' ? 'ROJO (Peligro Crítico)' : 'AMARILLO (Alerta)';
      dom.signalKicker.textContent = `SEÑAL DE ACTIVACIÓN NIVEL 2 — POSITIVO ${colorWord} CONFIRMADO`;
      dom.signalText.textContent =
        state.matrix === 'sludge'
          ? `Nivel 1 detectó ${mA.finalPpb.toFixed(1)} ppb en colas (${z.volumeM3.toFixed(0)} m³). Habilitado Nivel 2 (Cámara UV-C 254 nm) para cuantificar CH₃Hg⁺.`
          : `Nivel 1 detectó ${mA.finalPpb.toFixed(1)} ppb de Hg²⁺ en agua (${z.volumeM3.toFixed(0)} m³). Nivel 2 (UV-C) habilitado.`;
      dom.btnSignalGoLevel2.className = `btn ${level1Eval.level === 'red' ? 'btn--bad' : 'btn--gold'}`;
    } else {
      dom.level2SignalBanner.classList.add('hidden');
    }

    dom.stepPanel2.classList.toggle('is-locked', !level2Unlocked);
    dom.stepPanel2.classList.toggle('is-signaled', isPositiveL1 && !mC);

    updateLevel1Gate(mA, mC, level1Eval, level2Unlocked);
    if (mA) updateResultPanel(mA, mC, level1Eval);

    renderCalibrationChart();
    dom.sitesCountBadge.textContent = String(state.history.length);
    dom.affCountBadge.textContent = String(state.affiliations.length);
  }

  function renderTubeTelemetry(tubeKey) {
    const tube = state.tubes[tubeKey];
    const mat = MATRICES[state.matrix];
    const isA = tubeKey === 'A';
    const emptyBox = isA ? dom.telemetryEmptyA : dom.telemetryEmptyC;
    const panel = isA ? dom.telemetryA : dom.telemetryC;

    if (!tube.metrics) {
      emptyBox.classList.remove('hidden');
      panel.classList.add('hidden');
      return;
    }
    emptyBox.classList.add('hidden');
    panel.classList.remove('hidden');

    const m = tube.metrics;
    (isA ? dom.swatchA : dom.swatchC).style.background = `rgb(${m.r}, ${m.g}, ${m.b})`;
    (isA ? dom.rgbTextA : dom.rgbTextC).textContent = `RGB(${m.r}, ${m.g}, ${m.b})`;
    (isA ? dom.hsvTextA : dom.hsvTextC).textContent = `${m.h.toFixed(0)}° / ${m.s.toFixed(1)}% / ${m.v.toFixed(0)}%`;
    (isA ? dom.brTextA : dom.brTextC).textContent = m.br.toFixed(3);
    (isA ? dom.deltaSTextA : dom.deltaSTextC).textContent = `${m.deltaS.toFixed(1)}%`;
    (isA ? dom.concLabelA : dom.concLabelC).textContent = isA ? `Hg²⁺ (${mat.unitShort})` : `Hg Total (${mat.unitShort})`;
    (isA ? dom.concTextA : dom.concTextC).textContent = `${m.finalPpb.toFixed(1)} ${mat.unitShort}`;
  }

  function updateLevel1Gate(mA, mC, level1Eval, level2Unlocked) {
    if (!mA || !level1Eval) {
      dom.level1GateBanner.classList.add('hidden');
      dom.btnUnlockLevel2.classList.add('hidden');
      dom.btnNextFromLevel1.classList.add('hidden');
      return;
    }

    dom.level1GateBanner.className = `gate-box gate-box--${level1Eval.tone}`;
    dom.gateActions.innerHTML = '';

    if (level1Eval.level === 'green') {
      dom.gateTitle.textContent = '✅ Tamizaje Nivel 1 Limpio (Verde) — La prueba finaliza aquí';
      dom.gateDesc.textContent = 'No se requiere activar Nivel 2 (UV-C), ahorrando tiempo (+5 a 8 min) y reactivos.';
      dom.btnUnlockLevel2.classList.toggle('hidden', level2Unlocked);
      dom.btnNextFromLevel1.classList.remove('hidden');
      dom.btnNextFromLevel1.textContent = 'Ir al Dictamen Final →';
      dom.btnNextFromLevel1.className = 'btn btn--ok';
      dom.btnNextFromLevel1.dataset.nextStep = '3';
    } else {
      const icon = level1Eval.level === 'red' ? '🚨' : '⚠️';
      dom.gateTitle.textContent = `${icon} Positivo ${level1Eval.shortLabel} Confirmado — Nivel 2 (UV-C) Habilitado`;
      dom.gateDesc.textContent = 'Se emitió la señal para activar la cámara UV-C (254 nm) y evaluar la afiliación al Programa de Biorremediación.';

      const btnJumpL2 = document.createElement('button');
      btnJumpL2.type = 'button';
      btnJumpL2.className = `btn ${level1Eval.level === 'red' ? 'btn--bad' : 'btn--purple'}`;
      btnJumpL2.textContent = 'Ir a Nivel 2 (UV-C 254 nm) →';
      btnJumpL2.addEventListener('click', () => goToStep(2));
      dom.gateActions.appendChild(btnJumpL2);

      dom.btnUnlockLevel2.classList.add('hidden');
      dom.btnNextFromLevel1.classList.remove('hidden');
      dom.btnNextFromLevel1.textContent = mC ? 'Ir al Dictamen y Oro →' : 'Continuar a Nivel 2 (UV-C) →';
      dom.btnNextFromLevel1.className = 'btn btn--purple';
      dom.btnNextFromLevel1.dataset.nextStep = mC ? '3' : '2';
    }
  }

  function updateResultPanel(mA, mC, level1Eval) {
    const mat = MATRICES[state.matrix];
    const z = getZoneMetrics();
    const hg2 = mA.finalPpb;
    const hgTotal = mC ? mC.finalPpb : null;
    const methylHg = hgTotal !== null ? Math.max(0, hgTotal - hg2) : null;
    const evalConc = hgTotal !== null ? Math.max(hgTotal, hg2) : hg2;
    const finalEval = evaluateSemaphore(state.matrix, evalConc);
    const opp = computeOpportunityAndLoad(state.matrix, z.volumeM3, evalConc, hgTotal !== null, finalEval.level);

    dom.resultLevelBadge.textContent = hgTotal !== null ? 'Nivel 1 + Nivel 2 (UV-C)' : 'Nivel 1 (Tamizaje)';
    dom.resultTitle.textContent = `Dictamen y Oportunidad Oro Residual — ${mat.shortName}`;

    dom.semaphoreBanner.className = `semaphore-card semaphore-card--${finalEval.tone}`;
    dom.semaphoreBadge.textContent = finalEval.label;
    dom.semaphoreMessage.textContent = finalEval.message;
    dom.semaphoreNormRef.textContent = finalEval.normRef;

    dom.bulbRed.classList.toggle('is-lit', finalEval.level === 'red');
    dom.bulbYellow.classList.toggle('is-lit', finalEval.level === 'yellow');
    dom.bulbGreen.classList.toggle('is-lit', finalEval.level === 'green');

    dom.kpiHg2.textContent = hg2.toFixed(1);
    dom.kpiHgTotal.textContent = hgTotal !== null ? hgTotal.toFixed(1) : '—';
    dom.kpiMethyl.textContent = methylHg !== null ? methylHg.toFixed(1) : '—';

    dom.kpiUnit1.textContent = mat.unit;
    dom.kpiUnit2.textContent = hgTotal !== null ? mat.unit : level1Eval.level === 'green' ? 'No requerido' : 'Pendiente UV-C';
    dom.kpiUnit3.textContent = methylHg !== null ? mat.unit : level1Eval.level === 'green' ? 'No requerido' : 'Pendiente UV-C';

    // Volumen, Carga Hg (g) y Ganancia Estimada de Oro Residual (USD) — SIN costo de remediación
    dom.kpiVolume.textContent = `${z.volumeM3.toFixed(1)} m³`;
    dom.kpiAreaSub.textContent = `Área: ${z.areaM2.toFixed(1)} m² (~${opp.tailingsTons.toFixed(0)} t sól.)`;
    dom.kpiHgMass.textContent = fmtGrams(opp.hgMassGrams);
    dom.kpiMassFormula.textContent =
      state.matrix === 'sludge'
        ? `Vol × ${evalConc.toFixed(1)} ppb × 0.0014 (ρ ≈ 1.4 t/m³)`
        : `Vol × ${evalConc.toFixed(1)} ppb × 0.001`;
    dom.kpiGoldGain.textContent = fmtUsd(opp.netGoldGainUsd);
    dom.kpiGoldGrams.textContent = `Oro rescatable U-101: ${opp.recoverableGoldGrams.toFixed(1)} g Au (bruto ${fmtUsd(opp.grossGoldUsd)})`;

    if (hgTotal !== null && hgTotal > 0) {
      const effectiveTotal = Math.max(hgTotal, hg2);
      const inorgPct = Math.min(100, (hg2 / effectiveTotal) * 100);
      const methylPct = Math.max(0, 100 - inorgPct);
      dom.speciationBarWrap.classList.remove('hidden');
      dom.barInorganic.style.width = `${inorgPct.toFixed(1)}%`;
      dom.barMethyl.style.width = `${methylPct.toFixed(1)}%`;
      dom.speciationPctLabel.textContent = `Hg²⁺ ${inorgPct.toFixed(0)}% • CH₃Hg⁺ ${methylPct.toFixed(0)}%`;
    } else {
      dom.speciationBarWrap.classList.add('hidden');
    }

    // Mostrar opción EXTRA de Afiliación al Programa de Biorremediación si riesgo es Considerable / Alto (Amarillo o Rojo)
    const showAffiliation = finalEval.level === 'yellow' || finalEval.level === 'red';
    dom.resultAffiliationCard.classList.toggle('hidden', !showAffiliation);
    if (showAffiliation) {
      dom.resultAffiliationText.textContent = `Este sitio presenta riesgo ${finalEval.shortLabel.toUpperCase()} (${evalConc.toFixed(1)} ppb en ${z.volumeM3.toFixed(0)} m³). El rescate gravimétrico U-101 de ${opp.recoverableGoldGrams.toFixed(1)} g de oro residual en colas genera una ganancia neta estimada de ${fmtUsd(opp.netGoldGainUsd)} alineada al Programa de Biorremediación (SBR + Piedra Pómez + Cinabrio HgS).`;
    }
  }

  // ---------- Pestaña 2: Matrices 3×3 Duales (Riesgo + Oportunidad Oro Residual) ----------

  function setMatrixMode(mode) {
    state.matrixMode = mode;
    const isRisk = mode === 'risk';
    dom.btnModeRiskMatrix.classList.toggle('is-active', isRisk);
    dom.btnModeGoldMatrix.classList.toggle('is-active', !isRisk);
    dom.blockRiskMatrix.classList.toggle('hidden', !isRisk);
    dom.blockGoldMatrix.classList.toggle('hidden', isRisk);

    dom.activeMatrixHeading.textContent = isRisk
      ? 'Matriz 1: Riesgos Ambientales 3×3 (Severidad vs. Volumen)'
      : 'Matriz 2: Oportunidad de Inversión y Ganancia de Oro Residual (Colas)';
    dom.activeMatrixSub.textContent = isRisk
      ? 'Posiciona cada sitio según severidad Hg/CH₃Hg⁺ y volumen afectado (m³).'
      : 'Cruza la ganancia neta estimada de oro residual en colas (U-101, 5.5 g/t × 21.5%) contra la urgencia ambiental para impulsar tecnologías limpias.';

    renderMatricesView();
  }

  function renderMatricesView() {
    const sites = state.history.map(enrichSiteRecord);

    const totalVol = sites.reduce((s, x) => s + x.volumeM3, 0);
    const totalHgG = sites.reduce((s, x) => s + x.hgMassGrams, 0);
    const totalGoldG = sites.reduce((s, x) => s + x.recoverableGoldGrams, 0);
    const totalGoldGain = sites.reduce((s, x) => s + x.netGoldGainUsd, 0);

    dom.riskPortfolioKpis.innerHTML = `
      <div class="kpi"><span class="kpi__label">Sitios Evaluados</span><strong class="kpi__val mono">${sites.length}</strong><span class="kpi__unit">${sites.filter((x) => x.eligibleForBiorem).length} candidatos a Biorremediación</span></div>
      <div class="kpi"><span class="kpi__label">Volumen Total de Zona</span><strong class="kpi__val mono">${totalVol.toLocaleString('en-US', { maximumFractionDigits: 0 })} m³</strong><span class="kpi__unit">Agua y colas auríferas</span></div>
      <div class="kpi kpi--bad"><span class="kpi__label">Carga Acumulada de Hg</span><strong class="kpi__val mono">${fmtGrams(totalHgG)}</strong><span class="kpi__unit">Masa a neutralizar (HgS)</span></div>
      <div class="kpi kpi--gold"><span class="kpi__label">Ganancia Oro Residual</span><strong class="kpi__val mono">${fmtUsd(totalGoldGain)}</strong><span class="kpi__unit">${totalGoldG.toFixed(0)} g Au rescatables (U-101)</span></div>
    `;

    const dotColors = { green: 'var(--ok)', yellow: 'var(--mid)', red: 'var(--bad)' };

    // Render Matriz 1: Riesgos 3×3
    dom.riskMatrixGrid.innerHTML = RISK_CELLS_DEF.map((cell) => {
      const key = `${cell.sev}-${cell.vol}`;
      const cellSites = sites.filter((s) => s.riskCellKey === key);
      const isSelected = state.matrixMode === 'risk' && state.selectedRiskCellKey === key;
      const pinsHtml = cellSites
        .map((s) => {
          const shortName = s.location.split('—')[0].trim();
          return `
            <button type="button" class="site-pin ${state.selectedRiskSiteId === s.id ? 'is-active' : ''}" data-pin-site="${escapeHtml(s.id)}" data-pin-cell="${key}" data-pin-kind="risk" title="${escapeHtml(s.location)}">
              <span class="site-pin__dot" style="background:${dotColors[s.semaphore] || 'var(--unk)'}"></span>
              <span class="site-pin__name">${escapeHtml(shortName)}</span>
            </button>
          `;
        })
        .join('');
      return `
        <div class="risk-cell risk-cell--${cell.tier} ${isSelected ? 'is-selected' : ''}" data-cell-key="${key}" data-cell-kind="risk" role="gridcell" tabindex="0">
          <div class="risk-cell__tier"><span>${cell.tierLabel}</span><span class="mono">${cellSites.length}</span></div>
          <div class="risk-pins">${pinsHtml}</div>
        </div>
      `;
    }).join('');

    // Render Matriz 2: Oportunidad de Inversión y Ganancia Oro Residual 3×3
    dom.goldMatrixGrid.innerHTML = GOLD_CELLS_DEF.map((cell) => {
      const key = `${cell.gain}-${cell.urg}`;
      const cellSites = sites.filter((s) => s.goldCellKey === key);
      const isSelected = state.matrixMode === 'gold' && state.selectedGoldCellKey === key;
      const pinsHtml = cellSites
        .map((s) => {
          const shortName = s.location.split('—')[0].trim();
          return `
            <button type="button" class="site-pin ${state.selectedRiskSiteId === s.id ? 'is-active' : ''}" data-pin-site="${escapeHtml(s.id)}" data-pin-cell="${key}" data-pin-kind="gold" title="${escapeHtml(s.location)}">
              <span class="site-pin__dot" style="background:var(--gold)"></span>
              <span class="site-pin__name">${escapeHtml(shortName)}</span>
            </button>
          `;
        })
        .join('');
      return `
        <div class="risk-cell inv-cell--${cell.tier} ${isSelected ? 'is-selected' : ''}" data-cell-key="${key}" data-cell-kind="gold" role="gridcell" tabindex="0">
          <div class="risk-cell__tier"><span>${cell.tierLabel}</span><span class="mono">${cellSites.length}</span></div>
          <div class="risk-pins">${pinsHtml}</div>
        </div>
      `;
    }).join('');

    renderRiskDetailPanel(sites);
  }

  function renderRiskDetailPanel(sites) {
    const selectedSite = sites.find((s) => s.id === state.selectedRiskSiteId);

    if (selectedSite) {
      const methylDisplay = selectedSite.methyl > 0 ? `${selectedSite.methyl.toFixed(1)} ppb` : '0.0 ppb / No detectado';
      const activeAction = state.matrixMode === 'gold' ? selectedSite.goldAction : selectedSite.recommendedAction;
      const affBtnHtml = selectedSite.eligibleForBiorem
        ? `<button type="button" class="btn btn--gold" style="width:100%;margin-top:12px" data-affiliate-site="${escapeHtml(selectedSite.id)}">
            ${selectedSite.isAffiliated ? '✓ Sitio Afiliado — Ver Ruta de Biorremediación →' : '⚡ Afiliar al Programa de Biorremediación y Oro →'}
           </button>`
        : '';

      dom.riskDetailPanel.innerHTML = `
        <div class="badge-row" style="margin-bottom:8px">
          <span class="tier-pill tier-pill--${selectedSite.riskTier}">Riesgo ${selectedSite.riskTierLabel}</span>
          <span class="tier-pill tier-pill--star">${selectedSite.goldTierLabel}</span>
          <span class="tag ${selectedSite.matrix === 'sludge' ? 'tag--cap-red' : 'tag--blue'}">${escapeHtml(selectedSite.mat.shortName)}</span>
        </div>
        <h2>${escapeHtml(selectedSite.location)}</h2>
        <p class="small muted" style="margin:3px 0 12px">${escapeHtml(formatDateDisplay(selectedSite.dateISO))} • Prioridad ${selectedSite.priorityScore}/100</p>

        <div class="metrics-grid">
          <div class="metric-cell"><span>Volumen Afectado</span><strong class="mono">${selectedSite.volumeM3.toLocaleString('en-US', { maximumFractionDigits: 1 })} m³</strong></div>
          <div class="metric-cell"><span>Hg²⁺ / CH₃Hg⁺</span><strong class="mono">${selectedSite.hg2.toFixed(1)} / ${methylDisplay}</strong></div>
          <div class="metric-cell"><span>Carga Total de Hg</span><strong class="mono" style="color:var(--bad)">${fmtGrams(selectedSite.hgMassGrams)}</strong></div>
          <div class="metric-cell metric-cell--primary"><span>Oro Rescatable (U-101)</span><strong class="mono">${selectedSite.recoverableGoldGrams.toFixed(1)} g Au</strong></div>
        </div>

        <div class="value-box" style="margin-top:10px">
          <small>Ganancia Neta Estimada en Oro Residual (Programa Tecnologías Limpias)</small>
          <strong class="mono">${fmtUsd(selectedSite.netGoldGainUsd)} <span class="small muted">(Bruto: ${fmtUsd(selectedSite.grossGoldUsd)})</span></strong>
        </div>

        <div class="action-callout action-callout--${selectedSite.riskTier}">
          <strong style="display:block;margin-bottom:3px">${state.matrixMode === 'gold' ? 'Estrategia de Inversión Limpia:' : 'Acción Recomendada:'}</strong>
          ${escapeHtml(activeAction)}
        </div>
        ${affBtnHtml}
      `;
      return;
    }

    if (state.matrixMode === 'gold') {
      const def = GOLD_CELLS_DEF.find((c) => `${c.gain}-${c.urg}` === state.selectedGoldCellKey) || GOLD_CELLS_DEF[2];
      dom.riskDetailPanel.innerHTML = `
        <span class="tier-pill tier-pill--star">${def.tierLabel}</span>
        <h2 style="margin-top:8px">Cuadrante de Oportunidad de Oro Residual</h2>
        <div class="action-callout" style="margin-top:12px">${escapeHtml(def.action)}</div>
      `;
    } else {
      const def = RISK_CELLS_DEF.find((c) => `${c.sev}-${c.vol}` === state.selectedRiskCellKey) || RISK_CELLS_DEF[2];
      dom.riskDetailPanel.innerHTML = `
        <span class="tier-pill tier-pill--${def.tier}">Cuadrante ${def.tierLabel}</span>
        <h2 style="margin-top:8px">Sin sitios registrados en esta celda</h2>
        <div class="action-callout action-callout--${def.tier}" style="margin-top:12px">${escapeHtml(def.action)}</div>
      `;
    }
  }

  // ---------- Pestaña 3: Prioritarios (SIN costo de remediación, CON Ganancia Oro + Afiliación) ----------

  function renderPrioritiesView() {
    const allEnriched = state.history.map(enrichSiteRecord).sort((a, b) => b.priorityScore - a.priorityScore);
    dom.sitesCountBadge.textContent = String(allEnriched.length);

    const totalGoldGain = allEnriched.reduce((s, x) => s + x.netGoldGainUsd, 0);
    const totalGoldG = allEnriched.reduce((s, x) => s + x.recoverableGoldGrams, 0);
    const totalSavings = allEnriched.reduce((s, x) => s + x.monitoringSavingsUsd, 0);
    const totalHgG = allEnriched.reduce((s, x) => s + x.hgMassGrams, 0);
    const topScore = allEnriched.length > 0 ? allEnriched[0].priorityScore : 0;

    dom.prioritySummaryKpis.innerHTML = `
      <div class="kpi kpi--bad"><span class="kpi__label">Máxima Prioridad</span><strong class="kpi__val mono">${topScore}/100</strong><span class="kpi__unit">${allEnriched[0] ? escapeHtml(allEnriched[0].location.split('—')[0].trim()) : 'Sin datos'}</span></div>
      <div class="kpi"><span class="kpi__label">Carga Total de Hg</span><strong class="kpi__val mono">${fmtGrams(totalHgG)}</strong><span class="kpi__unit">${allEnriched.length} sitios evaluados</span></div>
      <div class="kpi kpi--gold"><span class="kpi__label">Ganancia Oro en Colas</span><strong class="kpi__val mono">${fmtUsd(totalGoldGain)}</strong><span class="kpi__unit">${totalGoldG.toFixed(0)} g Au recuperables (U-101)</span></div>
      <div class="kpi kpi--ok"><span class="kpi__label">Ahorro Monitoreo AgNPs</span><strong class="kpi__val mono">${fmtUsd(totalSavings)}</strong><span class="kpi__unit">vs. Lab (CV-AAS/ICP-MS)</span></div>
    `;

    const filtered = allEnriched.filter((s) => {
      if (state.priorityFilter === 'critical') return s.priorityTier === 'critical' || s.priorityTier === 'high';
      if (state.priorityFilter === 'water') return s.matrix === 'water';
      if (state.priorityFilter === 'sludge') return s.matrix === 'sludge';
      return true;
    });

    if (filtered.length === 0) {
      dom.priorityList.innerHTML = '<div class="telemetry-empty">No hay sitios registrados para este filtro.</div>';
      return;
    }

    dom.priorityList.innerHTML = filtered
      .map((s, idx) => {
        const methylText = s.methyl > 0 ? `${s.methyl.toFixed(1)} ppb` : '0.0 ppb';
        const matTag = s.matrix === 'sludge' ? 'tag--cap-red' : 'tag--blue';
        const affBtn = s.eligibleForBiorem
          ? `<button type="button" class="btn btn--sm btn--gold" data-affiliate-site="${escapeHtml(s.id)}">
              ${s.isAffiliated ? '✓ Afiliado (Ver Ruta)' : '⚡ Afiliar a Biorremediación'}
             </button>`
          : '';

        return `
          <article class="priority-card priority-card--${s.priorityTier}">
            <div class="priority-card__top">
              <div class="rank-cluster">
                <div class="rank-badge">#${idx + 1}</div>
                <div>
                  <div class="badge-row" style="margin-bottom:4px">
                    <span class="tag ${matTag}">${escapeHtml(s.mat.shortName)}</span>
                    <span class="tag">Riesgo: ${s.riskTierLabel}</span>
                    <span class="tag tag--gold">Oro: ${s.goldTierLabel}</span>
                  </div>
                  <h2 style="font-size:16.5px">${escapeHtml(s.location)}</h2>
                  <span class="small muted">${escapeHtml(formatDateDisplay(s.dateISO))}</span>
                </div>
              </div>

              <div class="priority-score-box">
                <span class="tier-pill tier-pill--${s.priorityTier}">${s.priorityLabel}</span>
                <span class="score-num mono">${s.priorityScore}/100</span>
              </div>
            </div>

            <div class="score-breakdown mono">
              <span><strong>45% Hg Total:</strong> ${s.scoreBreakdown.concPts}/45</span>
              <span><strong>30% CH₃Hg⁺:</strong> ${s.scoreBreakdown.methylPts}/30</span>
              <span><strong>25% Volumen:</strong> ${s.scoreBreakdown.volPts}/25</span>
            </div>

            <div class="priority-metrics">
              <div class="pm-cell"><small>Volumen Estimado</small><strong class="mono">${s.volumeM3.toLocaleString('en-US', { maximumFractionDigits: 1 })} m³</strong></div>
              <div class="pm-cell"><small>Hg²⁺ / CH₃Hg⁺</small><strong class="mono">${s.hg2.toFixed(1)} / ${methylText}</strong></div>
              <div class="pm-cell"><small>Carga Total Hg</small><strong class="mono" style="color:var(--bad)">${fmtGrams(s.hgMassGrams)}</strong></div>
              <div class="pm-cell" style="background:var(--gold-soft);border-color:#DEC687"><small>Oro Recuperable</small><strong class="mono" style="color:var(--value)">${s.recoverableGoldGrams.toFixed(1)} g Au</strong></div>
            </div>

            <div class="value-strip">
              <div class="value-box">
                <small>Ganancia Neta Oro Residual en Colas (Tecnologías Limpias)</small>
                <strong class="mono">${fmtUsd(s.netGoldGainUsd)} <span class="small muted">(Bruto: ${fmtUsd(s.grossGoldUsd)})</span></strong>
              </div>
              <div class="value-box value-box--savings">
                <small>Ahorro Monitoreo AgNPs vs. Laboratorio</small>
                <strong class="mono" style="color:var(--ok)">+${fmtUsd(s.monitoringSavingsUsd)} <span class="small muted">(${s.level2Used ? 'Nivel 1+2' : 'Nivel 1'})</span></strong>
              </div>
            </div>

            ${s.notes ? `<p class="small" style="margin:10px 0 0;color:var(--ink-2)">${escapeHtml(s.notes)}</p>` : ''}

            <div class="priority-card__foot">
              <div class="badge-row">
                <button type="button" class="btn btn--sm" data-open-risk-site="${escapeHtml(s.id)}" data-open-risk-cell="${s.riskCellKey}">Ver en Matrices 3×3</button>
                ${affBtn}
              </div>
              <button type="button" class="btn-link-del" data-delete-id="${escapeHtml(s.id)}">Eliminar sitio</button>
            </div>
          </article>
        `;
      })
      .join('');
  }

  // ---------- Pestaña 4: Afiliación al Programa de Biorremediación ----------

  function loadAffiliations() {
    try {
      const raw = localStorage.getItem(AFFILIATION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) { state.affiliations = parsed; return; }
      }
    } catch (_) {}
    state.affiliations = [];
  }

  function persistAffiliations() {
    try { localStorage.setItem(AFFILIATION_KEY, JSON.stringify(state.affiliations)); } catch (_) {}
  }

  function openAffiliationForSite(siteId) {
    renderAffiliationUI(siteId);
    switchView('biorem');
    dom.affCoopName.focus();
  }

  function renderAffiliationUI(preselectSiteId = null) {
    const sites = state.history.map(enrichSiteRecord);
    const eligible = sites.filter((s) => s.eligibleForBiorem);
    const listToShow = eligible.length > 0 ? eligible : sites;

    dom.affSiteSelect.innerHTML = listToShow
      .map(
        (s) =>
          `<option value="${escapeHtml(s.id)}">${escapeHtml(s.location)} — ${s.volumeM3.toFixed(0)} m³ | Riesgo ${s.riskTierLabel} | Oro neto ${fmtUsd(s.netGoldGainUsd)}</option>`
      )
      .join('');

    if (preselectSiteId && listToShow.some((s) => s.id === preselectSiteId)) {
      dom.affSiteSelect.value = preselectSiteId;
    }

    const active = listToShow.find((s) => s.id === dom.affSiteSelect.value) || listToShow[0];
    if (active) {
      dom.affActiveSiteTag.textContent = `Ganancia Oro Colas: ${fmtUsd(active.netGoldGainUsd)} (${active.recoverableGoldGrams.toFixed(1)} g Au)`;
    }

    dom.affCountBadge.textContent = String(state.affiliations.length);
    dom.affiliatedListWrap.classList.toggle('hidden', state.affiliations.length === 0);

    dom.affiliatedList.innerHTML = state.affiliations
      .map(
        (a) => `
        <div class="affiliated-item">
          <div>
            <strong>${escapeHtml(a.folio)} · ${escapeHtml(a.siteLocation)}</strong>
            <div class="small muted">${escapeHtml(a.coopName)} (${escapeHtml(a.contact)})${a.email ? ` · ${escapeHtml(a.email)}` : ''}</div>
          </div>
          <span class="tag tag--gold">Oro neto: ${fmtUsd(a.netGoldGainUsd)}</span>
        </div>
      `
      )
      .join('');
  }

  function handleAffiliationSubmit(e) {
    e.preventDefault();
    const siteId = dom.affSiteSelect.value;
    const coopName = dom.affCoopName.value.trim();
    const contact = dom.affContact.value.trim();
    const email = dom.affEmail.value.trim();
    if (!coopName || !contact || !email) {
      showToast('Completa cooperativa, teléfono y correo electrónico.');
      return;
    }

    const site = state.history.map(enrichSiteRecord).find((s) => s.id === siteId);
    const folio = `BIO-2026-${String(state.affiliations.length + 1).padStart(3, '0')}`;

    state.affiliations.unshift({
      folio,
      dateISO: new Date().toISOString(),
      siteId: site ? site.id : 'custom',
      siteLocation: site ? site.location : 'Sitio de campo',
      volumeM3: site ? site.volumeM3 : 0,
      netGoldGainUsd: site ? site.netGoldGainUsd : 0,
      coopName,
      contact,
      email,
    });

    persistAffiliations();
    dom.affCoopName.value = '';
    dom.affContact.value = '';
    dom.affEmail.value = '';
    renderAffiliationUI(siteId);
    renderMatricesView();
    renderPrioritiesView();
    showToast(`Pre-afiliación confirmada (${folio}). Revisa la Ruta de Biorremediación abajo.`);
  }

  // ---------- Reto 4.2: Guía Visual 4 Pasos + 5 Fases SBR + PFD + Balance Global ----------

  const FRIENDLY_STEPS = [
    {
      tag: 'Paso 1 de 4 · Recuperación gravimétrica previa',
      title: 'Rescatamos oro fino (5.5 g/t) y colamos arenas gruesas',
      desc: 'Los relaves de amalgamación conservan ~5.5 g/t de oro residual (ref. Youpoungam et al.). El separador gravimétrico U-101 recupera 19.8–22.7% (~21.5%) del oro fino (< 100 μm) para financiar la operación limpia y retira las arenas gruesas.',
      analogy: '<strong>En palabras simples:</strong> Rescatamos el oro perdido en las colas para financiar el programa limpio y limpiar la pulpa antes de que entren las bacterias.',
      pipes: { sand: 'flow', p1to2: 'flow', vapor: 'idle', clean: 'idle' },
      bubbles: false,
    },
    {
      tag: 'Paso 2 de 4 · Escudo natural (97–99% retención)',
      title: 'La piedra pómez + EPS atrapa y amortigua el mercurio',
      desc: 'Dentro del tanque sumergimos cestas de piedra pómez volcánica con biopelícula y exopolisacáridos (EPS), logrando 97–99% de retención global para amortiguar picos tóxicos sin dañar a las bacterias.',
      analogy: '<strong>En palabras simples:</strong> Funciona como una esponja inteligente que captura los picos de mercurio y sirve de refugio seguro para el consorcio bacteriano.',
      pipes: { sand: 'idle', p1to2: 'flow', vapor: 'idle', clean: 'idle' },
      bubbles: false,
    },
    {
      tag: 'Paso 3 de 4 · Limpieza biológica en lodos (80–90%)',
      title: 'Las bacterias expulsan el mercurio hacia el techo cerrado',
      desc: 'Con melaza, urea, DAP y aireación Venturi, el consorcio operón mer (MerB/MerA) rompe el metilmercurio y reduce Hg(II) a vapor Hg(0) bajo cubierta hermética HDPE (eficiencia real en lodos: 80–90%).',
      analogy: '<strong>En palabras simples:</strong> Las bacterias respiran aire y usan agroinsumos económicos para sacar el mercurio del lodo sin añadir químicos tóxicos.',
      pipes: { sand: 'idle', p1to2: 'idle', vapor: 'flow', clean: 'idle' },
      bubbles: true,
    },
    {
      tag: 'Paso 4 de 4 · Estabilización mineral (> 99%)',
      title: 'El azufre agrícola lo vuelve piedra inofensiva (Cinabrio HgS)',
      desc: 'El vapor de Hg(0) atraviesa el lecho de azufre agrícola / carbón impregnado con azufre (T-101), removiendo > 99% del vapor como cinabrio sólido insoluble (HgS) y dejando el agua en semáforo verde (< 5 ppb).',
      analogy: '<strong>En palabras simples:</strong> El mercurio queda encerrado como piedra mineral estable (cinabrio), mientras el agua sale limpia (< 5 ppb).',
      pipes: { sand: 'idle', p1to2: 'idle', vapor: 'flow', clean: 'flow' },
      bubbles: false,
    },
  ];

  let currentFriendlyStep = 0;
  let friendlyTimer = null;

  function setFriendlyStep(idx) {
    currentFriendlyStep = idx;
    const st = FRIENDLY_STEPS[idx];
    document.querySelectorAll('#friendly-steps .step-card').forEach((btn, i) => btn.classList.toggle('is-active', i === idx));
    document.getElementById('f-step-tag').textContent = st.tag;
    document.getElementById('f-step-title').textContent = st.title;
    document.getElementById('f-step-desc').textContent = st.desc;
    document.getElementById('f-step-analogy').innerHTML = st.analogy;

    const setPipe = (id, mode) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.remove('pipe-flow', 'pipe-idle');
      el.classList.add(mode === 'flow' ? 'pipe-flow' : 'pipe-idle');
    };
    setPipe('f-pipe-sand', st.pipes.sand);
    setPipe('f-pipe-1to2', st.pipes.p1to2);
    setPipe('f-pipe-vapor', st.pipes.vapor);
    setPipe('f-pipe-clean', st.pipes.clean);
    document.getElementById('f-bubbles').style.display = st.bubbles ? 'inline' : 'none';
  }

  function stopFriendlyTour() {
    if (friendlyTimer) {
      clearInterval(friendlyTimer);
      friendlyTimer = null;
      document.getElementById('friendly-tour-icon').innerHTML = '&#9654;';
      document.getElementById('friendly-tour-text').textContent = 'Reproducir recorrido automático';
    }
  }

  function setComparatorMode(mode) {
    const rawBtn = document.getElementById('comp-btn-raw');
    const cleanBtn = document.getElementById('comp-btn-clean');
    if (mode === 'clean') {
      rawBtn.classList.remove('is-active');
      cleanBtn.classList.add('is-active');
      document.getElementById('comp-water-val').textContent = '4.88 ppb (Verde < 5 ppb · NB 512 / RMCH)';
      document.getElementById('comp-water-val').style.color = 'var(--ok)';
      document.getElementById('comp-water-bar').style.width = '2%';
      document.getElementById('comp-water-bar').style.background = 'var(--ok)';
      document.getElementById('comp-water-note').textContent = 'Reducción del 99.95% desde 10,000 ppb; apta para recirculación y auditoría NB 512.';
      document.getElementById('comp-safe-val').textContent = '21.5% Oro fino (1.18 g/t) + >99% HgS';
      document.getElementById('comp-safe-val').style.color = 'var(--ok)';
      document.getElementById('comp-safe-bar').style.width = '99%';
      document.getElementById('comp-safe-note').textContent = 'Se rescatan 1.18 g Au/t en U-101 y el mercurio queda inmovilizado como cinabrio insoluble HgS.';
    } else {
      cleanBtn.classList.remove('is-active');
      rawBtn.classList.add('is-active');
      document.getElementById('comp-water-val').textContent = '10,000 ppb (10.0 mg/L · Rojo > 20 ppb)';
      document.getElementById('comp-water-val').style.color = 'var(--bad)';
      document.getElementById('comp-water-bar').style.width = '100%';
      document.getElementById('comp-water-bar').style.background = 'var(--bad)';
      document.getElementById('comp-water-note').textContent = 'Supera en 5,000 veces el límite RMCH Ley 1333 (1–2 ppb) y el umbral crítico de 20 ppb.';
      document.getElementById('comp-safe-val').textContent = '0% oro rescatado · 0% HgS';
      document.getElementById('comp-safe-val').style.color = 'var(--ink-3)';
      document.getElementById('comp-safe-bar').style.width = '0%';
      document.getElementById('comp-safe-note').textContent = 'Sin tratamiento, se pierden 5.5 g/t Au en las colas y el mercurio permanece biodisponible.';
    }
  }

  const SBR_PHASES = [
    {
      badge: 'Fase 1 de 5', title: '1. Alimentación (Llenado Gradual + Amortiguación)',
      desc: 'Ingresa el 80% de pulpa fina (< 0.85 mm) desde U-101 con melaza, urea y DAP (D-101). Las cestas de piedra pómez + EPS adsorben el pico inicial de Hg(II) vía Langmuir evitando inhibición bacteriana.',
      chip1: 'Venturi: Mezcla Suave', chip2: 'Cinética: Adsorción Langmuir',
      waterY: 152, waterH: 224, sludgeY: 350, sludgeH: 26, decY: 148, armY1: 160,
      pipes: { c1: 'flow', c2: 'slow', c3: 'flow', c4: 'flow', c5: 'idle', c6: 'idle', c7: 'idle', c8: 'idle' },
      bubbles: true, focusEq: 'pomez',
    },
    {
      badge: 'Fase 2 de 5', title: '2. Reacción Aeróbica (Enzimas MerB/MerA + Stripping Hg⁰)',
      desc: 'El Venturi inyecta microburbujas a plena potencia. MerB desmetila R-Hg → Hg(II) y MerA reduce Hg(II) → Hg(0) volátil; el aire arrastra el vapor hacia la trampa de azufre T-101 (Hg⁰ + S → HgS).',
      chip1: 'Venturi: ON (Aireación Total)', chip2: 'Reacción: R-Hg → Hg²⁺ → Hg⁰ → HgS',
      waterY: 152, waterH: 224, sludgeY: 354, sludgeH: 22, decY: 148, armY1: 160,
      pipes: { c1: 'idle', c2: 'idle', c3: 'idle', c4: 'idle', c5: 'idle', c6: 'idle', c7: 'flow', c8: 'flow' },
      bubbles: true, focusEq: 'venturi',
    },
    {
      badge: 'Fase 3 de 5', title: '3. Decantación (Sedimentación en Calma Hidráulica)',
      desc: 'Se apaga el circuito Venturi para generar quietud total. Los limos y flóculos biológicos sedimentan formando un manto denso mientras las cestas de piedra pómez permanecen sumergidas.',
      chip1: 'Venturi: OFF (Calma Total)', chip2: 'Operación: Clarificación Física',
      waterY: 152, waterH: 224, sludgeY: 332, sludgeH: 44, decY: 148, armY1: 160,
      pipes: { c1: 'idle', c2: 'idle', c3: 'idle', c4: 'idle', c5: 'idle', c6: 'idle', c7: 'idle', c8: 'idle' },
      bubbles: false, focusEq: 'decantador',
    },
    {
      badge: 'Fase 4 de 5', title: '4. Vaciado (Descarga Selectiva de Sobrenadante)',
      desc: 'El brazo decantador flotante (C6) extrae el 80% superior de agua tratada (< 5 ppb Verde). El 20% inferior conserva las cestas sumergidas y el inóculo bacteriano activo.',
      chip1: 'Venturi: OFF', chip2: 'Salida: Efluente < 5 ppb',
      waterY: 218, waterH: 158, sludgeY: 332, sludgeH: 44, decY: 214, armY1: 226,
      pipes: { c1: 'idle', c2: 'idle', c3: 'idle', c4: 'idle', c5: 'idle', c6: 'flow', c7: 'idle', c8: 'idle' },
      bubbles: false, focusEq: 'decantador',
    },
    {
      badge: 'Fase 5 de 5', title: '5. Reposo (Purga Controlada y Amortiguación entre Lotes)',
      desc: 'Absorbe paradas intermitentes de la planta gravimétrica. Si la biomasa supera 2.5 g/L, purga el exceso de lodos por fondo (C5) y ajusta pH en 7.0 ± 0.5.',
      chip1: 'Venturi: OFF (Stand-by)', chip2: 'Control: Purga X ≤ 2.5 g/L',
      waterY: 218, waterH: 158, sludgeY: 346, sludgeH: 30, decY: 214, armY1: 226,
      pipes: { c1: 'idle', c2: 'idle', c3: 'idle', c4: 'idle', c5: 'slow', c6: 'idle', c7: 'idle', c8: 'idle' },
      bubbles: false, focusEq: 'bacterias',
    },
  ];

  const EQUIPMENT_DATA = {
    separador: {
      tag: 'Pretratamiento + Oro', title: 'Separador Gravimétrico (U-101)',
      subtitle: 'Recuperación de oro fino (< 100 μm) y corte de arenas (< 0.85 mm)',
      what: 'Concentra gravimétricamente el oro fino (< 100 μm) en relaves de amalgamación (ley 5.5 g/t Au, ref. Youpoungam et al.) y separa arenas gruesas con Hg particulado.',
      why: 'Recupera 19.8–22.7% (~21.5%) del oro residual para financiar la biorremediación limpia, protege el Venturi y retira 25% del Hg particulado grueso.',
      eq: 'Au_rec = 5.50 g/t · η_Au  |  Hg_SBR = 0.75 · Hg_crudo',
      params: 'Ley entrada: 5.5 g/t Au | Recuperación Au (< 100 μm): 19.8–22.7% (~1.18 g Au/t) | Hg entrada: 10 mg/L (10,000 ppb).',
    },
    pomez: {
      tag: 'Soporte Híbrido (97–99%)', title: 'Cestas de Piedra Pómez + Biopelícula EPS',
      subtitle: 'Retención global de mercurio 97–99% y amortiguación Langmuir',
      what: 'Grava volcánica tamizada (15–30 mm) en 3 cestas sumergidas. La piedra pómez + biofilm/EPS alcanza retención global de Hg del 97–99%.',
      why: 'Adsorbe picos iniciales de Hg(II) y los libera gradualmente mientras el consorcio mer reduce el mercurio disuelto, evitando lavado de biomasa.',
      eq: 'q_eq(C) = (qmax · K · C) / (1 + K · C)  |  η_ret = 97% – 99%',
      params: 'Isoterma Langmuir: qmax = 4.58 mg Hg/g | K = 0.72 L/mg | Retención global: 97–99%.',
    },
    venturi: {
      tag: 'Hidráulica & Gas', title: 'Sistema de Aireación y Mezcla Venturi',
      subtitle: 'Inyección de microburbujas sin partes móviles sumergidas',
      what: 'Bomba externa con garganta Venturi que inyecta microburbujas de aire en toda la laguna HDPE.',
      why: 'Mantiene ambiente aeróbico (evita metilación anaeróbica) y realiza el stripping continuo de vapor Hg(0) hacia la trampa de azufre.',
      eq: 'r_vol = kLa · [Hg(0)_liq]',
      params: 'Coeficiente volumétrico de transferencia líquido-gas: kLa = 3.0 h⁻¹.',
    },
    bacterias: {
      tag: 'Biotransformación (80–90%)', title: 'Consorcio Bacteriano Operón mer (MerB / MerA)',
      subtitle: 'Eficiencia biológica acotada a 80–90% en matriz de lodos auríferos',
      what: 'Bacterias resistentes alimentadas con melaza, urea y DAP. En lodos pesados operan de forma realista entre 80% y 90% (> 99% en fase líquida pura).',
      why: 'MerB desmetila R-Hg → Hg(II) y MerA reduce Hg(II) → Hg(0) volátil sin reactivos tóxicos, controlando densidad en Reposo (X ≤ 2.5 g/L).',
      eq: 'v_MerA = (Vmax · C) / (Km + C · (1 + C / Kis))  |  η_bio = 80% – 90%',
      params: 'Eficiencia en lodos: 80–90% | Crecimiento Monod (μmax = 0.22 h⁻¹).',
    },
    decantador: {
      tag: 'Clarificación', title: 'Brazo Decantador Flotante (C6)',
      subtitle: 'Extracción selectiva del sobrenadante tratado (80% / ciclo)',
      what: 'Tubería articulada con flotador que extrae únicamente el estrato superior clarificado durante el Vaciado.',
      why: 'Evita arrastre de lodos y mantiene sumergidas las cestas de piedra pómez y el 20% de inóculo activo.',
      eq: 'V_descarga = 0.80 · V_útil  (Objetivo Semáforo Verde: < 5 ppb)',
      params: 'Referencia NB 512 (1 ppb) y Ley 1333 RMCH (1–2 ppb) · Auditoría 5% laboratorio.',
    },
    azufre: {
      tag: 'Captura Gas (> 99%)', title: 'Trampa Pasiva de Azufre / Carbón-S (T-101)',
      subtitle: 'Remoción de Hg(0) > 99% en fase gaseosa: Hg⁰ + S⁰ → HgS',
      what: 'Columna empacada con carbón impregnado con azufre / azufre agrícola que recibe el off-gas bajo la cubierta hermética.',
      why: 'Alcanza remociones de Hg(0) > 99% en fase gaseosa, fijándolo como cinabrio sólido insoluble (HgS).',
      eq: 'Hg(0)_(g) + S⁰_(s) → HgS_(s)  (η_captura > 99%)',
      params: 'Remoción fase gaseosa: > 99% (nominal 99.5%) | Capacidad: qmax_S = 120 mg Hg/g.',
    },
  };

  let currentPhase = 0;
  let sbrTourTimer = null;

  function selectEquipment(eqKey) {
    const d = EQUIPMENT_DATA[eqKey];
    if (!d) return;
    document.getElementById('insp-tag').textContent = d.tag;
    document.getElementById('insp-title').textContent = d.title;
    document.getElementById('insp-subtitle').textContent = d.subtitle;
    document.getElementById('insp-what').textContent = d.what;
    document.getElementById('insp-why').textContent = d.why;
    document.getElementById('insp-eq').textContent = d.eq;
    document.getElementById('insp-params').textContent = d.params;
    document.querySelectorAll('#eq-pills .eq-pill').forEach((p) => p.classList.toggle('is-active', p.dataset.eq === eqKey));
    document.querySelectorAll('.eq-hotspot').forEach((n) => n.classList.toggle('eq-selected', n.dataset.eq === eqKey));
  }

  function setSbrPhase(idx) {
    currentPhase = idx;
    const ph = SBR_PHASES[idx];
    document.querySelectorAll('#sbr-phase-buttons .phase-btn').forEach((b, i) => b.classList.toggle('is-active', i === idx));
    document.getElementById('phase-badge').textContent = ph.badge;
    document.getElementById('phase-title').textContent = ph.title;
    document.getElementById('phase-desc').textContent = ph.desc;
    document.getElementById('phase-chip-1').textContent = ph.chip1;
    document.getElementById('phase-chip-2').textContent = ph.chip2;

    const wRect = document.getElementById('pfd-water-rect'), wLine = document.getElementById('pfd-water-line');
    wRect.setAttribute('y', ph.waterY); wRect.setAttribute('height', ph.waterH);
    wLine.setAttribute('y1', ph.waterY); wLine.setAttribute('y2', ph.waterY);
    const sRect = document.getElementById('pfd-sludge-rect'), sLine = document.getElementById('pfd-sludge-line');
    sRect.setAttribute('y', ph.sludgeY); sRect.setAttribute('height', ph.sludgeH);
    sLine.setAttribute('y1', ph.sludgeY); sLine.setAttribute('y2', ph.sludgeY);
    document.getElementById('pfd-dec-float').setAttribute('y', ph.decY);
    document.getElementById('pfd-dec-arm').setAttribute('y1', ph.armY1);

    Object.entries(ph.pipes).forEach(([k, st]) => {
      const el = document.getElementById(`pfd-${k}`);
      if (!el) return;
      el.classList.remove('pipe-flow', 'pipe-flow-slow', 'pipe-idle');
      el.classList.add(st === 'flow' ? 'pipe-flow' : st === 'slow' ? 'pipe-flow-slow' : 'pipe-idle');
    });
    document.getElementById('pfd-bubbles').style.display = ph.bubbles ? 'inline' : 'none';
    selectEquipment(ph.focusEq);
  }

  function stopSbrTour() {
    if (sbrTourTimer) {
      clearInterval(sbrTourTimer);
      sbrTourTimer = null;
      document.getElementById('sbr-tour-icon').innerHTML = '&#9654;';
      document.getElementById('sbr-tour-label').textContent = 'Simular Ciclo Automático';
    }
  }

  function updateMassBalanceTable() {
    const N = Number(document.getElementById('slider-sbr-cycles').value);
    const etaAu = Number(document.getElementById('slider-au-rec').value) / 100;
    const etaBio = Number(document.getElementById('slider-bio-eff').value) / 100;
    const etaAds = Number(document.getElementById('slider-ads-eff').value) / 100;
    const etaGasS = 0.995;

    const fracFill = 0.8, fracRes = 0.2, veq = 1.0 + (N - 1) * fracFill;
    const auRecGt = GOLD_GRADE_GT * etaAu;
    const hgEntradaTotal = veq * 10.0;
    const hgSalSeparador = 0.25 * hgEntradaTotal;
    const hgSbrNeto = hgEntradaTotal - hgSalSeparador;

    const cycleFactor = N === 1 ? 1.0 : N === 2 ? 0.78 : 0.65;
    const cEffPpb = 7500.0 * (1 - etaBio) * (1 - etaAds) * cycleFactor;
    const cEffMgL = cEffPpb / 1000.0;

    const hgSalEfluente = N * fracFill * cEffMgL;
    const hgRemLiquido = fracRes * cEffMgL;
    const hgDisponSbr = Math.max(hgSbrNeto - hgSalEfluente - hgRemLiquido, 0);
    const h0GasTotal = hgDisponSbr * (etaBio * 0.985);
    const hgRetenidoSbr = hgDisponSbr - h0GasTotal;

    const hgSalPurga = N === 1 ? 0.0 : hgRetenidoSbr * (N === 2 ? 0.06 : 0.11);
    const hgRemBiomasa = (hgRetenidoSbr - hgSalPurga) * 0.12;
    const hgRemPomez = (hgRetenidoSbr - hgSalPurga) * 0.88;
    const hgSalAzufre = etaGasS * h0GasTotal;
    const hgSalChimenea = (1 - etaGasS) * h0GasTotal;

    const rows = [
      { num: 1, name: 'Retenido en Separador U-101 (arenas > 0.85 mm)', phase: 'Sólido', val: hgSalSeparador },
      { num: 2, name: `Descargado en Agua Tratada (${cEffPpb.toFixed(2)} ppb · vaciados 80%)`, phase: 'Líquido', val: hgSalEfluente },
      { num: 3, name: 'Purgado con exceso de lodos (Reposo X ≤ 2.5 g/L)', phase: 'Lodo', val: hgSalPurga },
      { num: 4, name: 'Capturado en Azufre / Carbón-S T-101 (Cinabrio HgS > 99%)', phase: 'Sólido HgS', val: hgSalAzufre },
      { num: 5, name: 'Emisión residual gas en chimenea (< 0.5% traza)', phase: 'Gas', val: hgSalChimenea },
      { num: 6, name: 'Remanente líquido en SBR (20% volumen inóculo)', phase: 'Líquido', val: hgRemLiquido },
      { num: 7, name: 'Retenido en Biomasa activa (pared celular)', phase: 'Biomasa', val: hgRemBiomasa },
      { num: 8, name: `Bioadsorbido en Piedra Pómez + EPS (${(etaAds * 100).toFixed(1)}% ret.)`, phase: 'Soporte', val: hgRemPomez },
    ];
    const sumaTotal = rows.reduce((acc, r) => acc + r.val, 0);

    document.getElementById('lbl-cycles-badge').textContent = `${N} ${N === 1 ? 'Ciclo' : 'Ciclos'} (V_eq = ${veq.toFixed(2)} L/L)`;
    document.getElementById('lbl-au-badge').textContent = `${(etaAu * 100).toFixed(1)}% (${auRecGt.toFixed(2)} g Au/t)`;
    document.getElementById('lbl-bio-badge').textContent = `${(etaBio * 100).toFixed(1)}% en lodos`;
    document.getElementById('lbl-ads-badge').textContent = `${(etaAds * 100).toFixed(1)}% retención`;
    document.getElementById('pfd-c2-au').textContent = `Au rec: ${(etaAu * 100).toFixed(1)}% (${auRecGt.toFixed(2)} g/t)`;

    const kpiSem = document.getElementById('kpi-eff-sem'), kpiVal = document.getElementById('kpi-eff-conc');
    kpiSem.classList.remove('semaforo-pill--ok', 'semaforo-pill--mid', 'semaforo-pill--bad');
    let semLabel = 'Verde';
    if (cEffPpb < 5) {
      kpiSem.classList.add('semaforo-pill--ok'); kpiSem.innerHTML = '<span class="semaforo-dot" style="background:var(--ok)"></span>Verde'; kpiVal.style.color = 'var(--ok)';
    } else if (cEffPpb <= 20) {
      kpiSem.classList.add('semaforo-pill--mid'); kpiSem.innerHTML = '<span class="semaforo-dot" style="background:var(--mid)"></span>Amarillo'; kpiVal.style.color = 'var(--mid)'; semLabel = 'Amarillo';
    } else {
      kpiSem.classList.add('semaforo-pill--bad'); kpiSem.innerHTML = '<span class="semaforo-dot" style="background:var(--bad)"></span>Rojo'; kpiVal.style.color = 'var(--bad)'; semLabel = 'Rojo';
    }
    document.getElementById('pfd-c6-val').textContent = `${cEffPpb.toFixed(2)} ppb (${semLabel})`;

    document.getElementById('kpi-au-pct').textContent = `${(etaAu * 100).toFixed(1)}%`;
    document.getElementById('kpi-au-val').textContent = `${auRecGt.toFixed(2)} g Au/t`;
    const pctHgs = (hgSalAzufre / hgEntradaTotal) * 100;
    document.getElementById('kpi-hgs-pct').textContent = `${pctHgs.toFixed(2)}%`;
    document.getElementById('kpi-hgs-val').textContent = `${hgSalAzufre.toFixed(2)} mg/L`;
    const solidTotal = hgSalSeparador + hgRemPomez + hgSalPurga + hgRemBiomasa;
    document.getElementById('kpi-solid-pct').textContent = `${((solidTotal / hgEntradaTotal) * 100).toFixed(2)}%`;
    document.getElementById('kpi-solid-val').textContent = `${solidTotal.toFixed(2)} mg/L`;
    document.getElementById('kpi-eff-conc').textContent = `${cEffPpb.toFixed(2)} ppb`;
    document.getElementById('kpi-eff-note').textContent = `Desde 10,000 ppb (${(((10000 - cEffPpb) / 10000) * 100).toFixed(2)}% rem.)`;
    document.getElementById('lbl-hg-in-summary').textContent = `Entrada: 10.00 mg/L (10,000 ppb) · V_eq = ${veq.toFixed(2)} L/L (${hgEntradaTotal.toFixed(2)} mg Hg/L eq.)`;

    const cinnabarH = Math.min(28 + (hgSalAzufre / 22) * 85, 130);
    const cRect = document.getElementById('pfd-cinnabar-rect');
    cRect.setAttribute('y', (326 - cinnabarH).toFixed(1));
    cRect.setAttribute('height', cinnabarH.toFixed(1));

    const pctSep = (hgSalSeparador / hgEntradaTotal) * 100;
    const pctPomez = ((hgRemPomez + hgSalPurga + hgRemBiomasa) / hgEntradaTotal) * 100;
    const pctEff = Math.max(100 - pctSep - pctHgs - pctPomez, 0.2);
    document.getElementById('seg-sep').style.width = `${pctSep.toFixed(2)}%`;
    document.getElementById('seg-sep').textContent = `${pctSep.toFixed(1)}% Sep.`;
    document.getElementById('seg-hgs').style.width = `${pctHgs.toFixed(2)}%`;
    document.getElementById('seg-hgs').textContent = `${pctHgs.toFixed(1)}% Cinabrio HgS`;
    document.getElementById('seg-pomez').style.width = `${pctPomez.toFixed(2)}%`;
    document.getElementById('seg-pomez').textContent = pctPomez >= 6 ? `${pctPomez.toFixed(1)}%` : '';
    document.getElementById('seg-eff').style.width = `${pctEff.toFixed(2)}%`;

    document.getElementById('balance-tbody').innerHTML =
      rows
        .map(
          (r) => `
          <tr>
            <td class="mono muted">${r.num}</td>
            <td>${r.name}</td>
            <td><span class="tag">${r.phase}</span></td>
            <td class="num">${r.val.toFixed(4)}</td>
            <td class="num">${((r.val / hgEntradaTotal) * 100).toFixed(2)}%</td>
          </tr>`
        )
        .join('') +
      `<tr class="row-total">
        <td>&Sigma;</td>
        <td>SUMA SALIDAS + INVENTARIO Hg (Entrada: ${hgEntradaTotal.toFixed(4)} mg/L eq. | Error: 0.00e+00)</td>
        <td><span class="tag tag--ok">Balance Hg OK</span></td>
        <td class="num">${sumaTotal.toFixed(4)}</td>
        <td class="num">100.00%</td>
      </tr>
      <tr>
        <td class="mono" style="color:var(--gold);font-weight:700">Au</td>
        <td><strong>Balance Oro Gravimétrico U-101 (&lt; 100 μm):</strong> Ley entrada ${GOLD_GRADE_GT.toFixed(2)} g/t &rarr; Recuperado ${auRecGt.toFixed(2)} g/t (${(etaAu * 100).toFixed(1)}%)</td>
        <td><span class="tag tag--gold">Oro Fino</span></td>
        <td class="num">${auRecGt.toFixed(2)} g/t</td>
        <td class="num">${(etaAu * 100).toFixed(1)}%</td>
      </tr>`;
  }

  // ---------- Gráfico SVG Calibración ----------

  function renderCalibrationChart() {
    const svg = dom.calibrationChart;
    if (!svg) return;
    const w = 360, h = 190, padL = 44, padR = 18, padT = 16, padB = 32;
    const plotW = w - padL - padR, plotH = h - padT - padB;
    const xOf = (ds) => padL + (Math.min(85, Math.max(0, ds)) / 85) * plotW;
    const yOf = (c) => padT + plotH - (Math.min(125, Math.max(0, c)) / 125) * plotH;
    const stdPoints = [{ ds: 0, c: 0 }, { ds: 10, c: 14.2 }, { ds: 20, c: 29.8 }, { ds: 35, c: 49.5 }, { ds: 50, c: 73.1 }, { ds: 70, c: 101.8 }, { ds: 82.8, c: 120.0 }];
    let markup = '';
    [0, 30, 60, 90, 120].forEach((val) => { const y = yOf(val); markup += `<line x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}" stroke="#DCD5C7" stroke-width="1"/><text x="${padL - 7}" y="${y + 3}" text-anchor="end" font-size="9.5" fill="#7C776C" font-family="monospace">${val}</text>`; });
    [0, 20, 40, 60, 80].forEach((val) => { const x = xOf(val); markup += `<line x1="${x}" y1="${padT}" x2="${x}" y2="${padT + plotH}" stroke="#DCD5C7" stroke-width="1"/><text x="${x}" y="${h - 15}" text-anchor="middle" font-size="9.5" fill="#7C776C" font-family="monospace">${val}</text>`; });
    markup += `<line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + plotH}" stroke="#1D1B18" stroke-width="1.4"/><line x1="${padL}" y1="${padT + plotH}" x2="${w - padR}" y2="${padT + plotH}" stroke="#1D1B18" stroke-width="1.4"/>`;
    markup += `<text x="${padL + plotW / 2}" y="${h - 2}" text-anchor="middle" font-size="10" font-weight="700" fill="#4F4B43">ΔS (%) = 87.2 − S_muestra</text>`;
    markup += `<text x="12" y="${padT + plotH / 2}" text-anchor="middle" font-size="10" font-weight="700" fill="#4F4B43" transform="rotate(-90 12 ${padT + plotH / 2})">Extracto (ppb)</text>`;
    markup += `<line x1="${xOf(0)}" y1="${yOf(0)}" x2="${xOf(82.8)}" y2="${yOf(120)}" stroke="#1F4E9C" stroke-width="2" stroke-dasharray="5 3"/>`;
    stdPoints.forEach((p) => { markup += `<circle cx="${xOf(p.ds)}" cy="${yOf(p.c)}" r="2.8" fill="#7C776C" opacity="0.7"/>`; });
    const mA = state.tubes.A.metrics, mC = state.tubes.C.metrics;
    if (mA) { const cx = xOf(mA.deltaS), cy = yOf(mA.extractPpb); markup += `<circle cx="${cx}" cy="${cy}" r="5.5" fill="#B07D14" stroke="#1D1B18" stroke-width="1.5"/><text x="${Math.min(w - 42, cx + 8)}" y="${Math.max(padT + 10, cy - 5)}" font-size="10" font-weight="700" fill="#8A6410">Tubo A</text>`; }
    if (mC) { const cx = xOf(mC.deltaS), cy = yOf(mC.extractPpb); markup += `<circle cx="${cx}" cy="${cy}" r="5.5" fill="#B6490F" stroke="#1D1B18" stroke-width="1.5"/><text x="${Math.min(w - 42, cx + 8)}" y="${Math.min(padT + plotH - 4, cy + 13)}" font-size="10" font-weight="700" fill="#B6490F">Tubo C</text>`; }
    svg.innerHTML = markup;
  }

  // ---------- Escenarios Demo, Reinicio y Persistencia ----------

  function applyZoneValues(lengthM, widthM, depthM, refSize, refName) {
    state.zone.lengthM = lengthM; state.zone.widthM = widthM; state.zone.depthM = depthM;
    if (refSize) state.zone.refSize = refSize;
    if (refName) state.zone.refName = refName;
    dom.zoneLengthNum.value = String(lengthM);
    dom.zoneLengthRange.value = String(Math.min(60, Math.max(1, lengthM)));
    dom.zoneWidthNum.value = String(widthM);
    dom.zoneWidthRange.value = String(Math.min(50, Math.max(1, widthM)));
    dom.zoneDepthManual.value = String(depthM);
    dom.depthButtons.forEach((b) => b.classList.toggle('is-active', Math.abs(Number(b.dataset.depth) - depthM) < 0.01));
    dom.refButtons.forEach((b) => b.classList.toggle('is-active', Math.abs(Number(b.dataset.ref) - state.zone.refSize) < 0.01));
  }

  function loadDemoScenario(key) {
    const demo = DEMO_SCENARIOS[key];
    if (!demo) return;
    switchView('measure');
    state.originMode = 'demo';
    state.matrix = demo.matrix;
    state.level2ManualUnlock = false;
    state.lastSignaledTubeAId = null;
    state.tubes.A = createEmptyTubeState();
    state.tubes.C = createEmptyTubeState();

    applyZoneValues(demo.zone.length, demo.zone.width, demo.zone.depth, demo.zone.refSize, demo.zone.refName);
    state.zone.hasPhoto = true; state.zone.isDemoPhoto = true;
    state.zone.photoCanvas = buildSyntheticZoneCanvas(demo.matrix, state.zone.refName);

    state.tubes.A.id = Date.now();
    state.tubes.A.sourceCanvas = buildSyntheticVialCanvas('A', demo.tubeA);
    state.tubes.A.hasImage = true;
    analyzeTubeCanvas('A', !demo.tubeC);

    if (demo.tubeC) {
      state.tubes.C.id = Date.now() + 1;
      state.tubes.C.sourceCanvas = buildSyntheticVialCanvas('C', demo.tubeC);
      state.tubes.C.hasImage = true;
      analyzeTubeCanvas('C', false);
    } else {
      drawEmptyCanvas('C');
    }

    dom.inputLocation.value = demo.location;
    dom.inputNotes.value = demo.notes;
    state.step = demo.targetStep;
    updateAllUI();
    showToast(`Escenario cargado: ${demo.location}`);
  }

  function resetMeasurementSession() {
    state.originMode = 'real'; state.step = 0; state.level2ManualUnlock = false; state.lastSignaledTubeAId = null;
    state.zone.hasPhoto = false; state.zone.isDemoPhoto = false; state.zone.photoCanvas = null;
    applyZoneValues(8, 5, 0.5, 1.0, 'Vara/Pala 1.0 m');
    state.tubes.A = createEmptyTubeState(); state.tubes.C = createEmptyTubeState();
    dom.cameraZoneInput.value = ''; dom.uploadZoneInput.value = '';
    dom.cameraInputA.value = ''; dom.uploadInputA.value = '';
    dom.cameraInputC.value = ''; dom.uploadInputC.value = '';
    dom.inputLocation.value = ''; dom.inputNotes.value = '';
    drawEmptyCanvas('A'); drawEmptyCanvas('C');
    updateAllUI();
    showToast('Ensayo reiniciado. Comienza en Paso Inicial (Zona y Volumen).');
  }

  function loadHistory() {
    try {
      const rawV2 = localStorage.getItem(STORAGE_KEY);
      if (rawV2) {
        const parsed = JSON.parse(rawV2);
        if (Array.isArray(parsed)) { state.history = parsed; return; }
      }
      const rawV1 = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (rawV1) {
        const old = JSON.parse(rawV1);
        if (Array.isArray(old)) {
          const customOld = old
            .filter((r) => !String(r.id || '').startsWith('demo-bo-'))
            .map((r) => ({ ...r, volumeM3: r.volumeM3 || (r.matrix === 'sludge' ? 280 : 75) }));
          state.history = [...customOld, ...DEFAULT_HISTORY.map((x) => ({ ...x }))];
          persistHistory();
          return;
        }
      }
    } catch (_) {}
    state.history = DEFAULT_HISTORY.map((item) => ({ ...item }));
    persistHistory();
  }

  function persistHistory() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.history)); } catch (_) {}
  }

  function saveActiveMeasurementRecord(customLocation = null) {
    const mA = state.tubes.A.metrics;
    if (!mA) return null;
    const location = (customLocation || dom.inputLocation.value || '').trim() || `Sitio Campo (${MATRICES[state.matrix].shortName})`;
    const z = getZoneMetrics();
    const mC = state.tubes.C.metrics;
    const hg2 = Number(mA.finalPpb.toFixed(1));
    const hgTotal = mC ? Number(mC.finalPpb.toFixed(1)) : null;
    const methylHg = hgTotal !== null ? Number(Math.max(0, hgTotal - hg2).toFixed(1)) : null;
    const evalConc = hgTotal !== null ? Math.max(hgTotal, hg2) : hg2;
    const sem = evaluateSemaphore(state.matrix, evalConc);

    const rec = {
      id: `meas-${Date.now()}`,
      dateISO: new Date().toISOString(),
      location,
      matrix: state.matrix,
      lengthM: Number(z.lengthM.toFixed(1)),
      widthM: Number(z.widthM.toFixed(1)),
      depthM: Number(z.depthM.toFixed(2)),
      areaM2: Number(z.areaM2.toFixed(1)),
      volumeM3: Number(z.volumeM3.toFixed(1)),
      hg2,
      hgTotal,
      methylHg,
      level2Used: hgTotal !== null,
      semaphore: sem.level,
      notes: dom.inputNotes.value.trim(),
    };
    state.history.unshift(rec);
    persistHistory();
    return enrichSiteRecord(rec);
  }

  function handleSaveMeasurement(e) {
    e.preventDefault();
    if (!state.tubes.A.metrics) { showToast('Primero completa el Nivel 1 (Tubo A).'); return; }
    if (!dom.inputLocation.value.trim()) { dom.inputLocation.focus(); showToast('Ingresa la ubicación del sitio.'); return; }
    const enriched = saveActiveMeasurementRecord();
    if (!enriched) return;
    state.selectedRiskCellKey = enriched.riskCellKey;
    state.selectedGoldCellKey = enriched.goldCellKey;
    state.selectedRiskSiteId = enriched.id;
    updateAllUI();
    renderMatricesView();
    renderPrioritiesView();
    renderAffiliationUI();
    showToast(`Sitio guardado — Prioridad ${enriched.priorityScore}/100 | Oro neto ${fmtUsd(enriched.netGoldGainUsd)}.`);
  }

  function deleteSiteById(id) {
    state.history = state.history.filter((item) => item.id !== id);
    if (state.selectedRiskSiteId === id) state.selectedRiskSiteId = state.history[0] ? state.history[0].id : null;
    persistHistory();
    updateAllUI();
    renderMatricesView();
    renderPrioritiesView();
    renderAffiliationUI();
    showToast('Sitio eliminado del registro.');
  }

  function restoreDemoHistory() {
    const existingIds = new Set(state.history.map((r) => r.id));
    let added = 0;
    DEFAULT_HISTORY.forEach((demoRec) => { if (!existingIds.has(demoRec.id)) { state.history.push({ ...demoRec }); added++; } });
    if (added === 0) state.history = DEFAULT_HISTORY.map((r) => ({ ...r }));
    persistHistory();
    updateAllUI();
    renderMatricesView();
    renderPrioritiesView();
    renderAffiliationUI();
    showToast('4 sitios referenciales de Bolivia restaurados.');
  }

  function exportCompleteReportCsv() {
    if (state.history.length === 0) { showToast('No hay sitios para exportar.'); return; }
    const ranked = state.history.map(enrichSiteRecord).sort((a, b) => b.priorityScore - a.priorityScore);
    const headers = [
      'Ranking_Prioridad', 'Indice_Prioridad_0_100', 'Nivel_Prioridad', 'Pts_Hg_45', 'Pts_CH3Hg_30', 'Pts_Volumen_25',
      'Matriz_Riesgo_3x3', 'Matriz_Oportunidad_Oro_3x3', 'Fecha_ISO', 'Ubicacion', 'Matriz', 'Volumen_m3',
      'Toneladas_Solidos_Est', 'Hg2_Inorganico_ppb', 'Hg_Total_ppb', 'CH3Hg_Metilmercurio_ppb',
      'Carga_Total_Hg_gramos', 'Oro_Residual_Recuperable_g_Au', 'Valor_Bruto_Oro_USD',
      'Ganancia_Neta_Oro_Limpia_USD', 'Ahorro_Monitoreo_AgNPs_USD', 'Afiliado_Biorremediacion',
      'Semaforo', 'Accion_Recomendada', 'Observaciones',
    ];
    const semEs = { green: 'VERDE', yellow: 'AMARILLO', red: 'ROJO' };
    const csvEscape = (val) => {
      const s = val === null || val === undefined ? '' : String(val);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = ranked.map((s, idx) =>
      [
        idx + 1, s.priorityScore, s.priorityLabel, s.scoreBreakdown.concPts, s.scoreBreakdown.methylPts, s.scoreBreakdown.volPts,
        s.riskTierLabel, s.goldTierLabel, s.dateISO, s.location, s.mat.shortName, s.volumeM3.toFixed(1),
        s.tailingsTons.toFixed(1), s.hg2.toFixed(1), s.concTotal.toFixed(1), s.methyl.toFixed(1),
        s.hgMassGrams.toFixed(2), s.recoverableGoldGrams.toFixed(2), Math.round(s.grossGoldUsd),
        Math.round(s.netGoldGainUsd), s.monitoringSavingsUsd, s.isAffiliated ? 'SI' : 'NO',
        semEs[s.semaphore] || s.semaphore, s.recommendedAction, s.notes || '',
      ]
        .map(csvEscape)
        .join(',')
    );
    const blob = new Blob(['\uFEFF' + [headers.join(','), ...rows].join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `hgsense_prioritarios_oro_biorremediacion_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Reporte CSV exportado (${ranked.length} sitios).`);
  }

  // ---------- ROI Picker ----------
  function attachCanvasRoiPicker(tubeKey, canvasEl) {
    canvasEl.addEventListener('click', (e) => {
      const tube = state.tubes[tubeKey];
      if (!tube.hasImage) return;
      const rect = canvasEl.getBoundingClientRect();
      tube.roiX = Math.max(0, Math.min(CANVAS_W - ROI_SIZE, Math.round((e.clientX - rect.left) * (CANVAS_W / rect.width) - ROI_SIZE / 2)));
      tube.roiY = Math.max(0, Math.min(CANVAS_H - ROI_SIZE, Math.round((e.clientY - rect.top) * (CANVAS_H / rect.height) - ROI_SIZE / 2)));
      analyzeTubeCanvas(tubeKey, false);
    });
  }
  function recenterRoi(tubeKey) {
    const tube = state.tubes[tubeKey];
    if (!tube.hasImage) return;
    tube.roiX = Math.floor((CANVAS_W - ROI_SIZE) / 2);
    tube.roiY = Math.floor((CANVAS_H - ROI_SIZE) / 2);
    analyzeTubeCanvas(tubeKey, false);
  }

  // ---------- Eventos ----------
  function bindEvents() {
    [dom.navMeasure, dom.navRisks, dom.navPriorities, dom.navBiorem].forEach((el) => {
      el.addEventListener('click', (e) => { e.preventDefault(); switchView(el.dataset.view); });
    });
    [dom.topTabMeasure, dom.topTabRisks, dom.topTabPriorities, dom.topTabBiorem].forEach((el) => {
      el.addEventListener('click', () => switchView(el.dataset.view));
    });

    dom.demoButtons.forEach((btn) => btn.addEventListener('click', () => loadDemoScenario(btn.dataset.demo)));
    dom.btnResetSession.addEventListener('click', resetMeasurementSession);

    dom.stepTab0.addEventListener('click', () => goToStep(0));
    dom.stepTab1.addEventListener('click', () => goToStep(1));
    dom.stepTab2.addEventListener('click', () => goToStep(2));
    dom.stepTab3.addEventListener('click', () => goToStep(3));
    dom.btnSignalGoLevel2.addEventListener('click', () => goToStep(2));

    dom.btnMatrixWater.addEventListener('click', () => { state.matrix = 'water'; updateAllUI(); });
    dom.btnMatrixSludge.addEventListener('click', () => { state.matrix = 'sludge'; updateAllUI(); });

    // Zona y Volumen
    dom.cameraZoneInput.addEventListener('change', (e) => loadZoneImageFile(e.target.files[0]));
    dom.uploadZoneInput.addEventListener('change', (e) => loadZoneImageFile(e.target.files[0]));
    dom.btnLoadDemoZone.addEventListener('click', loadDemoZonePhoto);

    dom.refButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        state.zone.refSize = Number(btn.dataset.ref);
        state.zone.refName = btn.dataset.refName;
        dom.refButtons.forEach((b) => b.classList.toggle('is-active', b === btn));
        updateAllUI();
      });
    });

    dom.zoneLengthRange.addEventListener('input', (e) => { state.zone.lengthM = Number(e.target.value); dom.zoneLengthNum.value = e.target.value; updateAllUI(); });
    dom.zoneLengthNum.addEventListener('input', (e) => { const v = Math.max(0.5, Number(e.target.value) || 0.5); state.zone.lengthM = v; dom.zoneLengthRange.value = String(Math.min(60, Math.max(1, v))); updateAllUI(); });
    dom.zoneWidthRange.addEventListener('input', (e) => { state.zone.widthM = Number(e.target.value); dom.zoneWidthNum.value = e.target.value; updateAllUI(); });
    dom.zoneWidthNum.addEventListener('input', (e) => { const v = Math.max(0.5, Number(e.target.value) || 0.5); state.zone.widthM = v; dom.zoneWidthRange.value = String(Math.min(50, Math.max(1, v))); updateAllUI(); });

    dom.depthButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const d = Number(btn.dataset.depth);
        state.zone.depthM = d;
        dom.zoneDepthManual.value = String(d);
        dom.depthButtons.forEach((b) => b.classList.toggle('is-active', b === btn));
        updateAllUI();
      });
    });
    dom.zoneDepthManual.addEventListener('input', (e) => {
      const d = Math.max(0.05, Number(e.target.value) || 0.1);
      state.zone.depthM = d;
      dom.depthButtons.forEach((b) => b.classList.toggle('is-active', Math.abs(Number(b.dataset.depth) - d) < 0.01));
      updateAllUI();
    });

    dom.btnGoStep1.addEventListener('click', () => goToStep(1));

    // Tubos
    dom.cameraInputA.addEventListener('change', (e) => loadImageFileToTube('A', e.target.files[0]));
    dom.uploadInputA.addEventListener('change', (e) => loadImageFileToTube('A', e.target.files[0]));
    dom.cameraInputC.addEventListener('change', (e) => loadImageFileToTube('C', e.target.files[0]));
    dom.uploadInputC.addEventListener('change', (e) => loadImageFileToTube('C', e.target.files[0]));
    attachCanvasRoiPicker('A', dom.canvasA);
    attachCanvasRoiPicker('C', dom.canvasC);
    dom.centerRoiA.addEventListener('click', () => recenterRoi('A'));
    dom.centerRoiC.addEventListener('click', () => recenterRoi('C'));

    dom.btnBackStep0.addEventListener('click', () => goToStep(0));
    dom.btnUnlockLevel2.addEventListener('click', () => { state.level2ManualUnlock = true; updateAllUI(); goToStep(2); showToast('Nivel 2 (UV-C) desbloqueado.'); });
    dom.btnNextFromLevel1.addEventListener('click', () => goToStep(Number(dom.btnNextFromLevel1.dataset.nextStep || 3)));
    dom.btnBackStep1.addEventListener('click', () => goToStep(1));
    dom.btnGoStep3.addEventListener('click', () => goToStep(3));
    dom.btnBackFromResult.addEventListener('click', () => goToStep(state.tubes.C.metrics ? 2 : 1));
    dom.btnJumpToMatrix.addEventListener('click', () => switchView('risks'));
    dom.btnNewMeasurement.addEventListener('click', resetMeasurementSession);

    // Afiliación directa desde Dictamen Paso 3
    dom.btnAffiliateFromResult.addEventListener('click', () => {
      const enriched = saveActiveMeasurementRecord();
      if (enriched) {
        updateAllUI();
        renderMatricesView();
        renderPrioritiesView();
        openAffiliationForSite(enriched.id);
        showToast('Sitio registrado y cargado en el formulario de Afiliación a Biorremediación.');
      } else {
        switchView('biorem');
      }
    });

    dom.saveForm.addEventListener('submit', handleSaveMeasurement);

    // Conmutador Matrices 3×3 (Riesgo vs Oportunidad Oro)
    dom.btnModeRiskMatrix.addEventListener('click', () => setMatrixMode('risk'));
    dom.btnModeGoldMatrix.addEventListener('click', () => setMatrixMode('gold'));

    const handleMatrixGridClick = (e) => {
      const pin = e.target.closest('[data-pin-site]');
      if (pin) {
        state.selectedRiskSiteId = pin.dataset.pinSite;
        if (pin.dataset.pinKind === 'gold') state.selectedGoldCellKey = pin.dataset.pinCell;
        else state.selectedRiskCellKey = pin.dataset.pinCell;
        renderMatricesView();
        return;
      }
      const cell = e.target.closest('[data-cell-key]');
      if (cell) {
        const key = cell.dataset.cellKey;
        const kind = cell.dataset.cellKind;
        if (kind === 'gold') state.selectedGoldCellKey = key;
        else state.selectedRiskCellKey = key;
        const first = state.history.map(enrichSiteRecord).find((s) => (kind === 'gold' ? s.goldCellKey : s.riskCellKey) === key);
        state.selectedRiskSiteId = first ? first.id : null;
        renderMatricesView();
      }
    };
    dom.riskMatrixGrid.addEventListener('click', handleMatrixGridClick);
    dom.goldMatrixGrid.addEventListener('click', handleMatrixGridClick);

    dom.riskDetailPanel.addEventListener('click', (e) => {
      const affBtn = e.target.closest('[data-affiliate-site]');
      if (affBtn) openAffiliationForSite(affBtn.dataset.affiliateSite);
    });

    // Prioritarios
    dom.priorityFilterButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        state.priorityFilter = btn.dataset.filter;
        dom.priorityFilterButtons.forEach((b) => b.classList.toggle('is-active', b === btn));
        renderPrioritiesView();
      });
    });

    dom.priorityList.addEventListener('click', (e) => {
      const affBtn = e.target.closest('[data-affiliate-site]');
      if (affBtn) { openAffiliationForSite(affBtn.dataset.affiliateSite); return; }
      const openBtn = e.target.closest('[data-open-risk-site]');
      if (openBtn) {
        state.selectedRiskSiteId = openBtn.dataset.openRiskSite;
        state.selectedRiskCellKey = openBtn.dataset.openRiskCell;
        switchView('risks');
        return;
      }
      const delBtn = e.target.closest('[data-delete-id]');
      if (delBtn) deleteSiteById(delBtn.dataset.deleteId);
    });

    dom.btnRestoreDemoHistory.addEventListener('click', restoreDemoHistory);
    dom.btnExportPriorityCsv.addEventListener('click', exportCompleteReportCsv);

    // Biorremediación: sub-tabs, afiliación, 4 pasos, comparador, 5 fases SBR, PFD y balance
    dom.btnBioSubSencilla.addEventListener('click', () => switchBioSubView('sencilla'));
    dom.btnBioSubTecnica.addEventListener('click', () => switchBioSubView('tecnica'));
    dom.btnGoBioTech.addEventListener('click', () => switchBioSubView('tecnica'));
    dom.affSiteSelect.addEventListener('change', () => renderAffiliationUI(dom.affSiteSelect.value));
    dom.affiliationForm.addEventListener('submit', handleAffiliationSubmit);

    document.querySelectorAll('#friendly-steps .step-card').forEach((btn) => {
      btn.addEventListener('click', () => { stopFriendlyTour(); setFriendlyStep(Number(btn.dataset.fstep)); });
    });
    document.getElementById('btn-friendly-tour').addEventListener('click', () => {
      if (friendlyTimer) stopFriendlyTour();
      else {
        document.getElementById('friendly-tour-icon').innerHTML = '&#10074;&#10074;';
        document.getElementById('friendly-tour-text').textContent = 'Pausar recorrido';
        setFriendlyStep((currentFriendlyStep + 1) % FRIENDLY_STEPS.length);
        friendlyTimer = setInterval(() => setFriendlyStep((currentFriendlyStep + 1) % FRIENDLY_STEPS.length), 3800);
      }
    });

    document.getElementById('comp-btn-raw').addEventListener('click', () => setComparatorMode('raw'));
    document.getElementById('comp-btn-clean').addEventListener('click', () => setComparatorMode('clean'));

    document.querySelectorAll('#sbr-phase-buttons .phase-btn').forEach((btn) => {
      btn.addEventListener('click', () => { stopSbrTour(); setSbrPhase(Number(btn.dataset.phase)); });
    });
    document.getElementById('btn-sbr-tour').addEventListener('click', () => {
      if (sbrTourTimer) stopSbrTour();
      else {
        document.getElementById('sbr-tour-icon').innerHTML = '&#10074;&#10074;';
        document.getElementById('sbr-tour-label').textContent = 'Pausar Simulación';
        setSbrPhase((currentPhase + 1) % SBR_PHASES.length);
        sbrTourTimer = setInterval(() => setSbrPhase((currentPhase + 1) % SBR_PHASES.length), 4200);
      }
    });

    document.querySelectorAll('.eq-hotspot, #eq-pills .eq-pill').forEach((el) => {
      el.addEventListener('click', () => selectEquipment(el.dataset.eq));
    });

    ['slider-sbr-cycles', 'slider-au-rec', 'slider-bio-eff', 'slider-ads-eff'].forEach((id) => {
      document.getElementById(id).addEventListener('input', updateMassBalanceTable);
    });
  }

  // ---------- Inicialización ----------
  function init() {
    loadHistory();
    loadAffiliations();
    drawEmptyCanvas('A');
    drawEmptyCanvas('C');
    bindEvents();
    updateAllUI();
    renderMatricesView();
    renderPrioritiesView();
    renderAffiliationUI();
    setFriendlyStep(0);
    setComparatorMode('raw');
    setSbrPhase(0);
    updateMassBalanceTable();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
