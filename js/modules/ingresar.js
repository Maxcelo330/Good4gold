/* Módulo: Ingresar. Acceso para funcionarios del municipio que controlan y
   llenan los datos. La ciudadanía no necesita cuenta. */
(function () {
  const G4G = (window.G4G = window.G4G || {});
  const U = G4G.util, { el } = U;
  const ui = () => G4G.ui;

  function formulario(root) {
    const usuario = el('input', { class: 'input', name: 'usuario', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false', required: true });
    const clave = el('input', { class: 'input', name: 'clave', type: 'password', autocomplete: 'current-password', required: true });
    const error = el('div', { class: 'callout callout--warn', role: 'alert', hidden: true });
    const boton = el('button', { type: 'submit', class: 'btn btn--primary btn--big btn--block' }, ui().icon('candado', 16), 'Ingresar');
    const form = el('form', { class: 'login__form', novalidate: true, onsubmit: async (e) => {
      e.preventDefault();
      error.hidden = true; boton.disabled = true; boton.lastChild.textContent = 'Verificando…';
      try {
        await G4G.auth.ingresar(usuario.value, clave.value);
        ui().toast('Bienvenido. Ahora ve toda la base y las opciones del municipio.');
      } catch (err) {
        error.textContent = err.message; error.hidden = false; clave.value = ''; clave.focus();
      } finally { boton.disabled = false; boton.lastChild.textContent = 'Ingresar'; }
    } }, ui().field('Usuario', usuario), ui().field('Clave', clave), error, boton);

    const demo = !G4G.api.activo() ? el('div', { class: 'callout' },
      el('strong', null, 'Modo demostración. '), 'Use usuario ', el('span', { class: 'mono' }, G4G.config.acceso.demo.usuario), ' y clave ', el('span', { class: 'mono' }, G4G.config.acceso.demo.clave),
      '. Sin servidor configurado, esta cuenta no protege datos reales.') : null;

    root.appendChild(el('div', { class: 'login' },
      el('section', { class: 'card login__card' }, el('div', { class: 'card__body' },
        el('div', { class: 'login__kicker' }, 'Acceso del municipio'),
        el('h2', { class: 'login__title' }, 'Ingreso para funcionarios'),
        el('p', { class: 'muted' }, 'Para quienes controlan y llenan los datos del registro minero. Con su cuenta verá también las operaciones que no son de consulta pública, podrá registrar datos y atender denuncias.'),
        demo, form)),
      el('aside', { class: 'login__side' },
        el('h3', null, '¿Solo quiere consultar o denunciar?'),
        el('p', null, 'No necesita cuenta. Puede buscar una operación, ver el mapa y enviar una denuncia con foto y ubicación.'),
        el('div', { class: 'row-gap' },
          ui().button('Consultar', { icon: 'operadores', onclick: () => G4G.app.go('operadores') }),
          ui().button('Denunciar', { icon: 'denuncias', onclick: () => G4G.app.go('denuncias') })))));
    setTimeout(() => usuario.focus(), 50);
  }

  function sesion(root) {
    const u = G4G.auth.usuario();
    root.appendChild(el('div', { class: 'login' },
      ui().card('Sesión iniciada', el('div', null,
        ui().dl([['Nombre', u.nombre], ['Usuario', el('span', { class: 'mono' }, u.usuario)], ['Municipio', u.municipio], ['Perfil', 'Funcionario: ve toda la base, registra datos y atiende denuncias']]),
        G4G.auth.esDemo() ? el('div', { class: 'callout' }, 'Sesión de demostración: los cambios quedan solo en este dispositivo.') : null,
        el('p', { class: 'muted small' }, 'La sesión se cierra sola al cerrar esta pestaña o después de unas horas. Cierre sesión si usa un equipo compartido.'),
        el('div', { class: 'row-gap' },
          ui().button('Ir al panel del municipio', { kind: 'primary', icon: 'resumen', onclick: () => G4G.app.go('resumen') }),
          ui().button('Cerrar sesión', { icon: 'salir', onclick: async () => { await G4G.auth.salir(); ui().toast('Sesión cerrada.'); } }))))));
  }

  function render(root) { if (G4G.auth.esFuncionario()) sesion(root); else formulario(root); }

  G4G.app.register({ id: 'ingresar', titulo: 'Ingresar', icono: 'usuario', orden: 98, grupo: 'app', oculto: true, subtitulo: 'Acceso para funcionarios del municipio', render });
})();
