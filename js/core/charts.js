/* Gráficos ligeros en HTML/SVG. Marcas finas, 2 px de separación entre
   segmentos, etiquetas directas y tooltip en cada marca. */
(function () {
  const G4G = (window.G4G = window.G4G || {});
  const { el, svg } = G4G.util;
  const ui = () => G4G.ui;
  const ESTADOS = () => G4G.config.estados;

  /* Barra 100% apilada: situación legal de todos los operadores. */
  function barraApilada(conteos) {
    const total = Object.values(conteos).reduce((s, n) => s + n, 0) || 1;
    const orden = Object.keys(ESTADOS()).sort((a, b) => ESTADOS()[a].orden - ESTADOS()[b].orden);
    const bar = el('div', { class: 'stackbar', role: 'img', 'aria-label': 'Operadores por situación legal' },
      orden.filter((k) => conteos[k] > 0).map((k) => {
        const e = ESTADOS()[k], p = (conteos[k] / total) * 100;
        return el('div', {
          class: 'stackbar__seg', style: { flexGrow: conteos[k], background: e.color },
          onmousemove: (ev) => ui().tip.show(`${e.label}: ${conteos[k]} (${Math.round(p)}%)`, ev), onmouseleave: () => ui().tip.hide()
        }, p >= 9 ? el('span', null, `${conteos[k]}`) : null);
      }));
    const legend = el('ul', { class: 'legend' }, orden.map((k) => {
      const e = ESTADOS()[k];
      return el('li', null, ui().shapeSvg(e.forma, e.color, 12), el('span', { class: 'legend__name' }, e.label), el('span', { class: 'legend__n' }, `${conteos[k] || 0} · ${Math.round(((conteos[k] || 0) / total) * 100)}%`));
    }));
    return el('div', null, bar, legend);
  }

  /* Barras horizontales apiladas por grupo (departamento). */
  function barrasPorGrupo(grupos) {
    const max = Math.max(1, ...grupos.map((g) => g.total));
    const orden = Object.keys(ESTADOS()).sort((a, b) => ESTADOS()[a].orden - ESTADOS()[b].orden);
    return el('div', { class: 'hbars' }, grupos.map((g) => el('div', { class: 'hbars__row' },
      el('div', { class: 'hbars__label' }, g.label),
      el('div', { class: 'hbars__track' }, el('div', { class: 'hbars__stack', style: { width: (g.total / max) * 100 + '%' } },
        orden.filter((k) => g.conteos[k] > 0).map((k) => el('div', {
          class: 'hbars__seg', style: { flexGrow: g.conteos[k], background: ESTADOS()[k].color },
          onmousemove: (ev) => ui().tip.show(`${g.label} · ${ESTADOS()[k].label}: ${g.conteos[k]}`, ev), onmouseleave: () => ui().tip.hide()
        })))),
      el('div', { class: 'hbars__n' }, g.total))));
  }

  /* Dispersión riesgo (x) × valor (y). Los puntos sin ley van a una franja inferior. */
  function dispersion(pasivos, o = {}) {
    const W = 600, H = 400, m = { l: 46, r: 14, t: 14, b: 44 }, band = 44;
    const pw = W - m.l - m.r, ph = H - m.t - m.b - band - 14;
    const x = (v) => m.l + (v / 100) * pw, y = (v) => m.t + ph - (v / 100) * ph;
    const yBand = m.t + ph + 14 + band / 2;
    const c = G4G.config.puntaje;
    const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'scatter', role: 'img', 'aria-label': 'Pasivos según riesgo y valor recuperable' });
    root.appendChild(svg('rect', { x: x(c.umbralRiesgoAlto), y: y(100), width: x(100) - x(c.umbralRiesgoAlto), height: y(c.umbralValorAlto) - y(100), class: 'scatter__zone' }));
    [0, 25, 50, 75, 100].forEach((t) => {
      root.appendChild(svg('line', { x1: x(0), x2: x(100), y1: y(t), y2: y(t), class: 'scatter__grid' }));
      root.appendChild(svg('text', { x: m.l - 8, y: y(t) + 4, class: 'scatter__tick', 'text-anchor': 'end' }, t));
      root.appendChild(svg('text', { x: x(t), y: m.t + ph + 12, class: 'scatter__tick', 'text-anchor': 'middle' }, t));
    });
    root.appendChild(svg('line', { x1: x(c.umbralRiesgoAlto), x2: x(c.umbralRiesgoAlto), y1: y(100), y2: y(0), class: 'scatter__cut' }));
    root.appendChild(svg('line', { x1: x(0), x2: x(100), y1: y(c.umbralValorAlto), y2: y(c.umbralValorAlto), class: 'scatter__cut' }));
    root.appendChild(svg('text', { x: x(c.umbralRiesgoAlto) + 6, y: y(100) + 14, class: 'scatter__zonelabel' }, 'Prioridad 1'));
    root.appendChild(svg('text', { x: x(100) - 6, y: y(0) - 6, class: 'scatter__zonelabel', 'text-anchor': 'end' }, 'Remediar'));
    root.appendChild(svg('text', { x: x(0) + 6, y: y(100) + 14, class: 'scatter__zonelabel' }, 'Oportunidad'));
    root.appendChild(svg('text', { x: x(0) + 6, y: y(0) - 6, class: 'scatter__zonelabel' }, 'Monitoreo'));
    root.appendChild(svg('text', { x: m.l + pw / 2, y: H - 4, class: 'scatter__axis', 'text-anchor': 'middle' }, 'Riesgo (0–100)'));
    root.appendChild(svg('text', { x: 12, y: m.t + ph / 2, class: 'scatter__axis', 'text-anchor': 'middle', transform: `rotate(-90 12 ${m.t + ph / 2})` }, 'Valor recuperable (índice)'));
    root.appendChild(svg('rect', { x: m.l, y: yBand - band / 2, width: pw, height: band, class: 'scatter__band' }));
    root.appendChild(svg('text', { x: m.l + 8, y: yBand - band / 2 + 13, class: 'scatter__zonelabel' }, 'Sin ley medida: requiere muestreo'));
    const jitter = (id) => { let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 997; return (h / 997 - 0.5) * (band - 22); };
    pasivos.forEach((p) => {
      const cx = x(p.riesgo), cy = p.valor === null ? yBand + 6 + jitter(p.id) : y(p.valor);
      const sel = o.selected === p.id;
      const r = sel ? 8 : 6.5;
      const dot = svg('polygon', {
        points: ui().puntosHexagono(cx, cy, r), class: 'scatter__dot' + (sel ? ' is-selected' : ''), tabindex: 0, role: 'button', 'aria-label': `${p.nombre || p.id}: riesgo ${p.riesgo}, valor ${p.valor === null ? 'sin dato' : p.valor}`,
        onmousemove: (ev) => ui().tip.show(el('div', null, el('strong', null, p.nombre || p.id), el('div', null, `Riesgo ${p.riesgo} · Valor ${p.valor === null ? 'sin dato' : p.valor}`), el('div', { class: 'tip__sub' }, p.clase.label)), ev),
        onmouseleave: () => ui().tip.hide(),
        onclick: () => o.onSelect && o.onSelect(p),
        onkeydown: (e) => { if (e.key === 'Enter' && o.onSelect) o.onSelect(p); }
      });
      root.appendChild(dot);
    });
    return root;
  }

  G4G.charts = { barraApilada, barrasPorGrupo, dispersion };
})();
