/* ==========================================================================
   Acceso de funcionarios del municipio.
   - Público (sin cuenta): consulta, mapa y denuncias. No ve los "No legal".
   - Funcionario (con cuenta): ve toda la base, registra datos y atiende denuncias.
   La sesión vive en sessionStorage: se cierra al cerrar la pestaña.
   Con backend, la clave se verifica en el servidor y los datos confidenciales
   solo llegan después de ingresar. Sin backend es una DEMOSTRACIÓN: la cuenta
   de prueba está en config.js y no protege nada.
   ========================================================================== */
(function () {
  const G4G = (window.G4G = window.G4G || {});
  const K = 'g4g.sesion.v1';
  let sesion = null;

  try { sesion = JSON.parse(sessionStorage.getItem(K) || 'null'); } catch (e) { sesion = null; }
  if (sesion && (!sesion.exp || sesion.exp < Date.now())) { sesion = null; try { sessionStorage.removeItem(K); } catch (e) { /* nada */ } }
  /* Una sesión de demostración no vale si luego se configuró un backend (y viceversa). */
  if (sesion && !!sesion.usuario.demo === G4G.api.activo()) sesion = null;

  const guardar = () => { try { if (sesion) sessionStorage.setItem(K, JSON.stringify(sesion)); else sessionStorage.removeItem(K); } catch (e) { /* sin persistencia */ } };
  /* Roles: 'funcionario' (autoridad: ve y gestiona todo), 'tecnico' (app de campo: registra muestras y fichas),
     'operador' (cooperativa o empresa: ve y gestiona SU estado). Sin sesión es público. */
  const rol = () => (sesion && sesion.usuario && sesion.usuario.rol) || 'publico';
  const esFuncionario = () => rol() === 'funcionario';
  const esTecnico = () => rol() === 'tecnico';
  const esOperador = () => rol() === 'operador';
  const esCampo = () => esFuncionario() || esTecnico();   // quienes pueden registrar datos de campo

  async function ingresar(usuario, clave) {
    usuario = String(usuario || '').trim();
    if (!usuario || !clave) throw new Error('Escribe tu usuario y tu clave.');
    if (G4G.api.activo()) {
      const r = await G4G.api.login(usuario, clave);
      sesion = { token: r.token, usuario: r.usuario, exp: Date.now() + (r.expiraEnS || 21600) * 1000 };
    } else {
      const d = G4G.config.acceso.demo;
      if (!d || usuario.toLowerCase() !== String(d.usuario).toLowerCase() || clave !== d.clave) throw new Error('Usuario o clave incorrectos.');
      sesion = { token: 'demo', exp: Date.now() + 8 * 3600e3, usuario: { usuario: d.usuario, nombre: 'Funcionario municipal', municipio: 'Demostración', rol: 'funcionario', demo: true } };
    }
    guardar();
    try { await G4G.store.alCambiarSesion(); }
    catch (e) { sesion = null; guardar(); await G4G.store.alCambiarSesion().catch(() => {}); throw e; }
    G4G.bus.emit('auth:changed');
  }

  async function salir(motivo) {
    const t = sesion && sesion.token;
    sesion = null; guardar();
    if (t && t !== 'demo' && G4G.api.activo()) G4G.api.salir(t).catch(() => {});
    await G4G.store.alCambiarSesion().catch(() => {});
    G4G.bus.emit('auth:changed', motivo);
  }

  /* El servidor avisó que la sesión ya no vale. */
  function vencida() { if (sesion) { salir('vencida'); G4G.ui && G4G.ui.toast('Tu sesión venció. Vuelve a ingresar.', 'warn'); } }

  G4G.auth = {
    rol, esFuncionario, esTecnico, esOperador, esCampo, ingresar, salir, vencida,
    operadorId: () => (sesion && sesion.usuario && sesion.usuario.operador_id) || '',
    usuario: () => (sesion ? sesion.usuario : null),
    token: () => (sesion ? sesion.token : null),
    esDemo: () => !!(sesion && sesion.usuario.demo)
  };
})();
