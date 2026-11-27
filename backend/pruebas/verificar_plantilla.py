"""Comprueba que la plantilla xlsx tiene las pestañas y encabezados que espera Codigo.gs.

Uso (desde la raiz del repositorio):
    python -I backend/pruebas/verificar_plantilla.py
"""
import os
import re
import sys
from openpyxl import load_workbook

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GS = open(os.path.join(RAIZ, "Codigo.gs"), encoding="utf-8").read()
wb = load_workbook(os.path.join(RAIZ, "plantilla-base-de-datos.xlsx"))


def arreglo(nombre):
    m = re.search(r"var\s+" + nombre + r"\s*=\s*\[([^\]]*)\]", GS)
    if not m:
        raise SystemExit("No se encontro " + nombre + " en Codigo.gs")
    return re.findall(r"'([^']*)'", m.group(1))


def cabecera(hoja):
    return [str(c.value).strip() for c in wb[hoja][1] if c.value is not None]


errores = []
# hoja -> constante de Codigo.gs (comparacion exacta y en el mismo orden)
for hoja, const in [("Denuncias", "CAB_DENUNCIAS"), ("Usuarios", "CAB_USUARIOS"), ("Muestras", "CAB_MUESTRAS"), ("Inscripciones", "CAB_INSCRIPCIONES")]:
    esperado, real = arreglo(const), cabecera(hoja)
    estado = "OK " if esperado == real else "DIFIERE"
    print(f"{estado} {hoja} == {const} ({len(real)} columnas)")
    if esperado != real:
        errores.append(hoja)
        print("   Codigo.gs:", esperado)
        print("   xlsx     :", real)

# Operadores: las columnas extra que agrega Codigo.gs deben estar en la plantilla
extra = arreglo("CAB_OPERADORES_EXTRA")
op = cabecera("Operadores")
faltan = [k for k in extra + ["id", "nombre", "estado_legal", "lat", "lng", "editado_por", "editado_en"] if k not in op]
print(("OK " if not faltan else "FALTAN ") + "Operadores contiene " + ", ".join(extra) + " (y las columnas base)" + ("" if not faltan else ": " + ", ".join(faltan)))
if faltan:
    errores.append("Operadores")
pa = cabecera("Pasivos")
faltan = [k for k in ["id", "lat", "lng", "muestra"] if k not in pa]
print(("OK " if not faltan else "FALTAN ") + "Pasivos contiene id, lat, lng, muestra")
if faltan:
    errores.append("Pasivos")

# Pestañas que usa HOJAS
hojas = re.findall(r":\s*'([A-Za-z]+)'", re.search(r"var\s+HOJAS\s*=\s*\{([^}]*)\}", GS).group(1))
sin = [h for h in hojas if h not in wb.sheetnames]
print(("OK " if not sin else "FALTAN ") + "pestanas de HOJAS: " + ", ".join(hojas))
if sin:
    errores.append("pestanas")

# Listas de validacion pedidas
def listas(hoja):
    out = {}
    for dv in wb[hoja].data_validations.dataValidation:
        if dv.type == "list":
            for rango in str(dv.sqref).split():
                out[re.match(r"[A-Z]+", rango).group(0)] = dv.formula1
    return out

from openpyxl.utils import get_column_letter
def lista_de(hoja, cab):
    col = get_column_letter(cabecera(hoja).index(cab) + 1)
    return listas(hoja).get(col)

esperadas = [("Muestras", "matriz", '"agua,lodo"'), ("Muestras", "semaforo", '"verde,amarillo,rojo"'), ("Muestras", "nivel2", '"si,no"'),
             ("Muestras", "confirmado_lab", '"si,no"'), ("Inscripciones", "estado", '"pendiente,en_revision,aceptada,no_aplica"'),
             ("Inscripciones", "programa", '"biorremediacion"'), ("Usuarios", "rol", '"funcionario,tecnico,operador"')]
for hoja, cab, f in esperadas:
    real = lista_de(hoja, cab)
    print(("OK " if real == f else "DIFIERE ") + f"validacion {hoja}.{cab} = {real}")
    if real != f:
        errores.append(hoja + "." + cab)

# Usuarios de ejemplo
filas = {r[0].value: [c.value for c in r] for r in wb["Usuarios"].iter_rows(min_row=2)}
cab = cabecera("Usuarios")
for u, rol, opid in [("Aurum80", "funcionario", None), ("Campo80", "tecnico", None), ("Coop80", "operador", "OP-003")]:
    f = dict(zip(cab, filas.get(u, [])))
    ok = f.get("rol") == rol and (f.get("operador_id") or None) == opid
    print(("OK " if ok else "FALLA ") + f"usuario {u}: rol={f.get('rol')} operador_id={f.get('operador_id')}")
    if not ok:
        errores.append(u)

for hoja in ("Muestras", "Inscripciones"):
    filas_h = [[str(c.value) for c in r] for r in wb[hoja].iter_rows(min_row=2)]
    sin_rotulo = [f[0] for f in filas_h if not any("simulado" in x.lower() for x in f)]
    print(("OK " if not sin_rotulo else "FALTA rotulo ") + f"{hoja}: {len(filas_h)} filas de ejemplo rotuladas como simuladas" + ("" if not sin_rotulo else " (sin rotulo: " + ", ".join(sin_rotulo) + ")"))
    if sin_rotulo:
        errores.append(hoja)

print("Pestanas:", ", ".join(wb.sheetnames))
print("RESULTADO:", "CORRECTO" if not errores else "ERRORES en " + ", ".join(errores))
sys.exit(1 if errores else 0)
