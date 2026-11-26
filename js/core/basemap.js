/* ==========================================================================
   Mapas base con respaldo automático.
   OpenStreetMap y CARTO no se usan: cuando la página se abre como archivo
   local o sin clave devuelven una imagen de aviso en vez de un error, así que
   ningún respaldo automático lo detecta. Si un proveedor falla, se pasa al
   siguiente. Una capa puede traer "etiquetas" (nombres de lugares) encima.
   ========================================================================== */
(function () {
  const G4G = (window.G4G = window.G4G || {});
  const KEY = 'g4g.mapabase';

  function crear(map, opts = {}) {
    const capas = G4G.config.mapa.capasBase;
    /* opts.porDefecto: capa que se usa si la persona nunca eligió una (sin guardarla como preferencia). */
    let guardado = null;
    try { guardado = localStorage.getItem(KEY); } catch (e) { /* sin persistencia */ }
    let idx = guardado !== null ? Number(guardado) : (opts.porDefecto || 0);
    if (!capas[idx]) idx = 0;
    let layer = null, rotulos = null, errores = 0, cargas = 0;
    const probados = new Set();

    function usar(i, manual) {
      if (layer) map.removeLayer(layer);
      if (rotulos) { map.removeLayer(rotulos); rotulos = null; }
      idx = i; errores = 0; cargas = 0;
      if (manual) { probados.clear(); try { localStorage.setItem(KEY, String(i)); } catch (e) { /* sin persistencia */ } }
      probados.add(i);
      const c = capas[i];
      layer = L.tileLayer(c.url, { maxZoom: c.maxZoom || 18, attribution: c.atribucion, subdomains: c.subdominios || 'abc', crossOrigin: false });
      layer.on('tileload', () => { cargas++; if (opts.onEstado) opts.onEstado(true, c); });
      layer.on('tileerror', () => {
        errores++;
        if (errores > 4 && cargas === 0) {
          const sig = capas.findIndex((_, j) => !probados.has(j));
          if (sig >= 0) usar(sig, false);
          else if (opts.onEstado) opts.onEstado(false, c);
        }
      });
      layer.addTo(map); layer.bringToBack();
      if (c.etiquetas) rotulos = L.tileLayer(c.etiquetas, { maxZoom: c.maxZoom || 18, pane: 'overlayPane', opacity: 0.9 }).addTo(map);
      if (opts.onCambio) opts.onCambio(i, c);
    }
    usar(idx, false);
    return { usar: (i) => usar(i, true), get indice() { return idx; }, capas };
  }

  G4G.basemap = { crear };
})();
