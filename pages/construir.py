"""Arma el sitio estatico de GitHub Pages en una carpeta.

    python pages/construir.py _site

El sitio es la interfaz de web/ tal cual, mas dos piezas:

- `codigo.zip` con los paquetes `core` y `api`, que Pyodide descomprime y
  ejecuta en el navegador. Es el mismo codigo que sirve uvicorn en local.
- `puente.js`, que carga Pyodide y le pasa a FastAPI cada pedido a `api/`.
- `catalogo.json`, la respuesta de GET api/methods sacada de la misma
  aplicacion FastAPI al armar, para pintar la interfaz sin esperar a Python.

web/ no se modifica: el script se inserta en la copia de index.html.
"""
from __future__ import annotations

import re
import shutil
import sys
import zipfile
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
WEB = RAIZ / "web"
PUENTE = RAIZ / "pages" / "puente.js"
PAQUETES = ("core", "api")
CATALOGO = "catalogo.json"

ETIQUETA_APP = '<script type="module" src="app.js"></script>'
# Pyodide se baja de un CDN con la version fija que declara puente.js; de ahi
# se lee para que el adelanto de descargas y el puente no se desincronicen.
PATRON_PYODIDE = re.compile(r'var PYODIDE = "([^"]+)";')
# (archivo de Pyodide, como se baja): el script es un <script>; el resto, fetch.
DESCARGAS_PYODIDE = (
    ("pyodide.js", "script"),
    ("pyodide.asm.wasm", "fetch"),
    ("python_stdlib.zip", "fetch"),
    ("pyodide-lock.json", "fetch"),
)
ETIQUETA_PUENTE = '<script src="puente.js"></script>'


def catalogo() -> bytes:
    """Lo que contesta GET api/methods, pedido a la aplicacion de verdad."""
    sys.path.insert(0, str(RAIZ))
    from fastapi.testclient import TestClient

    from api.main import create_app

    # create_app() recarga el registro: no depende de lo que haya dejado antes
    # otro codigo en este mismo proceso (las pruebas lo vacian).
    respuesta = TestClient(create_app()).get("/api/methods")
    if respuesta.status_code != 200:
        raise SystemExit(f"GET /api/methods dio {respuesta.status_code}")
    return respuesta.content


def adelantos(modulos: list[str]) -> str:
    """Pistas <link> para que el navegador empiece a bajar todo desde el HTML.

    Sin ellas, codigo.zip y Pyodide esperan a que se ejecute el puente, y los
    modulos de web/ se descubren de a uno, cuando app.js importa al siguiente.
    """
    encontrado = PATRON_PYODIDE.search(PUENTE.read_text(encoding="utf-8"))
    if not encontrado:
        raise SystemExit('puente.js tiene que declarar la direccion de Pyodide con var PYODIDE = "...";')
    cdn = encontrado.group(1)
    origen = re.match(r"https?://[^/]+", cdn).group(0)

    lineas = [f'<link rel="preconnect" href="{origen}" crossorigin>']
    lineas.append('<link rel="preload" href="codigo.zip" as="fetch" crossorigin>')
    for archivo, como in DESCARGAS_PYODIDE:
        # fetch() de otro origen es una peticion CORS: sin crossorigin el
        # preload no se reutiliza y el archivo se baja dos veces.
        extra = " crossorigin" if como == "fetch" else ""
        lineas.append(f'<link rel="preload" href="{cdn}{archivo}" as="{como}"{extra}>')
    lineas.extend(f'<link rel="modulepreload" href="{m}">' for m in modulos)
    return "".join(f"  {linea}\n" for linea in lineas)


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
    if html.count("</head>") != 1:
        raise SystemExit("index.html tiene que cerrar <head> exactamente una vez.")
    # Los modulos son los .js de la carpeta, no una lista escrita a mano:
    # app.js los importa en cascada y un modulo nuevo entra solo.
    modulos = sorted(archivo.name for archivo in destino.glob("*.js"))
    html = html.replace("</head>", f"{adelantos(modulos)}</head>")
    index.write_text(
        html.replace(ETIQUETA_APP, f"{ETIQUETA_PUENTE}\n{ETIQUETA_APP}"),
        encoding="utf-8",
    )

    shutil.copy2(PUENTE, destino / "puente.js")
    (destino / CATALOGO).write_bytes(catalogo())

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
