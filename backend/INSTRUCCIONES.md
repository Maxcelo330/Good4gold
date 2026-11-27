# Backend del municipio (Google Apps Script): guía de instalación

Tiempo: unos 20 minutos. Costo: 0. Solo se necesita la cuenta de Google dueña de la hoja.
Archivos de esta carpeta: `Codigo.gs` (el programa), `plantilla-base-de-datos.xlsx` (la base de referencia), `generar_plantilla.py` (regenera el Excel) y `pruebas/` (comprobaciones automáticas que se ejecutan en la computadora, sin Google).

> **¿Ya tiene un despliegue funcionando?** Salte a [Actualizar un despliegue existente](#actualizar-un-despliegue-existente). La URL `/exec` no cambia y no hay que tocar la app.

## Qué resuelve

| Sin backend (modo demostración) | Con backend |
|---|---|
| La página oculta los "No legal" **solo en pantalla**: quien sepa abrir el código los ve. | El servidor **no envía** al público los "No legal" ni **ningún pasivo** (colas, relaves) ni **ninguna muestra**. |
| Las denuncias quedan en el celular de quien denuncia: **otros dispositivos no las ven**. | Las denuncias llegan a la hoja **Denuncias** y se ven en el mapa de **todos** los dispositivos. |
| La cuenta de prueba (`Aurum80` / `Aurum80`) está escrita en el código de la página. | La clave vive **cifrada** en la hoja `Usuarios` (el usuario inicial sigue siendo `Aurum80`). |
| Registrar datos solo cambia ese dispositivo. | Registrar datos escribe en la hoja, con usuario y fecha (`editado_por`, `editado_en`). |
| Todos los perfiles ven lo mismo. | Hay **3 roles** (funcionario, técnico y operador) y el **servidor** comprueba el rol en cada acción. |

> Sobre las cuentas de demostración (`Aurum80`, `Campo80`, `Coop80`): sus claves están escritas en el código público de GitHub. Con backend, la clave que vale es la de la hoja `Usuarios`, guardada cifrada (hash + sal), pero como la clave inicial es pública, **cámbielas o desactívelas cuando el piloto pase a datos reales** (vea [Los 3 roles y las cuentas de demostración](#los-3-roles-y-las-cuentas-de-demostración)).

## Antes de empezar: no publique la hoja

Si la hoja está "Publicada en la Web" (los enlaces CSV que terminan en `output=csv`), **cualquiera puede descargar toda la base, incluidos los confidenciales**, sin pasar por el backend.
En la hoja: **Archivo → Compartir → Publicar en la Web → Contenido publicado → Dejar de publicar**.
En *Compartir* (botón azul) deje el acceso en **Restringido** (solo el equipo).

## Paso a paso

### 1. Subir el Excel a Google Drive y abrirlo como Hoja de Google
1. Entre a <https://drive.google.com> con la cuenta que será la dueña de la base.
2. **Nuevo → Subir archivo** y elija `backend/plantilla-base-de-datos.xlsx` (o su Excel con las mismas pestañas y columnas; la pestaña `Leeme` explica cada columna y los valores permitidos).
3. Haga clic derecho sobre el archivo → **Abrir con → Hojas de cálculo de Google**.
4. Si arriba aparece la etiqueta **.XLSX**, pase a hoja de Google real: **Archivo → Guardar como hoja de cálculo de Google**. Trabaje con la copia nueva (sin la etiqueta .XLSX).
5. Compruebe que las pestañas son exactamente: `Operadores`, `Pasivos`, `Denuncias`, `Usuarios`, `Muestras`, `Inscripciones` (y `Leeme`, que puede borrar). **No cambie los nombres de las pestañas ni la fila 1.**
6. Las filas de ejemplo son **simuladas** (llevan la marca "simulado"). Para probar déjelas; para datos reales, bórrelas (solo las filas, no los encabezados).

### 2. Pegar el programa
1. En la hoja: **Extensiones → Apps Script**. Se abre el editor.
2. Borre lo que haya en `Código.gs`, pegue **todo el contenido de `backend/Codigo.gs`** y guarde (icono de disquete). Nombre sugerido del proyecto: *Control Minero*.

### 3. Ejecutar `configurar`
1. Arriba, en la lista de funciones, elija **`configurar`** y pulse **Ejecutar**.
2. Google pide permisos: **Revisar permisos** → su cuenta → **Configuración avanzada** → **Ir a Control Minero (no seguro)** → **Permitir**. Aparece "no seguro" porque el script es suyo y no está en el catálogo de Google; es normal.
3. Al terminar, en el **Registro de ejecución** (abajo) debe verse un diagnóstico con seis líneas: `OK Operadores: …`, `OK Pasivos: …`, `OK Denuncias: …`, `OK Usuarios: …`, `OK Muestras: …`, `OK Inscripciones: …`. Si dice `FALTA la pestaña…` o `REVISAR … faltan columnas`, corrija el nombre o agregue la columna y vuelva a ejecutar.

`configurar` es **seguro de repetir**: crea las pestañas `Denuncias`, `Usuarios`, `Muestras` e `Inscripciones` si faltan, agrega las columnas nuevas que falten (`operador_id` en `Usuarios`; `origen` y `denuncia_codigo` en `Operadores`), crea las cuentas de demostración que no existan (no toca las existentes), cifra las claves escritas en `clave_nueva` y crea la carpeta privada de fotos en su Drive.

### 4. Crear los usuarios
- Si usó el Excel de referencia, la pestaña `Usuarios` ya trae tres filas de demostración (`Aurum80`, `Campo80` y `Coop80`, con `clave_nueva` igual al usuario). Al ejecutar `configurar` (o `procesarClaves`) el script **cifra cada clave en `hash` + `sal` y vacía la celda `clave_nueva`**. Si la celda no se vacía, vuelva al editor y ejecute **`procesarClaves`**.
- Para otra persona, agregue una fila: `usuario`, `nombre`, `municipio`, `rol` (`funcionario`, `tecnico` u `operador`), `activo` = `si` y la clave (mínimo 6 caracteres) en `clave_nueva`. Para quitar el acceso: `activo` = `no`. Para cambiar una clave: escriba la nueva en `clave_nueva`.
- **Usuario operador:** además del rol, la columna `operador_id` es **obligatoria** y debe ser el `id` de una fila que ya exista en la pestaña `Operadores` (por ejemplo `OP-003`). Sin ese dato la cuenta **no puede ingresar**. Pasos: (1) compruebe en `Operadores` el `id` de la cooperativa o empresa; (2) agregue la fila en `Usuarios` con `rol` = `operador` y `operador_id` = ese `id`; (3) escriba su clave en `clave_nueva`; (4) ejecute `procesarClaves` (o `configurar`). Cada cuenta operador queda atada a **un solo** operador.
- El usuario no distingue mayúsculas (`Aurum80` = `aurum80`); la clave sí.

### 5. Implementar como Aplicación web
1. **Implementar → Nueva implementación**.
2. Engranaje → **Aplicación web**.
3. Descripción: `v1`. **Ejecutar como: Yo (su cuenta)**. **Quién tiene acceso: Cualquier usuario**.
4. **Implementar** y copie la **URL de la aplicación web** (termina en `/exec`).

### 6. Probar la URL
Ábrala en el navegador: debe mostrar `{"ok":true,"servicio":"Aurum80",...}`.
Pruebe también `LA_URL/exec?accion=denunciasMapa`: debe mostrar `{"ok":true,"denuncias":[...]}` con solo `id`, `lat`, `lng`, `tipo`, `fecha` y `estado`. Y `LA_URL/exec?accion=publico`: `"pasivos":[]` y ningún operador "No legal". Más pruebas, con los roles, en [Comprobación rápida con curl](#comprobación-rápida-con-curl).

### 7. Conectar la app
En `js/config/config.js` pegue la URL:

```js
backend: { url: 'https://script.google.com/macros/s/XXXXXXXX/exec' },
```

### 8. Publicar de nuevo en GitHub Pages
1. En `sw.js` suba el número de `VERSION` (por ejemplo de `g4g-0.5.0` a `g4g-0.5.1`): así los celulares descartan la copia vieja de la app.
2. Suba los cambios a GitHub (rama que publica Pages). Espere 1 o 2 minutos.
3. Abra la página: arriba debe verse **En línea con la base** (verde). Si dice **Modo demostración**, la URL no quedó en `config.js` o falta publicar.

### 9. Probar con dos dispositivos
1. **Dispositivo A** (celular, sin ingresar): Denunciar → elija qué vio → marque un punto en el mapa → Enviar. Debe decir "Se envió a la autoridad del municipio". La fila aparece en la pestaña `Denuncias`.
2. **Dispositivo B** (otro celular o la computadora, sin ingresar): Mapa → **Actualizar** (o espere un minuto). Debe aparecer un **punto azul** donde denunció A. No debe verse ningún cuadrado rojo, anillo gris ni hexágono violeta.
3. En B pulse **Ingresar** con `Aurum80` / `Aurum80`: ahora se ven además los **rojos** (operadores no legales y denuncias para verificar), los **hexágonos violeta** (pasivos) y, en **Denuncias recibidas**, la lista completa. Cambie el estado de la denuncia a **En revisión**: su punto pasa a **rojo** para los funcionarios (el público lo sigue viendo azul).
4. Prueba sin señal: en A active el modo avión y denuncie: queda **Sin enviar**. Al volver la señal se envía sola y el punto aparece en B.

## Actualizar un despliegue existente

Use esto si ya tenía el backend instalado y solo quiere el programa nuevo (roles técnico y operador, muestras, inscripciones, aceptar denuncias). **No cree una implementación nueva**: la URL `/exec` cambiaría y habría que actualizar `config.js`.

1. Abra la hoja → **Extensiones → Apps Script**.
2. Borre el contenido de `Código.gs`, pegue **todo el contenido nuevo de `backend/Codigo.gs`** y guarde.
3. Elija la función **`configurar`** y pulse **Ejecutar** **una vez**. Si Google pide permisos nuevos, acéptelos (**Revisar permisos** → su cuenta → **Configuración avanzada** → **Ir a Control Minero (no seguro)** → **Permitir**). Esto crea las pestañas `Muestras` e `Inscripciones`, agrega las columnas nuevas y las cuentas `Campo80` y `Coop80` si faltan. **No borra ni cambia** sus datos ni sus usuarios actuales.
4. En el **Registro de ejecución** compruebe las seis líneas `OK …` del diagnóstico.
5. **Implementar → Administrar implementaciones** → el lápiz (editar) de la implementación activa → **Versión: Nueva versión** → **Implementar**. La URL termina igual que antes.
6. Compruebe con [curl](#comprobación-rápida-con-curl) que `login` responde `ok` y que una acción con el rol equivocado responde `permiso`.

Sin el paso 5, la URL sigue sirviendo el programa **viejo**, aunque el editor ya tenga el nuevo.

## Los 3 roles y las cuentas de demostración

El rol de cada persona está en la columna `rol` de la hoja `Usuarios`. El servidor lo comprueba en **cada** acción: ocultar un botón en la app no es la protección.

| Rol | Quién es | Qué puede hacer | Qué no puede |
|---|---|---|---|
| `funcionario` | Autoridad del municipio | Todo: base completa (con "No legal" y pasivos), registrar y editar datos, situación legal y requisitos, denuncias (ver, cambiar estado, **aceptar**), fotos, muestras, solicitudes de inscripción. | Nada queda fuera de su rol. |
| `tecnico` | Personal de campo | Ver la base completa, registrar y editar datos de operadores y pasivos, registrar y ver **muestras**, ver la foto de una muestra. | Cambiar `estado_legal` o cualquier `req_*` (lo verifica la autoridad); ver o gestionar **denuncias** y sus fotos; ver o gestionar **inscripciones**. |
| `operador` | Cooperativa o empresa | Ver la ficha de **su** operador (con el estado de sus requisitos y de sus inscripciones) y **solicitar inscribirse** a un programa (por ahora `biorremediacion`). | Ver o tocar a otros operadores, pasivos, muestras o denuncias; editar datos. Su cuenta está atada a un solo `operador_id`, que sale de la hoja y no de lo que envíe el celular. |

Cuentas de demostración (las crea `configurar` si no existen):

| Usuario | Clave | Rol | Observación |
|---|---|---|---|
| `Aurum80` | `Aurum80` | `funcionario` | Cuenta inicial del piloto. |
| `Campo80` | `Campo80` | `tecnico` | Para la app de campo. |
| `Coop80` | `Coop80` | `operador` | Vinculada a un operador "En proceso" (o al primero de la hoja). Compruebe su `operador_id` en la hoja `Usuarios`. |

> **Advertencia:** estas claves están escritas en el código público de GitHub. Sirven **solo para la demostración**. Antes de usar datos reales, escriba una clave nueva en `clave_nueva` de cada una (o ponga `activo` = `no`) y bórrelas si no las necesita.

## Acciones del servidor y quién puede usarlas

Todas se envían por **POST** con cuerpo JSON y el campo `accion`. Las que requieren sesión llevan además `token` (lo entrega `login`; dura 6 horas). Si falta o venció, responde `codigo: "sesion"`; si el rol no corresponde, `codigo: "permiso"`.

| Acción | Quién | Qué hace |
|---|---|---|
| `publico` | Cualquiera (también por GET) | Operadores sin los "No legal". Nunca pasivos. |
| `denunciasMapa` | Cualquiera (también por GET) | Denuncias para el mapa público: solo `id`, `lat`, `lng`, `tipo`, `fecha`, `estado` resumido. |
| `denuncia` | Cualquiera | Registra una denuncia (con foto opcional). Límite por minuto y por dispositivo. |
| `login` | Cualquiera | Usuario y clave: devuelve `token`, `usuario` (con `rol` y `operador_id`). |
| `salir` | Con token | Cierra la sesión. |
| `completo` | funcionario, tecnico | Toda la base: operadores (con "No legal") y pasivos. |
| `guardar` | funcionario, tecnico | Crea o edita un operador o pasivo (por `id`). El técnico no puede cambiar `estado_legal` ni `req_*`. Nadie fija `origen` ni `denuncia_codigo` por aquí. |
| `denuncias` | funcionario | Lista completa de denuncias (descripción, nota, si tiene foto). |
| `estadoDenuncia` | funcionario | Cambia el estado de una denuncia y anota el seguimiento. |
| `aceptarDenuncia` | funcionario | Convierte una denuncia en un **punto por verificar**: una fila en `Operadores` con situación "No legal" y `origen` = `denuncia`, y deja la denuncia como `atendida`. Es **idempotente**: repetirla no duplica el punto. |
| `foto` | funcionario, tecnico | Foto de una **muestra** (`tabla`: `muestras`). La foto de una **denuncia** (sin `tabla`, o `denuncias`) es **solo del funcionario**. |
| `guardarMuestra` | funcionario, tecnico | Registra una muestra de campo. Valida coordenadas en Bolivia, `matriz` (agua o lodo), `semaforo` (verde, amarillo o rojo) y que el mercurio no sea negativo. Reintentar con el mismo `id` no duplica. Si indica un `pasivo_id`, marca `muestra` = `si` en ese pasivo. |
| `muestras` | funcionario, tecnico | Lista de muestras (sin el id de la foto, solo si tiene foto). |
| `miOperador` | operador | La ficha de **su** operador, el estado de sus requisitos y sus inscripciones. |
| `inscribir` | operador | Solicita inscribirse a un programa. Si ya tiene una solicitud activa (`pendiente`, `en_revision` o `aceptada`) del mismo programa, no se duplica. |
| `inscripciones` | funcionario | Lista de solicitudes de inscripción. |
| `estadoInscripcion` | funcionario | Cambia el estado (`pendiente`, `en_revision`, `aceptada`, `no_aplica`) y anota una respuesta. |

## Comprobación rápida con curl

Cambie `LA_URL` por la URL que termina en `/exec`. Apps Script recibe el cuerpo como `text/plain` y responde con una redirección, por eso se usa `-L` (y **no** `-X POST`, que obligaría a repetir el POST en la redirección). En Windows use Git Bash, o `curl.exe` en PowerShell con las comillas del JSON escapadas.

**1. Ingresar** (devuelve el `token` y el `rol`):

```bash
curl -sL -H "Content-Type: text/plain" \
  -d '{"accion":"login","usuario":"Campo80","clave":"Campo80"}' \
  "LA_URL"
```

Respuesta esperada (el `token` cambia en cada ingreso):

```json
{"ok":true,"token":"…","usuario":{"usuario":"campo80","nombre":"Técnico de campo (demo)","municipio":"","rol":"tecnico","operador_id":""},"expiraEnS":21600}
```

**2. Una acción con el rol equivocado** (el técnico pide la lista de denuncias, que es solo del funcionario). Pegue el `token` del paso 1:

```bash
curl -sL -H "Content-Type: text/plain" \
  -d '{"accion":"denuncias","token":"PEGUE_AQUI_EL_TOKEN"}' \
  "LA_URL"
```

Debe responder **`"codigo":"permiso"`**:

```json
{"ok":false,"error":"Su cuenta no tiene permiso para esta acción.","codigo":"permiso"}
```

**3. Sin sesión** debe responder `"codigo":"sesion"`:

```bash
curl -sL -H "Content-Type: text/plain" -d '{"accion":"muestras"}' "LA_URL"
```

**4. Lo público no trae datos confidenciales** (ningún "No legal", `"pasivos":[]`):

```bash
curl -sL "LA_URL?accion=publico"
```

Si en el paso 2 responde `ok:true` en vez de `permiso`, la implementación sigue con el programa viejo: repita el paso 5 de [Actualizar un despliegue existente](#actualizar-un-despliegue-existente).

### Probar el programa sin Google (opcional)

Con Node instalado, desde la raíz del repositorio:

```bash
node backend/pruebas/probar_codigo.js
python -I backend/pruebas/verificar_plantilla.py
```

La primera carga `Codigo.gs` con hojas simuladas en memoria y prueba roles, privacidad, aceptar denuncias, muestras, inscripciones y la protección contra fórmulas. La segunda comprueba que el Excel tiene las mismas pestañas y encabezados que el programa. Úselas después de cambiar `Codigo.gs`. No reemplazan la prueba real en la hoja de Google.

## Lista de comprobación
- [ ] La hoja **no** está publicada en la web y su acceso es *Restringido*.
- [ ] Pestañas `Operadores`, `Pasivos`, `Denuncias`, `Usuarios`, `Muestras`, `Inscripciones` con los encabezados de la plantilla.
- [ ] `configurar` terminó sin errores y el diagnóstico dice `OK` en las 6 pestañas.
- [ ] Las celdas `clave_nueva` de `Aurum80`, `Campo80` y `Coop80` quedaron vacías y `hash` y `sal` tienen valor.
- [ ] `Coop80` (y cualquier usuario `operador`) tiene un `operador_id` que existe en `Operadores`.
- [ ] Con datos reales: las claves de demostración fueron cambiadas o las cuentas desactivadas (`activo` = `no`).
- [ ] La implementación es *Aplicación web*, ejecutar como **Yo**, acceso **Cualquier usuario**, y se creó una **Nueva versión** tras el último cambio de `Codigo.gs`.
- [ ] `LA_URL/exec` responde `{"ok":true,...}` y `?accion=publico` no trae pasivos ni "No legal".
- [ ] El `curl` del técnico pidiendo `denuncias` responde `permiso`.
- [ ] `backend.url` pegada en `config.js` y `VERSION` de `sw.js` subida.
- [ ] La página muestra **En línea con la base**.
- [ ] Una denuncia de A aparece como punto azul en B sin ingresar.
- [ ] Ingresando como funcionario se ven los rojos, los hexágonos violeta y la lista completa de denuncias.
- [ ] Una denuncia hecha sin señal se envía sola al volver la conexión.

## Problemas típicos
| Síntoma | Causa y solución |
|---|---|
| La app dice **Modo demostración** | `backend.url` está vacía, o la página publicada es una versión vieja: pegue la URL, suba `VERSION` y recargue. |
| **Sin conexión con la base** (rojo) con internet | La implementación no es "Cualquier usuario", o la URL no termina en `/exec`, o es de una implementación borrada. Revise el paso 5 y copie la URL de nuevo. |
| "Se requiere autorización" / pantalla de inicio de sesión de Google al abrir la URL | Falta ejecutar `configurar` y aceptar permisos, o el acceso no es "Cualquier usuario". |
| Cambié `Codigo.gs` y nada cambia | Una implementación guarda una versión fija: **Implementar → Administrar implementaciones** → lápiz → *Versión: Nueva versión* → **Implementar**. (La URL no cambia. Si crea una implementación nueva, la URL sí cambia y hay que actualizar `config.js`.) |
| La URL funciona pero la app sigue con lo viejo | Caché del service worker: suba `VERSION` en `sw.js`, publique, y en el celular cierre y abra la app (o Configuración → *Buscar nueva versión*). |
| "Usuario o clave incorrectos" con `Aurum80` | La clave no se cifró (la celda `clave_nueva` aún tiene texto): ejecute `procesarClaves`. Recuerde `activo` = `si`. Tras 5 fallos el usuario se bloquea 15 minutos. |
| Un usuario `operador` no puede ingresar | Falta `operador_id` en su fila de `Usuarios` (es obligatorio para ese rol), o esa fila ya no existe en `Operadores`. |
| `miOperador` dice "Su cuenta no está vinculada a una cooperativa o empresa registrada" | El `operador_id` del usuario no coincide con ningún `id` de `Operadores`. Corríjalo en `Usuarios`. |
| Una acción responde `permiso` | El rol de la cuenta no puede usar esa acción (vea la tabla de acciones). Es lo esperado: no es un error del servidor. |
| La clave no se cifra | Tiene menos de 6 caracteres (la celda muestra una nota) o la fila no tiene `usuario`. |
| Una denuncia dice "Sin enviar" y no se va | Revise la conexión; si el servidor respondió "Ya envió varias denuncias en esta hora", se reintenta sola más tarde. |
| Las denuncias no aparecen en el mapa de B | Pulse **Actualizar**; el servidor guarda la lista 20 segundos. Compruebe que el estado no sea `descartada`. |
| `FALTA la pestaña…` en el diagnóstico | El nombre de la pestaña difiere (mayúsculas, espacios). Debe ser exacto. |
| Falla al guardar fotos | `configurar` no creó la carpeta o no se aceptaron los permisos de Drive: vuelva a ejecutarlo. La denuncia o la muestra se guarda igual, sin foto. |

## Qué ve cada perfil

| Marcador en el mapa | Público | Funcionario |
|---|:-:|:-:|
| Círculo verde: operador legal | Sí | Sí |
| Triángulo amarillo: en proceso | Sí | Sí |
| Círculo azul con "!": denuncia recibida (de todos los dispositivos) | Sí | Sí |
| Cuadrado rojo: operador "No legal" | No | Sí |
| Círculo rojo con "!": denuncia para verificar (estado *En revisión* o a menos de 2 km de un "No legal") | No (la ve azul) | Sí |
| Anillo gris: sin verificar | No | Sí |
| Hexágono violeta: pasivos (colas, relaves) | No | Sí |

- **Público:** consulta, mapa, denuncias. El servidor nunca le envía "No legal", pasivos, muestras, fotos ni descripciones de denuncias.
- **Funcionario:** además Resumen, Pasivos, Datos, **Registrar datos** y **Denuncias recibidas**. La sesión dura hasta 6 horas y se cierra al cerrar la pestaña.
- **Técnico:** base completa y muestras, sin denuncias ni cambio de situación legal. **Operador:** solo su propia ficha e inscripciones. (El servidor ya aplica estas reglas; qué pantallas muestra cada versión de la app es aparte.)

## Seguridad: qué protege y qué no

- Protege: que el público reciba datos confidenciales; que cada rol solo use sus acciones (comprobado en el servidor); que un operador vea otro operador; claves cifradas (con sal); 5 intentos fallidos bloquean ese usuario 15 minutos; denuncias solo con coordenadas de Bolivia, campo trampa contra robots, máximo 30 por minuto en total y 10 por hora por dispositivo; los textos que empiezan con `=`, `+`, `-` o `@` se guardan como texto (no como fórmula).
- **Privacidad:** el público **nunca** recibe operadores "No legal", pasivos (colas, relaves), muestras, ni el código de la denuncia que originó un punto (`denuncia_codigo`) ni su `origen`. Un punto creado al aceptar una denuncia nace "No legal", sin nombre de ninguna persona, y solo lo ven funcionarios y técnicos.
- **Privacidad del mapa público:** las coordenadas de cada denuncia se publican **exactas** (son el lugar de la actividad que se vio, no el domicilio de quien denuncia) y sin nombre, contacto, foto, descripción ni hora. Si el municipio prefiere más discreción, se pueden redondear en `listarDenunciasMapa_()`.
- No protege: la seguridad depende de la cuenta de Google dueña de la hoja (use verificación en dos pasos) y de que la hoja **no** esté publicada ni compartida con cualquiera. Quien conozca la URL `/exec` puede enviar denuncias (los límites frenan el abuso, no lo impiden).
- Es un prototipo para el piloto. Para uso oficial a escala, conviene una revisión de seguridad y un servidor institucional.

## Límites gratuitos de Google (cuentas personales)

Cada apertura de la página hace llamadas, y con la página abierta se actualiza cada minuto. El servidor guarda la lista del mapa 20 segundos para ahorrar lecturas.
Los límites que más pesan son las ejecuciones simultáneas y el tiempo por ejecución; para un piloto municipal no deberían notarse.
Cifras vigentes (no verificadas aquí): https://developers.google.com/apps-script/guides/services/quotas
