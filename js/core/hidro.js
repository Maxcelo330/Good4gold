/* ==========================================================================
   Hidrografía: ríos, quebradas y canales.
   Tres capas de datos, de más a menos disponible:
   1. Principales: incluidos en el proyecto (js/data/rios.js). Sin conexión.
   2. Zona precargada: detalle fino del norte de La Paz (js/data/hidro-zona.js). Sin conexión.
   3. En vivo: OpenStreetMap (API Overpass) para cualquier otra zona al acercar el mapa.
        zoom 11-12: ríos y canales   |   zoom 13 o más: + quebradas, drenajes y zanjas
      Los servidores públicos de Overpass son lentos y a veces rechazan pedidos (probado:
      20 a 60 s por consulta), por eso se consultan varios en paralelo y se espera hasta 80 s.
   Lo cargado se guarda en memoria para no repetir pedidos.
   ========================================================================== */
(function () {
  const G4G = (window.G4G = window.G4G || {});
  const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
  const ZOOM_MIN = 11, ZOOM_QUEBRADAS = 13, MAX_VIAS = 6000, ESPERA_MS = 80000;
  const TIPO = { r: 'river', s: 'stream', c: 'canal', d: 'ditch' };
  const vias = new Map();            // id -> { id, tipo, nombre, pts: [[lat,lng]...] }
  const cubierto = [];               // { bbox, nivel } ya cargados
  let enCurso = false;

  const dentro = (b, c) => b.s >= c.s && b.n <= c.n && b.w >= c.w && b.e <= c.e;

  /* Zona precargada: se registra como ya cubierta (nivel 2 = incluye quebradas). */
  (function precargar() {
    const z = G4G.hidroZona;
    if (!z) return;
    z.vias.forEach((v, i) => vias.set('z' + i, { id: 'z' + i, tipo: TIPO[v.t] || 'stream', nombre: v.n || null, pts: v.p }));
    cubierto.push({ bbox: { s: z.bbox[0], w: z.bbox[1], n: z.bbox[2], e: z.bbox[3] }, nivel: 2, fija: true });
  })();

  /* Distancia de un punto a una polilínea, en km (proyección local, suficiente a <100 km). */
  function distKm(lat, lng, pts) {
    const k = Math.cos((lat * Math.PI) / 180), R = 111.32;
    let mejor = Infinity;
    for (let i = 1; i < pts.length; i++) {
      const ax = (pts[i - 1][1] - lng) * k * R, ay = (pts[i - 1][0] - lat) * R;
      const bx = (pts[i][1] - lng) * k * R, by = (pts[i][0] - lat) * R;
      const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
      let t = L2 ? -(ax * dx + ay * dy) / L2 : 0; t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(ax + t * dx, ay + t * dy);
      if (d < mejor) mejor = d;
    }
    return mejor;
  }

  /* Curso de agua más cercano: usa el detalle si hay uno a menos de 5 km; si no, los principales.
     El detalle solo es confiable donde está cargado (zona precargada o vista ya consultada). */
  function masCercano(lat, lng) {
    let det = null;
    const hayDetalle = cubierto.some((c) => lat >= c.bbox.s && lat <= c.bbox.n && lng >= c.bbox.w && lng <= c.bbox.e);
    if (hayDetalle) vias.forEach((v) => { const d = distKm(lat, lng, v.pts); if (!det || d < det.km) det = { km: d, nombre: v.nombre, tipo: v.tipo, fuente: 'detalle' }; });
    let pri = null;
    (G4G.riosPrincipales || []).forEach((r) => r.l.forEach((l) => {
      const pts = l.map((c) => [c[1], c[0]]); const d = distKm(lat, lng, pts);
      if (!pri || d < pri.km) pri = { km: d, nombre: r.n, tipo: 'river', fuente: 'principal' };
    }));
    return det && (!pri || det.km <= pri.km) ? det : pri;
  }

  const consulta = (b, nivel) => {
    const tipos = nivel === 2 ? 'river|stream|canal|drain|ditch' : 'river|canal';
    return `[out:json][timeout:70];way["waterway"~"^(${tipos})$"](${b.s.toFixed(4)},${b.w.toFixed(4)},${b.n.toFixed(4)},${b.e.toFixed(4)});out geom qt;`;
  };

  /* Pide a todos los servidores a la vez y usa la primera respuesta válida. */
  function pedir(b, nivel) {
    const ctrls = ENDPOINTS.map(() => new AbortController());
    const corte = setTimeout(() => ctrls.forEach((c) => c.abort()), ESPERA_MS);
    const intentos = ENDPOINTS.map((url, i) => fetch(url, { method: 'POST', body: new URLSearchParams({ data: consulta(b, nivel) }), signal: ctrls[i].signal })
      .then(async (res) => {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const j = await res.json();
        if (j.remark && /timed out|runtime error|too many/i.test(j.remark) && !(j.elements || []).length) throw new Error('servidor saturado');
        return j.elements || [];
      }));
    return Promise.any(intentos).then((r) => { ctrls.forEach((c) => c.abort()); return r; })
      .catch((e) => { throw new Error(e.errors ? e.errors.map((x) => x.message).join(' · ') : e.message); })
      .finally(() => clearTimeout(corte));
  }

  /* Carga el detalle de la vista actual. Devuelve { estado, nuevas } */
  async function cargarDetalle(map) {
    const z = map.getZoom();
    if (z < ZOOM_MIN) return { estado: 'lejos' };
    const nivel = z >= ZOOM_QUEBRADAS ? 2 : 1;
    const g = map.getBounds().pad(0.1);
    const b = { s: g.getSouth(), w: g.getWest(), n: g.getNorth(), e: g.getEast() };
    if (cubierto.some((c) => c.nivel >= nivel && dentro(b, c.bbox))) return { estado: 'ok', nuevas: 0 };
    if (enCurso) return { estado: 'ocupado' };
    enCurso = true;
    try {
      const els = await pedir(b, nivel);
      if (vias.size > MAX_VIAS) { for (const k of [...vias.keys()]) if (!String(k).startsWith('z')) vias.delete(k); for (let i = cubierto.length - 1; i >= 0; i--) if (!cubierto[i].fija) cubierto.splice(i, 1); }
      let nuevas = 0;
      els.forEach((e) => {
        if (e.type !== 'way' || !e.geometry || vias.has(e.id)) return;
        vias.set(e.id, { id: e.id, tipo: e.tags.waterway, nombre: e.tags.name || null, pts: e.geometry.map((p) => [p.lat, p.lon]) });
        nuevas++;
      });
      cubierto.push({ bbox: b, nivel });
      return { estado: 'ok', nuevas };
    } catch (e) {
      return { estado: 'error', mensaje: e.message };
    } finally { enCurso = false; }
  }

  /* ¿Ya está cargado el nivel de detalle indicado para esta vista? (1 = ríos y canales, 2 = + quebradas) */
  function cubre(map, nivel) {
    const g = map.getBounds().pad(0.1);
    const b = { s: g.getSouth(), w: g.getWest(), n: g.getNorth(), e: g.getEast() };
    return cubierto.some((c) => c.nivel >= nivel && dentro(b, c.bbox));
  }

  G4G.hidro = { vias, cargarDetalle, masCercano, cubre, ZOOM_MIN, ZOOM_QUEBRADAS, distKm };
})();
