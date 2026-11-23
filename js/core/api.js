/* ==========================================================================
   Cliente del backend (Google Apps Script). Ver backend/Codigo.gs.
   Se envía como text/plain para evitar la verificación previa (CORS) que
   Apps Script no responde. Toda respuesta trae { ok, ... } o { ok:false, error, codigo }.
   ========================================================================== */
(function () {
  const G4G = (window.G4G = window.G4G || {});
  const url = () => ((G4G.config.backend || {}).url || '').trim();
  const activo = () => !!url();

  async function llamar(accion, datos = {}, espera = 30000) {
    if (!activo()) throw new Error('No hay backend configurado.');
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), espera);
    try {
      const res = await fetch(url(), {
        method: 'POST', redirect: 'follow', cache: 'no-store', signal: ctrl.signal,
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(Object.assign({ accion }, datos))
      });
      if (!res.ok) throw new Error('El servidor respondió con error (HTTP ' + res.status + ').');
      const j = await res.json();
      if (!j.ok) { const e = new Error(j.error || 'Error del servidor.'); e.codigo = j.codigo; throw e; }
      return j;
    } catch (e) {
      if (e.name === 'AbortError') throw new Error('El servidor no respondió a tiempo. Revise su conexión.');
      if (e instanceof TypeError) throw new Error('Sin conexión con el servidor.');
      throw e;
    } finally { clearTimeout(t); }
  }

  G4G.api = {
    activo, llamar,
    publico: () => llamar('publico'),
    login: (usuario, clave) => llamar('login', { usuario, clave }),
    salir: (token) => llamar('salir', { token }, 8000),
    completo: (token) => llamar('completo', { token }),
    guardar: (token, tabla, registro) => llamar('guardar', { token, tabla, registro }),
    denuncia: (denuncia) => llamar('denuncia', { denuncia }, 60000),
    denuncias: (token) => llamar('denuncias', { token }),
    estadoDenuncia: (token, id, estado, nota) => llamar('estadoDenuncia', { token, id, estado, nota }),
    foto: (token, id) => llamar('foto', { token, id }, 45000)
  };
})();
