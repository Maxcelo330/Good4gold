/* Módulo: Programas. Explica el programa de biorremediación en palabras simples y permite inscribirse.
   Solo afirmaciones generales y sin cifras: los requisitos y fechas oficiales los define la convocatoria.
   Expone G4G.programas.enviar(mensaje), que usa también la pantalla Mi estado. */
(function () {
  const G4G = (window.G4G = window.G4G || {});
  const U = G4G.util, { el } = U;
  const ui = () => G4G.ui;
  const PROGRAMA = 'biorremediacion';

  let ctx = null;   // { zona }: donde se pinta la inscripción

  /* Envía la solicitud. Devuelve true si el servidor la recibió. Maneja errores con aviso. */
  async function enviar(mensaje) {
    const M = G4G.miestado;
    if (!G4G.api.activo()) { ui().toast('Modo demostración: no hay un servidor conectado, por eso no se envió nada.'); return false; }
    if (!G4G.auth.esOperador()) { ui().toast('Para inscribirte, ingresa con la cuenta de tu cooperativa o empresa.', 'warn'); G4G.app.go('ingresar'); return false; }
    try {
      const r = await G4G.api.inscribir(G4G.auth.token(), PROGRAMA, String(mensaje || '').trim().slice(0, 500));
      if (M) M.invalidar();
      ui().toast(r && r.repetida ? 'Ya tenías una solicitud activa. Mira su estado en Mi estado.' : 'Solicitud enviada. Podrás ver su estado en Mi estado.');
      return true;
    } catch (e) {
      ui().toast(M ? M.mensajeDeError(e) : (e.message || 'No se pudo enviar la solicitud.'), 'warn');
      return false;
    }
  }

  function bloque(titulo, ...contenido) {
    return el('section', { class: 'p2-programa__bloque' }, el('h3', { style: { marginBottom: '8px' } }, titulo), ...contenido);
  }

  /* ---------- Zona de inscripción: cambia según quién mira ---------- */
  function cajaInscripcion(titulo, ...hijos) {
    return el('section', { class: 'p2-inscribir p2-ancho', 'aria-label': 'Inscripción' }, el('h3', null, titulo), ...hijos);
  }

  function zonaSinSesion() {
    return cajaInscripcion('¿Quieres inscribirte?',
      el('p', { style: { margin: 0 } }, 'Para enviar tu solicitud, ingresa con la cuenta de tu cooperativa o empresa.'),
      !G4G.api.activo() ? el('div', { class: 'p2-aviso p2-aviso--demo' }, ui().icon('info', 18), el('span', null, 'Estás en modo demostración: no hay un servidor conectado, así que ninguna solicitud se envía de verdad.')) : null,
      el('button', { type: 'button', class: 'btn btn--primary', onclick: () => G4G.app.go('ingresar') }, ui().icon('enviar', 18), 'Quiero inscribirme'));
  }

  function zonaOtroRol() {
    const hay = G4G.app.modulos.some((m) => m.id === 'solicitudes');
    return cajaInscripcion('Inscripciones',
      el('p', { style: { margin: 0 } }, 'Las solicitudes las envían las cooperativas y empresas desde su cuenta. Con tu perfil no necesitas inscribirte.'),
      G4G.auth.esFuncionario() && hay ? el('button', { type: 'button', class: 'btn btn--primary', onclick: () => G4G.app.go('solicitudes') }, ui().icon('solicitudes', 18), 'Ver solicitudes recibidas') : null);
  }

  function zonaOperador(zona) {
    const M = G4G.miestado;
    U.clear(zona);
    zona.appendChild(el('div', { class: 'p2-carga', role: 'status' }, el('p', { class: 'p2-carga__txt' }, 'Revisando si ya tienes una solicitud…'), el('div', { class: 'p2-carga__linea' })));
    M.cargar(false).then((d) => {
      if (!zona.isConnected) return;
      pintarOperador(zona, d);
    }).catch((e) => {
      if (!zona.isConnected) return;
      const m = M.mensajeDeError(e);
      U.clear(zona);
      zona.appendChild(cajaInscripcion('Inscripción',
        el('div', { class: 'p2-aviso p2-aviso--error', role: 'alert' }, ui().icon('alerta', 20), el('span', null, m)),
        el('button', { type: 'button', class: 'btn', onclick: () => zonaOperador(zona) }, ui().icon('actualizar', 18), 'Intentar de nuevo')));
    });
  }

  function pintarOperador(zona, d) {
    const M = G4G.miestado, { actual, activa } = M.inscripcionDe(d.inscripciones, PROGRAMA);
    U.clear(zona);
    if (ctx) ctx.listo = true;
    const partes = [];
    if (actual) {
      partes.push(el('div', { class: 'p2-solicitud' },
        el('div', { class: 'p2-solicitud__fila' }, el('strong', null, 'Tu solicitud:'), M.chipInscripcion(actual.estado)),
        actual.creado ? el('span', { class: 'muted small' }, 'Enviada el ' + U.fmtDate(actual.creado)) : null,
        actual.nota ? el('p', { class: 'small', style: { margin: 0 } }, 'Mensaje de la autoridad: ' + actual.nota) : null,
        actual.estado === 'no_aplica' ? el('p', { class: 'small', style: { margin: 0 } }, 'Por ahora no corresponde, pero puedes enviar una nueva solicitud si tu situación cambia.') : null));
    }
    if (activa) {
      partes.push(el('div', { class: 'p2-aviso p2-aviso--ok' }, ui().icon('info', 18), el('span', null, 'Ya enviaste tu solicitud. No necesitas hacer nada más por ahora.')),
        el('a', { class: 'btn', href: '#/miestado' }, ui().icon('miestado', 18), 'Ir a Mi estado'));
    } else {
      const mensaje = el('textarea', { class: 'input', rows: 3, maxlength: 500, placeholder: 'Por ejemplo: dónde está tu operación o qué te interesa del programa.' });
      const boton = el('button', { type: 'button', class: 'btn btn--primary' }, ui().icon('enviar', 18), el('span', null, 'Quiero inscribirme'));
      boton.addEventListener('click', async () => {
        const txt = boton.lastChild;
        boton.disabled = true; txt.textContent = 'Enviando…';
        const ok = await enviar(mensaje.value);
        if (ok && zona.isConnected) zonaOperador(zona);
        else { boton.disabled = false; txt.textContent = 'Quiero inscribirme'; }
      });
      partes.push(ui().field('Mensaje (opcional)', mensaje, 'No pongas datos personales sensibles.'), boton);
    }
    zona.appendChild(cajaInscripcion(activa ? 'Tu inscripción' : '¿Quieres inscribirte?', ...partes));
  }

  function pintarZona(zona) {
    U.clear(zona);
    if (G4G.auth.esOperador()) { zonaOperador(zona); return; }
    zona.appendChild(G4G.auth.rol() === 'publico' ? zonaSinSesion() : zonaOtroRol());
  }

  /* ---------- "Así funciona": animación ilustrativa del concepto (sin cifras ni resultados) ---------- */
  const ETAPAS = [
    { corto: 'Sitio', equipo: 'El sitio', cx: 64, titulo: 'Reconocer el sitio y tomar muestras',
      texto: 'Antes de hacer nada, un equipo técnico visita el lugar y toma muestras de suelo y de agua. Así se sabe qué hay y qué cuidado necesita tu caso.' },
    { corto: 'Preparar', equipo: 'Unidad de preparación', cx: 197, titulo: 'Preparar el material y retirar lo recuperable',
      texto: 'El material se ordena: se separa lo grueso y se retira lo que se pueda recuperar, por ejemplo partículas finas de oro. Así llega más ordenado al tratamiento.' },
    { corto: 'Tratar', equipo: 'Reactor biológico', cx: 364, titulo: 'Tratamiento biológico controlado',
      texto: 'Microorganismos o plantas ayudan a transformar o retener el contaminante, bajo una cubierta y con control. Es un proceso lento que se ajusta según lo que muestren los análisis.' },
    { corto: 'Controlar', equipo: 'Tanque de control', cx: 540, titulo: 'Monitoreo del agua y del suelo',
      texto: 'Se mide el agua y el suelo antes, durante y después. En el tanque de control se revisa lo tratado para decidir si hay que ajustar algo o repetir pasos.' },
    { corto: 'Cerrar', equipo: 'Cierre del sitio', cx: 656, titulo: 'Cierre y seguimiento',
      texto: 'Cuando los resultados lo permiten, se cierra el trabajo y se sigue vigilando el lugar con revisiones periódicas, para ver que todo se mantenga estable.' }
  ];
  const ETAPA_MS = 6500;
  const NOTA_ANIMACION = 'Esquema ilustrativo del concepto. No es un diseño de planta ni garantiza resultados: cada sitio requiere estudio, muestreo y licencia ambiental.';

  const IC = {
    play: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path d="M7 4.5v15l12-7.5z" fill="currentColor"/></svg>',
    pausa: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><rect x="6" y="4.5" width="4.2" height="15" rx="1" fill="currentColor"/><rect x="13.8" y="4.5" width="4.2" height="15" rx="1" fill="currentColor"/></svg>',
    ant: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    sig: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  /* Piezas repetidas del dibujo */
  const tubo = (d, color, s) => `<g class="an__tubo" data-s="${s}"><path d="${d}" fill="none" stroke="#1D1B18" stroke-width="9" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#EFE9DA" stroke-width="5" stroke-linecap="round"/><path class="an__flujo" d="${d}" stroke="${color}" stroke-width="3"/></g>`;
  const planta = (x, y0, h, dl) => `<g class="an__planta" style="--dl:${dl}s"><path d="M${x} ${y0}V${y0 - h}" stroke="#2E7D4F" stroke-width="2.6" stroke-linecap="round" fill="none"/><path d="M${x} ${y0 - Math.round(h * .55)}c-12 0-17-8-17-14 11 0 17 5 17 14z" fill="#2E7D4F"/><path d="M${x} ${y0 - Math.round(h * .82)}c10 0 15-7 15-12-9 0-15 4-15 12z" fill="#7DBB8E"/></g>`;
  const raiz = (x, y0, dl, color) => `<path class="an__raiz" pathLength="100" style="--dl:${dl}s" d="M${x} ${y0}q-3 8-1 16M${x} ${y0 + 6}q7 4 9 12M${x} ${y0 + 10}q-8 3-10 11" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round"/>`;
  const particula = (x, y, dl, claro) => `<g class="an__pt${claro ? ' an__pt--claro' : ''}" style="--dl:${dl}s"><circle class="an__pt-o" cx="${x}" cy="${y}" r="4.2" fill="#4A3C2B"/><circle class="an__pt-c" cx="${x}" cy="${y}" r="4.2" fill="#EBDDB0" stroke="#B07D14" stroke-width=".9"/></g>`;
  const burbuja = (x, dl) => `<circle class="an__burbuja" cx="${x}" cy="304" r="2.6" fill="#fff" style="--dl:${dl}s"/>`;
  const microbio = (x, y, dl) => `<ellipse class="an__microbio" cx="${x}" cy="${y}" rx="6.5" ry="2.8" fill="#2E7D4F" style="--dl:${dl}s"/>`;
  const insignia = (n, x) => `<g class="an__bad" data-s="${n}"><circle cx="${x}" cy="68" r="14"/><text x="${x}" y="68.5">${n}</text></g>`;
  const ORO_TPL = '<g transform="translate(X Y)"><path class="an__oro" style="--dl:Ds" d="M0-3L3 0 0 3-3 0Z" fill="#D9A431" stroke="#B07D14" stroke-width=".8"/></g>';
  const oro = (x, y, dl) => ORO_TPL.replace('X Y', x + ' ' + y).replace('Ds', dl + 's');

  function escenaSvg() {
    return `<svg class="an__svg" viewBox="0 50 720 350" preserveAspectRatio="xMidYMid slice" role="img" focusable="false" aria-label="Esquema animado del proceso en cinco etapas: sitio con material, unidad de preparación, reactor biológico, tanque de control y cierre con seguimiento.">
<defs>
<linearGradient id="an-cielo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E1EAE4"/><stop offset="1" stop-color="#F3EFE7"/></linearGradient>
<linearGradient id="an-agua" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#D6E9F3"/><stop offset="1" stop-color="#A5CCE0"/></linearGradient>
<clipPath id="an-clip-reactor"><path d="M272 214H384L376 312H280Z"/></clipPath>
<clipPath id="an-clip-control"><rect x="486" y="232" width="80" height="80" rx="5"/></clipPath>
</defs>
<g class="an__cam">
<rect width="720" height="312" fill="url(#an-cielo)"/>
<path d="M0 252L70 192 120 230 190 160 262 238 330 186 402 242 470 172 540 234 610 184 680 238 720 212V312H0Z" fill="#DAD3C1" opacity=".75"/>
<path d="M0 282Q90 238 190 272T380 264 570 270 720 254V312H0Z" fill="#CBC4AD" opacity=".85"/>
<g class="an__nube"><ellipse cx="150" cy="116" rx="34" ry="9" fill="#fff" opacity=".7"/><ellipse cx="172" cy="109" rx="22" ry="8" fill="#fff" opacity=".7"/></g>
<rect y="312" width="720" height="88" fill="#6F5A3C"/>
<rect y="340" width="720" height="34" fill="#9A7F55"/>
<rect y="374" width="720" height="26" fill="#B9AE97"/>
<rect y="378" width="720" height="22" fill="#4B8FB5" opacity=".3"/>
<path class="an__napa" d="M0 386H720" fill="none" stroke="#4B8FB5" stroke-width="3" stroke-dasharray="4 9" stroke-linecap="round" opacity=".8"/>
<path d="M0 313H720" stroke="#2E7D4F" stroke-width="5"/>
<g fill="#3B2F22" opacity=".28"><circle cx="30" cy="330" r="2.6"/><circle cx="130" cy="352" r="3"/><circle cx="210" cy="326" r="2.4"/><circle cx="300" cy="356" r="3"/><circle cx="410" cy="330" r="2.6"/><circle cx="500" cy="352" r="3"/><circle cx="590" cy="328" r="2.4"/><circle cx="680" cy="354" r="3"/><circle cx="70" cy="366" r="2.4"/><circle cx="360" cy="366" r="2.4"/></g>

<g class="an__z an__z1" data-s="1">
<ellipse cx="64" cy="328" rx="58" ry="9" fill="#2B2118" opacity=".4"/>
<circle class="an__anillo" cx="64" cy="272" r="58" fill="none" stroke="#B07D14" stroke-width="2" stroke-dasharray="4 6"/>
<path d="M8 312Q30 246 64 232 98 240 122 312Z" fill="#6B5A45" stroke="#1D1B18" stroke-width="2.2" stroke-linejoin="round"/>
<g fill="#3B2F22"><circle cx="44" cy="290" r="4"/><circle cx="72" cy="274" r="3.4"/><circle cx="90" cy="298" r="4.2"/><circle cx="58" cy="302" r="3"/><circle cx="102" cy="306" r="3"/><circle cx="30" cy="304" r="3"/><circle cx="66" cy="252" r="3"/></g>
<g fill="#8C7A5E"><circle cx="52" cy="268" r="2.6"/><circle cx="82" cy="286" r="2.4"/><circle cx="38" cy="300" r="2"/></g>
<g class="an__sonda"><path d="M64 198V254" stroke="#1D1B18" stroke-width="3.2" stroke-linecap="round"/><path d="M53 198H75" stroke="#1D1B18" stroke-width="5" stroke-linecap="round"/><path d="M64 254l-3-9h6z" fill="#1D1B18"/></g>
<rect x="118" y="282" width="13" height="5" rx="1.5" fill="#1D1B18"/><rect x="119" y="285" width="11" height="26" rx="3" fill="#FCFAF6" stroke="#1D1B18" stroke-width="1.8"/><rect class="an__rel" x="120.5" y="296" width="8" height="13" fill="#6B5A45"/>
<rect x="134" y="282" width="13" height="5" rx="1.5" fill="#1D1B18"/><rect x="135" y="285" width="11" height="26" rx="3" fill="#FCFAF6" stroke="#1D1B18" stroke-width="1.8"/><rect class="an__rel" x="136.5" y="296" width="8" height="13" fill="#4B8FB5"/>
</g>

<g class="an__z an__z2" data-s="2">
<rect x="150" y="200" width="94" height="112" rx="6" fill="#FCFAF6" stroke="#1D1B18" stroke-width="2.2"/>
<path d="M160 208H234L220 232H174Z" fill="#EFE7D6" stroke="#1D1B18" stroke-width="1.6" stroke-linejoin="round"/>
<path d="M160 258L234 276" stroke="#B07D14" stroke-width="3" stroke-dasharray="5 3" fill="none"/>
<g fill="#6B5A45"><circle class="an__grano" cx="178" cy="254" r="3.8"/><circle class="an__grano" style="--dl:.2s" cx="196" cy="259" r="3.4"/><circle class="an__grano" style="--dl:.4s" cx="214" cy="264" r="3.8"/><circle class="an__grano" style="--dl:.1s" cx="188" cy="243" r="3.2"/><circle class="an__grano" style="--dl:.3s" cx="206" cy="246" r="3"/></g>
${oro(186, 280, 0)}${oro(204, 284, .55)}${oro(222, 288, 1.1)}
<rect x="166" y="298" width="62" height="12" rx="2" fill="#F3E7C6" stroke="#B07D14" stroke-width="1.6"/>
<rect class="an__pila" x="168" y="302" width="58" height="7" fill="#D9A431"/>
</g>

<g class="an__z an__z3" data-s="3">
<path d="M272 214Q328 168 384 214Z" fill="#E3EAF6" stroke="#1D1B18" stroke-width="2" stroke-linejoin="round"/>
<path d="M272 214H384L376 312H280Z" fill="#FCFAF6" stroke="#1D1B18" stroke-width="2.2" stroke-linejoin="round"/>
<g clip-path="url(#an-clip-reactor)">
<rect x="270" y="236" width="116" height="76" fill="url(#an-agua)"/>
<rect class="an__turbia" x="270" y="236" width="116" height="76" fill="#8B7A4F"/>
<rect x="270" y="300" width="116" height="12" fill="#5B4A36" opacity=".85"/>
<path d="M270 236H386" stroke="#4B8FB5" stroke-width="2"/>
${particula(291, 260, 0, false)}${particula(309, 282, .4, false)}${particula(330, 253, .9, false)}${particula(347, 276, 1.2, true)}${particula(363, 257, 1.6, true)}${particula(337, 292, 2, true)}
${microbio(302, 270, 0)}${microbio(322, 289, .5)}${microbio(352, 262, 1)}${microbio(368, 284, 1.5)}
<rect x="294" y="306" width="22" height="4" rx="1" fill="#4F4B43"/><rect x="340" y="306" width="22" height="4" rx="1" fill="#4F4B43"/>
${burbuja(300, 0)}${burbuja(309, .8)}${burbuja(346, .4)}${burbuja(355, 1.3)}
</g>
<rect x="392" y="276" width="64" height="36" rx="3" fill="#CBB98F" stroke="#1D1B18" stroke-width="2"/>
<rect x="393" y="284" width="62" height="27" fill="#BFD9E8" opacity=".7"/>
<path d="M393 284H455" stroke="#4B8FB5" stroke-width="1.6"/>
<g fill="#A89870"><circle cx="402" cy="300" r="2.4"/><circle cx="416" cy="305" r="2.4"/><circle cx="430" cy="299" r="2.4"/><circle cx="444" cy="304" r="2.4"/></g>
${raiz(404, 277, .9, '#6B4F18')}${raiz(424, 277, 1.2, '#6B4F18')}${raiz(444, 277, 1.5, '#6B4F18')}
${planta(404, 277, 40, .2)}${planta(424, 277, 48, .45)}${planta(444, 277, 36, .7)}
</g>

<g class="an__z an__z4" data-s="4">
<rect x="486" y="232" width="80" height="80" rx="5" fill="#FCFAF6" stroke="#1D1B18" stroke-width="2.2"/>
<g clip-path="url(#an-clip-control)"><rect x="486" y="254" width="80" height="58" fill="url(#an-agua)"/><path d="M486 254H566" stroke="#4B8FB5" stroke-width="2"/></g>
<ellipse class="an__onda" cx="520" cy="255" rx="7" ry="2" fill="none" stroke="#4B8FB5" stroke-width="1.6"/>
<ellipse class="an__onda" style="--dl:1.3s" cx="520" cy="255" rx="7" ry="2" fill="none" stroke="#4B8FB5" stroke-width="1.6"/>
<g class="an__sonda2"><path d="M520 192V280" stroke="#1D1B18" stroke-width="3" stroke-linecap="round"/><rect x="513" y="184" width="14" height="9" rx="2" fill="#FCFAF6" stroke="#1D1B18" stroke-width="1.8"/><circle cx="520" cy="283" r="4.4" fill="#D9A431" stroke="#1D1B18" stroke-width="1.6"/></g>
<circle cx="548" cy="204" r="18" fill="#FCFAF6" stroke="#1D1B18" stroke-width="2"/>
<path d="M535.5 216.5A17.6 17.6 0 1 1 560.5 216.5" fill="none" stroke="#DCD5C7" stroke-width="3.4" stroke-linecap="round"/>
<path d="M560.5 216.5A17.6 17.6 0 0 0 565 204" fill="none" stroke="#2E7D4F" stroke-width="3.4" stroke-linecap="round"/>
<g class="an__aguja"><path d="M548 204V192" stroke="#1D1B18" stroke-width="2.4" stroke-linecap="round"/></g>
<circle cx="548" cy="204" r="2.6" fill="#1D1B18"/>
<circle class="an__luz" cx="553" cy="245" r="4" fill="#2E7D4F"/>
<rect x="593" y="296" width="10" height="9" rx="2" fill="#FCFAF6" stroke="#1D1B18" stroke-width="1.6"/>
<circle class="an__luz" cx="598" cy="300.5" r="2.2" fill="#2E7D4F"/>
<path d="M598 305V348" stroke="#1D1B18" stroke-width="2.4" stroke-linecap="round"/>
</g>

<g class="an__z an__z5" data-s="5">
<g class="an__rayos"><g stroke="#D9A431" stroke-width="2.4" stroke-linecap="round"><path d="M660 90v6M660 120v6M643 108h6M671 108h6M648 96l4 4M668 116l4 4M672 96l-4 4M652 116l-4 4"/></g></g>
<circle cx="660" cy="108" r="10" fill="#F2D58C" stroke="#B07D14" stroke-width="1.8"/>
<g class="an__ciclo"><circle cx="660" cy="170" r="26" fill="none" stroke="#4B8FB5" stroke-width="2.6" stroke-dasharray="7 7" stroke-linecap="round"/><path d="M655 138l10 5-10 5z" fill="#4B8FB5"/></g>
<path d="M650 170l7 7 13-14" fill="none" stroke="#2E7D4F" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M604 312V262" stroke="#1D1B18" stroke-width="3.2" stroke-linecap="round"/>
<path class="an__banderin" d="M605 262h24l-6 8 6 8h-24z" fill="#D9A431" stroke="#1D1B18" stroke-width="1.6" stroke-linejoin="round"/>
${raiz(634, 313, .9, '#F3E7C6')}${raiz(656, 313, 1.2, '#F3E7C6')}${raiz(678, 313, 1.5, '#F3E7C6')}${raiz(700, 313, 1.8, '#F3E7C6')}
${planta(634, 313, 38, .2)}${planta(656, 313, 46, .45)}${planta(678, 313, 34, .7)}${planta(700, 313, 42, .95)}
</g>

${tubo('M108 262H150', '#4A3C2B', '2')}
${tubo('M244 262H276', '#4A3C2B', '2 3')}
${tubo('M377 290H392', '#4B8FB5', '3')}
${tubo('M456 290H486', '#4B8FB5', '3 4')}
<g class="an__tubo" data-s="3 4"><path class="an__flujo" d="M328 191V150H500V230" stroke="#7C776C" stroke-width="2.6" opacity=".9"/><circle cx="500" cy="231" r="3.4" fill="#7C776C"/></g>
${insignia(1, 64)}${insignia(2, 197)}${insignia(3, 364)}${insignia(4, 540)}${insignia(5, 656)}
</g>
</svg>`;
  }

  function crearAnimacion() {
    const N = ETAPAS.length;
    const rm = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
    let etapa = 0, auto = !rm.matches, congelado = false, visible = true, elapsed = 0, ultimo = 0, raf = 0;

    const vista = el('div', { class: 'an__vista', html: escenaSvg() });
    const cam = vista.querySelector('.an__cam');
    const marcas = Array.from(vista.querySelectorAll('[data-s]')).map((n) => ({ n, e: n.getAttribute('data-s').split(' ').map(Number) }));

    const segs = Array.from({ length: N }, () => el('span', { class: 'an__seg' }, el('i')));
    const prog = el('div', { class: 'an__prog', role: 'progressbar', 'aria-label': 'Progreso del recorrido', 'aria-valuemin': 1, 'aria-valuemax': N }, ...segs);

    const botones = ETAPAS.map((e, i) => el('button', { type: 'button', class: 'btn an__etapa', 'aria-label': `Etapa ${i + 1}: ${e.titulo}`, onclick: () => irA(i, true) },
      el('span', { class: 'an__n', 'aria-hidden': 'true' }, String(i + 1)), el('span', { class: 'an__l' }, e.corto)));
    const grupo = el('div', { class: 'an__etapas', role: 'group', 'aria-label': 'Elegir etapa' }, ...botones);

    const tag = el('p', { class: 'an__tag' });
    const titulo = el('p', { class: 'an__titulo' });
    const desc = el('p', { class: 'an__desc' });
    const texto = el('div', { class: 'an__texto', 'aria-atomic': 'true' }, tag, titulo, desc);

    const play = el('button', { type: 'button', class: 'btn btn--primary an__play', onclick: alternar });
    const ant = el('button', { type: 'button', class: 'btn', 'aria-label': 'Etapa anterior', onclick: () => irA(etapa - 1, true) }, el('span', { html: IC.ant }), el('span', { class: 'an__bt' }, 'Anterior'));
    const sig = el('button', { type: 'button', class: 'btn', 'aria-label': 'Etapa siguiente', onclick: () => irA(etapa + 1, true) }, el('span', { class: 'an__bt' }, 'Siguiente'), el('span', { html: IC.sig }));
    const aviso = el('p', { class: 'an__aviso', hidden: true }, 'Tu dispositivo pide menos movimiento: la animación no corre sola. Avanza con los botones.');
    const ctrl = el('div', { class: 'an__ctrl', role: 'group', 'aria-label': 'Controles de la animación' }, play, ant, sig);

    const raizAn = el('section', { class: 'an p2-ancho', 'aria-labelledby': 'an-titulo' },
      el('div', { class: 'an__cab' },
        el('h3', { id: 'an-titulo' }, 'Así funciona', el('span', { class: 'an__tri', 'aria-hidden': 'true' }, el('i'), el('i'), el('i'))),
        el('p', null, 'Un recorrido en cinco etapas, desde la toma de muestras hasta el seguimiento. Míralo solo o avanza a tu ritmo.')),
      el('div', { class: 'an__cuerpo' },
        el('div', { class: 'an__izq' }, vista, prog, grupo),
        el('div', { class: 'an__der' }, texto, ctrl, aviso,
          el('p', { class: 'an__nota' }, ui().icon('info', 16), el('span', null, NOTA_ANIMACION)))));

    /* En pantallas angostas la escena se recorta; la cámara se centra en la etapa activa. */
    function camara() {
      const w = vista.clientWidth, h = vista.clientHeight;
      if (!w || !h) return;
      const vw = Math.min(720, 350 * (w / h)), lim = (720 - vw) / 2;
      const tx = lim <= 0.5 ? 0 : Math.max(-lim, Math.min(lim, 360 - ETAPAS[etapa].cx));
      cam.style.setProperty('--cam-x', tx.toFixed(1) + 'px');
    }

    function segmentos() {
      const f = auto ? Math.min(1, elapsed / ETAPA_MS) : 1;
      segs.forEach((s, i) => { s.firstChild.style.transform = 'scaleX(' + (i < etapa ? 1 : i === etapa ? f : 0) + ')'; });
    }

    function pintar() {
      const e = ETAPAS[etapa];
      raizAn.classList.toggle('is-frozen', congelado);
      marcas.forEach(({ n, e: lista }) => {
        const act = lista.includes(etapa + 1), hecho = !act && Math.max(...lista) < etapa + 1;
        n.classList.toggle('is-act', act); n.classList.toggle('is-done', hecho);
      });
      botones.forEach((b, i) => { if (i === etapa) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); b.classList.toggle('is-done', i < etapa); });
      texto.setAttribute('aria-live', auto ? 'off' : 'polite');
      tag.textContent = `Etapa ${etapa + 1} de ${N} · ${e.equipo}`;
      titulo.textContent = e.titulo;
      desc.textContent = e.texto;
      prog.setAttribute('aria-valuenow', etapa + 1);
      prog.setAttribute('aria-valuetext', `Etapa ${etapa + 1} de ${N}`);
      play.hidden = rm.matches; aviso.hidden = !rm.matches; ctrl.classList.toggle('is-rm', rm.matches);
      play.innerHTML = (auto ? IC.pausa : IC.play) + '<span>' + (auto ? 'Pausar' : 'Reproducir') + '</span>';
      play.setAttribute('aria-label', auto ? 'Pausar la animación' : 'Reproducir la animación automática');
      segmentos(); camara();
    }

    /* Elegir o pasar de etapa a mano detiene el avance automático; se reproduce esa etapa. */
    function irA(i, manual) {
      etapa = (i + N) % N; elapsed = 0; congelado = false;
      if (manual) auto = false;
      pintar(); bombear();
    }
    function alternar() {
      if (auto) { auto = false; congelado = true; } else { auto = true; congelado = false; elapsed = 0; }
      pintar(); bombear();
    }

    function cuadro(t) {
      raf = 0;
      if (!raizAn.isConnected) return;
      if (!(auto && visible && !rm.matches)) return;
      if (!document.hidden) {
        elapsed += Math.min(100, t - ultimo);
        if (elapsed >= ETAPA_MS) { irA(etapa + 1, false); ultimo = t; raf = requestAnimationFrame(cuadro); return; }
        segmentos();
      }
      ultimo = t; raf = requestAnimationFrame(cuadro);
    }
    function bombear() {
      if (raf || !(auto && visible && !rm.matches)) return;
      ultimo = performance.now(); raf = requestAnimationFrame(cuadro);
    }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver((es) => {
        visible = es[es.length - 1].isIntersecting;
        raizAn.classList.toggle('is-off', !visible);
        bombear();
      }, { threshold: 0.15 }).observe(raizAn);
    }
    if ('ResizeObserver' in window) new ResizeObserver(camara).observe(vista); else window.addEventListener('resize', camara);
    const alCambiarMovimiento = () => { if (rm.matches) { auto = false; congelado = false; } pintar(); bombear(); };
    if (rm.addEventListener) rm.addEventListener('change', alCambiarMovimiento);
    else if (rm.addListener) rm.addListener(alCambiarMovimiento);

    pintar(); bombear();
    return raizAn;
  }

  function render(root) {
    root.classList.add('p2');
    const zona = el('div', { class: 'p2-ancho' });
    ctx = { zona, listo: false };
    let animacion = null;
    try { animacion = crearAnimacion(); } catch (e) { animacion = null; }   // si la animación falla, el resto de la pantalla sigue igual
    root.appendChild(el('div', { class: 'p2-programa' },
      el('div', { class: 'p2-ancho il-intro' },
        el('div', null,
          el('span', { class: 'p2-ref', style: { marginBottom: '10px' } }, ui().icon('info', 13), 'Programa piloto de Aurum80, sujeto a convocatoria'),
          el('h2', { style: { marginBottom: '8px' } }, (G4G.config.programas[PROGRAMA] || {}).label || 'Programa de biorremediación'),
          el('p', { class: 'p2-lead', style: { marginBottom: 0 } }, 'Una forma de ayudar a reducir la contaminación en suelos y aguas afectados por la minería usando la propia naturaleza.')),
        el('img', { class: 'il il-intro__img', src: 'img/biorremediacion.svg', alt: '', width: 210, height: 158, decoding: 'async' })),
      animacion,
      bloque('Qué es',
        el('p', { style: { margin: 0 } }, 'La biorremediación usa seres vivos, como microorganismos y plantas, para ayudar a reducir la contaminación en suelos o aguas. Es un trabajo lento y se hace con acompañamiento técnico.')),
      bloque('A quién le sirve',
        el('p', { style: { margin: 0 } }, 'Está pensado para cooperativas y empresas mineras que tienen residuos, como colas o relaves, y quieren manejarlos mejor y con menos riesgo para su comunidad.')),
      bloque('Qué implica',
        el('ul', null,
          el('li', null, 'Que un equipo técnico conozca tu sitio y tu situación.'),
          el('li', null, 'Que compartas información sobre tu operación.'),
          el('li', null, 'Que tu caso corresponda a lo que pida la convocatoria.'))),
      bloque('Antes de inscribirte',
        el('p', { style: { margin: '0 0 8px' } }, 'Inscribirte envía una solicitud. No garantiza un cupo y no reemplaza ningún permiso ni trámite legal.'),
        el('p', { style: { margin: 0 } }, 'Hoy no existe un programa del Estado de remediación abierto a cooperativas: este es un piloto de Aurum80. Los requisitos y las fechas se publicarán en la convocatoria.')),
      zona));
    pintarZona(zona);
  }

  /* Al volver a la pantalla se vuelve a revisar el estado de la solicitud. */
  function onShow() { if (ctx && ctx.listo && ctx.zona.isConnected && G4G.auth.esOperador()) zonaOperador(ctx.zona); }

  G4G.programas = { enviar };
  G4G.app.register({ id: 'programas', titulo: 'Programas', icono: 'programas', orden: 5, grupo: 'ciudadania', movil: [], subtitulo: 'Programa de biorremediación: qué es y cómo inscribirte', render, onShow });
})();
