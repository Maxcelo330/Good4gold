/* Módulo: Ingresar. Un solo ingreso para tres perfiles:
   cooperativas y empresas (Mi estado), autoridades (panel completo) y técnicos de campo (app Aurum80 Campo).
   La ciudadanía no necesita cuenta. Tras ingresar, app.js lleva a cada perfil a su pantalla. */
(function () {
  const G4G = (window.G4G = window.G4G || {});
  const U = G4G.util, { el } = U;
  const ui = () => G4G.ui;

  const ROLES = {
    operador: 'Cooperativa o empresa',
    funcionario: 'Autoridad',
    tecnico: 'Técnico de campo'
  };

  function perfil(icono, titulo, texto, extra) {
    return el('li', { class: 'p2-perfil' },
      el('span', { class: 'p2-perfil__icon', 'aria-hidden': 'true' }, ui().icon(icono, 24)),
      el('strong', null, titulo), el('span', null, texto, extra || null));
  }

  function formulario(root) {
    const usuario = el('input', { class: 'input', name: 'usuario', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false', required: true });
    const clave = el('input', { class: 'input', name: 'clave', type: 'password', autocomplete: 'current-password', required: true });
    const ver = el('input', { type: 'checkbox', onchange: (e) => { clave.type = e.target.checked ? 'text' : 'password'; } });
    const error = el('div', { class: 'p2-aviso p2-aviso--error', role: 'alert', hidden: true });
    const boton = el('button', { type: 'submit', class: 'btn btn--primary btn--block' }, ui().icon('candado', 18), el('span', null, 'Ingresar'));
    const form = el('form', { class: 'p2-login__form', novalidate: true, onsubmit: async (e) => {
      e.preventDefault();
      error.hidden = true; boton.disabled = true; boton.lastChild.textContent = 'Verificando…';
      try {
        await G4G.auth.ingresar(usuario.value, clave.value);
        ui().toast('Bienvenido. Ya iniciaste sesión.');
      } catch (err) {
        error.textContent = err.message; error.hidden = false; clave.value = ''; clave.focus();
      } finally { boton.disabled = false; boton.lastChild.textContent = 'Ingresar'; }
    } },
      ui().field('Usuario', usuario), ui().field('Clave', clave),
      el('label', { class: 'check' }, ver, 'Mostrar la clave'),
      error, boton);

    const demo = !G4G.api.activo() ? el('div', { class: 'p2-aviso p2-aviso--demo', style: { marginTop: '12px' } }, ui().icon('info', 20),
      el('span', null, el('strong', null, 'Modo demostración. '), 'Usa el usuario ', el('span', { class: 'mono' }, G4G.config.acceso.demo.usuario), ' y la clave ', el('span', { class: 'mono' }, G4G.config.acceso.demo.clave),
        '. Sin servidor, esta cuenta no protege datos reales.')) : null;

    root.appendChild(el('div', { class: 'p2-login' },
      el('section', { class: 'p2-login__card' },
        el('img', { class: 'il il-login', src: 'img/login.svg', alt: '', width: 190, height: 143, decoding: 'async' }),
        el('div', { class: 'login__kicker' }, 'Cuenta Aurum80'),
        el('h2', null, 'Entra a tu cuenta'),
        el('p', { class: 'p2-lead', style: { marginBottom: 0 } }, 'Una sola entrada para cooperativas, empresas, autoridades y técnicos de campo.'),
        demo, form),
      el('aside', { 'aria-label': 'Quién puede ingresar' },
        el('p', { class: 'p2-sub' }, '¿Para quién es?'),
        el('ul', { class: 'p2-perfiles' },
          perfil('operadores', 'Cooperativas y empresas', 'Mira tu avance y inscríbete a programas.'),
          perfil('resumen', 'Autoridades', 'Panel completo con todas las operaciones y denuncias.'),
          perfil('gps', 'Técnicos de campo', 'Usan la app Aurum80 Campo.', [' ', el('a', { href: 'campo/' }, 'Abrir la app de campo')])),
        el('p', { class: 'p2-login__otro', style: { marginTop: '14px' } }, '¿Solo quieres consultar o denunciar? No necesitas cuenta.'),
        el('div', { class: 'p2-acciones', style: { marginTop: '8px' } },
          el('a', { class: 'btn', href: '#/operadores' }, ui().icon('operadores', 18), 'Consultar'),
          el('a', { class: 'btn', href: '#/denuncias' }, ui().icon('denuncias', 18), 'Denunciar')))));
    setTimeout(() => usuario.focus({ preventScroll: true }), 50);
  }

  function sesion(root) {
    const u = G4G.auth.usuario(), A = G4G.auth, rol = A.rol();
    let mensaje, accion;
    if (rol === 'operador') {
      mensaje = 'Desde Mi estado ves tu avance, tus requisitos y tus inscripciones a programas.';
      accion = el('button', { type: 'button', class: 'btn btn--primary', onclick: () => G4G.app.go('miestado') }, ui().icon('miestado', 18), 'Ir a Mi estado');
    } else if (rol === 'funcionario') {
      mensaje = 'Ves toda la base, registras datos y atiendes denuncias.';
      accion = el('button', { type: 'button', class: 'btn btn--primary', onclick: () => G4G.app.go('resumen') }, ui().icon('resumen', 18), 'Ir al panel');
    } else {
      mensaje = 'Tu cuenta es de técnico de campo. Para registrar muestras y fichas en el terreno usa la app Aurum80 Campo, que se abre aparte y funciona con poca señal.';
      accion = el('a', { class: 'btn btn--primary', href: 'campo/' }, ui().icon('gps', 18), 'Abrir Aurum80 Campo');
    }
    root.appendChild(el('div', { class: 'p2-login p2-login--una' },
      el('section', { class: 'p2-login__card p2-sesion' },
        el('div', { class: 'p2-sesion__quien' },
          el('span', { class: 'p2-perfil__icon', 'aria-hidden': 'true' }, ui().icon('usuario', 24)),
          el('div', null, el('strong', null, u.nombre || u.usuario), el('span', null, ROLES[rol] || 'Sesión iniciada'))),
        el('p', { style: { margin: 0 } }, mensaje),
        ui().dl([['Usuario', el('span', { class: 'mono' }, u.usuario)], u.municipio ? ['Municipio', u.municipio] : null]),
        A.esDemo() ? el('div', { class: 'p2-aviso p2-aviso--demo' }, ui().icon('info', 20), el('span', null, 'Sesión de demostración: los cambios quedan solo en este dispositivo.')) : null,
        el('p', { class: 'muted small', style: { margin: 0 } }, 'La sesión se cierra sola al cerrar esta pestaña o después de unas horas. Si usas un equipo compartido, cierra sesión al terminar.'),
        el('div', { class: 'p2-acciones' }, accion,
          el('button', { type: 'button', class: 'btn', onclick: async () => { await A.salir(); ui().toast('Sesión cerrada.'); } }, ui().icon('salir', 18), 'Cerrar sesión')))));
  }

  function render(root) {
    root.classList.add('p2');
    if (G4G.auth.usuario()) sesion(root); else formulario(root);
  }

  G4G.app.register({ id: 'ingresar', titulo: 'Ingresar', icono: 'usuario', orden: 98, grupo: 'app', oculto: true, subtitulo: 'Cooperativas, empresas, autoridades y técnicos de campo', render });
})();
