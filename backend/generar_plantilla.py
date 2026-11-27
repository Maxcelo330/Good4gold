"""Genera backend/plantilla-base-de-datos.xlsx: la base de datos de referencia para la hoja de Google.

Uso (desde la carpeta del repositorio):
    python -I backend/generar_plantilla.py

Las pestañas y encabezados son EXACTAMENTE los que espera backend/Codigo.gs.
Todos los datos de las filas de ejemplo son SIMULADOS (inventados): borrelos antes de cargar datos reales.
"""
import os
from datetime import date
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

SALIDA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "plantilla-base-de-datos.xlsx")

REQ = ["derecho_minero", "licencia_ambiental", "registro_actividad", "nit", "plan_colas", "responsable_tecnico"]
CAB_OPERADORES = ["id", "nombre", "tipo", "estado_legal", "departamento", "municipio", "lat", "lng", "socios", "actualizado"] + ["req_" + r for r in REQ] + ["origen", "denuncia_codigo", "editado_por", "editado_en"]
CAB_PASIVOS = ["id", "operador_id", "nombre", "tipo", "lat", "lng", "volumen_m3", "dist_rio_m", "dist_poblado_m", "estructura", "uso_hg", "muestra", "ley_au_gt", "actualizado", "deteccion", "editado_por", "editado_en"]
CAB_DENUNCIAS = ["codigo", "id", "recibido", "creado", "tipo", "descripcion", "lat", "lng", "precision_m", "estado", "foto_id", "nota", "atendido_por", "atendido_en"]
CAB_USUARIOS = ["usuario", "nombre", "municipio", "rol", "activo", "clave_nueva", "hash", "sal", "ultimo_ingreso", "operador_id"]
CAB_MUESTRAS = ["id", "fecha", "pasivo_id", "operador_id", "lugar", "lat", "lng", "precision_m", "matriz", "volumen_m3", "hg2_ppb", "hg_total_ppb", "ch3hg_ppb", "nivel2", "semaforo", "lote_reactivo", "confirmado_lab", "foto_id", "notas", "tomada_por", "registrado_en"]
CAB_INSCRIPCIONES = ["id", "operador_id", "operador_nombre", "programa", "estado", "mensaje", "nota", "creado", "atendido_por", "atendido_en"]

ESTADOS_LEGALES = ["Legal", "En proceso", "No legal", "Sin verificar"]
TIPOS_OPERADOR = ["Cooperativa", "Empresa", "Asociación", "Planta de beneficio"]
TIPOS_PASIVO = ["Dique de colas", "Relave", "Desmonte", "Acumulación"]
ESTRUCTURAS = ["Estable", "Deterioro", "Crítica", "Desconocida"]
DETECCIONES = ["imagen satelital", "visita de campo", "denuncia"]
TIPOS_DENUNCIA = ["Posible operación sin registro o licencia", "Vertido de colas o relaves a un río", "Uso visible de mercurio", "Acumulación de colas sin control", "Otro"]
ESTADOS_DENUNCIA = ["nueva", "en_revision", "atendida", "descartada"]
ROLES = ["funcionario", "tecnico", "operador"]
MATRICES = ["agua", "lodo"]
SEMAFOROS = ["verde", "amarillo", "rojo"]
ESTADOS_INSCRIPCION = ["pendiente", "en_revision", "aceptada", "no_aplica"]
PROGRAMAS = ["biorremediacion"]

hoy = date(2026, 11, 22)


def d(dias_atras):
    return date.fromordinal(hoy.toordinal() - dias_atras)


# ---- Datos de ejemplo SIMULADOS, en el estilo de js/data/seed.js ----
# (id, nombre, tipo, estado, depto, municipio, lat, lng, socios, dias, requisitos[6] en si/no/'')
OPERADORES = [
    ("OP-001", "Cooperativa Demo 001 (simulado)", "Cooperativa", "Legal", "La Paz", "Guanay", -15.4327, -67.5026, 120, 30, ["si"] * 6),
    ("OP-002", "Empresa Demo 002 (simulado)", "Empresa", "Legal", "La Paz", "Tipuani", -15.5811, -67.7102, 48, 90, ["si", "si", "si", "si", "si", "no"]),
    ("OP-003", "Asociación Demo 003 (simulado)", "Asociación", "En proceso", "La Paz", "Mapiri", -15.3367, -68.1412, 74, 200, ["si", "no", "si", "si", "no", "si"]),
    ("OP-004", "Cooperativa Demo 004 (simulado)", "Cooperativa", "En proceso", "Beni", "Rurrenabaque", -14.4402, -67.5298, 36, 120, ["si", "no", "no", "si", "no", "no"]),
    ("OP-005", "Cooperativa Demo 005 (simulado)", "Cooperativa", "No legal", "La Paz", "Teoponte", -15.5002, -67.8305, 22, 15, ["no", "no", "no", "si", "no", "no"]),
    ("OP-006", "Planta de beneficio Demo 006 (simulado)", "Planta de beneficio", "No legal", "Oruro", "Poopó", -18.3601, -66.9604, 15, 60, ["no"] * 6),
    ("OP-007", "Asociación Demo 007 (simulado)", "Asociación", "Sin verificar", "Potosí", "Llallagua", -19.6204, -65.8403, 60, 500, [""] * 6),
    ("OP-008", "Empresa Demo 008 (simulado)", "Empresa", "Sin verificar", "Pando", "Porvenir", -11.1003, -68.6204, 12, 640, [""] * 6),
]
# (id, operador_id, nombre, tipo, lat, lng, vol, dist_rio, dist_pob, estructura, uso_hg, muestra, ley, dias, deteccion)
PASIVOS = [
    ("PA-001", "OP-005", "Dique de colas Demo 01 (simulado)", "Dique de colas", -15.5102, -67.8203, 85000, 60, 900, "Crítica", "si", "si", 2.4, 20, "imagen satelital"),
    ("PA-002", "OP-005", "Relave Demo 02 (simulado)", "Relave", -15.4903, -67.8401, 32000, 120, 1500, "Deterioro", "si", "no", "", 45, "visita de campo"),
    ("PA-003", "OP-006", "Desmonte Demo 03 (simulado)", "Desmonte", -18.3702, -66.9502, 150000, 800, 2500, "Estable", "desconocido", "no", "", 300, "imagen satelital"),
    ("PA-004", "OP-003", "Acumulación Demo 04 (simulado)", "Acumulación", -15.3401, -68.1304, 9000, 300, 4000, "Estable", "no", "si", 0.9, 150, "visita de campo"),
    ("PA-005", "OP-001", "Dique de colas Demo 05 (simulado)", "Dique de colas", -15.4401, -67.4903, 60000, 250, 1200, "Deterioro", "si", "si", 3.1, 70, "denuncia"),
    ("PA-006", "", "Relave Demo 06 sin responsable (simulado)", "Relave", -15.2104, -67.9102, 21000, 45, 700, "Desconocida", "desconocido", "no", "", 25, "imagen satelital"),
]
# (codigo, id, dias_recibido, tipo, descripcion, lat, lng, precision, estado, nota)
DENUNCIAS = [
    ("DEN-DEMO01", "DEMO-0001", 6, TIPOS_DENUNCIA[0], "SIMULADO: maquinaria trabajando cerca del río.", -15.5052, -67.8253, 12, "nueva", ""),
    ("DEN-DEMO02", "DEMO-0002", 4, TIPOS_DENUNCIA[1], "SIMULADO: agua turbia aguas abajo.", -16.9500, -64.2000, 25, "en_revision", "SIMULADO: visita programada"),
    ("DEN-DEMO03", "DEMO-0003", 2, TIPOS_DENUNCIA[2], "SIMULADO: quema de amalgama a la vista.", -14.4452, -67.5348, 8, "atendida", "SIMULADO: inspeccionada"),
]
# (usuario, nombre, municipio, rol, activo, clave_nueva, hash, sal, ultimo_ingreso, operador_id)
# Cuentas de DEMOSTRACION: cambie las claves (o ponga activo = no) antes de usar datos reales.
USUARIOS = [
    ("Aurum80", "Funcionario municipal (simulado)", "Mapiri", "funcionario", "si", "Aurum80", "", "", "", ""),
    ("Campo80", "Técnico de campo (simulado)", "Mapiri", "tecnico", "si", "Campo80", "", "", "", ""),
    ("Coop80", "Cooperativa de prueba (simulado)", "Mapiri", "operador", "si", "Coop80", "", "", "", "OP-003"),
]
# (id, dias_atras, pasivo_id, operador_id, lugar, lat, lng, precision, matriz, vol, hg2, hgt, ch3, nivel2, semaforo, lote, confirmado, notas)
MUESTRAS = [
    ("MU-DEMO01", 12, "PA-004", "OP-003", "Punto de descarga Demo A (simulado)", -15.3402, -68.1305, 10, "agua", 0.5, 0.8, "", "", "no", "verde", "LOTE-DEMO-1", "no", "SIMULADO: tamizaje colorimétrico de ejemplo."),
    ("MU-DEMO02", 8, "PA-005", "OP-001", "Borde del dique Demo B (simulado)", -15.4402, -67.4904, 15, "agua", 2.0, 4.5, 6.0, "", "si", "amarillo", "LOTE-DEMO-1", "no", "SIMULADO: pendiente de confirmar en laboratorio."),
    ("MU-DEMO03", 3, "PA-001", "OP-005", "Lodo del dique Demo C (simulado)", -15.5103, -67.8204, 8, "lodo", 1.2, 38.0, 55.0, 1.1, "si", "rojo", "LOTE-DEMO-2", "si", "SIMULADO: valor inventado solo para probar la hoja."),
]
# (id, operador_id, operador_nombre, programa, estado, mensaje, nota, dias_creado, atendido_por, dias_atendido)
INSCRIPCIONES = [
    ("IN-001", "OP-003", "Asociación Demo 003 (simulado)", "biorremediacion", "pendiente", "SIMULADO: queremos participar en el programa.", "", 5, "", None),
    ("IN-002", "OP-004", "Cooperativa Demo 004 (simulado)", "biorremediacion", "en_revision", "SIMULADO: solicitud de ejemplo.", "SIMULADO: se pidió documentación.", 9, "Aurum80", 6),
    ("IN-003", "OP-001", "Cooperativa Demo 001 (simulado)", "biorremediacion", "aceptada", "SIMULADO: solicitud de ejemplo.", "SIMULADO: aceptada.", 20, "Aurum80", 15),
]

AZUL = "1F4E9C"
ENC = Font(bold=True, color="FFFFFF")
RELLENO_ENC = PatternFill("solid", fgColor="1D1B18")
RELLENO_OPC = PatternFill("solid", fgColor="76726A")       # columnas que rellena el script, no la persona
BORDE = Border(bottom=Side(style="thin", color="DCD5C7"))


def hoja(wb, nombre, cabeceras, filas, anchos, automaticas=()):
    ws = wb.create_sheet(nombre)
    ws.append(cabeceras)
    for f in filas:
        ws.append(list(f))
    for i, c in enumerate(cabeceras, 1):
        celda = ws.cell(row=1, column=i)
        celda.font = ENC
        celda.fill = RELLENO_OPC if c in automaticas else RELLENO_ENC
        celda.alignment = Alignment(vertical="center", wrap_text=True)
        ws.column_dimensions[get_column_letter(i)].width = anchos.get(c, 16)
    ws.row_dimensions[1].height = 30
    ws.freeze_panes = "A2"
    ws.sheet_properties.tabColor = AZUL
    return ws


def lista(ws, cab, cabeceras, opciones, fin=2000, permitir_vacio=True):
    col = get_column_letter(cabeceras.index(cab) + 1)
    dv = DataValidation(type="list", formula1='"' + ",".join(opciones) + '"', allow_blank=permitir_vacio, showErrorMessage=True,
                        errorTitle="Valor no permitido", error="Elija un valor de la lista: " + ", ".join(opciones))
    ws.add_data_validation(dv)
    dv.add(f"{col}2:{col}{fin}")


def lista_ref(ws, cab, cabeceras, hoja_ref, mensaje, fin=2000):
    """Lista desplegable con los ids de otra pestaña (columna A). Es solo un aviso: permite escribir otro valor."""
    col = get_column_letter(cabeceras.index(cab) + 1)
    dv = DataValidation(type="list", formula1=f"={hoja_ref}!$A$2:$A$2000", allow_blank=True, showErrorMessage=True, errorStyle="warning",
                        errorTitle="Id no encontrado", error=mensaje)
    ws.add_data_validation(dv)
    dv.add(f"{col}2:{col}{fin}")


def numero(ws, cab, cabeceras, minimo, maximo, fin=2000, mensaje=""):
    col = get_column_letter(cabeceras.index(cab) + 1)
    dv = DataValidation(type="decimal", operator="between", formula1=str(minimo), formula2=str(maximo), allow_blank=True, showErrorMessage=True,
                        errorTitle="Número fuera de rango", error=mensaje or f"Escriba un número entre {minimo} y {maximo}.")
    ws.add_data_validation(dv)
    dv.add(f"{col}2:{col}{fin}")


def fechas(ws, cabeceras, *cols):
    for c in cols:
        j = cabeceras.index(c) + 1
        for fila in range(2, ws.max_row + 1):
            ws.cell(row=fila, column=j).number_format = "yyyy-mm-dd"


def construir():
    wb = Workbook()
    wb.remove(wb.active)

    # ---------- Leeme ----------
    L = wb.create_sheet("Leeme")
    L.sheet_properties.tabColor = "B07D14"
    L.column_dimensions["A"].width = 26
    L.column_dimensions["B"].width = 118
    filas = [
        ("BASE DE DATOS DE REFERENCIA: Aurum80", None),
        ("Qué es", "Libro de referencia con las pestañas y columnas EXACTAS que espera backend/Codigo.gs. Todas las filas de ejemplo son SIMULADAS (inventadas, ninguna representa a una cooperativa real): bórrelas antes de cargar datos reales."),
        ("Cómo se usa", "1) Súbalo a Google Drive y ábralo con Hojas de cálculo de Google. 2) Extensiones > Apps Script: pegue backend/Codigo.gs y ejecute configurar() (acepte los permisos). Guía completa: backend/INSTRUCCIONES.md."),
        ("Reglas generales", "No cambie los nombres de las pestañas ni la fila 1 (encabezados). Puede agregar columnas a la derecha; el sistema ignora las que no conoce. Una fila = un registro. Coordenadas en grados decimales: en Bolivia la latitud y la longitud son NEGATIVAS (ej. -15.43274 y -67.50264). Use punto decimal."),
        ("Esta pestaña (Leeme)", "Solo es una explicación: puede borrarla en la hoja de Google sin afectar nada."),
        (None, None),
        ("PESTAÑA Operadores", "Una fila por cooperativa, empresa, asociación o planta. Es lo que consulta la ciudadanía (excepto los 'No legal', que solo ve un funcionario)."),
        ("id", "Código único. Formato sugerido OP-001. Si se registra desde la app sin id, el sistema lo crea."),
        ("nombre", "Nombre del operador. Obligatorio."),
        ("tipo", "Cooperativa | Empresa | Asociación | Planta de beneficio."),
        ("estado_legal", "Legal | En proceso | No legal | Sin verificar. Obligatorio. 'No legal' NUNCA se envía al público: el servidor lo filtra. Lo vacío se toma como 'Sin verificar'. Solo el funcionario puede cambiarlo desde la app."),
        ("departamento, municipio", "Texto libre (ej. La Paz / Mapiri)."),
        ("lat, lng", "Latitud y longitud en grados decimales, dentro de Bolivia. Obligatorias para verse en el mapa."),
        ("socios", "Número de socios (opcional)."),
        ("actualizado", "Fecha de la última verificación (AAAA-MM-DD). Pasados 365 días se marca como desactualizado."),
        ("req_*", "Requisitos para operar: req_derecho_minero, req_licencia_ambiental, req_registro_actividad, req_nit, req_plan_colas, req_responsable_tecnico. Valores: si | no | vacío (sin verificar). Solo el funcionario los cambia desde la app; el operador ve el estado de los suyos."),
        ("origen", "Cómo nació la fila. 'denuncia' = punto por verificar creado al ACEPTAR una denuncia (aceptarDenuncia); vacío = registrado a mano. La fija el sistema: no se puede editar desde la app."),
        ("denuncia_codigo", "Código (DEN-XXXXXX) de la denuncia que originó la fila; evita crear dos puntos de la misma denuncia. Es interno: el público y los operadores nunca lo reciben."),
        ("editado_por, editado_en", "Las llena el sistema al registrar o editar desde la app. No las escriba a mano."),
        (None, None),
        ("PESTAÑA Pasivos", "Colas, relaves, desmontes y acumulaciones. SOLO los ven los funcionarios: el público nunca los recibe (ni el servidor se los envía)."),
        ("id", "Código único. Formato sugerido PA-001."),
        ("operador_id", "id del operador responsable (de la pestaña Operadores). Vacío = sin responsable identificado."),
        ("nombre", "Nombre del sitio."),
        ("tipo", "Dique de colas | Relave | Desmonte | Acumulación."),
        ("lat, lng", "Coordenadas del sitio (grados decimales, negativas en Bolivia). Obligatorias."),
        ("volumen_m3", "Volumen estimado en metros cúbicos."),
        ("dist_rio_m, dist_poblado_m", "Distancia al río y al poblado más cercano, en metros (calculada en el SIG)."),
        ("estructura", "Estable | Deterioro | Crítica | Desconocida."),
        ("uso_hg", "Uso de mercurio: si | no | desconocido."),
        ("muestra", "¿Se tomó muestra? si | no. El sistema pone 'si' al registrar una muestra de este pasivo (pestaña Muestras)."),
        ("ley_au_gt", "Ley de oro en gramos por tonelada. Vacío = sin medir (no se inventa)."),
        ("actualizado", "Fecha de la última actualización (AAAA-MM-DD)."),
        ("deteccion", "Cómo se detectó: imagen satelital | visita de campo | denuncia."),
        ("editado_por, editado_en", "Las llena el sistema."),
        (None, None),
        ("PESTAÑA Denuncias", "La llena el sistema cuando alguien denuncia desde la app (el funcionario cambia estado y nota, o la ACEPTA y se crea un punto por verificar en Operadores). El técnico y el operador no la ven. Si no existe, configurar() la crea."),
        ("codigo, id", "Código corto de seguimiento (DEN-XXXXXX) e identificador único de la denuncia. El código es el único dato de la denuncia que ve el público."),
        ("recibido, creado", "Cuándo llegó a la hoja y cuándo se hizo en el celular."),
        ("tipo, descripcion", "Qué se observó. La descripción es texto libre y NO se muestra al público."),
        ("lat, lng, precision_m", "Ubicación marcada (coordenadas exactas) y precisión del GPS en metros."),
        ("estado", "nueva | en_revision | atendida | descartada. Público: nueva y en_revision se ven como 'Recibida', atendida como 'Atendida', descartada no se muestra. Funcionarios: en_revision se dibuja en rojo."),
        ("foto_id", "Id del archivo de la foto en la carpeta privada de Drive. No se muestra al público."),
        ("nota, atendido_por, atendido_en", "Seguimiento interno del funcionario."),
        ("Mapa público", "El mapa público de denuncias recibe SOLO: código, lat, lng, tipo, fecha (día) y estado resumido. Nunca la foto, la descripción, la nota ni quién la atendió."),
        (None, None),
        ("PESTAÑA Usuarios", "Personas que pueden ingresar a la app. Una fila por persona. Hay 3 roles y el servidor verifica el rol en CADA acción: ocultar un botón en la app no es la protección."),
        ("usuario", "Nombre de usuario (no distingue mayúsculas: Aurum80 = aurum80)."),
        ("nombre, municipio", "Cómo se muestra en la app."),
        ("rol", "funcionario | tecnico | operador. FUNCIONARIO (autoridad): ve y hace todo (base completa, denuncias, aceptar denuncias, muestras, inscripciones). TECNICO (campo): ve la base completa, registra datos y muestras, pero NO cambia estado_legal ni req_* de un operador, NO ve las denuncias ni sus fotos y NO gestiona inscripciones. OPERADOR (cooperativa o empresa): solo ve la ficha de SU propio operador, el estado de sus requisitos y sus inscripciones, y puede solicitar inscribirse a un programa. Nunca ve a otros operadores, pasivos ni muestras."),
        ("operador_id", "OBLIGATORIO si el rol es operador: debe ser el id de una fila existente de la pestaña Operadores (ej. OP-003). Sin él, esa cuenta no puede ingresar. Para funcionario y tecnico se deja vacío."),
        ("activo", "si | no. Con 'no' pierde el acceso."),
        ("clave_nueva", "Escriba aquí la clave (mínimo 6 caracteres). Al ejecutar configurar() o procesarClaves() (o al editar la celda) el script la CIFRA en hash + sal y VACÍA esta celda. Nunca queda la clave escrita."),
        ("Cuentas de demostración", "Las filas de ejemplo traen Aurum80 / Aurum80 (funcionario), Campo80 / Campo80 (tecnico) y Coop80 / Coop80 (operador, vinculada a OP-003). Sus claves son públicas (están en el código en GitHub): SOLO para la demostración. Cámbielas o ponga activo = no antes de usar datos reales."),
        ("hash, sal, ultimo_ingreso", "Las llena el sistema. No las toque."),
        (None, None),
        ("PESTAÑA Muestras", "Muestras de campo (tamizaje colorimétrico) que registran el funcionario o el técnico. SOLO las ven funcionarios y técnicos: el público y los operadores nunca las reciben. La crea configurar() si falta. Si la muestra indica un pasivo_id conocido, el sistema pone muestra = si en ese pasivo."),
        ("id, fecha", "Código único de la muestra (MU-XXXXXXXX; si el celular reintenta el envío con el mismo id no se duplica) y fecha de la toma."),
        ("pasivo_id, operador_id", "Opcionales. id del pasivo (pestaña Pasivos) y del operador (pestaña Operadores) al que corresponde la muestra."),
        ("lugar", "Descripción corta del lugar de toma (texto libre)."),
        ("lat, lng, precision_m", "Ubicación de la toma (grados decimales dentro de Bolivia, negativas) y precisión del GPS en metros."),
        ("matriz", "agua | lodo."),
        ("volumen_m3", "Volumen de la fuente en metros cúbicos (opcional)."),
        ("hg2_ppb, hg_total_ppb, ch3hg_ppb", "Mercurio en ppb: Hg2+ (obligatorio, mayor o igual a 0), mercurio total y metilmercurio (opcionales). Vacío = no medido."),
        ("nivel2", "si | no. Si se hizo la segunda prueba del tamizaje."),
        ("semaforo", "verde | amarillo | rojo. Resultado del tamizaje: es una orientación de campo, no un resultado de laboratorio."),
        ("lote_reactivo", "Lote del reactivo usado (trazabilidad)."),
        ("confirmado_lab", "si | no. Si un laboratorio confirmó el resultado."),
        ("foto_id", "Id de la foto en la carpeta privada de Drive. La llena el sistema."),
        ("notas", "Observaciones (texto libre)."),
        ("tomada_por, registrado_en", "Usuario que registró la muestra y cuándo. Las llena el sistema."),
        (None, None),
        ("PESTAÑA Inscripciones", "Solicitudes de cooperativas o empresas (rol operador) para participar en un programa. La crea configurar() si falta. El funcionario las ve y cambia su estado; cada operador ve únicamente las suyas."),
        ("id", "Código único (IN-001). Lo crea el sistema."),
        ("operador_id, operador_nombre", "Operador que solicita (id y nombre al momento de solicitar). Salen de la cuenta, no de lo que envíe el cliente."),
        ("programa", "biorremediacion (por ahora el único programa)."),
        ("estado", "pendiente | en_revision | aceptada | no_aplica. Un operador no puede tener dos solicitudes activas (pendiente, en_revision o aceptada) del mismo programa."),
        ("mensaje", "Mensaje opcional del operador al solicitar."),
        ("nota", "Respuesta o seguimiento del funcionario; el operador la ve en su ficha."),
        ("creado, atendido_por, atendido_en", "Fecha de la solicitud y quién y cuándo cambió el estado. Las llena el sistema."),
        (None, None),
        ("Colores de la app", "Verde = legal; amarillo = en proceso; azul = denuncia; rojo = no legal o denuncia para verificar (solo funcionarios); violeta (hexágono) = pasivos (solo funcionarios)."),
    ]
    for a, b in filas:
        L.append([a, b])
    L["A1"].font = Font(bold=True, size=14, color=AZUL)
    for fila in L.iter_rows(min_row=2):
        a, b = fila
        b.alignment = Alignment(wrap_text=True, vertical="top")
        a.alignment = Alignment(wrap_text=True, vertical="top")
        if a.value and a.value.startswith("PESTAÑA"):
            a.font = Font(bold=True, color="FFFFFF"); a.fill = RELLENO_ENC
            b.fill = RELLENO_ENC; b.font = Font(color="FFFFFF")
        elif a.value:
            a.font = Font(bold=True)

    # ---------- Operadores ----------
    filas_op = [(i, n, t, e, de, mu, la, lo, so, d(di), *rq, "", "", "", "") for (i, n, t, e, de, mu, la, lo, so, di, rq) in OPERADORES]
    ws = hoja(wb, "Operadores", CAB_OPERADORES, filas_op, {"nombre": 38, "tipo": 20, "estado_legal": 16, "departamento": 14, "municipio": 16, "lat": 12, "lng": 12, "actualizado": 13, "origen": 12, "denuncia_codigo": 16,
              **{"req_" + r: 14 for r in REQ}}, automaticas=("origen", "denuncia_codigo", "editado_por", "editado_en"))
    lista(ws, "estado_legal", CAB_OPERADORES, ESTADOS_LEGALES, permitir_vacio=False)
    lista(ws, "tipo", CAB_OPERADORES, TIPOS_OPERADOR)
    for r in REQ:
        lista(ws, "req_" + r, CAB_OPERADORES, ["si", "no"])
    numero(ws, "lat", CAB_OPERADORES, -23.5, -9, mensaje="La latitud de Bolivia es negativa, entre -23.5 y -9 (ej. -15.43274).")
    numero(ws, "lng", CAB_OPERADORES, -70, -57, mensaje="La longitud de Bolivia es negativa, entre -70 y -57 (ej. -67.50264).")
    fechas(ws, CAB_OPERADORES, "actualizado")

    # ---------- Pasivos ----------
    filas_pa = [(i, op, n, t, la, lo, vol, dr, dp, es, hg, mu, ley, d(di), de, "", "") for (i, op, n, t, la, lo, vol, dr, dp, es, hg, mu, ley, di, de) in PASIVOS]
    ws = hoja(wb, "Pasivos", CAB_PASIVOS, filas_pa, {"nombre": 40, "tipo": 16, "operador_id": 12, "estructura": 14, "deteccion": 17, "actualizado": 13}, automaticas=("editado_por", "editado_en"))
    lista(ws, "tipo", CAB_PASIVOS, TIPOS_PASIVO)
    lista(ws, "estructura", CAB_PASIVOS, ESTRUCTURAS)
    lista(ws, "uso_hg", CAB_PASIVOS, ["si", "no", "desconocido"])
    lista(ws, "muestra", CAB_PASIVOS, ["si", "no"])
    lista(ws, "deteccion", CAB_PASIVOS, DETECCIONES)
    numero(ws, "lat", CAB_PASIVOS, -23.5, -9, mensaje="La latitud de Bolivia es negativa, entre -23.5 y -9.")
    numero(ws, "lng", CAB_PASIVOS, -70, -57, mensaje="La longitud de Bolivia es negativa, entre -70 y -57.")
    fechas(ws, CAB_PASIVOS, "actualizado")

    # ---------- Denuncias ----------
    filas_de = [(c, i, d(di), d(di), t, desc, la, lo, pr, es, "", nota, "", "") for (c, i, di, t, desc, la, lo, pr, es, nota) in DENUNCIAS]
    ws = hoja(wb, "Denuncias", CAB_DENUNCIAS, filas_de, {"codigo": 14, "id": 14, "recibido": 13, "creado": 13, "tipo": 38, "descripcion": 44, "estado": 13, "nota": 32, "atendido_por": 14, "atendido_en": 13},
              automaticas=("codigo", "id", "recibido", "creado", "tipo", "descripcion", "lat", "lng", "precision_m", "foto_id"))
    lista(ws, "estado", CAB_DENUNCIAS, ESTADOS_DENUNCIA, permitir_vacio=False)
    fechas(ws, CAB_DENUNCIAS, "recibido", "creado", "atendido_en")

    # ---------- Usuarios ----------
    ws = hoja(wb, "Usuarios", CAB_USUARIOS, USUARIOS, {"nombre": 32, "municipio": 14, "rol": 14, "clave_nueva": 16, "hash": 22, "sal": 22, "ultimo_ingreso": 16, "operador_id": 14}, automaticas=("hash", "sal", "ultimo_ingreso"))
    lista(ws, "activo", CAB_USUARIOS, ["si", "no"], permitir_vacio=False)
    lista(ws, "rol", CAB_USUARIOS, ROLES, permitir_vacio=False)
    lista_ref(ws, "operador_id", CAB_USUARIOS, "Operadores", "Escriba el id de un operador de la pestaña Operadores (ej. OP-003). Es obligatorio para el rol operador.")

    # ---------- Muestras ----------
    filas_mu = [(i, d(di), pa, op, lu, la, lo, pr, ma, vo, h2, ht, c3, n2, se, lote, cf, "", nota, "Campo80", d(di)) for (i, di, pa, op, lu, la, lo, pr, ma, vo, h2, ht, c3, n2, se, lote, cf, nota) in MUESTRAS]
    ws = hoja(wb, "Muestras", CAB_MUESTRAS, filas_mu, {"id": 12, "fecha": 12, "pasivo_id": 11, "operador_id": 12, "lugar": 34, "lat": 11, "lng": 11, "matriz": 9, "semaforo": 10, "lote_reactivo": 14, "notas": 40, "tomada_por": 13, "registrado_en": 13},
              automaticas=("foto_id", "tomada_por", "registrado_en"))
    lista(ws, "matriz", CAB_MUESTRAS, MATRICES, permitir_vacio=False)
    lista(ws, "semaforo", CAB_MUESTRAS, SEMAFOROS, permitir_vacio=False)
    lista(ws, "nivel2", CAB_MUESTRAS, ["si", "no"])
    lista(ws, "confirmado_lab", CAB_MUESTRAS, ["si", "no"])
    lista_ref(ws, "pasivo_id", CAB_MUESTRAS, "Pasivos", "Escriba el id de un pasivo de la pestaña Pasivos (ej. PA-001) o deje vacío.")
    lista_ref(ws, "operador_id", CAB_MUESTRAS, "Operadores", "Escriba el id de un operador de la pestaña Operadores (ej. OP-003) o deje vacío.")
    numero(ws, "lat", CAB_MUESTRAS, -23.5, -9, mensaje="La latitud de Bolivia es negativa, entre -23.5 y -9.")
    numero(ws, "lng", CAB_MUESTRAS, -70, -57, mensaje="La longitud de Bolivia es negativa, entre -70 y -57.")
    for c in ("hg2_ppb", "hg_total_ppb", "ch3hg_ppb", "volumen_m3", "precision_m"):
        numero(ws, c, CAB_MUESTRAS, 0, 1000000, mensaje="Escriba un número mayor o igual a 0 (no se aceptan valores negativos).")
    fechas(ws, CAB_MUESTRAS, "fecha", "registrado_en")

    # ---------- Inscripciones ----------
    filas_in = [(i, op, nom, pr, es, me, nota, d(dc), por, d(da) if da is not None else "") for (i, op, nom, pr, es, me, nota, dc, por, da) in INSCRIPCIONES]
    ws = hoja(wb, "Inscripciones", CAB_INSCRIPCIONES, filas_in, {"id": 10, "operador_id": 12, "operador_nombre": 34, "programa": 16, "estado": 13, "mensaje": 40, "nota": 34, "creado": 12, "atendido_por": 14, "atendido_en": 13},
              automaticas=("id", "operador_id", "operador_nombre", "mensaje", "creado"))
    lista(ws, "estado", CAB_INSCRIPCIONES, ESTADOS_INSCRIPCION, permitir_vacio=False)
    lista(ws, "programa", CAB_INSCRIPCIONES, PROGRAMAS, permitir_vacio=False)
    fechas(ws, CAB_INSCRIPCIONES, "creado", "atendido_en")

    wb.move_sheet("Leeme", offset=len(wb.sheetnames))   # Leeme al final, para que la hoja de Google abra en Operadores
    wb.active = wb.sheetnames.index("Operadores")
    return wb


if __name__ == "__main__":
    wb = construir()
    wb.save(SALIDA)
    print("Guardado:", SALIDA)
    print("Pestañas:", ", ".join(wb.sheetnames))
