"""Genera los iconos PNG de Aurum80 (app principal y variante Campo).

Uso (desde la raiz del repo):  python scripts/generar_iconos.py
Requiere Pillow. Las formas replican icons/logo-aurum80.svg (viewBox 100x100):
aro dorado, "A" en tinta/papel y pepita dorada como travesano.
"""
from pathlib import Path
from PIL import Image, ImageDraw

RAIZ = Path(__file__).resolve().parent.parent
SS = 4  # supermuestreo

PAPEL = "#F3EFE7"
TINTA = "#1D1B18"
ORO = "#B07D14"
ORO_CLARO = "#D9A431"  # oro un poco mas vivo sobre fondo oscuro


def marca(d, cx, cy, u, c_aro, c_a, c_pepita):
    """Dibuja la marca centrada en (cx, cy); u = pixeles por unidad del viewBox 100."""
    def p(x, y):
        return (cx + (x - 50) * u, cy + (y - 50) * u)

    # Aro: circulo r=40, trazo 8
    r_ext, r_int = 44 * u, 36 * u
    d.ellipse([cx - r_ext, cy - r_ext, cx + r_ext, cy + r_ext], fill=c_aro)
    d.ellipse([cx - r_int, cy - r_int, cx + r_int, cy + r_int], fill=d._fondo)
    # A: trazo 9, extremos redondeados
    w = 9 * u
    pts = [p(31, 70), p(50, 28), p(69, 70)]
    d.line(pts, fill=c_a, width=round(w), joint="curve")
    for x, y in pts:
        d.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=c_a)
    # Pepita
    x, y = p(50, 59)
    rr = 5.5 * u
    d.ellipse([x - rr, y - rr, x + rr, y + rr], fill=c_pepita)


def insignia_ubicacion(d, cx, cy, r, c_fondo, c_pin, c_agujero):
    """Insignia circular con un marcador de ubicacion (gota con punto)."""
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=c_fondo)
    pr = r * 0.42
    py = cy - r * 0.12
    d.ellipse([cx - pr, py - pr, cx + pr, py + pr], fill=c_pin)
    d.polygon([(cx - pr * 0.86, py + pr * 0.5), (cx + pr * 0.86, py + pr * 0.5),
               (cx, cy + r * 0.62)], fill=c_pin)
    hr = pr * 0.4
    d.ellipse([cx - hr, py - hr, cx + hr, py + hr], fill=c_agujero)


def render(tam, fondo, aro, a, pepita, escala, campo=False):
    """escala = diametro exterior del aro / lado del lienzo."""
    n = tam * SS
    img = Image.new("RGB", (n, n), fondo)
    d = ImageDraw.Draw(img)
    d._fondo = fondo
    u = (n * escala) / 88.0  # el aro mide 88 unidades de diametro exterior
    marca(d, n / 2, n / 2, u, aro, a, pepita)
    if campo:
        ang = 0.7071
        dist = 44 * u * ang * 1.02
        insignia_ubicacion(d, n / 2 + dist, n / 2 + dist, 14 * u, ORO_CLARO, TINTA, ORO_CLARO)
    return img.resize((tam, tam), Image.LANCZOS)


def generar(carpeta, campo):
    carpeta.mkdir(parents=True, exist_ok=True)
    if campo:
        fondo, aro, a, pepita = TINTA, ORO_CLARO, PAPEL, ORO_CLARO
        esc_any, esc_mask = 0.64, 0.58
    else:
        fondo, aro, a, pepita = PAPEL, ORO, TINTA, ORO
        esc_any, esc_mask = 0.76, 0.68
    def hacer(nombre, tam, esc, cam=campo):
        render(tam, fondo, aro, a, pepita, esc, cam).save(carpeta / nombre, optimize=True)
    hacer("icon-192.png", 192, esc_any)
    hacer("icon-512.png", 512, esc_any)
    hacer("icon-maskable-512.png", 512, esc_mask)  # zona segura: todo dentro del circulo central de 80%
    hacer("apple-touch-icon.png", 180, esc_any)
    hacer("favicon-32.png", 32, 0.90 if not campo else 0.74)


if __name__ == "__main__":
    generar(RAIZ / "icons", campo=False)
    generar(RAIZ / "campo" / "icons", campo=True)
    print("Iconos generados.")
