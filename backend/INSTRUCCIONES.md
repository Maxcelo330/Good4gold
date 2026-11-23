# Backend del municipio (Google Apps Script): guía de instalación

Tiempo: unos 15 minutos. Costo: 0. Solo se necesita la cuenta de Google dueña de la hoja.

## Qué resuelve

| Sin backend (modo demostración) | Con backend |
|---|---|
| La página oculta los "No legal" **solo en pantalla**: quien sepa abrir el código los ve. | El servidor **no envía** los "No legal" ni sus pasivos a quien no ingresó. |
| La cuenta de prueba (`municipio` / `demo2026`) está escrita en el código. | Cada funcionario tiene su usuario; la clave se guarda cifrada en la hoja. |
| Las denuncias quedan en el celular de quien denuncia. | Las denuncias llegan a la hoja **Denuncias**, con la foto en una carpeta privada de Drive. |
| Registrar datos solo cambia ese dispositivo. | Registrar datos escribe en la hoja, con usuario y fecha (`editado_por`, `editado_en`). |

## Antes de empezar: deje de publicar la hoja

Si la hoja está "Publicada en la Web" (los enlaces CSV que terminan en `output=csv`),
**cualquiera puede descargar toda la base, incluidos los confidenciales**, sin pasar por el backend.

En la hoja: **Archivo → Compartir → Publicar en la Web → Contenido publicado → Dejar de publicar**.

Y en *Compartir* (botón azul), deje el acceso en **Restringido** (solo las personas del equipo).

## Pasos

1. **Abra la hoja de cálculo de Google** con las pestañas `Operadores` y `Pasivos`
   (la versión convertida a hoja de Google, no el `.xlsx`).
2. **Extensiones → Apps Script.** Se abre el editor.
3. Borre lo que haya en `Código.gs`, **pegue todo el contenido de `backend/Codigo.gs`** y guarde (icono de disquete). Póngale nombre al proyecto, por ejemplo *Control Minero*.
4. Arriba, en la lista de funciones, elija **`configurar`** y pulse **Ejecutar**.
   - Google pedirá permisos: *Revisar permisos* → elija su cuenta → *Configuración avanzada* → *Ir a Control Minero (no seguro)* → *Permitir*.
     Aparece "no seguro" porque el script es suyo y no está publicado en el catálogo de Google; es normal.
   - Se crean las pestañas **Denuncias** y **Usuarios** y una carpeta privada en Drive para las fotos.
5. **Cree los usuarios** en la pestaña `Usuarios`, una fila por funcionario:

   | usuario | nombre | municipio | rol | activo | clave_nueva |
   |---|---|---|---|---|---|
   | jperez | Juan Pérez | Mapiri | funcionario | si | *(clave de al menos 8 caracteres)* |

   La fila de ejemplo `municipio` viene **desactivada y sin clave**: actívela (`si`) y póngale clave, o bórrela.
   Al escribir en `clave_nueva`, la clave se cifra sola y la celda se vacía. Si no se vacía, vuelva al editor y ejecute **`procesarClaves`**.
   Para quitar el acceso a alguien: `activo` = `no`.
6. **Implementar → Nueva implementación** → engranaje → **Aplicación web**:
   - Descripción: `v1`
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario**
   - **Implementar** y copie la **URL de la aplicación web** (termina en `/exec`).
7. **Pruebe la URL**: ábrala en el navegador. Debe mostrar `{"ok":true,"servicio":"Registro y Control Minero",...}`.
8. **Conecte la app**: en `js/config/config.js`, pegue la URL:

   ```js
   backend: { url: 'https://script.google.com/macros/s/XXXXXXXX/exec' },
   ```

   Suba el cambio a GitHub. Al abrir la página, el chip de arriba dirá **Base del municipio**.

## Si cambia el código del backend

**Implementar → Gestionar implementaciones** → lápiz → *Versión: Nueva versión* → *Implementar*.
Así la URL no cambia. (Si crea una implementación nueva, la URL cambia y hay que actualizar `config.js`.)

## Qué ve cada perfil

- **Público (sin cuenta):** operadores Legal, En proceso y Sin verificar; pasivos que no son de operadores "No legal" (incluidos los sin responsable). Puede consultar, ver el mapa y denunciar.
- **Funcionario:** toda la base, Resumen, Pasivos, Datos, **Registrar datos** y **Denuncias recibidas**.
  La sesión dura hasta 6 horas y se cierra al cerrar la pestaña.

## Seguridad: qué protege y qué no

- Protege: que el público reciba datos confidenciales; claves guardadas cifradas (con sal); 5 intentos fallidos bloquean ese usuario 15 minutos; denuncias solo con coordenadas de Bolivia y como máximo 30 por minuto.
- No protege: la seguridad depende de la cuenta de Google dueña de la hoja (use verificación en dos pasos) y de que la hoja **no** esté publicada ni compartida con cualquiera.
- Es un prototipo para el piloto. Para uso oficial a escala, conviene una revisión de seguridad y un servidor institucional.

## Límites gratuitos de Google (cuentas personales)

Cada apertura de la página hace una llamada, y cada denuncia o registro hace otra.
Los límites que más pesan son las ejecuciones simultáneas y el tiempo por ejecución; para un piloto municipal no deberían notarse.
Cifras vigentes (no verificadas aquí): https://developers.google.com/apps-script/guides/services/quotas
