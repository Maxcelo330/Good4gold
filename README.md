# Aurum80 — minería responsable en Bolivia

Aplicación de **verificación, control y reporte** del equipo **Aurum80** para el desafío ORO-4.2 (Gold4Good Bolivia 2026). Funciona abriendo `index.html`: no necesita servidor, instalación ni conexión (el mapa base sí usa internet; sin él se ven los puntos igual).

> **Los datos incluidos son simulados.** Los nombres y estados legales son inventados y no representan a ninguna cooperativa real. Una franja "DATOS SIMULADOS" lo recuerda en todo momento.

## Novedades de la versión 0.7.0
**Tres perfiles con inicio de sesión real** (el servidor valida el rol en cada acción): **autoridad** (`funcionario`), **cooperativa o empresa** (`operador`, ligada a su `operador_id`) y **técnico de campo** (`tecnico`).

| Quién | Qué tiene |
|---|---|
| **Público** | Inicio con **Informaciones**, **Trámites para ser legal** (pasos, institución, documento y norma), **Programas** (piloto de biorremediación), mapa, consulta y denuncia desde el celular. |
| **Cooperativa o empresa** | **Mi estado**: cada requisito en *Listo / En proceso / Faltante*, siguiente paso, e **inscripción a programas**. |
| **Autoridad** | **Resumen** con 8 indicadores simples, **Denuncias recibidas** con **Aceptar y crear punto por verificar**, **Solicitudes** de programas, **Monitoreo** priorizado, **Zonas de riesgo** (mapa y tabla) y **Muestras**. |
| **Técnico de campo** | App aparte **Aurum80 Campo** (`campo/`): toma de muestra colorimétrica de mercurio con foto y GPS, fichas de pasivos y operadores, y cola de envío sin conexión. Guarda en el mismo Google Sheet. |

- **Novedades 0.7:** sección **Novedades** (noticias del sector con fuente y guías, con imágenes propias; los datos se editan en `js/data/novedades.js`), **animación de biorremediación** en Programas, y en Aurum80 Campo una **planilla tipo Excel** (Muestras y Pasivos, con pegado desde Excel, borrador local y envío sin conexión).
- **Dos apps instalables** con logo propio: la principal (`/`) y Campo (`/campo/`). En el celular: abrir la dirección y usar *Instalar* (Android) o Compartir → Agregar a inicio (iPhone).
- **Normas bolivianas** en `js/data/normativa.js`, cada una con fuente y fecha de verificación (2026-11-26). Lo que no se pudo comprobar se rotula **Referencial**. Es orientación, no asesoría legal.
- **La prueba de campo no reemplaza al laboratorio**: sus cortes (5/20 ppb en agua, 50/170 ppb en lodo) no son límites legales; la norma boliviana permite 1 ppb. La calibración es teórica y está pendiente de validar con estándares.
- **Backend ampliado** (`backend/Codigo.gs`): hojas `Muestras` e `Inscripciones`, roles validados en el servidor, `aceptarDenuncia` (denuncia a punto por verificar). Pruebas: `node backend/pruebas/probar_codigo.js` (246 comprobaciones). **Para actualizar un despliegue existente siga `backend/INSTRUCCIONES.md`** (pegar el código, ejecutar `configurar()` y crear una nueva versión).
- **Cuentas demo** (en la hoja `Usuarios`, claves públicas en GitHub: cámbielas con datos reales): `Aurum80` (autoridad), `Campo80` (técnico) y `Coop80` (cooperativa).
- **Hecho con agentes especializados** (`.claude/agents/`): diseñador UX, verificador normativo, backend y revisor de calidad.

## Qué hace
**Ciudadanía** (pensado para quien quiere consultar o denunciar):
| Sección | Para qué sirve |
|---|---|
| **Inicio** | Buscador con sugerencias ("¿esta operación está en regla?"), accesos a mapa y denuncia, y cifras del registro que llevan a la lista filtrada. |
| **Mapa** | Puntos **verdes** (legal), **amarillos** (en proceso) y **azules** (denuncias de la ciudadanía, de todos los dispositivos). Toca cualquier punto: "¿Qué hay aquí?" muestra las operaciones a menos de 5 km y un botón **Denunciar en este punto**. Buscador que vuela a la operación, botón "Mi ubicación", filtros de un toque, vistas Mapa / Satélite / Relieve, estado de la conexión y botón **Actualizar**. |
| **Consultar** | Tarjetas o tabla de operadores con filtros por situación legal. La ficha muestra **qué requisitos le faltan** y permite denunciar en su ubicación. |
| **Denunciar** | Asistente en 3 pasos (qué viste → dónde → foto y envío) con código de seguimiento. Compara la ubicación con el registro y avisa si no hay operaciones registradas cerca. |

**Panel técnico** (funcionarios): **Resumen** del registro, **Pasivos** (ranking de colas por riesgo × valor) y **Datos** (carga del Excel/CSV, conexión en línea y validación de calidad). **Detecciones revisadas**: zonas marcadas en imágenes satelitales (ver abajo).

**Denuncias:** con la base en línea (backend) van a la hoja **Denuncias** y todos los dispositivos las ven en el mapa (ver "Interconexión"). En modo demostración (sin backend) se guardan solo en el dispositivo y se exportan (GeoJSON / CSV / JSON con fotos) para que un funcionario las incorpore.

## Ríos, quebradas y canales
En el mapa, grupo **Agua**: interruptores *Ríos principales* y *Quebradas y canales*, con leyenda. Además, **"¿Qué hay aquí?"** y el paso de ubicación de la denuncia indican el **curso de agua más cercano** y a qué distancia.
| Capa | Origen | Funciona sin conexión |
|---|---|---|
| Ríos principales de Bolivia (29 tramos: Beni, Mamoré, Madre de Dios, Pilcomayo, Grande…) | Natural Earth 10m (dominio público), `js/data/rios.js` | Sí |
| Detalle del **norte de La Paz** (Tipuani, Mapiri, Teoponte, Guanay): 153 ríos y 269 quebradas, 110 con nombre | OpenStreetMap (ODbL), descargado el 22-11-2026, `js/data/hidro-zona.js` | Sí |
| Detalle de **cualquier otra zona** (ríos y canales desde zoom 11; quebradas, drenajes y zanjas desde zoom 13) | OpenStreetMap vía Overpass, en vivo | No |

Límites que conviene conocer:
- **Los servidores públicos de Overpass son lentos y se saturan** (probado hoy: 17 a 60 s por consulta, y errores 502/504/429 a ratos). La app consulta dos en paralelo, espera hasta 80 s y, si fallan, avisa con un botón **Reintentar**. Para una demo, conviene quedarse en la zona precargada.
- **En la zona precargada OpenStreetMap no tiene canales mapeados**, solo ríos y quebradas. Los canales aparecerán donde existan en OSM.
- Son datos **abiertos y colaborativos, no oficiales**: el detalle puede estar incompleto. La capa oficial `rios` del mapa base del taller (ArcMap) sigue pendiente de pedir (ver `Datos-disponibles-vs-faltantes`).
- Para ampliar la zona precargada: descargar otra caja con la misma consulta (`waterway` = river|stream|canal|drain|ditch), simplificar y generar un archivo `js/data/hidro-<zona>.js`.
- El "curso de agua más cercano" solo es fiable donde hay detalle cargado; fuera de eso se dice "río principal más cercano".

## Acceso por perfil, backend e instalación (v0.4.0)

- **Público (sin cuenta):** Inicio, Mapa, Consultar, Denunciar y Configuración. **No ve los operadores "No legal", ni ningún pasivo (colas, relaves)**, ni la cifra de "No legales". No hay otra pantalla de clave que el botón **Ingresar**.
- **Funcionario del municipio (Ingresar, arriba a la derecha):** usuario `Aurum80`, clave `Aurum80`. Ve toda la base y el menú **Municipio**: Resumen, Pasivos, Datos, **Detecciones revisadas**, **Registrar datos** (alta y edición de operadores y pasivos) y **Denuncias recibidas** (estado y nota de seguimiento). Las fichas muestran el botón Editar.
- **Backend:** `backend/Codigo.gs` (Google Apps Script, gratis) junto a la hoja de Google. Guía: [backend/INSTRUCCIONES.md](backend/INSTRUCCIONES.md). Se conecta con `backend.url` en `js/config/config.js`. El libro de referencia de la hoja es `backend/plantilla-base-de-datos.xlsx` (se regenera con `backend/generar_plantilla.py`).
  Sin backend la app funciona en **modo demostración** (indicador "Modo demostración · solo este dispositivo"): cuenta `Aurum80` / `Aurum80`, lo confidencial se oculta solo en pantalla y los cambios quedan en el dispositivo. Esa cuenta está escrita en `config.js` (público en GitHub) y no protege nada; con backend, la clave vive cifrada en la hoja `Usuarios`.

### Qué ve cada perfil en el mapa
| Marcador | Significa | Público | Funcionario |
|---|---|:-:|:-:|
| Círculo **verde** | Operador legal | Sí | Sí |
| Triángulo **amarillo** | Operador en proceso | Sí | Sí |
| Círculo azul con "!" **(azul)** | Denuncia recibida (de cualquier dispositivo) | Sí | Sí |
| Cuadrado **rojo** | Operador "No legal" | No | Sí |
| Círculo rojo con "!" **(rojo)** | Denuncia **para verificar**: en estado "En revisión", o a menos de 2 km de una operación "No legal" (`config.mapaDenuncias`) | No (la ve azul) | Sí |
| Anillo gris | Operador sin verificar | No | Sí |
| Hexágono **violeta** (oscuro = más prioridad) | Pasivo (colas, relaves, desmontes) | No | Sí |

Los pasivos usan su propia familia (violeta) y forma (hexágono) para no confundirse con nada rojo; la escala por clasificación está en `config.pasivoColor` y `--pasivo-1..4` (css). Las denuncias "descartadas" no se dibujan. El público ve el estado resumido de una denuncia ("Recibida" o "Atendida").

### Interconexión entre dispositivos (con backend)
| Qué pasa en la app | Acción de Apps Script |
|---|---|
| Al abrir, la ciudadanía recibe el registro sin "No legal" y **sin pasivos** | `publico` |
| Alguien denuncia (sin cuenta; foto opcional) | `denuncia` (valida largo y rango, campo trampa, límite por minuto y por dispositivo, y escribe en la hoja `Denuncias`) |
| El mapa público dibuja los puntos azules | `denunciasMapa` (solo código, lat, lng, tipo, día y estado resumido: nunca foto, descripción ni contacto) |
| Un funcionario ingresa y ve todo | `login`, `completo`, `denuncias` (lista completa), `foto` |
| Un funcionario atiende una denuncia o edita datos | `estadoDenuncia`, `guardar` |

El mapa se actualiza solo: al abrir, cada 60 segundos mientras la pestaña está visible, al volver la señal o la pestaña, y con el botón **Actualizar**. Una denuncia hecha sin señal queda "Sin enviar" (con su punto en el mapa de ese dispositivo) y se envía sola al volver la conexión. **Decisión de privacidad:** las coordenadas de las denuncias se publican exactas (es el lugar de la actividad que se vio) y sin ningún dato de la persona; si se prefiere más discreción, se pueden redondear en `listarDenunciasMapa_()` de `Codigo.gs`.
- **Instalar en el celular:** Configuración → *Instalar aplicación* (Android/Chrome/Edge) o instrucciones para iPhone (Safari → Compartir → Agregar a inicio). Requiere la página publicada por https (GitHub Pages); abierta como archivo no se instala.
- **Sin conexión:** `sw.js` guarda la app; abre sin señal con la última copia pública. Una denuncia hecha sin señal queda "Sin enviar" y se envía sola al volver la conexión. Al cambiar archivos, subir `VERSION` en `sw.js`.

## Detecciones revisadas (solo funcionarios)
Sección **Municipio → Detecciones revisadas**: muestra en un mapa (satélite Esri) y en una lista ordenable las zonas que una persona marcó como **"Parece actividad minera"** en el visor de imágenes satelitales (modelo de aprendizaje automático + revisión visual). Cada zona tiene una ficha con área, puntaje del modelo (relativo, no es una probabilidad), coordenadas, distancia al río y al poblado más cercano, la nota de quien revisó y, si existe, la opinión de Claude. Se puede descargar todo como **GeoJSON** o **CSV** (con BOM para Excel).

- **Lenguaje:** siempre "posible actividad minera, por verificar en campo". No indica legalidad ni presencia de mercurio, y el registro de la AJAM aún no se consultó.
- **Confidencialidad (decisión D-002):** son datos sensibles. La sección pertenece al grupo `tecnico`: sin sesión de funcionario no aparece en el menú, no se construye y su dirección (`#/deteccion`) lleva a Ingresar. **El repositorio no incluye ningún dato real**; el service worker tampoco guarda archivos `.geojson` ni `zonas-revisadas*`. Al cerrar sesión se limpia la pantalla, pero el archivo cargado sigue guardado en ese dispositivo hasta pulsar **Quitar las zonas de este dispositivo** (en un equipo compartido, quítelas antes de salir).
- **Cómo cargar los datos:**
  1. En el visor de imágenes se genera `zonas_confirmadas.geojson` (FeatureCollection de Polygon/MultiPolygon en WGS84, con `id` y propiedades como `area_ha`, `puntaje_modelo`, `poblado_cercano`, `dist_rio_m`, `fecha_revision`, `nota_revision`, `opinion_claude`).
  2. Ingrese como funcionario (demostración: `Aurum80` / `Aurum80`), abra **Detecciones revisadas** y pulse **Cargar archivo de zonas (GeoJSON)**. El archivo se valida: se ignoran las zonas sin geometría válida, sin `id` o con `id` repetido, y se muestra cuántas.
  3. Las zonas se guardan solo en este dispositivo (`localStorage`, clave `g4g_zonas_revisadas_v1`, cerca de 5 MB de límite; si no caben se avisa y se ven solo hasta recargar).
- **Alternativas (opcionales):** `G4G.config.deteccion.url` en `js/config/config.js` (por defecto vacía): si tiene la dirección de un GeoJSON accesible desde el navegador (con CORS), la sección lo descarga al abrirse sin datos o con el botón "Actualizar desde la dirección configurada". También puede definirse `window.G4G_ZONAS_REVISADAS` (FeatureCollection) en un archivo `js/data/zonas-revisadas.js` enlazado en `index.html`; **ese archivo no se crea ni se sube** mientras los datos sean confidenciales.

## Diseño
- **Tipografías del INE Bolivia**: Montserrat (títulos), Roboto (texto) y Roboto Condensed (cifras y rótulos). Se verificó en el HTML de ine.gob.bo (22-11-2026); gob.bo usa Open Sans. Están incluidas en `css/fonts/` (licencias SIL OFL / Apache 2.0), así que funcionan sin conexión.
- Estados con forma + color (círculo legal, triángulo en proceso, cuadrado no legal, anillo sin verificar).
- **Mapa base: Esri.** OpenStreetMap y CARTO no sirven al abrir el archivo localmente: no dan error, devuelven una imagen de aviso ("Access blocked" / "API KEY REQUIRED"). Si se publica en producción, revisar los términos de uso de Esri o conseguir una clave de un proveedor.

## Cómo usarlo
1. Descargue la carpeta (o clone el repositorio) y abra `index.html` con Chrome, Edge o Firefox.
2. Para publicarlo en GitHub: suba esta carpeta a un repositorio y active **Settings → Pages → Deploy from a branch** apuntando a la carpeta que contiene `index.html`. El archivo `.nojekyll` ya está incluido.
3. Para usar la base real: sección **Datos → Cargar Excel o CSV**. Use **Plantilla Excel** para ver el formato (hojas `Operadores` y `Pasivos`). Los encabezados se reconocen aunque cambien tildes, mayúsculas o espacios; los alias aceptados están en `js/config/config.js`. Los CSV pueden usar `;` y coma decimal (formato de Excel en español).
4. Para conectar la base en línea (solo lectura): Google Sheets → *Archivo → Compartir → Publicar en la Web → CSV*, o un CSV del repositorio (URL "raw"), y pegar la URL en **Datos**.

## Estructura modular
```
index.html
css/            base.css (diseño y estructura) · components.css · public.css (experiencia pública)
                fonts.css + fonts/ (tipografías del INE, incluidas)
js/config/      config.js   estados, requisitos, pesos del puntaje, alias de columnas
js/core/        app.js (módulos, rutas y grupos de menú) · store.js (datos) · importer.js (Excel/CSV)
                basemap.js (mapas base con respaldo) · hidro.js (ríos y canales)
                scoring.js (riesgo × valor) · ui.js · charts.js · util.js
js/data/        seed.js (datos simulados) · rios.js (ríos principales) · hidro-zona.js (detalle norte de La Paz)
backend/        Codigo.gs (Apps Script) · INSTRUCCIONES.md · plantilla-base-de-datos.xlsx · generar_plantilla.py
js/modules/     una sección por archivo: inicio, mapa, operadores (Consultar), denuncias (Denunciar),
                resumen, pasivos, datos, deteccion (Detecciones revisadas)
                detalle.js  fichas laterales (no es una sección)
js/vendor/      Leaflet (mapa) y SheetJS (lector de Excel), incluidos para uso sin conexión
```
**Agregar una sección:** crear `js/modules/<nombre>.js` con `G4G.app.register({ id, titulo, icono, orden, grupo: 'ciudadania' | 'tecnico', subtitulo, render(root) })` y añadir su `<script>` en `index.html`. **Quitar una:** borrar su línea. **Cambiar reglas** (requisitos, pesos, umbrales, precio de referencia): solo `config.js`.

## Modelo de puntaje (resumen)
- **Riesgo 0–100**: volumen, cercanía a río y a población, estado de la estructura, uso de mercurio, falta de responsable legal.
- **Valor (índice 0–100)**: volumen × densidad × ley × recuperación. **Sin ley medida no se inventa**: queda "sin dato" y se pide muestreo.
- Clasificación: Prioridad 1 · Muestreo urgente · Remediar · Oportunidad · Monitoreo. Nunca recomienda reprocesar: dice "evaluar" y recuerda licencia ambiental y control del mercurio.
- El satélite ubica pero **no mide mercurio**: el modelo usa indicadores indirectos. Las distancias a río y a población deben calcularse en el SIG (capas `rios` y `centros_poblados`) antes de cargarlas.

## Pendientes y límites conocidos
- Pesos, umbrales, densidad, recuperación y precio del oro son **supuestos de demostración**: validar con especialistas (nota V-003 en el vault).
- La lista de requisitos para regularizarse es un **ejemplo editable**; debe ajustarse a la normativa vigente.
- En modo demostración las denuncias se guardan en el navegador del dispositivo (límite del navegador, unas decenas de fotos reducidas) y no las ven otros dispositivos. Con el backend de Google Sheets sí (límites gratuitos de Apps Script; para producción a escala, un servidor institucional).
- Un usuario con conocimientos técnicos puede borrar los datos del navegador: no sustituye a un sistema con cuentas y respaldo.
- Solo tema claro.
- Probado con Edge (escritorio y emulación móvil). Falta probar en celulares reales y con el Excel real.
