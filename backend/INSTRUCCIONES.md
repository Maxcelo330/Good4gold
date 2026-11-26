# Backend del municipio (Google Apps Script): guía de instalación

Tiempo: unos 20 minutos. Costo: 0. Solo se necesita la cuenta de Google dueña de la hoja.
Archivos de esta carpeta: `Codigo.gs` (el programa), `plantilla-base-de-datos.xlsx` (la base de referencia) y `generar_plantilla.py` (regenera el Excel).

## Qué resuelve

| Sin backend (modo demostración) | Con backend |
|---|---|
| La página oculta los "No legal" **solo en pantalla**: quien sepa abrir el código los ve. | El servidor **no envía** al público los "No legal" ni **ningún pasivo** (colas, relaves). |
| Las denuncias quedan en el celular de quien denuncia: **otros dispositivos no las ven**. | Las denuncias llegan a la hoja **Denuncias** y se ven en el mapa de **todos** los dispositivos. |
| La cuenta de prueba (`Aurum80` / `Aurum80`) está escrita en el código de la página. | La clave vive **cifrada** en la hoja `Usuarios` (el usuario inicial sigue siendo `Aurum80`). |
| Registrar datos solo cambia ese dispositivo. | Registrar datos escribe en la hoja, con usuario y fecha (`editado_por`, `editado_en`). |

> Sobre la cuenta `Aurum80` / `Aurum80`: en modo demostración está visible en `js/config/config.js` (público en GitHub), igual que antes la cuenta `municipio`. Con backend, la clave que vale es la de la hoja `Usuarios`, guardada cifrada (hash + sal). Como la clave inicial es pública, **cámbiela cuando el piloto pase a datos reales** (escriba otra en `clave_nueva`).

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
5. Compruebe que las pestañas son exactamente: `Operadores`, `Pasivos`, `Denuncias`, `Usuarios` (y `Leeme`, que puede borrar). **No cambie los nombres de las pestañas ni la fila 1.**
6. Las filas de ejemplo son **simuladas**. Para probar déjelas; para datos reales, bórrelas (solo las filas, no los encabezados).

### 2. Pegar el programa
1. En la hoja: **Extensiones → Apps Script**. Se abre el editor.
2. Borre lo que haya en `Código.gs`, pegue **todo el contenido de `backend/Codigo.gs`** y guarde (icono de disquete). Nombre sugerido del proyecto: *Control Minero*.

### 3. Ejecutar `configurar`
1. Arriba, en la lista de funciones, elija **`configurar`** y pulse **Ejecutar**.
2. Google pide permisos: **Revisar permisos** → su cuenta → **Configuración avanzada** → **Ir a Control Minero (no seguro)** → **Permitir**. Aparece "no seguro" porque el script es suyo y no está en el catálogo de Google; es normal.
3. Al terminar, en el **Registro de ejecución** (abajo) debe verse un diagnóstico: `OK Operadores: …`, `OK Pasivos: …`, `OK Denuncias: …`, `OK Usuarios: …`. Si dice `FALTA la pestaña…` o `REVISAR … faltan columnas`, corrija el nombre o agregue la columna y vuelva a ejecutar. `configurar` crea la pestaña `Denuncias`/`Usuarios` si faltan, cifra las claves y crea la carpeta privada de fotos en su Drive.

### 4. Crear el usuario
- Si usó el Excel de referencia, la pestaña `Usuarios` ya trae la fila **`Aurum80`** (rol `funcionario`, activo `si`) con `clave_nueva` = `Aurum80`. Al ejecutar `configurar` (o `procesarClaves`) el script **cifra la clave en `hash` + `sal` y vacía la celda `clave_nueva`**. Si la celda no se vacía, vuelva al editor y ejecute **`procesarClaves`**.
- Para otro funcionario, agregue una fila: `usuario`, `nombre`, `municipio`, `rol` = `funcionario`, `activo` = `si` y la clave (mínimo 6 caracteres) en `clave_nueva`. Para quitar el acceso: `activo` = `no`. Para cambiar una clave: escriba la nueva en `clave_nueva`.
- El usuario no distingue mayúsculas (`Aurum80` = `aurum80`); la clave sí.

### 5. Implementar como Aplicación web
1. **Implementar → Nueva implementación**.
2. Engranaje → **Aplicación web**.
3. Descripción: `v1`. **Ejecutar como: Yo (su cuenta)**. **Quién tiene acceso: Cualquier usuario**.
4. **Implementar** y copie la **URL de la aplicación web** (termina en `/exec`).

### 6. Probar la URL
Ábrala en el navegador: debe mostrar `{"ok":true,"servicio":"Registro y Control Minero",...}`.
Pruebe también `LA_URL/exec?accion=denunciasMapa`: debe mostrar `{"ok":true,"denuncias":[...]}` con solo `id`, `lat`, `lng`, `tipo`, `fecha` y `estado`. Y `LA_URL/exec?accion=publico`: `"pasivos":[]` y ningún operador "No legal".

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

## Lista de comprobación
- [ ] La hoja **no** está publicada en la web y su acceso es *Restringido*.
- [ ] Pestañas `Operadores`, `Pasivos`, `Denuncias`, `Usuarios` con los encabezados de la plantilla.
- [ ] `configurar` terminó sin errores y el diagnóstico dice `OK` en las 4 pestañas.
- [ ] La celda `clave_nueva` de `Aurum80` quedó vacía y `hash` y `sal` tienen valor.
- [ ] La implementación es *Aplicación web*, ejecutar como **Yo**, acceso **Cualquier usuario**.
- [ ] `LA_URL/exec` responde `{"ok":true,...}` y `?accion=publico` no trae pasivos ni "No legal".
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
| Cambié `Codigo.gs` y nada cambia | Una implementación guarda una versión fija: **Implementar → Gestionar implementaciones** → lápiz → *Versión: Nueva versión* → **Implementar**. (La URL no cambia. Si crea una implementación nueva, la URL sí cambia y hay que actualizar `config.js`.) |
| La URL funciona pero la app sigue con lo viejo | Caché del service worker: suba `VERSION` en `sw.js`, publique, y en el celular cierre y abra la app (o Configuración → *Buscar nueva versión*). |
| "Usuario o clave incorrectos" con `Aurum80` | La clave no se cifró (la celda `clave_nueva` aún tiene texto): ejecute `procesarClaves`. Recuerde `activo` = `si`. Tras 5 fallos el usuario se bloquea 15 minutos. |
| La clave no se cifra | Tiene menos de 6 caracteres (la celda muestra una nota) o la fila no tiene `usuario`. |
| Una denuncia dice "Sin enviar" y no se va | Revise la conexión; si el servidor respondió "Ya envió varias denuncias en esta hora", se reintenta sola más tarde. |
| Las denuncias no aparecen en el mapa de B | Pulse **Actualizar**; el servidor guarda la lista 20 segundos. Compruebe que el estado no sea `descartada`. |
| `FALTA la pestaña…` en el diagnóstico | El nombre de la pestaña difiere (mayúsculas, espacios). Debe ser exacto. |
| Falla al guardar fotos | `configurar` no creó la carpeta o no se aceptaron los permisos de Drive: vuelva a ejecutarlo. La denuncia se guarda igual, sin foto. |

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

- **Público:** consulta, mapa, denuncias. El servidor nunca le envía "No legal", pasivos, fotos ni descripciones de denuncias.
- **Funcionario:** además Resumen, Pasivos, Datos, **Registrar datos** y **Denuncias recibidas**. La sesión dura hasta 6 horas y se cierra al cerrar la pestaña.

## Seguridad: qué protege y qué no

- Protege: que el público reciba datos confidenciales; claves cifradas (con sal); 5 intentos fallidos bloquean ese usuario 15 minutos; denuncias solo con coordenadas de Bolivia, campo trampa contra robots, máximo 30 por minuto en total y 10 por hora por dispositivo; los textos que empiezan con `=`, `+`, `-` o `@` se guardan como texto (no como fórmula).
- **Privacidad del mapa público:** las coordenadas de cada denuncia se publican **exactas** (son el lugar de la actividad que se vio, no el domicilio de quien denuncia) y sin nombre, contacto, foto, descripción ni hora. Si el municipio prefiere más discreción, se pueden redondear en `listarDenunciasMapa_()`.
- No protege: la seguridad depende de la cuenta de Google dueña de la hoja (use verificación en dos pasos) y de que la hoja **no** esté publicada ni compartida con cualquiera. Quien conozca la URL `/exec` puede enviar denuncias (los límites frenan el abuso, no lo impiden).
- Es un prototipo para el piloto. Para uso oficial a escala, conviene una revisión de seguridad y un servidor institucional.

## Límites gratuitos de Google (cuentas personales)

Cada apertura de la página hace llamadas, y con la página abierta se actualiza cada minuto. El servidor guarda la lista del mapa 20 segundos para ahorrar lecturas.
Los límites que más pesan son las ejecuciones simultáneas y el tiempo por ejecución; para un piloto municipal no deberían notarse.
Cifras vigentes (no verificadas aquí): https://developers.google.com/apps-script/guides/services/quotas
