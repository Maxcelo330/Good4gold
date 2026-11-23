/* ==========================================================================
   DATOS SIMULADOS de demostración. Nombres y estados legales son INVENTADOS:
   ninguna fila representa a una cooperativa real. Las coordenadas caen en
   zonas mineras de Bolivia solo para que el mapa tenga sentido.
   Se reemplazan al cargar el Excel real desde el módulo "Datos".
   ========================================================================== */
(function () {
  const G4G = (window.G4G = window.G4G || {});

  function rng(seed) {
    let a = seed >>> 0;
    return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  const ZONAS = [
    { depto: 'La Paz',     n: 26, lat: -15.55, lng: -67.75, s: 0.38, mun: ['Guanay', 'Tipuani', 'Teoponte', 'Mapiri'] },
    { depto: 'Beni',       n: 10, lat: -14.20, lng: -67.30, s: 0.40, mun: ['Rurrenabaque', 'Reyes', 'San Borja'] },
    { depto: 'Oruro',      n: 8,  lat: -18.35, lng: -66.95, s: 0.35, mun: ['Poopó', 'Machacamarca', 'Antequera'] },
    { depto: 'Potosí',     n: 8,  lat: -19.60, lng: -65.80, s: 0.40, mun: ['Llallagua', 'Porco', 'Colquechaca'] },
    { depto: 'Santa Cruz', n: 6,  lat: -16.30, lng: -61.80, s: 0.45, mun: ['San Ignacio', 'San Ramón', 'Concepción'] },
    { depto: 'Pando',      n: 6,  lat: -11.10, lng: -68.60, s: 0.40, mun: ['Cobija', 'Porvenir', 'Filadelfia'] }
  ];
  const TIPOS = G4G.config.tiposOperador;
  const REQ = G4G.config.requisitos.map((r) => r.id);

  function generar() {
    const R = rng(20261122);
    const pick = (arr) => arr[Math.floor(R() * arr.length)];
    const between = (a, b) => a + R() * (b - a);
    const logBetween = (a, b) => Math.exp(between(Math.log(a), Math.log(b)));
    const hoy = Date.now();
    const iso = (diasAtras) => new Date(hoy - diasAtras * 86400000).toISOString().slice(0, 10);

    const operadores = [];
    let n = 0;
    ZONAS.forEach((z) => {
      for (let i = 0; i < z.n; i++) {
        n++;
        const x = R();
        const estado = x < 0.45 ? 'legal' : x < 0.70 ? 'proceso' : x < 0.90 ? 'no_legal' : 'sin_dato';
        const tipo = pick(TIPOS);
        const requisitos = {};
        if (estado === 'legal') REQ.forEach((q) => { requisitos[q] = R() > 0.06; });
        else if (estado === 'proceso') { const k = 2 + Math.floor(R() * 3); const tengo = REQ.slice().sort(() => R() - 0.5).slice(0, k); REQ.forEach((q) => { requisitos[q] = tengo.includes(q); }); }
        else if (estado === 'no_legal') REQ.forEach((q) => { requisitos[q] = R() > 0.85; });
        else REQ.forEach((q) => { requisitos[q] = null; });
        const dias = estado === 'sin_dato' ? 400 + Math.floor(R() * 600) : Math.floor(logBetween(5, 700));
        operadores.push({
          id: 'OP-' + String(n).padStart(3, '0'),
          nombre: `${tipo} Demo ${String(n).padStart(3, '0')}`,
          tipo, estado_legal: estado, departamento: z.depto, municipio: pick(z.mun),
          lat: +(z.lat + between(-z.s, z.s)).toFixed(5), lng: +(z.lng + between(-z.s, z.s)).toFixed(5),
          socios: Math.round(logBetween(6, 220)), actualizado: iso(dias), requisitos
        });
      }
    });

    const pasivos = [];
    const sesgo = operadores.filter((o) => o.estado_legal !== 'legal');
    const ESTR = ['estable', 'estable', 'deterioro', 'deterioro', 'critica', 'desconocida'];
    for (let i = 0; i < 34; i++) {
      const op = R() < 0.55 ? pick(sesgo) : pick(operadores);
      const conLey = R() < 0.45;
      pasivos.push({
        id: 'PA-' + String(i + 1).padStart(3, '0'),
        operador_id: R() < 0.1 ? null : op.id,
        nombre: `${pick(G4G.config.tiposPasivo)} Demo ${String(i + 1).padStart(2, '0')}`,
        tipo: pick(G4G.config.tiposPasivo),
        lat: +(op.lat + between(-0.03, 0.03)).toFixed(5), lng: +(op.lng + between(-0.03, 0.03)).toFixed(5),
        volumen_m3: Math.round(logBetween(800, 180000)),
        dist_rio_m: Math.round(logBetween(30, 4000)),
        dist_poblado_m: Math.round(logBetween(200, 9000)),
        estructura: pick(ESTR),
        uso_hg: pick(['si', 'si', 'desconocido', 'no']),
        muestra: conLey,
        ley_au_gt: conLey ? +logBetween(0.6, 6).toFixed(2) : null,
        actualizado: iso(Math.floor(logBetween(10, 800))),
        deteccion: pick(['imagen satelital', 'visita de campo', 'denuncia'])
      });
    }
    return { operadores, pasivos };
  }

  G4G.seed = { generar };
})();
