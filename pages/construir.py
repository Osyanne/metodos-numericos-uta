"""Arma el sitio estatico de GitHub Pages en una carpeta.

    python pages/construir.py _site

El sitio es la interfaz de web/ tal cual, mas dos piezas:

- `codigo.zip` con los paquetes `core` y `api`, que Pyodide descomprime y
  ejecuta en el navegador. Es el mismo codigo que sirve uvicorn en local.
- `puente.js`, que carga Pyodide y le pasa a FastAPI cada pedido a `api/`.

web/ no se modifica: el script se inserta en la copia de index.html.
"""
from __future__ import annotations

import shutil
import sys
import zipfile
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
WEB = RAIZ / "web"
PUENTE = RAIZ / "pages" / "puente.js"
PAQUETES = ("core", "api")

ETIQUETA_APP = '<script type="module" src="app.js"></script>'
ETIQUETA_PUENTE = '<script src="puente.js"></script>'


def construir(destino: Path) -> Path:
    destino = Path(destino)
    if destino.exists():
        shutil.rmtree(destino)
    shutil.copytree(WEB, destino, ignore=shutil.ignore_patterns(".gitkeep"))

    index = destino / "index.html"
    html = index.read_text(encoding="utf-8")
    if html.count(ETIQUETA_APP) != 1:
        raise SystemExit(
            f"index.html tiene que cargar app.js exactamente una vez con "
            f"{ETIQUETA_APP!r}; el puente se inserta justo antes."
        )
    index.write_text(
        html.replace(ETIQUETA_APP, f"{ETIQUETA_PUENTE}\n{ETIQUETA_APP}"),
        encoding="utf-8",
    )

    shutil.copy2(PUENTE, destino / "puente.js")

    with zipfile.ZipFile(destino / "codigo.zip", "w", zipfile.ZIP_DEFLATED) as zf:
        for paquete in PAQUETES:
            for archivo in sorted((RAIZ / paquete).rglob("*.py")):
                zf.write(archivo, archivo.relative_to(RAIZ).as_posix())

    # Sin esto Pages pasa el sitio por Jekyll, que ignora lo que empieza con _.
    (destino / ".nojekyll").write_text("", encoding="utf-8")
    return destino


if __name__ == "__main__":
    salida = construir(Path(sys.argv[1] if len(sys.argv) > 1 else "_site"))
    print(f"Sitio armado en {salida}")
