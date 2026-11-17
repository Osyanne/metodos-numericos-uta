"""El sitio de GitHub Pages se arma con lo que hay en el repositorio.

Pages sirve el aplicativo bajo /metodos-numericos-uta/, no en la raiz, y sin
servidor de Python: el nucleo corre en el navegador desde codigo.zip. Estas
pruebas no levantan un navegador (eso lo hace tests/pages/sitio.spec.js); fijan
lo que, si se rompe, deja el sitio en blanco sin que falle nada en local.
"""
from __future__ import annotations

import importlib.util
import json
import re
import zipfile
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]

# pages/ no es un paquete del aplicativo: se carga por ruta.
_spec = importlib.util.spec_from_file_location("construir", RAIZ / "pages" / "construir.py")
construir = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(construir)


def test_el_sitio_lleva_la_interfaz_el_puente_y_el_codigo(tmp_path):
    sitio = construir.construir(tmp_path / "sitio")

    for archivo in (RAIZ / "web").iterdir():
        if archivo.name != ".gitkeep":
            assert (sitio / archivo.name).is_file(), f"falta {archivo.name}"
    assert (sitio / "puente.js").is_file()
    assert (sitio / ".nojekyll").is_file()

    with zipfile.ZipFile(sitio / "codigo.zip") as zf:
        empaquetados = set(zf.namelist())
    esperados = {
        archivo.relative_to(RAIZ).as_posix()
        for paquete in ("core", "api")
        for archivo in (RAIZ / paquete).rglob("*.py")
    }
    assert empaquetados == esperados


def test_el_puente_se_carga_antes_que_app_js(tmp_path):
    """app.js pide la lista de metodos apenas arranca: fetch ya tiene que
    estar reemplazado, o ese pedido sale a la red y da 404."""
    html = (construir.construir(tmp_path / "sitio") / "index.html").read_text(encoding="utf-8")
    assert html.index('src="puente.js"') < html.index('src="app.js"')
    # web/ queda intacto: la version local no sabe nada del puente.
    assert "puente.js" not in (RAIZ / "web" / "index.html").read_text(encoding="utf-8")


def test_la_interfaz_no_usa_rutas_absolutas():
    """En Pages, "/app.js" apunta a la raiz del dominio y no al proyecto."""
    web = RAIZ / "web"
    html = (web / "index.html").read_text(encoding="utf-8")
    assert not re.findall(r'(?:src|href)="/(?!/)', html)
    for archivo in web.glob("*.js"):
        texto = archivo.read_text(encoding="utf-8")
        assert not re.findall(r'["`]/api/', texto), f"{archivo.name} pide /api/ absoluto"


def test_el_sitio_lleva_el_catalogo_que_da_la_api(tmp_path):
    """La lista de metodos se pinta desde este archivo mientras Python carga:
    tiene que ser lo que contesta GET api/methods, no una copia a mano."""
    from fastapi.testclient import TestClient

    from api.main import create_app

    sitio = construir.construir(tmp_path / "sitio")
    estatico = json.loads((sitio / "catalogo.json").read_text(encoding="utf-8"))
    en_vivo = TestClient(create_app(), raise_server_exceptions=False).get("/api/methods")
    assert en_vivo.status_code == 200
    assert estatico == en_vivo.json()
    assert len(estatico) > 0


def test_el_puente_contesta_la_lista_de_metodos_desde_el_catalogo():
    puente = (RAIZ / "pages" / "puente.js").read_text(encoding="utf-8")
    assert "catalogo.json" in puente


def test_el_html_armado_adelanta_las_descargas(tmp_path):
    """El navegador tiene que enterarse desde el HTML de lo que va a necesitar:
    codigo.zip, Pyodide y los modulos de web/, que app.js importa en cascada."""
    sitio = construir.construir(tmp_path / "sitio")
    html = (sitio / "index.html").read_text(encoding="utf-8")
    cabeza = html[: html.index("</head>")]

    assert 'rel="preconnect" href="https://cdn.jsdelivr.net"' in cabeza
    assert 'rel="preload" href="codigo.zip" as="fetch" crossorigin' in cabeza
    for archivo in ("pyodide.js", "pyodide.asm.wasm", "python_stdlib.zip"):
        assert re.search(rf'rel="preload" href="https://cdn\.jsdelivr\.net/pyodide/v[\d.]+/full/{re.escape(archivo)}"', cabeza)
    # La version sale de puente.js: no hay otra escrita aparte.
    version = re.search(r'var PYODIDE = "([^"]+)"', (RAIZ / "pages" / "puente.js").read_text(encoding="utf-8")).group(1)
    assert f'href="{version}pyodide.asm.wasm"' in cabeza

    # La lista de modulos sale de la carpeta: todos los .js de web/, ni mas ni menos.
    esperados = sorted(archivo.name for archivo in (RAIZ / "web").glob("*.js"))
    assert re.findall(r'rel="modulepreload" href="([^"]+)"', cabeza) == esperados
    assert "modulepreload" not in (RAIZ / "web" / "index.html").read_text(encoding="utf-8")


def test_el_service_worker_guarda_todo_el_sitio_con_la_version_del_armado(tmp_path):
    """sw.js lleva la lista de archivos y un nombre de cache que cambia con el
    contenido: tras un despliegue no se puede seguir sirviendo lo anterior."""
    sitio = construir.construir(tmp_path / "a")
    sw = (sitio / "sw.js").read_text(encoding="utf-8")
    assert "__" not in sw, "quedo un marcador sin reemplazar"

    archivos = json.loads(re.search(r"var ARCHIVOS = (\[.*?\]);", sw, re.S).group(1))
    presentes = {
        archivo.relative_to(sitio).as_posix()
        for archivo in sitio.rglob("*")
        if archivo.is_file() and archivo.name != "sw.js"
    }
    assert set(archivos) - {"./"} == presentes
    assert "./" in archivos

    # Mismo contenido, misma version; otro contenido, otra version.
    version = re.search(r'var VERSION = "([0-9a-f]+)"', sw).group(1)
    otra = construir.construir(tmp_path / "b")
    assert re.search(r'var VERSION = "([0-9a-f]+)"', (otra / "sw.js").read_text(encoding="utf-8")).group(1) == version
    (otra / "app.js").write_text("// cambio", encoding="utf-8")
    assert construir.version_del_sitio(otra) != version


def test_el_puente_registra_el_service_worker_con_ruta_relativa():
    """Bajo /metodos-numericos-uta/ una ruta absoluta apuntaria a la raiz del dominio."""
    puente = (RAIZ / "pages" / "puente.js").read_text(encoding="utf-8")
    assert 'register("sw.js")' in puente
